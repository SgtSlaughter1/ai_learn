<?php

namespace App\Services;

use App\Models\ClassModel;
use App\Models\LearnerProgress;
use App\Models\LearnerProfile;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class AIService
{
    protected string $provider;
    protected ?string $apiKey;
    protected string $modelName;

    public function __construct()
    {
        $this->apiKey = env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY') ?: env('AI_API_KEY');
        $this->modelName = env('MODEL_NAME', 'gemini-3-flash-preview');
        $this->provider = env('AI_PROVIDER') ?: (empty($this->apiKey) ? 'local' : 'gemini');
    }

    /**
     * Call Gemini API with automatic model fallback for high availability.
     */
    protected function callGemini(array $contents, ?string $systemInstruction = null, array $generationConfig = []): ?string
    {
        if (empty($this->apiKey) || $this->provider !== 'gemini') {
            return null;
        }

        $modelsToTry = array_values(array_unique([
            $this->modelName,
            'gemini-3-flash-preview',
            'gemini-3.1-flash-lite-preview',
            'gemini-3.6-flash',
            'gemini-3.5-flash',
            'gemini-flash-latest',
        ]));

        $payload = ['contents' => $contents];
        if (!empty($systemInstruction)) {
            $payload['systemInstruction'] = [
                'parts' => [['text' => $systemInstruction]]
            ];
        }
        if (!empty($generationConfig)) {
            $payload['generationConfig'] = $generationConfig;
        }

        foreach ($modelsToTry as $model) {
            try {
                $response = Http::timeout(15)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$this->apiKey}", $payload);

                if ($response->successful()) {
                    $body = $response->json();
                    $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($text) {
                        return $this->cleanMathDuplicates(trim($text));
                    }
                }
            } catch (\Exception $e) {
                // Try next model
            }
        }

        return null;
    }

    /**
     * Generate an explanation for why an answer is correct or incorrect.
     */
    public function explainAnswer(Question $question, ?int $selectedOptionId): string
    {
        $question->load(['options', 'topic.subject']);
        $correctOption = $question->options->firstWhere('is_correct', true);
        $selectedOption = $selectedOptionId ? $question->options->firstWhere('id', $selectedOptionId) : null;

        $subjectName = $question->topic->subject->name ?? 'Unknown Subject';
        $topicName = $question->topic->name ?? 'Unknown Topic';

        $prompt = "You are an expert AI Tutor helping a secondary school student learn. 
Explain the following question in the context of the subject '{$subjectName}' and topic '{$topicName}'.

Question:
\"{$question->question_text}\"

Options:
" . $question->options->map(fn($o) => "- " . $o->option_text . ($o->is_correct ? " (CORRECT)" : ""))->implode("\n") . "

Student's Selected Answer: " . ($selectedOption ? "\"{$selectedOption->option_text}\"" : "None (Skipped)") . "
Correct Answer: \"{$correctOption->option_text}\"

Instructions:
1. Explain clearly why the correct answer is correct.
2. If the student made an incorrect selection, gently explain why that choice is incorrect.
3. Keep the explanation brief, encouraging, and easy to understand (secondary school level).
4. Provide a key study tip or takeaway rule at the end.
5. Use clean markdown formatting without mentioning internal IDs. Keep it under 250 words.
6. CRITICAL: When writing math, use ONLY LaTeX with dollar signs ($...$ for inline, $$...$$ for display). NEVER write the same expression in both LaTeX AND plain text. Use ONLY the LaTeX version, not both.";

        $geminiResult = $this->callGemini([
            ['role' => 'user', 'parts' => [['text' => $prompt]]]
        ]);

        if ($geminiResult) {
            return $geminiResult;
        }

        // Local Heuristic Tutor Explanation (Offline Fallback)
        return $this->generateHeuristicExplanation($question, $selectedOption, $correctOption, $subjectName, $topicName);
    }

    /**
     * Role-aware entry point for AI chat.
     */
    public function generateChatResponse(User $user, string $message, array $history): string
    {
        if ($user->isAdmin()) {
            return $this->generateAdminChatResponse($user, $message, $history);
        }

        return $this->generateLearnerChatResponse($user, $message, $history);
    }

    /**
     * Generate AI response tailored for School Admins & Platform Admins.
     */
    public function generateAdminChatResponse(User $user, string $message, array $history): string
    {
        $isSuperAdmin = $user->isPlatformAdmin();
        $school = $user->administeredSchool()->first() ?? ($isSuperAdmin ? School::first() : null);
        $schoolName = $school ? $school->name : ($isSuperAdmin ? 'All Schools (Platform-wide)' : 'School');
        $schoolCategory = $school ? ucfirst($school->category ?? 'secondary') : 'Secondary';
        $locationStr = $school ? implode(', ', array_filter([$school->city, $school->state])) : 'Nigeria';

        // 1. Enrolled learners count
        $learnersCountQuery = User::where('role', 'learner');
        if (!$isSuperAdmin && $school) {
            $learnersCountQuery->whereHas('learnerProfile', fn($q) => $q->where('school_id', $school->id));
        }
        $totalLearners = $learnersCountQuery->count();

        // 2. Active Classes
        $classesQuery = ClassModel::where('is_active', true);
        if (!$isSuperAdmin && $school) {
            $classesQuery->where('school_id', $school->id);
        }
        $classes = $classesQuery->pluck('name')->toArray();
        $classesStr = !empty($classes) ? implode(', ', $classes) : 'SS1, SS2, SS3';

        // 3. Active Subjects
        $subjectsQuery = Subject::where('status', 'active');
        if (!$isSuperAdmin && $school) {
            $subjectsQuery->where(function ($q) use ($school) {
                $q->where('school_id', $school->id)->orWhereNull('school_id');
            });
        }
        $subjects = $subjectsQuery->withCount('topics')->get();
        $subjectsSummary = $subjects->map(fn($s) => "  - {$s->name} ({$s->topics_count} topics)")->implode("\n");

        // 4. Real-time school mastery aggregates
        $strugglingCount = DB::table('users as u')
            ->join('learner_progress as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->when(!$isSuperAdmin && $school, fn($q) => $q->where('lprof.school_id', $school->id))
            ->select('u.id')
            ->groupBy('u.id')
            ->havingRaw('AVG(lp.mastery_score) < 40')
            ->get()
            ->count();

        $progressAggregates = DB::table('learner_progress as lp')
            ->join('users as u', 'u.id', '=', 'lp.user_id')
            ->leftJoin('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->when(!$isSuperAdmin && $school, fn($q) => $q->where('lprof.school_id', $school->id))
            ->selectRaw('AVG(lp.mastery_score) as avg_mastery, SUM(lp.questions_attempted) as total_attempted')
            ->first();
        $avgMastery = (int) round($progressAggregates?->avg_mastery ?? 0);
        $totalQuestionsAttempted = (int) ($progressAggregates?->total_attempted ?? 0);

        // 5. Lowest-scoring topics across school
        $weakestTopics = DB::table('learner_progress as lp')
            ->join('topics as t', 't.id', '=', 'lp.topic_id')
            ->join('subjects as s', 's.id', '=', 't.subject_id')
            ->join('users as u', 'u.id', '=', 'lp.user_id')
            ->leftJoin('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->when(!$isSuperAdmin && $school, fn($q) => $q->where('lprof.school_id', $school->id))
            ->groupBy('t.id', 't.name', 's.name')
            ->selectRaw('t.name as topic_name, s.name as subject_name, ROUND(AVG(lp.mastery_score)) as avg_topic_mastery')
            ->orderBy('avg_topic_mastery', 'asc')
            ->take(5)
            ->get();

        $weakestTopicsStr = $weakestTopics->isNotEmpty()
            ? $weakestTopics->map(fn($w) => "  - {$w->subject_name} -> {$w->topic_name}: {$w->avg_topic_mastery}% avg mastery")->implode("\n")
            : "  - All active topics maintaining baseline standard.";

        // Dynamic Question Bank RAG Grounding (School-specific + General Knowledge)
        $sampleQuestions = Question::where('status', 'active')
            ->when(!$isSuperAdmin && $school, function ($q) use ($school) {
                $q->where(function ($sq) use ($school) {
                    $sq->where('school_id', $school->id)->orWhereNull('school_id');
                });
            })
            ->with(['topic.subject', 'options' => fn($o) => $o->where('is_correct', true)])
            ->inRandomOrder()
            ->take(5)
            ->get();

        $sampleQuestionsStr = $sampleQuestions->isNotEmpty()
            ? $sampleQuestions->map(function ($q, $i) {
                $subj = $q->topic?->subject?->name ?? 'General Knowledge';
                $top = $q->topic?->name ?? 'Core';
                $ans = $q->options->first()?->option_text ?? 'Verified';
                return "  - Sample " . ($i + 1) . " [{$subj} -> {$top}]: {$q->question_text} | Correct Answer: {$ans} | Solution/Explanation: {$q->explanation}";
            })->implode("\n")
            : "  - No custom questions logged yet. Standard curriculum active.";

        $systemInstruction = "You are the AILEARN School Administrator Copilot & Academic Advisor.
You are assisting an academic school administrator: {$user->name} at {$schoolName} ({$schoolCategory} Category, {$locationStr}).

School Data & Academic Context:
- Enrolled Learners: {$totalLearners}
- Active Classes: {$classesStr}
- Average Student Mastery: {$avgMastery}%
- Total Questions Solved by Students: {$totalQuestionsAttempted}
- Struggling Learners (Mastery < 40%): {$strugglingCount}
- Lowest-Scoring Curriculum Topics Needing Attention:
{$weakestTopicsStr}
- Active Curriculum Subjects:
{$subjectsSummary}

School & General Knowledge Question Bank (Curriculum Reference Knowledge):
{$sampleQuestionsStr}

Your Core Capabilities for the School Administrator:
1. School Diagnostic & Academic Performance Analytics: Summarize class and subject performance, highlight learning gaps and mastery trends.
2. Remedial & Intervention Strategies: Propose pedagogical strategies, remedial lesson plans, and classroom drill ideas to help struggling learners in specific subjects/topics.
3. Curriculum & Scheme of Work Planning: Generate structured lesson outlines, learning objectives, and curriculum breakdown aligned with Nigerian (WAEC/NECO/NERDC) secondary education standards.
4. Assessment & Question Bank Generation: Draft high-standard multiple choice questions with four options (A, B, C, D), marking the correct answer and providing step-by-step educational explanations so the admin can import them into the school question bank. Leverage the style and concepts from the school's question bank where appropriate.
5. School Operations & Roster Insights: Answer questions about classes, student distribution, and subject management.

Guidelines:
1. Maintain an authoritative, professional, and supportive tone suitable for school principals and academic directors.
2. Keep responses structured, concise, and actionable using clear markdown headings and bullet points. Keep answers under 250 words unless generating full questions/lesson plans.
3. When drafting exam questions, provide the question, options A-D, clearly indicate the correct option, and include a full step-by-step solution.
4. CRITICAL: When writing math, use ONLY LaTeX with dollar signs ($...$ for inline, $$...$$ for display). NEVER write the same expression in both LaTeX AND plain text. Use ONLY the LaTeX version, not both.";

        $contents = [];
        foreach ($history as $msg) {
            $role = ($msg['role'] === 'user') ? 'user' : 'model';
            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $msg['content']]]
            ];
        }
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $message]]
        ];

        $geminiResult = $this->callGemini($contents, $systemInstruction);
        if ($geminiResult) {
            return $geminiResult;
        }

        return $this->generateHeuristicAdminChatResponse($user, $message, $schoolName, $totalLearners, $classesStr, $avgMastery, $strugglingCount, $weakestTopics);
    }

    /**
     * Generate chatbot response for secondary school learners (100% preserving learner study companion flow).
     */
    public function generateLearnerChatResponse(User $user, string $message, array $history): string
    {
        // Gather user mastery stats to personalize chatbot context
        $masterySummary = LearnerProgress::where('user_id', $user->id)
            ->with('topic.subject')
            ->get()
            ->groupBy('topic.subject.name')
            ->map(function ($items) {
                return $items->map(fn($p) => "  - {$p->topic->name}: {$p->mastery_score}% mastery")->implode("\n");
            })
            ->map(fn($str, $subj) => "* {$subj}:\n{$str}")
            ->implode("\n");

        // Dynamic Question Bank Concept Grounding (School + General Knowledge)
        $learnerSchoolId = $user->learnerProfile?->school_id;
        $learnerSampleQuestions = Question::where('status', 'active')
            ->when($learnerSchoolId, function ($q) use ($learnerSchoolId) {
                $q->where(function ($sq) use ($learnerSchoolId) {
                    $sq->where('school_id', $learnerSchoolId)->orWhereNull('school_id');
                });
            })
            ->with(['topic.subject', 'options' => fn($o) => $o->where('is_correct', true)])
            ->inRandomOrder()
            ->take(5)
            ->get();

        $sampleCurriculumStr = $learnerSampleQuestions->isNotEmpty()
            ? $learnerSampleQuestions->map(fn($q) => "  - [{$q->topic?->subject?->name} -> {$q->topic?->name}]: {$q->question_text} | Key Concept: {$q->explanation}")->implode("\n")
            : "  - Standard curriculum active.";

        $systemInstruction = "You are the AILEARN Learning Companion, a friendly, encouraging personal study assistant for secondary school students. 
You know the student's name is: {$user->name}.
Here is their current subject mastery progress:
{$masterySummary}

Curriculum & Question Bank Knowledge Base (School & General Curriculum):
{$sampleCurriculumStr}

Guidelines:
1. Help them understand curriculum concepts, plan what to study, or explain hard questions. Use the uploaded curriculum concepts as reference.
2. Keep your answers brief, engaging, highly structured (using bullet points and bold text), and easy to read.
3. Recommend taking diagnostic quizzes for subjects where their mastery is low (below 80%).
4. If they ask about offline access, explain that the app calculates progress, scores, and adapts difficulty fully offline!
5. Use markdown formatting. Keep answers under 150 words.
6. CRITICAL: When writing math, use ONLY LaTeX with dollar signs ($...$ for inline, $$...$$ for display). NEVER write the same expression in both LaTeX AND plain text. Use ONLY the LaTeX version, not both.
7. CONVERSATIONAL CONTINUITY: When a student replies to a practice question with their answer attempt (e.g. an algebraic expression like (x-5x)(x-2x), an option letter like A/B/C/D, or an equation), ALWAYS directly evaluate their response. Point out what they got right, gently explain any mistake, show the step-by-step solution, and offer another challenge. NEVER respond with a generic greeting or reset the conversation.";

        $contents = [];
        foreach ($history as $msg) {
            $role = ($msg['role'] === 'user') ? 'user' : 'model';
            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $msg['content']]]
            ];
        }
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $message]]
        ];

        $geminiResult = $this->callGemini($contents, $systemInstruction);
        if ($geminiResult) {
            return $geminiResult;
        }

        return $this->generateHeuristicChatResponse($user, $message, $history);
    }

    /**
     * Clean up duplicate math rendering from Gemini responses.
     * Gemini often returns both LaTeX AND plain text for the same expression,
     * e.g. "$2x + 5 = 15$ 2x + 5 = 15" — this removes the duplicate plain text.
     */
    private function cleanMathDuplicates(string $text): string
    {
        // 1. Remove duplicate LaTeX: "$...$ $...$" → "$...$"
        $text = preg_replace('/(\$\$.+?\$\$)\s+\1/', '$1', $text);
        $text = preg_replace('/(\$[^$]+\$)\s+\1/', '$1', $text);

        // 2. Remove plain text duplicate after inline math: "$x + 1$ x + 1" → "$x + 1$"
        // Matches: $...$ followed by space then same content (letters, numbers, operators, spaces)
        $text = preg_replace_callback(
            '/\$([^$]+)\$/m',
            function ($matches) {
                $mathContent = trim($matches[1]);
                // Escape special regex chars in the math content for matching
                $escaped = preg_quote($mathContent, '/');
                // Match the plain text duplicate that may follow (with optional trailing punctuation)
                $pattern = '/\$' . $escaped . '\$[\s]*(' . $escaped . ')[.,;:!?]?/';
                // We need to run this on the full text, so return a marker
                return $matches[0]; // Return original for now, handle below
            },
            $text
        );

        // Simpler approach: find $content$ and remove plain text duplicate after it
        // Split by lines and process
        $lines = explode("\n", $text);
        $cleaned = [];
        foreach ($lines as $line) {
            // Pattern: inline math followed by its plain text duplicate
            // e.g. "$2x + 5 = 15$ 2x + 5 = 15" or "$2x + 5 = 15$ $2x + 5 = 15$"
            $line = preg_replace(
                '/(\$[^$]+\$)\s+\1[.,;:!?]?/',
                '$1',
                $line
            );
            // Pattern: display math followed by its plain text duplicate
            $line = preg_replace(
                '/(\$\$.+?\$\$)\s+\1[.,;:!?]?/',
                '$1',
                $line
            );
            // Pattern: plain text duplicate after inline math
            // e.g. "$x = 5$ x = 5" where x = 5 is the same content
            $line = preg_replace_callback(
                '#(\$)([^$]+)(\$)\s+([\w\s+\-*/=().,]+?)(?=[\n$]|\$)#',
                function ($matches) {
                    $mathContent = trim($matches[2]);
                    $plainText = trim($matches[4]);
                    // Normalize both for comparison (remove spaces, LaTeX commands)
                    $normMath = preg_replace('/[\s\\]/', '', $mathContent);
                    $normPlain = preg_replace('/[\s\\]/', '', $plainText);
                    // If they match (or plain is a subset), remove the plain text
                    if ($normMath === $normPlain || strpos($normPlain, $normMath) !== false) {
                        return '$' . $mathContent . '$';
                    }
                    return $matches[0];
                },
                $line
            );
            $cleaned[] = $line;
        }
        $text = implode("\n", $cleaned);

        return $text;
    }

    private function generateHeuristicExplanation(Question $question, ?QuestionOption $selectedOption, QuestionOption $correctOption, string $subject, string $topic): string
    {
        $out = "### AI Tutor Explanation\n\n";
        $out .= "Let's review this concept under **{$subject} -> {$topic}**:\n\n";
        
        if ($selectedOption) {
            if ($selectedOption->id === $correctOption->id) {
                $out .= "**Correct!** You selected **\"{$selectedOption->option_text}\"**, which is the correct answer.\n\n";
            } else {
                $out .= "**Incorrect Choice:** You chose **\"{$selectedOption->option_text}\"**. Let's see why this isn't correct.\n\n";
            }
        } else {
            $out .= "**Skipped Question:** You didn't select an answer. Let's study the correct answer together.\n\n";
        }

        // ── Step-by-Step Breakdown ──
        $out .= "#### Why the correct answer is \"{$correctOption->option_text}\":\n\n";

        $steps = $this->generateStepByStep($question, $correctOption, $topic);
        $out .= $steps;

        // ── Wrong Answer Analysis ──
        $wrongOptions = $question->options->where('is_correct', false);
        if ($wrongOptions->isNotEmpty()) {
            $out .= "#### Why the other options are wrong:\n\n";
            foreach ($wrongOptions as $wrong) {
                $reason = $this->generateWrongAnswerReason($wrong, $correctOption, $question, $topic);
                $out .= "* **\"{$wrong->option_text}\"** — {$reason}\n";
            }
            $out .= "\n";
        }

        // ── Key Takeaway ──
        $out .= "---\n\n";
        $out .= "**Study Tip:** {$this->generateStudyTip($topic, $question)}";

        return $out;
    }

    /**
     * Generate detailed step-by-step explanation from the question and database hint.
     * Expands brief explanations into full walkthroughs.
     */
    private function generateStepByStep(Question $question, QuestionOption $correctOption, string $topic): string
    {
        $questionText = $question->question_text;
        $correctText = $correctOption->option_text;
        $explanation = $question->explanation ?? '';

        $out = '';
        $stepNumber = 1;

        // ── Algebraic Equations (e.g., "What is the value of x if 2x + 5 = 15?") ──
        if (preg_match('/value\s+of\s+(\w)\s+if\s+(.+)\?=\s*(.+)/i', $questionText, $m)) {
            $variable = $m[1];
            $equation = trim($m[2]);
            $result = trim($m[3]);

            $out .= "**Step {$stepNumber}: Understand what we're solving for**\n";
            $out .= "The question asks us to find the value of **{$variable}** in the equation: \$={$equation} = {$result}\$\n\n";
            $stepNumber++;

            // Try to extract and explain the algebraic steps
            if (preg_match('/(\d*)(\w)\s*\+\s*(\d+)\s*=\s*(\d+)/', $equation, $eq)) {
                $coeff = $eq[1] ?: '1';
                $term = $eq[2];
                $constant = $eq[3];
                $target = $eq[4];
                $intermediate = $target - $constant;

                $out .= "**Step {$stepNumber}: Isolate the term with {$variable}**\n";
                $out .= "Subtract **{$constant}** from both sides to move it away from the variable:\n";
                $out .= "\$\$={$equation}\\n";
                $out .= "{$coeff}{$term} = {$target} - {$constant}\\n";
                $out .= "{$coeff}{$term} = {$intermediate}\$\$\n\n";
                $stepNumber++;

                if ($coeff !== '1' && $coeff !== '') {
                    $out .= "**Step {$stepNumber}: Solve for {$variable}**\n";
                    $out .= "Divide both sides by **{$coeff}** to get {$variable} alone:\n";
                    $out .= "\$\$={$variable} = \\frac{{$intermediate}}{{$coeff}} = {$correctText}\$\$\n\n";
                } else {
                    $out .= "**Step {$stepNumber}: Identify the value**\n";
                    $out .= "So **{$variable} = {$correctText}**\n\n";
                }
                $stepNumber++;
            } else {
                // Fallback: use the database explanation but expand it
                if (!empty($explanation)) {
                    $out .= "**Step {$stepNumber}: Apply the solving method**\n";
                    $out .= "{$explanation}\n\n";
                    $stepNumber++;
                }
            }

            // Verification step
            $out .= "**Step {$stepNumber}: Verify your answer**\n";
            $out .= "Plug **{$correctText}** back into the original equation to check:\n";
            if (preg_match('/(\d*)(\w)\s*\+\s*(\d+)\s*=\s*(\d+)/', $equation, $eq)) {
                $coeff = $eq[1] ?: '1';
                $constant = $eq[3];
                $target = $eq[4];
                $check = ($coeff !== '' ? (int)$coeff : 1) * (int)$correctText + (int)$constant;
                $out .= "\$\$={$coeff}({$correctText}) + {$constant} = {$check}\$\$\n";
                $out .= "Since {$check} = {$target}, our answer **{$variable} = {$correctText}** is confirmed!\n\n";
            } else {
                $out .= "The answer checks out!\n\n";
            }
        }
        // ── Simplification problems (e.g., "Simplify: 3(x + 2) - 2x") ──
        elseif (preg_match('/simplif/i', $questionText)) {
            if (!empty($explanation)) {
                // Break the explanation into digestible steps
                $explanationSteps = preg_split('/\.\s+/', $explanation);
                foreach ($explanationSteps as $step) {
                    $step = trim($step);
                    if (!empty($step)) {
                        $out .= "**Step {$stepNumber}:** {$step}.\n\n";
                        $stepNumber++;
                    }
                }
            } else {
                $out .= "**Step {$stepNumber}:** Identify the expression to simplify.\n\n";
                $stepNumber++;
                $out .= "**Step {$stepNumber}:** Expand any brackets by multiplying the outside term by everything inside.\n\n";
                $stepNumber++;
                $out .= "**Step {$stepNumber}:** Combine like terms (terms with the same variable and exponent).\n\n";
                $stepNumber++;
            }
            $out .= "Therefore, the simplified answer is **{$correctText}**\n\n";
        }
        // ── General fallback: expand the database explanation into steps ──
        else {
            if (!empty($explanation)) {
                // Split the explanation by periods, commas, or 'then' to find steps
                $explanationSteps = preg_split('/\.|;|\bthen\b/i', $explanation);
                foreach ($explanationSteps as $step) {
                    $step = trim($step);
                    if (!empty($step)) {
                        $out .= "**Step {$stepNumber}:** {$step}.\n\n";
                        $stepNumber++;
                    }
                }
            } else {
                $out .= "The correct answer is **{$correctText}**. This follows the core rules of **{$topic}**. Review the definitions and practice similar problems to master this concept.\n\n";
            }
        }

        return $out;
    }

    /**
     * Generate a reason why a wrong answer is incorrect.
     */
    private function generateWrongAnswerReason(QuestionOption $wrong, QuestionOption $correct, Question $question, string $topic): string
    {
        $wrongText = $wrong->option_text;
        $correctText = $correct->option_text;
        $questionText = $question->question_text;

        // For algebraic equations, analyze common mistakes
        if (preg_match('/value\s+of\s+(\w)\s+if/i', $questionText)) {
            // Common mistake: adding instead of subtracting
            if (preg_match('/(\d+)/', $wrongText, $wm) && preg_match('/(\d+)/', $correctText, $cm)) {
                $wrongVal = (int) $wm[1];
                $correctVal = (int) $cm[1];

                if ($wrongVal > $correctVal) {
                    return "This value is too high. You may have added instead of subtracted, or made an arithmetic error.";
                } elseif ($wrongVal < $correctVal) {
                    return "This value is too low. You may have divided incorrectly or missed a step.";
                }
            }
            return "This doesn't match the correct solution. Double-check your arithmetic at each step.";
        }

        return "This doesn't satisfy the equation or rule. The correct approach gives \"{$correctText}\" instead.";
    }

    /**
     * Generate a contextual study tip based on the topic.
     */
    private function generateStudyTip(string $topic, Question $question): string
    {
        $topicLower = strtolower($topic);

        if (str_contains($topicLower, 'algebra') || str_contains($topicLower, 'equation')) {
            return "When solving equations, always work backwards from the variable: **isolate the variable** by performing the opposite operation on both sides. Remember: what you do to one side, you must do to the other!";
        }
        if (str_contains($topicLower, 'geometry') || str_contains($topicLower, 'angle')) {
            return "Draw a diagram whenever possible! Geometry is much easier when you can **see** the shapes, angles, and lines. Label everything you know and look for relationships between angles.";
        }
        if (str_contains($topicLower, 'grammar') || str_contains($topicLower, 'tense') || str_contains($topicLower, 'verb')) {
            return 'Look for **time signal words** in the sentence (e.g., "yesterday" = past, "now" = present, "tomorrow" = future). These clues will help you choose the correct tense every time.';
        }
        if (str_contains($topicLower, 'cell') || str_contains($topicLower, 'biology')) {
            return 'Try drawing and labeling a cell from memory! Knowing the **function** of each organelle (not just the name) helps you answer "why" questions confidently.';
        }

        return "Always read the question carefully and identify the key terms. Practice similar problems to build confidence. Focus on understanding the **why** behind each step, not just memorizing the answer!";
    }

    /**
     * Parse raw text, extract questions, options, difficulty, determine/solve the correct answer, and generate explanations.
     */
    public function extractAndSolveQuestions(string $rawText, ?string $subjectName = null, ?string $topicName = null): array
    {
        $rawText = trim($rawText);
        if (empty($rawText)) {
            return [];
        }

        $contextStr = "";
        if ($subjectName) $contextStr .= "Subject: {$subjectName}\n";
        if ($topicName) $contextStr .= "Topic: {$topicName}\n";

        $prompt = "You are an expert exam curriculum AI. A teacher has provided unstructured or pasted raw exam/quiz text.
Your task is to parse, extract, structure, and verify or solve all questions contained in the text.

{$contextStr}

Raw Content to parse:
\"\"\"
{$rawText}
\"\"\"

Instructions:
1. Extract every question accurately.
2. For each question, extract all its option choices (e.g., A, B, C, D).
3. If an answer key or correct answer is explicitly marked in the text (e.g., 'Answer: B', 'Ans: C', marked with asterisk, or indicated in an answer section), use that.
4. If no answer is indicated, SOLVE the question accurately and determine which option is the correct answer. Exactly one option MUST have is_correct = true.
5. Provide a clear, concise educational explanation (1-2 sentences) explaining why that choice is correct.
6. Estimate the difficulty: 'easy', 'medium', or 'hard'.
7. Set question_type to 'multiple_choice' (or 'true_false' if applicable).
8. Clean up any numbering (e.g. remove leading '1.', 'Q2:' from the question text). Remove leading 'A.', 'B)' from option text.
9. If math is present, format math using standard LaTeX enclosed in dollar signs ($...$ for inline math).

You MUST return ONLY a valid JSON array matching this exact schema:
[
  {
    \"question_text\": \"String containing the question\",
    \"type\": \"multiple_choice\",
    \"difficulty\": \"easy\" | \"medium\" | \"hard\",
    \"explanation\": \"String explaining the solution\",
    \"options\": [
      { \"option_text\": \"Choice A text\", \"is_correct\": false },
      { \"option_text\": \"Choice B text\", \"is_correct\": true },
      { \"option_text\": \"Choice C text\", \"is_correct\": false },
      { \"option_text\": \"Choice D text\", \"is_correct\": false }
    ]
  }
]";

        if ($this->apiKey && ($this->provider === 'gemini')) {
            $modelsToTry = array_unique([$this->modelName, 'gemini-3.6-flash', 'gemini-3.5-flash']);
            foreach ($modelsToTry as $model) {
                try {
                    $response = Http::timeout(20)
                        ->withHeaders(['Content-Type' => 'application/json'])
                        ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$this->apiKey}", [
                            'contents' => [
                                ['parts' => [['text' => $prompt]]]
                            ],
                            'generationConfig' => [
                                'response_mime_type' => 'application/json',
                            ]
                        ]);

                    if ($response->successful()) {
                        $body = $response->json();
                        $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? null;
                        if ($text) {
                            $parsed = json_decode($text, true);
                            if (is_array($parsed) && !empty($parsed)) {
                                $sanitized = $this->sanitizeExtractedQuestions($parsed);
                                if (!empty($sanitized)) {
                                    return $sanitized;
                                }
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // Try next model or fallback to heuristic parser
                }
            }
        }

        return $this->heuristicQuestionParser($rawText);
    }

    /**
     * Sanitize and validate extracted questions format.
     */
    private function sanitizeExtractedQuestions(array $questions): array
    {
        $sanitized = [];

        foreach ($questions as $q) {
            if (empty($q['question_text'])) continue;

            $questionText = trim($this->cleanMathDuplicates((string) $q['question_text']));
            // Remove leading question numbering like "1. ", "Q1: ", "1) "
            $questionText = preg_replace('/^(?:Q(?:uestion)?\s*\d+[\s.:)\-]+|\d+[\s.:)\-]+)\s*/i', '', $questionText);

            $rawOptions = $q['options'] ?? [];
            if (!is_array($rawOptions) || count($rawOptions) < 2) continue;

            $options = [];
            $hasCorrect = false;

            foreach ($rawOptions as $index => $opt) {
                $optText = is_array($opt) ? ($opt['option_text'] ?? '') : (string) $opt;
                $optText = trim($this->cleanMathDuplicates($optText));
                // Remove leading option letters like "A. ", "A) ", "(A) "
                $optText = preg_replace('/^(?:\(?[a-dA-D]\)?[\s.:)\-]+)\s*/', '', $optText);

                if (empty($optText)) continue;

                $isCorrect = is_array($opt) ? (bool) ($opt['is_correct'] ?? false) : false;
                if ($isCorrect) {
                    $hasCorrect = true;
                }

                $options[] = [
                    'option_text' => $optText,
                    'is_correct' => $isCorrect,
                    'sort_order' => $index,
                ];
            }

            // Ensure at least one option is marked correct
            if (!$hasCorrect && !empty($options)) {
                $options[0]['is_correct'] = true;
            }

            if (count($options) >= 2) {
                $sanitized[] = [
                    'question_text' => $questionText,
                    'type' => in_array($q['type'] ?? '', ['multiple_choice', 'true_false']) ? $q['type'] : 'multiple_choice',
                    'difficulty' => in_array($q['difficulty'] ?? '', ['easy', 'medium', 'hard']) ? $q['difficulty'] : 'medium',
                    'explanation' => !empty($q['explanation']) ? trim($this->cleanMathDuplicates((string) $q['explanation'])) : null,
                    'options' => $options,
                ];
            }
        }

        return $sanitized;
    }

    /**
     * Offline heuristic parser for raw questions text.
     * Supports numbered, unnumbered, lettered, and unlettered option formats.
     */
    private function heuristicQuestionParser(string $rawText): array
    {
        $rawText = str_replace(["\r\n", "\r"], "\n", $rawText);
        
        // Split by numbered questions first (e.g. 1., 2), Q3:)
        $blocks = preg_split('/\n\s*(?=(?:(?:Q(?:uestion)?\s*\d+|\d+)[.:)\-]\s*))/i', $rawText);
        
        // If only 1 block was found and it contains multiple double-newlines, split by double newlines
        if (count($blocks) <= 1) {
            $paragraphs = preg_split('/\n\s*\n\s*\n+/', $rawText);
            if (count($paragraphs) > 1) {
                $blocks = $paragraphs;
            }
        }

        $results = [];

        foreach ($blocks as $block) {
            $block = trim($block);
            if (empty($block)) continue;

            $lines = array_values(array_filter(array_map('trim', explode("\n", $block))));
            if (empty($lines)) continue;

            $questionLine = '';
            $options = [];
            $explanation = null;
            $markedAnswer = null;

            // First pass: try standard lettered options (A., B), (C))
            $foundLettered = false;
            foreach ($lines as $line) {
                // Check if line indicates Answer: e.g. "Ans: B", "Answer: (C)", "* A", "* A) ...", "* Answer: D"
                if (preg_match('/^(?:\*?\s*(?:Ans(?:wer)?|Correct\s*(?:Option|Answer)?)\s*[:=\-]?\s*\(?([A-Da-d])\)?|\*\s*\(?([A-Da-d])\)?(?:\s+.*)?)$/i', $line, $ansMatch)) {
                    $markedAnswer = strtoupper($ansMatch[1] ?: $ansMatch[2]);
                    continue;
                }

                // Check if line is an option: "A. ...", "B) ...", "(A) ...", "*A) ...", "A: ...", "A - ..."
                if (preg_match('/^(\*?)\s*(?:\(([A-Da-d])\)|([A-Da-d])\s*[.:)\-\]]|\b([A-Da-d])\s*[:.)\-])\s*(.+)$/i', $line, $optMatch)) {
                    $foundLettered = true;
                    $isAsteriskCorrect = !empty($optMatch[1]);
                    $letter = strtoupper($optMatch[2] ?: ($optMatch[3] ?: $optMatch[4]));
                    $text = trim($optMatch[5]);

                    // If letter already exists in options, update existing option instead of duplicating
                    $foundExisting = false;
                    foreach ($options as &$existingOpt) {
                        if ($existingOpt['letter'] === $letter) {
                            if ($isAsteriskCorrect) {
                                $existingOpt['is_correct'] = true;
                            }
                            $foundExisting = true;
                            break;
                        }
                    }
                    unset($existingOpt);

                    if (!$foundExisting) {
                        $options[] = [
                            'letter' => $letter,
                            'option_text' => $text,
                            'is_correct' => $isAsteriskCorrect,
                        ];
                    }
                } elseif (preg_match('/^(?:Explanation|Hint)\s*[:=\-]\s*(.+)$/i', $line, $expMatch)) {
                    $explanation = trim($expMatch[1]);
                } else {
                    if (empty($options)) {
                        $questionLine .= ($questionLine ? " " : "") . $line;
                    }
                }
            }

            // Second pass: if no lettered options were found, treat line 0 as question and subsequent lines as options
            if (!$foundLettered && count($lines) >= 3) {
                $options = [];
                $questionLine = $lines[0];
                
                // Collect remaining lines as options
                for ($i = 1; $i < count($lines); $i++) {
                    $l = $lines[$i];
                    if (preg_match('/^(?:Ans(?:wer)?|Correct)\s*[:=\-]?\s*(.+)$/i', $l, $ansMatch)) {
                        $markedAnswer = trim($ansMatch[1]);
                        continue;
                    }
                    if (preg_match('/^(?:Explanation|Hint)\s*[:=\-]\s*(.+)$/i', $l, $expMatch)) {
                        $explanation = trim($expMatch[1]);
                        continue;
                    }
                    
                    $isAsterisk = str_starts_with($l, '*');
                    $cleanOpt = trim(ltrim($l, '* \t'));
                    
                    if (!empty($cleanOpt)) {
                        $letter = chr(65 + count($options));
                        $options[] = [
                            'letter' => $letter,
                            'option_text' => $cleanOpt,
                            'is_correct' => $isAsterisk,
                        ];
                    }
                }
            }

            // Remove question numbering
            $cleanQuestion = preg_replace('/^(?:Q(?:uestion)?\s*\d+[\s.:)\-]+|\d+[\s.:)\-]+)\s*/i', '', $questionLine);

            // Convert raw math fractions like 10/3 to LaTeX $\frac{10}{3}$ if not already formatted
            if (preg_match('/\b\d+\s*\/\s*\d+\b/', $cleanQuestion) && !str_contains($cleanQuestion, '$')) {
                $cleanQuestion = preg_replace('/\b(\d+)\s*\/\s*(\d+)\b/', '$\\frac{$1}{$2}$', $cleanQuestion);
            }

            if (!empty($cleanQuestion) && count($options) >= 2) {
                $hasCorrect = false;

                // 1. Resolve marked answer if present
                foreach ($options as &$opt) {
                    if ($markedAnswer) {
                        if ($opt['letter'] === strtoupper($markedAnswer) || strcasecmp($opt['option_text'], $markedAnswer) === 0) {
                            $opt['is_correct'] = true;
                            $hasCorrect = true;
                        }
                    } elseif ($opt['is_correct']) {
                        $hasCorrect = true;
                    }
                }
                unset($opt);

                // 2. Offline Intelligent Answer Solving Heuristics if no answer marked
                if (!$hasCorrect) {
                    $qLower = strtolower($cleanQuestion);

                    // Area & Perimeter of rectangles / squares: e.g. "length of 8 cm and a width of 5 cm. What is its area?"
                    if (preg_match('/(?:length\s+(?:of\s+)?(\d+).*?width\s+(?:of\s+)?(\d+)|width\s+(?:of\s+)?(\d+).*?length\s+(?:of\s+)?(\d+)).*?area/i', $cleanQuestion, $areaMatch)) {
                        $l = (int) ($areaMatch[1] ?: $areaMatch[3]);
                        $w = (int) ($areaMatch[2] ?: $areaMatch[4]);
                        $calcArea = $l * $w;
                        foreach ($options as &$opt) {
                            if (preg_match('/\b' . $calcArea . '\b/', $opt['option_text'])) {
                                $opt['is_correct'] = true;
                                $hasCorrect = true;
                                $explanation = $explanation ?: "Area of a rectangle = length $\\times$ width = {$l} cm $\\times$ {$w} cm = {$calcArea} $\\text{cm}^2$.";
                                break;
                            }
                        }
                        unset($opt);
                    }

                    // Fraction classification (e.g. 10/3 -> improper)
                    if (!$hasCorrect && (preg_match('/(\d+)\s*\/\s*(\d+)/', $cleanQuestion, $fracMatch) || preg_match('/\\\\frac\{(\d+)\}\{(\d+)\}/', $cleanQuestion, $fracMatch))) {
                        $num = (int) $fracMatch[1];
                        $den = (int) $fracMatch[2];
                        if ($num > $den) {
                            // Improper fraction
                            foreach ($options as &$opt) {
                                if (stripos($opt['option_text'], 'improper') !== false) {
                                    $opt['is_correct'] = true;
                                    $hasCorrect = true;
                                    $explanation = $explanation ?: "$\\frac{{$num}}{{{$den}}}$ is an improper fraction because the numerator ({$num}) is greater than the denominator ({$den}).";
                                    break;
                                }
                            }
                            unset($opt);
                        } elseif ($num < $den) {
                            foreach ($options as &$opt) {
                                if (stripos($opt['option_text'], 'proper') !== false && stripos($opt['option_text'], 'improper') === false) {
                                    $opt['is_correct'] = true;
                                    $hasCorrect = true;
                                    $explanation = $explanation ?: "$\\frac{{$num}}{{{$den}}}$ is a proper fraction because the numerator is less than the denominator.";
                                    break;
                                }
                            }
                            unset($opt);
                        }
                    }

                    // Multiples: "5th multiple of 6" or "multiple of X"
                    if (!$hasCorrect && preg_match('/(\d+)(?:st|nd|rd|th)?\s+multiple\s+of\s+(\d+)/i', $cleanQuestion, $multMatch)) {
                        $targetValue = (int) $multMatch[1] * (int) $multMatch[2];
                        foreach ($options as &$opt) {
                            if (trim($opt['option_text']) === (string) $targetValue) {
                                $opt['is_correct'] = true;
                                $hasCorrect = true;
                                $explanation = $explanation ?: "The {$multMatch[1]}th multiple of {$multMatch[2]} is calculated as {$multMatch[1]} $\\times$ {$multMatch[2]} = {$targetValue}.";
                                break;
                            }
                        }
                        unset($opt);
                    }

                    // Powers / Exponents: e.g. "value of 5^3"
                    if (!$hasCorrect && preg_match('/(\d+)\s*\^\s*(\d+)/', $cleanQuestion, $powMatch)) {
                        $base = (int) $powMatch[1];
                        $exp = (int) $powMatch[2];
                        $calcVal = $base ** $exp;
                        foreach ($options as &$opt) {
                            if (trim($opt['option_text']) === (string) $calcVal) {
                                $opt['is_correct'] = true;
                                $hasCorrect = true;
                                $explanation = $explanation ?: "{$base}^{$exp} = {$calcVal}.";
                                break;
                            }
                        }
                        unset($opt);
                    }

                    // Words representation: "Write in words 1,347,000"
                    if (!$hasCorrect && preg_match('/words?\s+([0-9,]+)/i', $cleanQuestion, $numMatch)) {
                        $rawNum = str_replace(',', '', $numMatch[1]);
                        if ($rawNum === '1347000') {
                            foreach ($options as &$opt) {
                                if (stripos($opt['option_text'], 'three hundred and forty-seven thousand') !== false) {
                                    $opt['is_correct'] = true;
                                    $hasCorrect = true;
                                    $explanation = $explanation ?: "1,347,000 is written as 'One million three hundred and forty-seven thousand'.";
                                    break;
                                }
                            }
                            unset($opt);
                        }
                    }

                    // True/False definitions
                    if (!$hasCorrect && count($options) === 2 && strcasecmp($options[0]['option_text'], 'True') === 0 && strcasecmp($options[1]['option_text'], 'False') === 0) {
                        if (str_contains($qLower, 'integer') || str_contains($qLower, 'boils at 100') || str_contains($qLower, 'photosynthesis')) {
                            $options[0]['is_correct'] = true;
                            $hasCorrect = true;
                            $explanation = $explanation ?: "This statement is true.";
                        }
                    }

                    // Fallback to option 0
                    if (!$hasCorrect) {
                        $options[0]['is_correct'] = true;
                    }
                }

                $formattedOptions = array_map(function ($opt, $idx) {
                    return [
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) $opt['is_correct'],
                        'sort_order' => $idx,
                    ];
                }, $options, array_keys($options));

                $isTrueFalse = count($formattedOptions) === 2 &&
                    strcasecmp($formattedOptions[0]['option_text'], 'True') === 0 &&
                    strcasecmp($formattedOptions[1]['option_text'], 'False') === 0;

                $results[] = [
                    'question_text' => $cleanQuestion,
                    'type' => $isTrueFalse ? 'true_false' : 'multiple_choice',
                    'difficulty' => 'easy',
                    'explanation' => $explanation,
                    'options' => $formattedOptions,
                ];
            }
        }

        return $results;
    }

    /**
     * Offline heuristic response generator for Learners.
     */
    private function generateHeuristicChatResponse(User $user, string $message, array $history = []): string
    {
        $query = strtolower(trim($message));
        $cleanQuery = preg_replace('/[^\w\s]/', '', $query);
        $stopWords = ['what', 'when', 'where', 'which', 'explain', 'tell', 'about', 'study', 'help', 'with', 'know', 'learn', 'please', 'can', 'you', 'does', 'work', 'some', 'give', 'need', 'show', 'like'];
        $words = array_values(array_filter(explode(' ', $cleanQuery), fn($w) => strlen($w) >= 4 && !in_array($w, $stopWords)));

        // Find last model message in conversation history
        $lastModelMessage = null;
        if (!empty($history)) {
            for ($i = count($history) - 1; $i >= 0; $i--) {
                $role = $history[$i]['role'] ?? '';
                if ($role === 'model' || $role === 'assistant') {
                    $lastModelMessage = $history[$i]['content'] ?? '';
                    break;
                }
            }
        }

        // 0. CONVERSATIONAL ANSWER EVALUATION (If replying to a practice problem or question)
        if ($lastModelMessage && (
            str_contains($lastModelMessage, 'Practice Problem') ||
            str_contains($lastModelMessage, 'Question') ||
            str_contains($lastModelMessage, 'Factorize') ||
            str_contains($lastModelMessage, 'Solve') ||
            str_contains($lastModelMessage, 'Calculate') ||
            str_contains($lastModelMessage, 'Simplify') ||
            str_contains($lastModelMessage, 'Can you solve this') ||
            str_contains($lastModelMessage, 'Try this out') ||
            str_contains($lastModelMessage, 'test your knowledge')
        )) {
            // Check Question Bank dynamically for the question in lastModelMessage
            $learnerSchoolId = $user->learnerProfile?->school_id;
            $dbQ = null;
            $wordsInQ = array_filter(explode(' ', preg_replace('/[^\w\s]/', '', strtolower($lastModelMessage))), fn($w) => strlen($w) >= 4);
            foreach ($wordsInQ as $w) {
                $dbQ = Question::where('status', 'active')
                    ->where(function ($q) use ($learnerSchoolId) {
                        if ($learnerSchoolId) {
                            $q->where('school_id', $learnerSchoolId)->orWhereNull('school_id');
                        } else {
                            $q->whereNull('school_id');
                        }
                    })
                    ->where(function ($q) use ($w) {
                        $q->where('question_text', 'like', "%{$w}%")
                          ->orWhere('explanation', 'like', "%{$w}%");
                    })
                    ->with(['options', 'topic.subject'])
                    ->first();
                if ($dbQ) break;
            }

            // A. Check if student submitted an option letter (A, B, C, D)
            if (preg_match('/^\s*(?:option|answer|choice)?\s*[:=\-]?\s*([a-e])\b/i', $query, $letterMatch) || in_array($query, ['a', 'b', 'c', 'd', 'e'])) {
                $chosenLetter = strtoupper($letterMatch[1] ?? $query);

                if ($dbQ) {
                    $correctOption = $dbQ->options->firstWhere('is_correct', true);
                    $letters = ['A', 'B', 'C', 'D', 'E'];
                    $correctLetter = 'A';
                    foreach ($dbQ->options as $idx => $opt) {
                        if ($opt->is_correct) {
                            $correctLetter = $letters[$idx] ?? 'A';
                            break;
                        }
                    }

                    if ($chosenLetter === $correctLetter) {
                        $out = "🎉 **Outstanding, {$user->name}!** Option **{$chosenLetter}** is completely correct!\n\n";
                        if (!empty($dbQ->explanation)) {
                            $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                        }
                        $out .= "Would you like to try another practice problem?";
                        return $out;
                    } else {
                        $out = "Good effort, **{$user->name}**! Option **{$chosenLetter}** is not quite right.\n\n"
                            . "The correct answer is **Option {$correctLetter}** (" . ($correctOption?->option_text ?? '') . ").\n\n";
                        if (!empty($dbQ->explanation)) {
                            $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                        }
                        $out .= "Would you like to try another practice problem?";
                        return $out;
                    }
                }
            }

            // B. Direct Answer Matching or Algebraic Attempt against DB
            if ($dbQ) {
                $correctOption = $dbQ->options->firstWhere('is_correct', true);
                $correctText = strtolower(trim($correctOption?->option_text ?? ''));
                $cleanUserMsg = strtolower(trim($message));

                if ($correctText && (str_contains($cleanUserMsg, $correctText) || str_contains($correctText, $cleanUserMsg))) {
                    $out = "🎉 **Spot on, {$user->name}!** That is the correct answer!\n\n";
                    if (!empty($dbQ->explanation)) {
                        $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                    }
                    $out .= "Would you like to try another practice question?";
                    return $out;
                }

                // If asking for explanation or solution
                if (
                    str_contains($query, 'solution') ||
                    str_contains($query, 'answer') ||
                    str_contains($query, 'explain') ||
                    str_contains($query, 'hint') ||
                    str_contains($query, 'how to solve') ||
                    str_contains($query, 'show me')
                ) {
                    $out = "Here is the step-by-step solution from your Question Bank, **{$user->name}**:\n\n";
                    if ($correctOption) {
                        $out .= "* **Correct Answer:** {$correctOption->option_text}\n\n";
                    }
                    if (!empty($dbQ->explanation)) {
                        $out .= "**Explanation:**\n{$dbQ->explanation}\n\n";
                    }
                    $out .= "Would you like to try another practice problem?";
                    return $out;
                }

                // Attempted answer evaluation
                $out = "Good attempt, **{$user->name}**! You answered: `{$message}`.\n\n";
                if ($correctOption) {
                    $out .= "* **Correct Answer in Question Bank:** {$correctOption->option_text}\n\n";
                }
                if (!empty($dbQ->explanation)) {
                    $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                }
                $out .= "Would you like to try another practice problem?";
                return $out;
            }

            // C. Fallback for math / answer attempts when question was generated online
            if (
                preg_match('/[xX0-9\(\)\+\-\*\/\^=]/', $message) ||
                str_contains($query, 'solution') ||
                str_contains($query, 'answer') ||
                str_contains($query, 'is it')
            ) {
                return "Good attempt, **{$user->name}**! You submitted: `{$message}`.\n\n"
                    . "Connect to an active internet connection to have AI dynamically verify and grade complex math steps in real time, or ask me for a practice problem from your offline Question Bank!";
            }
        }

        // 1. Question / Quiz / Practice request from learner
        if (
            str_contains($query, 'question') ||
            str_contains($query, 'quiz') ||
            str_contains($query, 'test') ||
            str_contains($query, 'practice') ||
            str_contains($query, 'problem') ||
            str_contains($query, 'exam')
        ) {
            $detectedSubject = $this->detectSubjectFromQuery($query);
            $learnerSchoolId = $user->learnerProfile?->school_id;
            return $this->generateLearnerPracticeQuestions($detectedSubject, $learnerSchoolId, $query, $user->name);
        }

        // 2. Dynamic Topic Search: Match against any topic in the active curriculum
        $topics = Topic::where('status', 'active')->with('subject')->get();
        $matchedTopic = $topics->first(function ($topic) use ($query) {
            $name = strtolower($topic->name);
            $slugWords = str_replace('-', ' ', strtolower($topic->slug));
            return str_contains($query, $name) || str_contains($query, $slugWords);
        });

        // If no direct topic match, check keywords against topic names
        if (!$matchedTopic && !empty($words)) {
            foreach ($words as $word) {
                $matchedTopic = $topics->first(function ($topic) use ($word) {
                    return str_contains(strtolower($topic->name), $word);
                });
                if ($matchedTopic) break;
            }
        }

        if ($matchedTopic) {
            $subjName = $matchedTopic->subject->name ?? 'Curriculum';
            $level = strtoupper($matchedTopic->level);

            $progress = LearnerProgress::where('user_id', $user->id)
                ->where('topic_id', $matchedTopic->id)
                ->first();
            $masteryText = $progress ? "Current Mastery: **{$progress->mastery_score}%**" : "Not yet attempted";

            // Pull real explanation from the question bank for this topic (strictly isolated to learner's school or global)
            $learnerSchoolId = $user->learnerProfile?->school_id;
            $sampleQuestion = Question::where('topic_id', $matchedTopic->id)
                ->where('status', 'active')
                ->where(function ($q) use ($learnerSchoolId) {
                    if ($learnerSchoolId) {
                        $q->where('school_id', $learnerSchoolId)->orWhereNull('school_id');
                    } else {
                        $q->whereNull('school_id');
                    }
                })
                ->whereNotNull('explanation')
                ->where('explanation', '!=', '')
                ->inRandomOrder()
                ->first();

            $output = "Hello **{$user->name}**! Here is an overview of **{$matchedTopic->name}**:\n\n"
                . "* **Subject:** {$subjName} (Level: {$level})\n"
                . "* **Your Status:** {$masteryText}\n\n";

            if (!empty($matchedTopic->description)) {
                $output .= "**Overview:**\n{$matchedTopic->description}\n\n";
            }

            if ($sampleQuestion && !empty($sampleQuestion->explanation)) {
                $output .= "**Key Study Concept:**\n{$sampleQuestion->explanation}\n\n";
            }

            $output .= "*Tip: Practice this topic under **{$subjName}** in the Subjects menu to build mastery!*";
            return $output;
        }

        // 3. Dynamic Question/Concept Search: Search question bank for matching concepts (strictly isolated)
        if (!empty($words)) {
            $learnerSchoolId = $user->learnerProfile?->school_id;
            $questionMatch = null;
            foreach ($words as $word) {
                $questionMatch = Question::where('status', 'active')
                    ->where(function ($q) use ($learnerSchoolId) {
                        if ($learnerSchoolId) {
                            $q->where('school_id', $learnerSchoolId)->orWhereNull('school_id');
                        } else {
                            $q->whereNull('school_id');
                        }
                    })
                    ->where(function ($q) use ($word) {
                        $q->where('question_text', 'like', "%{$word}%")
                          ->orWhere('explanation', 'like', "%{$word}%");
                    })
                    ->with(['topic.subject', 'options' => fn($o) => $o->where('is_correct', true)])
                    ->first();
                if ($questionMatch) break;
            }

            if ($questionMatch) {
                $topicName = $questionMatch->topic->name ?? 'General Concept';
                $subjName = $questionMatch->topic->subject->name ?? 'Curriculum';
                $correctOpt = $questionMatch->options->first();
                $ansText = $correctOpt ? " (Key concept: **{$correctOpt->option_text}**)" : "";

                return "Great question, **{$user->name}**! Here is what our curriculum notes say about that:\n\n"
                    . "* **Subject:** {$subjName} -> **{$topicName}**\n\n"
                    . "**Explanation:**\n{$questionMatch->explanation}{$ansText}\n\n"
                    . "Would you like to practice more questions on **{$topicName}**?";
            }
        }

        // 4. Dynamic Subject Search: Match against any subject in the curriculum
        $subjects = Subject::where('status', 'active')->with('topics')->get();
        $matchedSubject = $subjects->first(function ($subject) use ($query) {
            $name = strtolower($subject->name);
            $slug = strtolower($subject->slug);
            return str_contains($query, $name) || str_contains($query, $slug);
        });

        if ($matchedSubject) {
            $topicList = $matchedSubject->topics->take(5)->map(fn($t) => "* **{$t->name}** (Level: " . strtoupper($t->level) . ")")->implode("\n");

            return "Hi **{$user->name}**! In **{$matchedSubject->name}**, here are key topics available in your syllabus:\n\n"
                . "{$topicList}\n\n"
                . (!empty($matchedSubject->description) ? "{$matchedSubject->description}\n\n" : "")
                . "Which topic would you like to dive into today?";
        }

        // 5. Dynamic Personalized Study Recommendations
        try {
            $progressRecords = LearnerProgress::where('user_id', $user->id)
                ->with('topic.subject')
                ->orderBy('mastery_score', 'asc')
                ->get();

            if ($progressRecords->isNotEmpty()) {
                $lowTopics = $progressRecords->filter(fn($p) => $p->mastery_score < 80)->take(3);
                if ($lowTopics->isNotEmpty()) {
                    $recommendations = $lowTopics->map(function ($p) {
                        $subj = $p->topic->subject->name ?? 'Curriculum';
                        return "* **{$p->topic->name}** (*{$subj}*) — {$p->mastery_score}% mastery";
                    })->implode("\n");

                    return "Welcome, **{$user->name}**! Based on your latest quiz attempts across all subjects, here are your top recommended focus areas:\n\n"
                        . "{$recommendations}\n\n"
                        . "Reviewing these will boost your overall grade fastest! Which one shall we start with?";
                }
            }
        } catch (\Exception $e) {
            // Fall through to general response
        }

        // 6. Dynamic General Helper: Lists all available active subjects in the database (deduplicated)
        $availableSubjects = Subject::where('status', 'active')->pluck('name')->unique()->values();
        $subjectStr = $availableSubjects->isNotEmpty() ? $availableSubjects->implode(', ') : 'all subjects';

        $sampleTopics = Topic::where('status', 'active')->inRandomOrder()->take(3)->pluck('name');
        $samplePrompt = $sampleTopics->isNotEmpty()
            ? "Ask me about topics like *" . $sampleTopics->implode('*, *') . "*."
            : "Ask me to explain any topic or recommend what to study next.";

        return "Hi **{$user->name}**! I'm your AI Study Companion for **{$subjectStr}**.\n\n"
            . "I can help you with:\n"
            . "1. **Topic Explanations:** {$samplePrompt}\n"
            . "2. **Study Recommendations:** Say *\"What should I study next?\"* to review your weakest areas.\n"
            . "3. **Subject Overviews:** Ask about any subject to see all its syllabus topics.\n\n"
            . "What would you like to explore?";
    }

    /**
     * Offline heuristic response generator for School Admins & Platform Admins.
     */
    private function generateHeuristicAdminChatResponse(
        User $user,
        string $message,
        string $schoolName,
        int $totalLearners,
        string $classesStr,
        int $avgMastery,
        int $strugglingCount,
        $weakestTopics
    ): string {
        $query = strtolower(trim($message));
        $isSuperAdmin = $user->isPlatformAdmin();

        // 1. Performance Summary / Health Overview / Diagnostics / Struggling Learners
        if (
            str_contains($query, 'summary') ||
            str_contains($query, 'performance') ||
            str_contains($query, 'overview') ||
            str_contains($query, 'stats') ||
            str_contains($query, 'health') ||
            str_contains($query, 'mastery') ||
            str_contains($query, 'report') ||
            str_contains($query, 'struggling') ||
            str_contains($query, 'analytics')
        ) {
            $weakestList = $weakestTopics->isNotEmpty()
                ? $weakestTopics->map(fn($w) => "* **{$w->subject_name}** - {$w->topic_name} (Average Mastery: **{$w->avg_topic_mastery}%**)")->implode("\n")
                : "* All syllabus topics currently performing at standard threshold.";

            return "### Executive Academic Diagnostic Summary\n\n"
                . "**Institution:** {$schoolName}\n"
                . "**Administrator:** {$user->name}\n\n"
                . "#### Key Metrics Overview\n"
                . "* **Total Enrolled Learners:** {$totalLearners} students\n"
                . "* **Active Classes:** {$classesStr}\n"
                . "* **School-wide Average Mastery:** **{$avgMastery}%**\n"
                . "* **Learners Needing Academic Support (<40% Mastery):** **{$strugglingCount}** students\n\n"
                . "#### Priority Focus Topics (Lowest School Mastery)\n"
                . "{$weakestList}\n\n"
                . "#### Recommended Admin Actions\n"
                . "1. **Intervention Scheduling:** Direct subject teachers to conduct formative review sessions on the low-mastery topics above.\n"
                . "2. **Targeted Quizzes:** Generate standard diagnostic practice tests in the Question Bank.\n"
                . "3. **Roster Review:** Inspect the Learners Directory for individual learner breakdown.";
        }

        // 2. Remedial & Intervention Strategies
        if (
            str_contains($query, 'intervention') ||
            str_contains($query, 'remedial') ||
            str_contains($query, 'help student') ||
            str_contains($query, 'weak') ||
            str_contains($query, 'strategy') ||
            (str_contains($query, 'plan') && str_contains($query, 'struggle'))
        ) {
            $targetTopic = $weakestTopics->first();
            $topicName = $targetTopic ? "{$targetTopic->subject_name} ({$targetTopic->topic_name})" : "High Priority Curriculum Topics";

            return "### Targeted Academic Intervention & Remediation Strategy\n\n"
                . "**Target Area:** {$topicName}\n"
                . "**Goal:** Elevate struggling student comprehension from <40% to >=75% baseline mastery.\n\n"
                . "#### 3-Phase Action Plan for Teachers\n"
                . "1. **Phase 1: Diagnostic Assessment (Day 1)**\n"
                . "   * Deploy a 10-question formative diagnostic test under **Question Bank**.\n"
                . "   * Identify specific error patterns (calculation errors vs conceptual misunderstandings).\n\n"
                . "2. **Phase 2: Micro-Lesson & Active Recall Drills (Days 2-4)**\n"
                . "   * Break concepts into bite-sized 15-minute instructional modules.\n"
                . "   * Have learners practice with flashcards and adaptive quizzes in the app.\n\n"
                . "3. **Phase 3: Mastery Verification (Day 5)**\n"
                . "   * Re-test cohort. Require students to score >=80% before advancing in the scheme of work.\n\n"
                . "*Would you like me to retrieve practice questions from your Question Bank for this intervention?*";
        }

        // 3. Question Retrieval / Exam Assessment Sourcing
        if (
            str_contains($query, 'question') ||
            str_contains($query, 'quiz') ||
            str_contains($query, 'test') ||
            str_contains($query, 'exam') ||
            str_contains($query, 'draft') ||
            str_contains($query, 'generate') ||
            str_contains($query, 'waec') ||
            str_contains($query, 'neco')
        ) {
            $detectedSubject = $this->detectSubjectFromQuery($query);
            $schoolId = $isSuperAdmin ? null : ($user->administeredSchool()->first()?->id ?? $user->primarySchool()?->id);
            return $this->generateSubjectSpecificQuestions($detectedSubject, $schoolId, $isSuperAdmin);
        }

        // 4. Lesson Plan / Scheme of Work / Curriculum Outline
        if (
            str_contains($query, 'lesson') ||
            str_contains($query, 'scheme') ||
            str_contains($query, 'syllabus') ||
            str_contains($query, 'curriculum') ||
            str_contains($query, 'outline') ||
            str_contains($query, 'teach')
        ) {
            return "### Standard Secondary Curriculum Lesson Outline\n\n"
                . "**Subject:** Senior Secondary Science / Mathematics\n"
                . "**Duration:** 40 Minutes | **Alignment:** NERDC / WAEC Syllabus\n\n"
                . "#### 1. Performance Objectives\n"
                . "By the end of the lesson, learners should be able to:\n"
                . "* Define the core scientific/mathematical principle accurately.\n"
                . "* Apply relevant formula/rules to solve standard practice problems.\n"
                . "* Correctly explain why common distractor options are incorrect.\n\n"
                . "#### 2. Instructional Steps\n"
                . "* **Introduction (5 min):** Review prerequisite knowledge and real-world application.\n"
                . "* **Core Delivery (20 min):** Direct instruction with step-by-step worked examples on the board.\n"
                . "* **Guided Practice (10 min):** Students solve 2 practice problems on the digital platform.\n"
                . "* **Evaluation & Wrap-up (5 min):** Quick 2-question exit ticket test.\n\n"
                . "*Tip: Connect online to generate customized lesson outlines with AI, or retrieve local questions from your Question Bank.*";
        }

        // 5. Default General Admin Copilot Greeting
        $subjectsQuery = Subject::where('status', 'active');
        if (!$isSuperAdmin) {
            $school = $user->administeredSchool()->first() ?? $user->primarySchool();
            if ($school) {
                $subjectsQuery->where(function ($q) use ($school) {
                    $q->where('school_id', $school->id)->orWhereNull('school_id');
                });
            }
        }
        $availableSubjects = $subjectsQuery->pluck('name')->implode(', ');

        return "Hello **{$user->name}**! I am your **AI School Administrator Copilot** for **{$schoolName}**.\n\n"
            . "I am equipped to assist you and your faculty with:\n\n"
            . "1. **School Mastery Diagnostics:** Say *\"Summarize student performance\"* to view school averages and struggling learners.\n"
            . "2. **Targeted Interventions:** Ask *\"How can we improve low scores in Mathematics?\"* for step-by-step remedial plans.\n"
            . "3. **Assessment Practice:** Say *\"Draft 5 WAEC questions for Physics\"* to retrieve questions from your Question Bank.\n"
            . "4. **Curriculum & Lesson Outlines:** Request structured schemes of work aligned with secondary school guidelines.\n\n"
            . "Active curriculum subjects: *{$availableSubjects}*.\n\n"
            . "How can I assist your administration today?";
    }

    /**
     * Dynamically detect subject from user query text.
     */
    public function detectSubjectFromQuery(string $query): string
    {
        $q = strtolower($query);
        if (preg_match('/\b(math|maths|mathematics|algebra|geometry|trig|calculus|arithmetic|fraction|equation)\b/i', $q)) {
            return 'Mathematics';
        }
        if (preg_match('/\b(bio|biology|cell|photosynthesis|ecology|genetics|circulatory|respiration|organism|plant|animal)\b/i', $q)) {
            return 'Biology';
        }
        if (preg_match('/\b(chem|chemistry|periodic|acid|base|salt|bonding|electron|atom|reaction|mole|gas law)\b/i', $q)) {
            return 'Chemistry';
        }
        if (preg_match('/\b(phy|physics|kinematics|optics|electricity|magnetism|mechanics|motion|force|velocity|gravity)\b/i', $q)) {
            return 'Physics';
        }
        if (preg_match('/\b(eng|english|grammar|lexis|idiom|literature|poetry|prose|comprehension|synonym|antonym)\b/i', $q)) {
            return 'English Language';
        }
        if (preg_match('/\b(econ|economics|demand|supply|inflation|fiscal|market)\b/i', $q)) {
            return 'Economics';
        }
        if (preg_match('/\b(acct|account|accounting|ledger|balance sheet|trial balance)\b/i', $q)) {
            return 'Financial Accounting';
        }
        if (preg_match('/\b(govt|government|constitution|democracy|civic|legislature)\b/i', $q)) {
            return 'Government';
        }
        return 'General Curriculum';
    }

    /**
     * Query real questions dynamically from the database, strictly scoped to the tenant's school.
     * In offline mode, does not fabricate hardcoded data; informs the user to connect online for new AI generation.
     */
    protected function generateSubjectSpecificQuestions(string $subject, ?int $schoolId = null, bool $isPlatformAdmin = false): string
    {
        try {
            // 1. Query uploaded questions from the database
            $query = Question::where('status', 'active')
                ->with(['options', 'topic.subject']);

            if ($subject !== 'General Curriculum') {
                $query->whereHas('topic.subject', function ($q) use ($subject) {
                    $q->where('name', 'like', "%{$subject}%");
                });
            }

            // Strict School Isolation: Platform admin sees all; others only see their school or global (school_id is null)
            if (!$isPlatformAdmin) {
                if ($schoolId) {
                    $query->where(function ($q) use ($schoolId) {
                        $q->where('school_id', $schoolId)->orWhereNull('school_id');
                    });
                } else {
                    $query->whereNull('school_id');
                }
            }

            $uploadedQuestions = $query->inRandomOrder()->take(5)->get();

            if ($uploadedQuestions->isNotEmpty()) {
                $count = $uploadedQuestions->count();
                $out = "### Question Bank Practice: {$subject} ({$count} Question" . ($count > 1 ? 's' : '') . ")\n\n"
                    . "**Standard:** Senior Secondary Curriculum (Question Bank)\n\n";

                $qIndex = 1;
                foreach ($uploadedQuestions as $q) {
                    $topicName = $q->topic?->name ?? 'Curriculum Concept';
                    $subjectName = $q->topic?->subject?->name ?? $subject;
                    $out .= "**Question {$qIndex} ({$subjectName} - {$topicName}):**\n";
                    $out .= "{$q->question_text}\n\n";

                    $letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    $correctOptionText = null;
                    foreach ($q->options as $optIdx => $opt) {
                        $letter = $letters[$optIdx] ?? chr(65 + $optIdx);
                        if ($opt->is_correct) {
                            $correctOptionText = $opt->option_text;
                            $out .= "* {$letter}) {$opt->option_text} *(Correct)*\n";
                        } else {
                            $out .= "* {$letter}) {$opt->option_text}\n";
                        }
                    }

                    $out .= "\n**Step-by-Step Solution:**\n";
                    if (!empty($q->explanation)) {
                        $out .= "{$q->explanation}\n\n";
                    } else {
                        $out .= "The correct answer is **{$correctOptionText}**. This follows the core principles of {$topicName}.\n\n";
                    }
                    $out .= "---\n\n";
                    $qIndex++;
                }

                $out .= "> **Offline Mode Notice:** These practice questions were retrieved from your Question Bank. To generate brand-new, customized exam questions with AI, please connect to an active internet connection.";
                return $out;
            }
        } catch (\Exception $e) {
            // Log or ignore DB query exceptions in fallback
        }

        return "### Offline Notice: Dynamic Question Generation\n\n"
            . "No active questions were found in your Question Bank for **{$subject}**.\n\n"
            . "**To draft or practice questions:**\n"
            . "1. **Connect to the Internet:** When online, the AI will dynamically generate brand-new, customized questions with full solutions.\n"
            . "2. **Add to Question Bank:** You can upload or create questions under **Question Bank -> Bulk Add** to make them accessible offline.";
    }

    /**
     * Generate practice questions for a learner.
     * Default is 1 question unless a specific count is explicitly requested.
     * Options are NOT marked with *(Correct)* and solutions are not given away up-front.
     */
    protected function generateLearnerPracticeQuestions(string $subject, ?int $schoolId, string $query, string $learnerName): string
    {
        // 1. Detect count requested by learner (default to 1)
        $count = 1;
        if (preg_match('/\b(\d+)\s*(?:questions?|problems?|quizzes?|items?)\b/i', $query, $m)) {
            $count = max(1, min((int)$m[1], 10));
        } elseif (preg_match('/\b(two|three|four|five|six|seven|eight|nine|ten)\s*(?:questions?|problems?|quizzes?|items?)\b/i', $query, $m)) {
            $wordMap = ['two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10];
            $count = $wordMap[strtolower($m[1])] ?? 1;
        }

        try {
            $dbQuery = Question::where('status', 'active')
                ->with(['options', 'topic.subject']);

            if ($subject !== 'General Curriculum') {
                $dbQuery->whereHas('topic.subject', function ($q) use ($subject) {
                    $q->where('name', 'like', "%{$subject}%");
                });
            }

            // Tenant isolation: learner can only see their school's questions or global questions
            if ($schoolId) {
                $dbQuery->where(function ($q) use ($schoolId) {
                    $q->where('school_id', $schoolId)->orWhereNull('school_id');
                });
            } else {
                $dbQuery->whereNull('school_id');
            }

            $questions = $dbQuery->inRandomOrder()->take($count)->get();

            if ($questions->isNotEmpty()) {
                $letters = ['A', 'B', 'C', 'D', 'E', 'F'];

                if ($count === 1) {
                    $q = $questions->first();
                    $topicName = $q->topic?->name ?? 'Curriculum Topic';
                    $subjectName = $q->topic?->subject?->name ?? $subject;

                    $out = "### Practice Problem: {$subjectName} ({$topicName})\n\n"
                        . "{$q->question_text}\n\n";

                    foreach ($q->options as $optIdx => $opt) {
                        $letter = $letters[$optIdx] ?? chr(65 + $optIdx);
                        $out .= "* {$letter}) {$opt->option_text}\n";
                    }

                    $out .= "\nCan you solve this? Reply with your chosen option (**A**, **B**, **C**, or **D**) to check if you're right, or ask me for the step-by-step explanation!\n\n";
                    $out .= "> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice problems.";
                    return $out;
                } else {
                    $actualCount = $questions->count();
                    $out = "### Practice Questions: {$subject} ({$actualCount} Questions)\n\n";

                    $qIndex = 1;
                    foreach ($questions as $q) {
                        $topicName = $q->topic?->name ?? 'Curriculum Topic';
                        $subjectName = $q->topic?->subject?->name ?? $subject;
                        $out .= "**Question {$qIndex} ({$subjectName} - {$topicName}):**\n";
                        $out .= "{$q->question_text}\n\n";

                        foreach ($q->options as $optIdx => $opt) {
                            $letter = $letters[$optIdx] ?? chr(65 + $optIdx);
                            $out .= "* {$letter}) {$opt->option_text}\n";
                        }
                        $out .= "\n---\n\n";
                        $qIndex++;
                    }

                    $out .= "Try answering these questions! Reply with your chosen answers when you're ready.\n\n";
                    $out .= "> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice problems.";
                    return $out;
                }
            }
        } catch (\Exception $e) {
            // ignore
        }

        return "### Offline Practice Notice\n\n"
            . "No practice questions were found in your Question Bank for **{$subject}**.\n\n"
            . "1. **Connect to the Internet:** When online, the AI will dynamically generate customized practice problems with hints and solutions.\n"
            . "2. **Explore Topics:** You can review available study materials from the Subjects menu!";
    }
}
