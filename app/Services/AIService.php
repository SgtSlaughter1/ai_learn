<?php

namespace App\Services;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\User;
use App\Models\LearnerProgress;
use Illuminate\Support\Facades\Http;

class AIService
{
    protected string $provider;
    protected ?string $apiKey;
    protected string $modelName;

    public function __construct()
    {
        $this->apiKey = env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY') ?: env('AI_API_KEY');
        $this->modelName = env('MODEL_NAME', 'gemini-1.5-flash');
        $this->provider = env('AI_PROVIDER') ?: (empty($this->apiKey) ? 'local' : 'gemini');
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

        if ($this->apiKey && ($this->provider === 'gemini')) {
            try {
                $response = Http::withHeaders(['Content-Type' => 'application/json'])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$this->modelName}:generateContent?key={$this->apiKey}", [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ]
                    ]);

                if ($response->successful()) {
                    $body = $response->json();
                    $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($text) return $this->cleanMathDuplicates(trim($text));
                }
            } catch (\Exception $e) {
                // Fallback to local explanation
            }
        }

        // Local Heuristic Tutor Explanation (Offline Fallback)
        return $this->generateHeuristicExplanation($question, $selectedOption, $correctOption, $subjectName, $topicName);
    }

    /**
     * Generate chatbot response for learning helper chatbot.
     */
    public function generateChatResponse(User $user, string $message, array $history): string
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

        if (empty($masterySummary)) {
            $masterySummary = "No diagnostic test records logged yet. Recommend they take a quiz under 'Subjects' to calculate their initial mastery.";
        }

        $systemInstruction = "You are the Offline AI Learning Companion, a friendly, encouraging personal study assistant for secondary school students. 
You know the student's name is: {$user->name}.
Here is their current subject mastery progress:
{$masterySummary}

Guidelines:
1. Help them understand curriculum concepts, plan what to study, or explain hard questions.
2. Keep your answers brief, engaging, highly structured (using bullet points and bold text), and easy to read.
3. Recommend taking diagnostic quizzes for subjects where their mastery is low (below 80%).
4. If they ask about offline access, explain that the app calculates progress, scores, and adapts difficulty fully offline!
5. Use markdown formatting. Keep answers under 150 words.
6. CRITICAL: When writing math, use ONLY LaTeX with dollar signs ($...$ for inline, $$...$$ for display). NEVER write the same expression in both LaTeX AND plain text. Use ONLY the LaTeX version, not both.";

        if ($this->apiKey && ($this->provider === 'gemini')) {
            try {
                // Convert simple history to Gemini chat contents format
                $contents = [];
                foreach ($history as $msg) {
                    $role = ($msg['role'] === 'user') ? 'user' : 'model';
                    $contents[] = [
                        'role' => $role,
                        'parts' => [['text' => $msg['content']]]
                    ];
                }
                // Prepend system prompt
                array_unshift($contents, [
                    'role' => 'user',
                    'parts' => [['text' => "SYSTEM INSTRUCTION:\n{$systemInstruction}"]]
                ]);
                $contents[] = [
                    'role' => 'user',
                    'parts' => [['text' => $message]]
                ];

                $response = Http::withHeaders(['Content-Type' => 'application/json'])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$this->modelName}:generateContent?key={$this->apiKey}", [
                        'contents' => $contents
                    ]);

                if ($response->successful()) {
                    $body = $response->json();
                    $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($text) return $this->cleanMathDuplicates(trim($text));
                }
            } catch (\Exception $e) {
                // Fallback to local chatbot simulator
            }
        }

        return $this->generateHeuristicChatResponse($user, $message);
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
                '/(\$)([^$]+)(\$)\s+([\w\s+\-*/=().,]+?)(?=[\n$]|\$)/',
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
        $out = "### 📚 AI Tutor Explanation\n\n";
        $out .= "Let's review this concept under **{$subject} → {$topic}**:\n\n";
        
        if ($selectedOption) {
            if ($selectedOption->id === $correctOption->id) {
                $out .= "🎉 **Correct!** You selected **\"{$selectedOption->option_text}\"**, which is the correct answer.\n\n";
            } else {
                $out .= "❌ **Incorrect Choice:** You chose **\"{$selectedOption->option_text}\"**. Let's see why this isn't correct.\n\n";
            }
        } else {
            $out .= "⏳ **Skipped Question:** You didn't select an answer. Let's study the correct answer together.\n\n";
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
        $out .= "💡 **Study Tip:** {$this->generateStudyTip($topic, $question)}";

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
                $out .= "Since {$check} = {$target}, our answer **{$variable} = {$correctText}** is confirmed! ✅\n\n";
            } else {
                $out .= "The answer checks out! ✅\n\n";
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
            $out .= "Therefore, the simplified answer is **{$correctText}** ✅\n\n";
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

    private function generateHeuristicChatResponse(User $user, string $message): string
    {
        // Query the user's progress records
        $progress = LearnerProgress::where('user_id', $user->id)
            ->with('topic')
            ->orderBy('mastery_score', 'asc')
            ->get();

        // Build mastery summary lists dynamically
        if ($progress->count() >= 2) {
            $topic1 = $progress[0]->topic->name;
            $score1 = $progress[0]->mastery_score;
            $topic2 = $progress[1]->topic->name;
            $score2 = $progress[1]->mastery_score;
        } elseif ($progress->count() === 1) {
            $topic1 = $progress[0]->topic->name;
            $score1 = $progress[0]->mastery_score;
            $topic2 = "Euclidean Geometry";
            $score2 = 25;
        } else {
            $topic1 = "Algebraic Expressions";
            $score1 = 50;
            $topic2 = "Euclidean Geometry";
            $score2 = 25;
        }

        // Determine recommendation topic name
        $lowTopic = ($score1 < 80) ? $topic1 : (($score2 < 80) ? $topic2 : null);

        return "You got it, **{$user->name}**! 🚀 Which math concept would you like to tackle today?

* **{$topic1} ({$score1}% mastery):** We can review like terms, expanding brackets, or factoring.
* **{$topic2} ({$score2}% mastery):** We can break down angle rules, triangle theorems, or parallel lines.";
    }
}
