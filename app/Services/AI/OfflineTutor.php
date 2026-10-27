<?php

namespace App\Services\AI;

use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The chat answers used without the AI: the learner study companion and the staff copilot.
 */
class OfflineTutor
{
    /**
     * The bank question whose text appears in a tutor message, among questions this user may see.
     * Looks up the message's three longest words (a few queries, not one per word) and keeps only a
     * question whose whole text is in the message; a single shared word used to pick an unrelated one.
     */
    private function questionShownIn(User $user, string $message): ?Question
    {
        $normalise = fn (string $s): string => mb_strtolower(trim(preg_replace('/\s+/u', ' ', strip_tags($s)) ?? ''));
        $haystack = $normalise($message);
        $words = array_unique(array_filter(preg_split('/[^\p{L}\p{N}]+/u', $haystack) ?: [], fn ($w) => mb_strlen($w) >= 5));
        usort($words, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));

        foreach (array_slice($words, 0, 3) as $word) {
            $match = Question::forUser($user)
                ->where('status', 'active')
                ->where('question_text', 'like', '%'.addcslashes($word, '%_\\').'%')
                ->with(['options', 'topic.subject'])
                ->limit(20)
                ->get()
                ->first(fn (Question $q) => ($text = $normalise((string) $q->question_text)) !== '' && str_contains($haystack, $text));
            if ($match) {
                return $match;
            }
        }

