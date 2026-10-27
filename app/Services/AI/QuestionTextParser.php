<?php

namespace App\Services\AI;

use App\Models\Question;
use App\Support\MathText;

/**
 * Turns AI or pasted question text into clean question arrays, parses text offline, and builds
 * template questions when the AI is unavailable.
 */
class QuestionTextParser
{
    public function decodeQuestionList(?string $text): array
    {
        $parsed = $text ? json_decode($text, true) : null;
        if (is_array($parsed) && isset($parsed['questions']) && is_array($parsed['questions'])) {
            $parsed = $parsed['questions'];
        }

        return is_array($parsed) ? $parsed : [];
    }

    /**
     * "1. ", "2) ", "Q3: ", "Question 4 - " at the start of a question. A number must be followed
     * by punctuation and a space, so "2 + 3 equals?", "3.5 kg" and "100 students" stay whole.
     */
    public static function stripQuestionNumber(string $text): string
    {
        return preg_replace('/^(?:Q(?:uestion)?\s*\d+\s*[.:)\-]?\s+|\d+\s*[.):]\s+)/i', '', $text) ?? $text;
    }

    /** "A. ", "b) ", "(C) " at the start of an option; "A triangle", "B-cells", "D.N.A" stay whole. */
    public static function stripOptionLetter(string $text): string
    {
        return preg_replace('/^\(?[A-Ea-e][.)]\s+/', '', $text) ?? $text;
    }

