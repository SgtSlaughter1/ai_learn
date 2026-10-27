<?php

namespace App\Services\AI;

use App\Models\Question;
use App\Models\QuestionOption;

/**
 * Explanations written without the AI (offline or when every provider fails).
 */
class OfflineExplainer
{
    public function generateHeuristicExplanation(Question $question, ?QuestionOption $selectedOption, QuestionOption $correctOption, string $subject, string $topic): string
    {
        $isCorrect = $selectedOption && ($selectedOption->id === $correctOption->id);

        if ($isCorrect) {
            $out = "### 1. Why Your Answer is Correct\n\n";
            $out .= "You chose **\"{$selectedOption->option_text}\"**, which is the **correct answer**! Great job applying the principles of **{$topic}**.\n\n";
            $steps = $this->generateStepByStep($question, $correctOption, $topic);
            $out .= $steps."\n\n";
            $out .= "### 2. A Simple Example\n\n";
            $out .= $this->generateStudyTip($topic, $question);

            return $out;
        }

        $out = "### 1. Why Your Choice Was Incorrect\n\n";
        if ($selectedOption) {
            $reason = $this->generateWrongAnswerReason($selectedOption, $correctOption, $question, $topic);
            $out .= "You chose **\"{$selectedOption->option_text}\"**. This option is incorrect because {$reason}\n\n";
        } else {
            $out .= "You skipped this question without choosing an option. Here is the concept being tested in **{$topic}**.\n\n";
        }

        $out .= "### 2. Why the Correct Answer is Right\n\n";
        $out .= "The correct answer is **\"{$correctOption->option_text}\"**.\n\n";
        $steps = $this->generateStepByStep($question, $correctOption, $topic);
        $out .= $steps."\n\n";

        $out .= "### 3. A Simple Example\n\n";
        $out .= $this->generateStudyTip($topic, $question);

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
                if (! empty($explanation)) {
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
                $check = ($coeff !== '' ? (int) $coeff : 1) * (int) $correctText + (int) $constant;
                $out .= "\$\$={$coeff}({$correctText}) + {$constant} = {$check}\$\$\n";
                $out .= "Since {$check} = {$target}, our answer **{$variable} = {$correctText}** is confirmed!\n\n";
            } else {
                $out .= "The answer checks out!\n\n";
            }
        }
        // ── Simplification problems (e.g., "Simplify: 3(x + 2) - 2x") ──
        elseif (preg_match('/simplif/i', $questionText)) {
            if (! empty($explanation)) {
                $sentences = array_values(array_filter(array_map('trim', preg_split('/(?<=[.!?])\s+/', $explanation))));
                if (count($sentences) >= 2) {
                    foreach ($sentences as $idx => $step) {
                        $out .= '**Step '.($idx + 1).":** {$step}\n\n";
                    }
                } else {
                    $out .= trim($explanation)."\n\n";
                }
            } else {
                $out .= "**Step 1:** Expand any brackets by multiplying the outside term by everything inside.\n\n";
                $out .= "**Step 2:** Combine like terms with the same variable and exponent.\n\n";
                $out .= "Therefore, the simplified answer is **{$correctText}**\n\n";
            }
        }
        // ── General fallback: expand the database explanation into steps ──
        else {
            if (! empty($explanation)) {
                $cleaned = trim($explanation);
                $sentences = array_values(array_filter(array_map('trim', preg_split('/(?<=[.!?])\s+/', $cleaned))));
                if (count($sentences) >= 2) {
                    foreach ($sentences as $idx => $step) {
                        $out .= '**Step '.($idx + 1).":** {$step}\n\n";
                    }
                } else {
                    $out .= "{$cleaned}\n\n";
                }
            } else {
                $out .= "The correct answer is **{$correctText}**. This follows the core rules of **{$topic}**.\n\n";
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
                    return 'This value is too high. You may have added instead of subtracted, or made an arithmetic error.';
                } elseif ($wrongVal < $correctVal) {
                    return 'This value is too low. You may have divided incorrectly or missed a step.';
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
            return 'When solving equations, always work backwards from the variable: **isolate the variable** by performing the opposite operation on both sides. Remember: what you do to one side, you must do to the other!';
        }
        if (str_contains($topicLower, 'geometry') || str_contains($topicLower, 'angle')) {
            return 'Draw a diagram whenever possible! Geometry is much easier when you can **see** the shapes, angles, and lines. Label everything you know and look for relationships between angles.';
        }
        if (str_contains($topicLower, 'grammar') || str_contains($topicLower, 'tense') || str_contains($topicLower, 'verb')) {
            return 'Look for **time signal words** in the sentence (e.g., "yesterday" = past, "now" = present, "tomorrow" = future). These clues will help you choose the correct tense every time.';
        }
        if (str_contains($topicLower, 'cell') || str_contains($topicLower, 'biology')) {
            return 'Try drawing and labeling a cell from memory! Knowing the **function** of each organelle (not just the name) helps you answer "why" questions confidently.';
        }

        return 'Always read the question carefully and identify the key terms. Practice similar problems to build confidence. Focus on understanding the **why** behind each step, not just memorizing the answer!';
    }
}