        return null;
    }

    public function generateHeuristicChatResponse(User $user, string $message, array $history = []): string
    {
        // Unicode-aware (/u, mb_*): Yoruba and Igbo letters such as ẹ, ọ, ṣ must survive.
        $query = mb_strtolower(trim($message));
        $cleanQuery = preg_replace('/[^\p{L}\p{N}\s]/u', '', $query) ?? '';
        $stopWords = ['what', 'when', 'where', 'which', 'explain', 'tell', 'about', 'study', 'help', 'with', 'know', 'learn', 'please', 'can', 'you', 'does', 'work', 'some', 'give', 'need', 'show', 'like'];
        $words = array_values(array_filter(preg_split('/\s+/u', $cleanQuery) ?: [], fn ($w) => mb_strlen($w) >= 4 && ! in_array($w, $stopWords)));

        // Find last model message in conversation history
        $lastModelMessage = null;
        if (! empty($history)) {
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
            // The question that last message actually showed (null when unsure: better no grading than wrong grading)
            $dbQ = $this->questionShownIn($user, $lastModelMessage);

            // A. The whole reply is an option letter ("B", "b.", "(c)", "option D"); "a number..." is not.
            if (preg_match('/^\s*(?:(?:option|answer|choice)\s*[:=\-]?\s*)?\(?([a-e])\)?\s*[.!]?\s*$/i', $query, $letterMatch)) {
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
                        $out = "**Outstanding, {$user->name}!** Option **{$chosenLetter}** is completely correct!\n\n";
                        if (! empty($dbQ->explanation)) {
                            $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                        }
                        $out .= 'Would you like to try another practice problem?';

                        return $out;
                    } else {
                        $out = "Good effort, **{$user->name}**! Option **{$chosenLetter}** is not quite right.\n\n"
                            ."The correct answer is **Option {$correctLetter}** (".($correctOption?->option_text ?? '').").\n\n";
                        if (! empty($dbQ->explanation)) {
                            $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                        }
                        $out .= 'Would you like to try another practice problem?';

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
                    $out = "**Spot on, {$user->name}!** That is the correct answer!\n\n";
                    if (! empty($dbQ->explanation)) {
                        $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                    }
                    $out .= 'Would you like to try another practice question?';

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
                    if (! empty($dbQ->explanation)) {
                        $out .= "**Explanation:**\n{$dbQ->explanation}\n\n";
                    }
                    $out .= 'Would you like to try another practice problem?';

                    return $out;
                }

                // Attempted answer evaluation
                $out = "Good attempt, **{$user->name}**! You answered: `{$message}`.\n\n";
                if ($correctOption) {
                    $out .= "* **Correct Answer in Question Bank:** {$correctOption->option_text}\n\n";
                }
                if (! empty($dbQ->explanation)) {
                    $out .= "**Step-by-Step Solution:**\n{$dbQ->explanation}\n\n";
                }
                $out .= 'Would you like to try another practice problem?';

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
                    .'Connect to an active internet connection to have AI dynamically verify and grade complex math steps in real time, or ask me for a practice problem from your offline Question Bank!';
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
        if (! $matchedTopic && ! empty($words)) {
            foreach ($words as $word) {
                $matchedTopic = $topics->first(function ($topic) use ($word) {
                    return str_contains(strtolower($topic->name), $word);
                });
                if ($matchedTopic) {
                    break;
                }
            }
        }

        if ($matchedTopic) {
            $subjName = $matchedTopic->subject->name ?? 'Curriculum';
            $level = strtoupper($matchedTopic->level);

            $progress = LearnerProgress::where('user_id', $user->id)
                ->where('topic_id', $matchedTopic->id)
                ->first();
            $masteryText = $progress ? "Current Mastery: **{$progress->mastery_score}%**" : 'Not yet attempted';

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
                ."* **Subject:** {$subjName} (Level: {$level})\n"
                ."* **Your Status:** {$masteryText}\n\n";

            if (! empty($matchedTopic->description)) {
                $output .= "**Overview:**\n{$matchedTopic->description}\n\n";
            }

            if ($sampleQuestion && ! empty($sampleQuestion->explanation)) {
                $output .= "**Key Study Concept:**\n{$sampleQuestion->explanation}\n\n";
            }

            $output .= "*Tip: Practice this topic under **{$subjName}** in the Subjects menu to build mastery!*";

            return $output;
        }

        // 3. Dynamic Question/Concept Search: Search question bank for matching concepts (strictly isolated)
        if (! empty($words)) {
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
                    ->with(['topic.subject', 'options' => fn ($o) => $o->where('is_correct', true)])
                    ->first();
                if ($questionMatch) {
                    break;
                }
            }

            if ($questionMatch) {
                $topicName = $questionMatch->topic->name ?? 'General Concept';
                $subjName = $questionMatch->topic->subject->name ?? 'Curriculum';
                $correctOpt = $questionMatch->options->first();
                $ansText = $correctOpt ? " (Key concept: **{$correctOpt->option_text}**)" : '';

                return "Great question, **{$user->name}**! Here is what our curriculum notes say about that:\n\n"
                    ."* **Subject:** {$subjName} -> **{$topicName}**\n\n"
                    ."**Explanation:**\n{$questionMatch->explanation}{$ansText}\n\n"
                    ."Would you like to practice more questions on **{$topicName}**?";
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
            $topicList = $matchedSubject->topics->take(5)->map(fn ($t) => "* **{$t->name}** (Level: ".strtoupper($t->level).')')->implode("\n");

            return "Hi **{$user->name}**! In **{$matchedSubject->name}**, here are key topics available in your syllabus:\n\n"
                ."{$topicList}\n\n"
                .(! empty($matchedSubject->description) ? "{$matchedSubject->description}\n\n" : '')
                .'Which topic would you like to dive into today?';
        }

        // 5. Dynamic Personalized Study Recommendations
        try {
            $progressRecords = LearnerProgress::where('user_id', $user->id)
                ->with('topic.subject')
                ->orderBy('mastery_score', 'asc')
                ->get();

            if ($progressRecords->isNotEmpty()) {
                $lowTopics = $progressRecords->filter(fn ($p) => $p->mastery_score < 80)->take(3);
                if ($lowTopics->isNotEmpty()) {
                    $recommendations = $lowTopics->map(function ($p) {
                        $subj = $p->topic->subject->name ?? 'Curriculum';

                        return "* **{$p->topic->name}** (*{$subj}*) — {$p->mastery_score}% mastery";
                    })->implode("\n");

                    return "Welcome, **{$user->name}**! Based on your latest quiz attempts across all subjects, here are your top recommended focus areas:\n\n"
                        ."{$recommendations}\n\n"
                        .'Reviewing these will boost your overall grade fastest! Which one shall we start with?';
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
            ? 'Ask me about topics like *'.$sampleTopics->implode('*, *').'*.'
            : 'Ask me to explain any topic or recommend what to study next.';

        return "Hi **{$user->name}**! I'm your AI Study Companion for **{$subjectStr}**.\n\n"
            ."I can help you with:\n"
            ."1. **Topic Explanations:** {$samplePrompt}\n"
            ."2. **Study Recommendations:** Say *\"What should I study next?\"* to review your weakest areas.\n"
            ."3. **Subject Overviews:** Ask about any subject to see all its syllabus topics.\n\n"
            .'What would you like to explore?';
    }

    /**
     * Offline heuristic response generator for School Admins & Platform Admins.
     */
    public function generateHeuristicAdminChatResponse(
        User $user,
        string $message,
        string $schoolName,
        int $totalLearners,
        string $classesStr,
        int $avgMastery,
        int $strugglingCount,
        $weakestTopics,
        array $strugglingLearnersList = [],
        array $learnersSummaryList = []
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
            str_contains($query, 'student') ||
            str_contains($query, 'learner') ||
            str_contains($query, 'analytics')
        ) {
            $weakestList = $weakestTopics->isNotEmpty()
                ? $weakestTopics->map(fn ($w) => "* **{$w->subject_name}** - {$w->topic_name} (Average Mastery: **{$w->avg_topic_mastery}%**)")->implode("\n")
                : '* All syllabus topics currently performing at standard threshold.';

            $learnersBreakdownStr = '';
            if (! empty($strugglingLearnersList)) {
                $learnersBreakdownStr = "\n\n#### Students Needing Attention\n"
                    .implode("\n", array_map(function ($s) {
                        $topics = ! empty($s['low_topics']) ? ' (Focus: '.implode(', ', $s['low_topics']).')' : '';

                        return "* **{$s['name']}** ({$s['class']}) — Mastery: **{$s['avg_mastery']}%**{$topics}";
                    }, array_slice($strugglingLearnersList, 0, 5)));
            } elseif (! empty($learnersSummaryList)) {
                $learnersBreakdownStr = "\n\n#### Enrolled Students\n"
                    .implode("\n", array_slice($learnersSummaryList, 0, 5));
            }

            return "### Academic Diagnostic Summary\n\n"
                ."**Institution:** {$schoolName}\n"
                ."**Educator / Admin:** {$user->name}\n\n"
                ."#### Key Metrics Overview\n"
                ."* **Total Enrolled Learners:** {$totalLearners} students\n"
                ."* **Active Classes:** {$classesStr}\n"
                ."* **School-wide Average Mastery:** **{$avgMastery}%**\n"
                ."* **Learners Needing Practice (<50% Mastery):** **{$strugglingCount}** students"
                ."{$learnersBreakdownStr}\n\n"
                ."#### Priority Focus Topics (Lowest School Mastery)\n"
                ."{$weakestList}\n\n"
                ."#### Recommended Actions\n"
                ."1. **Targeted Practice:** Assign personalized revision quizzes to students listed above.\n"
                ."2. **Review Sessions:** Conduct quick 15-minute refreshers on low-mastery curriculum topics.\n"
                .'3. **Track Progress:** Check student scores after the next practice session to verify improvement.';
        }

        // 2. Remedial & Intervention Strategies
        if (
            str_contains($query, 'intervention') ||
            str_contains($query, 'remedial') ||
            str_contains($query, 'help student') ||
            str_contains($query, 'weak') ||
            str_contains($query, 'strategy') ||
            str_contains($query, 'support') ||
            (str_contains($query, 'plan') && (str_contains($query, 'struggle') || str_contains($query, 'help')))
        ) {
            $targetTopic = $weakestTopics->first();
            $topicName = $targetTopic ? "{$targetTopic->subject_name} ({$targetTopic->topic_name})" : 'High Priority Curriculum Topics';

            $studentTargetLine = '';
            if (! empty($strugglingLearnersList)) {
                $names = array_map(fn ($s) => "{$s['name']} ({$s['class']})", array_slice($strugglingLearnersList, 0, 3));
                $studentTargetLine = '**Target Students:** '.implode(', ', $names)."\n";
            }

            return "### Targeted Academic Support & Practice Strategy\n\n"
                ."{$studentTargetLine}"
                ."**Target Area:** {$topicName}\n"
                ."**Goal:** Boost student understanding to >=75% baseline mastery.\n\n"
                ."#### 3-Phase Action Plan\n"
                ."1. **Phase 1: Quick Practice Check (Day 1)**\n"
                ."   * Deploy a 10-question formative practice test under **Question Bank**.\n"
                ."   * Identify specific areas where students need clarification.\n\n"
                ."2. **Phase 2: Focused Practice & Recall Drills (Days 2-4)**\n"
                ."   * Break concepts into bite-sized 15-minute instructional modules.\n"
                ."   * Have learners practice with flashcards and adaptive quizzes in the app.\n\n"
                ."3. **Phase 3: Mastery Verification (Day 5)**\n"
                ."   * Re-test cohort. Ensure students score >=80% before advancing in the scheme of work.\n\n"
                .'*Would you like me to retrieve practice questions from your Question Bank for this intervention?*';
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
                ."**Subject:** Senior Secondary Science / Mathematics\n"
                ."**Duration:** 40 Minutes | **Alignment:** NERDC / WAEC Syllabus\n\n"
                ."#### 1. Performance Objectives\n"
                ."By the end of the lesson, learners should be able to:\n"
                ."* Define the core scientific/mathematical principle accurately.\n"
                ."* Apply relevant formula/rules to solve standard practice problems.\n"
                ."* Correctly explain why common distractor options are incorrect.\n\n"
                ."#### 2. Instructional Steps\n"
                ."* **Introduction (5 min):** Review prerequisite knowledge and real-world application.\n"
                ."* **Core Delivery (20 min):** Direct instruction with step-by-step worked examples on the board.\n"
                ."* **Guided Practice (10 min):** Students solve 2 practice problems on the digital platform.\n"
                ."* **Evaluation & Wrap-up (5 min):** Quick 2-question exit ticket test.\n\n"
                .'*Tip: Connect online to generate customized lesson outlines with AI, or retrieve local questions from your Question Bank.*';
        }

        // 5. Default General Admin Copilot Greeting
        $subjectsQuery = Subject::where('status', 'active');
        if (! $isSuperAdmin) {
            $school = $user->administeredSchool()->first() ?? $user->primarySchool();
            if ($school) {
                $subjectsQuery->where(function ($q) use ($school) {
                    $q->where('school_id', $school->id)->orWhereNull('school_id');
                });
            }
        }
        $availableSubjects = $subjectsQuery->pluck('name')->implode(', ');

        return "Hello **{$user->name}**! I am your **AI School Administrator Copilot** for **{$schoolName}**.\n\n"
            ."I am equipped to assist you and your faculty with:\n\n"
            ."1. **School Mastery Diagnostics:** Say *\"Summarize student performance\"* to view school averages and struggling learners.\n"
            ."2. **Targeted Interventions:** Ask *\"How can we improve low scores in Mathematics?\"* for step-by-step remedial plans.\n"
            ."3. **Assessment Practice:** Say *\"Draft 5 WAEC questions for Physics\"* to retrieve questions from your Question Bank.\n"
            ."4. **Curriculum & Lesson Outlines:** Request structured schemes of work aligned with secondary school guidelines.\n\n"
            ."Active curriculum subjects: *{$availableSubjects}*.\n\n"
            .'How can I assist your administration today?';
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
            if (! $isPlatformAdmin) {
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
                $out = "### Question Bank Practice: {$subject} ({$count} Question".($count > 1 ? 's' : '').")\n\n"
                    ."**Standard:** Senior Secondary Curriculum (Question Bank)\n\n";

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
                    if (! empty($q->explanation)) {
                        $out .= "{$q->explanation}\n\n";
                    } else {
                        $out .= "The correct answer is **{$correctOptionText}**. This follows the core principles of {$topicName}.\n\n";
                    }
                    $out .= "---\n\n";
                    $qIndex++;
                }

                $out .= '> **Offline Mode Notice:** These practice questions were retrieved from your Question Bank. To generate brand-new, customized exam questions with AI, please connect to an active internet connection.';

                return $out;
            }
        } catch (\Exception $e) {
            // Log or ignore DB query exceptions in fallback
        }

        return "### Offline Notice: Dynamic Question Generation\n\n"
            ."No active questions were found in your Question Bank for **{$subject}**.\n\n"
            ."**To draft or practice questions:**\n"
            ."1. **Connect to the Internet:** When online, the AI will dynamically generate brand-new, customized questions with full solutions.\n"
            .'2. **Add to Question Bank:** You can upload or create questions under **Question Bank -> Bulk Add** to make them accessible offline.';
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
            $count = max(1, min((int) $m[1], 10));
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
                        ."{$q->question_text}\n\n";

                    foreach ($q->options as $optIdx => $opt) {
                        $letter = $letters[$optIdx] ?? chr(65 + $optIdx);
                        $out .= "* {$letter}) {$opt->option_text}\n";
                    }

                    $out .= "\nCan you solve this? Reply with your chosen option (**A**, **B**, **C**, or **D**) to check if you're right, or ask me for the step-by-step explanation!\n\n";
                    $out .= '> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice problems.';

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
                    $out .= '> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice problems.';

                    return $out;
                }
            }
        } catch (\Exception $e) {
            // ignore
        }

        return "### Offline Practice Notice\n\n"
            ."No practice questions were found in your Question Bank for **{$subject}**.\n\n"
            ."1. **Connect to the Internet:** When online, the AI will dynamically generate customized practice problems with hints and solutions.\n"
            .'2. **Explore Topics:** You can review available study materials from the Subjects menu!';
    }
}