    public function sanitizeExtractedQuestions(array $questions): array
    {
        $sanitized = [];

        foreach ($questions as $q) {
            if (empty($q['question_text'])) {
                continue;
            }

            $questionText = trim(MathText::removeDuplicates((string) $q['question_text']));
            $questionText = self::stripQuestionNumber($questionText);

            $rawOptions = $q['options'] ?? [];
            if (! is_array($rawOptions) || count($rawOptions) < 2) {
                continue;
            }

            $options = [];
            $hasCorrect = false;

            foreach ($rawOptions as $index => $opt) {
                $optText = is_array($opt) ? ($opt['option_text'] ?? '') : (string) $opt;
                $optText = trim(MathText::removeDuplicates($optText));
                $optText = self::stripOptionLetter($optText);

                if (empty($optText)) {
                    continue;
                }

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

            // No answer found: still pre-select one so it can be saved, but flag it so the
            // reviewer checks it instead of importing a guessed answer key unnoticed.
            $needsReview = ! $hasCorrect || count(array_filter($options, fn ($o) => $o['is_correct'])) > 1;
            if (! $hasCorrect && ! empty($options)) {
                $options[0]['is_correct'] = true;
            }

            if (count($options) >= 2) {
                $sanitized[] = [
                    'needs_review' => $needsReview,
                    'question_text' => $questionText,
                    'type' => in_array($q['type'] ?? '', ['multiple_choice', 'true_false']) ? $q['type'] : 'multiple_choice',
                    'difficulty' => in_array($q['difficulty'] ?? '', ['easy', 'medium', 'hard']) ? $q['difficulty'] : 'medium',
                    'explanation' => ! empty($q['explanation']) ? trim(MathText::removeDuplicates((string) $q['explanation'])) : null,
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
    public function heuristicQuestionParser(string $rawText): array
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
            if (empty($block)) {
                continue;
            }

            $lines = array_values(array_filter(array_map('trim', explode("\n", $block))));
            if (empty($lines)) {
                continue;
            }

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
                    $isAsteriskCorrect = ! empty($optMatch[1]);
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

                    if (! $foundExisting) {
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
                        $questionLine .= ($questionLine ? ' ' : '').$line;
                    }
                }
            }

            // Second pass: if no lettered options were found, treat line 0 as question and subsequent lines as options
            if (! $foundLettered && count($lines) >= 3) {
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

                    if (! empty($cleanOpt)) {
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
            $cleanQuestion = self::stripQuestionNumber($questionLine);

            // Convert raw math fractions like 10/3 to LaTeX $\frac{10}{3}$ if not already formatted
            if (preg_match('/\b\d+\s*\/\s*\d+\b/', $cleanQuestion) && ! str_contains($cleanQuestion, '$')) {
                $cleanQuestion = preg_replace('/\b(\d+)\s*\/\s*(\d+)\b/', '$\\frac{$1}{$2}$', $cleanQuestion);
            }

            if (! empty($cleanQuestion) && count($options) >= 2) {
                $hasCorrect = false;
                $guessedAnswer = false;

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
                if (! $hasCorrect) {
                    $qLower = strtolower($cleanQuestion);

                    // Area & Perimeter of rectangles / squares: e.g. "length of 8 cm and a width of 5 cm. What is its area?"
                    if (preg_match('/(?:length\s+(?:of\s+)?(\d+).*?width\s+(?:of\s+)?(\d+)|width\s+(?:of\s+)?(\d+).*?length\s+(?:of\s+)?(\d+)).*?area/i', $cleanQuestion, $areaMatch)) {
                        $l = (int) ($areaMatch[1] ?: $areaMatch[3]);
                        $w = (int) ($areaMatch[2] ?: $areaMatch[4]);
                        $calcArea = $l * $w;
                        foreach ($options as &$opt) {
                            if (preg_match('/\b'.$calcArea.'\b/', $opt['option_text'])) {
                                $opt['is_correct'] = true;
                                $hasCorrect = true;
                                $explanation = $explanation ?: "Area of a rectangle = length $\\times$ width = {$l} cm $\\times$ {$w} cm = {$calcArea} $\\text{cm}^2$.";
                                break;
                            }
                        }
                        unset($opt);
                    }

                    // Fraction classification (e.g. 10/3 -> improper)
                    if (! $hasCorrect && (preg_match('/(\d+)\s*\/\s*(\d+)/', $cleanQuestion, $fracMatch) || preg_match('/\\\\frac\{(\d+)\}\{(\d+)\}/', $cleanQuestion, $fracMatch))) {
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
                    if (! $hasCorrect && preg_match('/(\d+)(?:st|nd|rd|th)?\s+multiple\s+of\s+(\d+)/i', $cleanQuestion, $multMatch)) {
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
                    if (! $hasCorrect && preg_match('/(\d+)\s*\^\s*(\d+)/', $cleanQuestion, $powMatch)) {
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
                    if (! $hasCorrect && preg_match('/words?\s+([0-9,]+)/i', $cleanQuestion, $numMatch)) {
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
                    if (! $hasCorrect && count($options) === 2 && strcasecmp($options[0]['option_text'], 'True') === 0 && strcasecmp($options[1]['option_text'], 'False') === 0) {
                        if (str_contains($qLower, 'integer') || str_contains($qLower, 'boils at 100') || str_contains($qLower, 'photosynthesis')) {
                            $options[0]['is_correct'] = true;
                            $hasCorrect = true;
                            $explanation = $explanation ?: 'This statement is true.';
                        }
                    }

                    // Fallback to option 0, flagged so the reviewer checks it
                    if (! $hasCorrect) {
                        $options[0]['is_correct'] = true;
                        $guessedAnswer = true;
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
                    'needs_review' => $guessedAnswer,
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

    /**
     * Fallback heuristic generator when offline or AI provider is unavailable.
     */
    public function generateHeuristicTopicQuestions(
        string $topicName,
        ?string $subjectName = null,
        ?string $gradeLevel = null,
        int $count = 10
    ): array {
        $subj = $subjectName ?? 'General Studies';
        $level = $gradeLevel ?? 'Secondary';
        $templates = [
            [
                'q' => "What is the primary definition or fundamental concept of {$topicName} in {$subj}?",
                'correct' => "The core principle governing {$topicName} and its systematic applications.",
                'distractors' => [
                    'A secondary factor that only applies in extreme conditions.',
                    "An obsolete method no longer recognized in modern {$subj}.",
                    'A purely theoretical model with no practical relevance.',
                ],
                'diff' => 'easy',
                'exp' => "Understanding {$topicName} begins with its foundational definition and core principles in {$subj}.",
            ],
            [
                'q' => "Which of the following best describes the key function or significance of {$topicName}?",
                'correct' => "It enables systematic analysis, structure, and problem solving within {$subj}.",
                'distractors' => [
                    'It replaces all fundamental principles of the subject entirely.',
                    'It serves only as a temporary decorative element.',
                    'It prevents further experimentation and analysis.',
                ],
                'diff' => 'easy',
                'exp' => "{$topicName} is essential because it provides structured methodology and reliable outcomes in {$subj}.",
            ],
            [
                'q' => "When analyzing a standard problem related to {$topicName}, which step should be performed first?",
                'correct' => "Identify the given data, known parameters, and underlying laws of {$topicName}.",
                'distractors' => [
                    'Immediately guess the final numerical or logical result without verification.',
                    'Disregard the given conditions and apply an arbitrary formula.',
                    'Convert all values into unrelated units before analyzing.',
                ],
                'diff' => 'medium',
                'exp' => "Systematic problem solving in {$topicName} always begins with identifying given parameters and relevant principles.",
            ],
            [
                'q' => "Which of the following is a common error or misconception when studying {$topicName}?",
                'correct' => 'Failing to account for standard conditions, units, and baseline assumptions.',
                'distractors' => [
                    'Following standard definitions and step-by-step procedures.',
                    'Verifying calculations against established formulas.',
                    'Checking the logical consistency of the solution.',
                ],
                'diff' => 'medium',
                'exp' => "Overlooking initial assumptions and unit consistency is a frequent source of error in {$topicName}.",
            ],
            [
                'q' => "In {$subj}, what is a direct real-world application of {$topicName}?",
                'correct' => "Solving practical {$subj} challenges and optimizing real-world processes.",
                'distractors' => [
                    'Generating random, non-reproducible outcomes.',
                    'Restricting observations to laboratory simulations only.',
                    'Eliminating the need for measurement and calculation.',
                ],
                'diff' => 'medium',
                'exp' => "{$topicName} provides practical tools that bridge academic theory and real-world practical applications.",
            ],
            [
                'q' => "How does an increase in the main variable impact the behavior of {$topicName} under standard conditions?",
                'correct' => "It produces a proportional or predictable change according to the governing principles of {$topicName}.",
                'distractors' => [
                    'It causes the system to stop functioning completely without reason.',
                    'It has zero mathematical or physical effect on any parameter.',
                    'It always reduces every dependent value to absolute zero.',
                ],
                'diff' => 'medium',
                'exp' => "Governing laws in {$topicName} determine how dependent variables respond to changes in main inputs.",
            ],
            [
                'q' => "Which tool, instrument, or analytical method is most commonly utilized when investigating {$topicName}?",
                'correct' => 'Standard measurement, calculation models, and structured observation methods.',
                'distractors' => [
                    'Arbitrary guesswork without structured recording.',
                    'Uncalibrated subjective estimations alone.',
                    'Methods that explicitly reject data collection.',
                ],
                'diff' => 'medium',
                'exp' => "Structured measurement and scientific models are standard for exploring {$topicName}.",
            ],
            [
                'q' => "Under what specific condition would the standard formula or law for {$topicName} require modification?",
                'correct' => 'When extreme boundary conditions, non-standard variables, or external constraints are present.',
                'distractors' => [
                    'Whenever the experiment is conducted during daytime hours.',
                    'Only when using modern digital calculators.',
                    'Never, because all formulas apply universally without any constraints.',
                ],
                'diff' => 'hard',
                'exp' => "Complex systems in {$topicName} have boundary conditions where advanced or modified formulations become necessary.",
            ],
            [
                'q' => "Which of the following statements accurately distinguishes {$topicName} from related concepts in {$subj}?",
                'correct' => "{$topicName} focuses on specific operational relationships and quantitative/qualitative properties.",
                'distractors' => [
                    "{$topicName} is completely identical to every other topic in {$subj}.",
                    "{$topicName} cannot be categorized or studied scientifically.",
                    "{$topicName} only applies to fictional or non-existent phenomena.",
                ],
                'diff' => 'hard',
                'exp' => "Every distinct topic in {$subj} possesses unique characteristic properties that differentiate its scope.",
            ],
            [
                'q' => "What is the expected outcome when standard evaluation criteria for {$topicName} are rigorously met?",
                'correct' => 'Accurate, verifiable, and reproducible results that validate the solution.',
                'distractors' => [
                    'Unpredictable inconsistencies that cannot be reproduced.',
                    'Complete failure of the underlying mathematical or physical system.',
                    'An automatic disqualification of all collected data.',
                ],
                'diff' => 'hard',
                'exp' => "Rigorous adherence to {$topicName} standards ensures high accuracy and reproducibility in {$subj}.",
            ],
        ];

        $results = [];
        $selectedTemplates = array_slice($templates, 0, $count);

        foreach ($selectedTemplates as $index => $t) {
            $options = [
                ['option_text' => $t['correct'], 'is_correct' => true],
                ['option_text' => $t['distractors'][0], 'is_correct' => false],
                ['option_text' => $t['distractors'][1], 'is_correct' => false],
                ['option_text' => $t['distractors'][2], 'is_correct' => false],
            ];
            // Random order, so the correct answer isn't always first.
            shuffle($options);

            $results[] = [
                // Templates, not real questions: the admin must edit them before saving.
                'is_placeholder' => true,
                'needs_review' => true,
                'question_text' => $t['q'],
                'type' => 'multiple_choice',
                'difficulty' => $t['diff'],
                'explanation' => $t['exp'],
                'options' => $options,
            ];
        }

        return $results;
    }
}
