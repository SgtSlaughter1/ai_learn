export interface ExtractedOption {
    option_text: string;
    is_correct: boolean;
    sort_order?: number;
}

export interface ExtractedQuestion {
    question_text: string;
    image_url?: string | null;
    type: string;
    difficulty: string;
    explanation: string | null;
    options: ExtractedOption[];
}

export function parseQuestionsOffline(rawText: string): ExtractedQuestion[] {
    const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let blocks = cleanText.split(/\n\s*(?=(?:(?:Q(?:uestion)?\s*\d+|\d+)[.:)\-]\s*))/i);

    if (blocks.length <= 1) {
        const paragraphs = cleanText.split(/\n\s*\n\s*\n+/);
        if (paragraphs.length > 1) {
            blocks = paragraphs;
        }
    }

    const results: ExtractedQuestion[] = [];

    for (const block of blocks) {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) continue;

        let questionLine = '';
        const options: ExtractedOption[] = [];
        let explanation: string | null = null;
        let markedAnswer: string | null = null;
        let foundLettered = false;

        for (const line of lines) {
            const ansMatch = line.match(
                /^(?:\*?\s*(?:Ans(?:wer)?|Correct\s*(?:Option|Answer)?)\s*[:=\-]?\s*\(?([A-Da-d])\)?|\*\s*\(?([A-Da-d])\)?(?:\s+.*)?)$/i
            );
            if (ansMatch) {
                markedAnswer = (ansMatch[1] || ansMatch[2]).toUpperCase();
                continue;
            }

            // Check if line is an option: "A. ...", "B) ...", "(A) ...", "*A) ...", "A: ...", "A - ..."
            const optMatch = line.match(
                /^(\*?)\s*(?:\(([A-Da-d])\)|([A-Da-d])\s*[.:)\-\]]|\b([A-Da-d])\s*[:.)\-])\s*(.+)$/i
            );
            if (optMatch) {
                foundLettered = true;
                const isAsterisk = Boolean(optMatch[1]);
                const text = optMatch[5].trim();
                const existing = options.find((o) => o.option_text === text);
                if (!existing) {
                    options.push({
                        option_text: text,
                        is_correct: isAsterisk,
                    });
                }
            } else if (/^(?:Explanation|Hint)\s*[:=\-]\s*(.+)$/i.test(line)) {
                explanation = line.replace(/^(?:Explanation|Hint)\s*[:=\-]\s*/i, '').trim();
            } else {
                if (options.length === 0) {
                    questionLine += (questionLine ? ' ' : '') + line;
                }
            }
        }

        if (!foundLettered && lines.length >= 3) {
            options.length = 0;
            questionLine = lines[0];
            for (let i = 1; i < lines.length; i++) {
                const l = lines[i];
                if (/^(?:Ans(?:wer)?|Correct)\s*[:=\-]?\s*(.+)$/i.test(l)) {
                    markedAnswer = l.replace(/^(?:Ans(?:wer)?|Correct)\s*[:=\-]?\s*/i, '').trim();
                    continue;
                }
                if (/^(?:Explanation|Hint)\s*[:=\-]\s*(.+)$/i.test(l)) {
                    explanation = l.replace(/^(?:Explanation|Hint)\s*[:=\-]\s*/i, '').trim();
                    continue;
                }
                const isAsterisk = l.startsWith('*');
                const cleanOpt = l.replace(/^\*+\s*/, '').trim();
                if (cleanOpt) {
                    options.push({
                        option_text: cleanOpt,
                        is_correct: isAsterisk,
                    });
                }
            }
        }

        let cleanQuestion = questionLine
            .replace(/^(?:Q(?:uestion)?\s*\d+[\s.:)\-]+|\d+[\s.:)\-]+)\s*/i, '')
            .trim();

        // Convert simple math fractions like 10/3 to LaTeX $\frac{10}{3}$
        if (/\b\d+\s*\/\s*\d+\b/.test(cleanQuestion) && !cleanQuestion.includes('$')) {
            cleanQuestion = cleanQuestion.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, '$\\frac{$1}{$2}$');
        }

        if (cleanQuestion && options.length >= 2) {
            let hasCorrect = false;
            options.forEach((opt, idx) => {
                if (markedAnswer) {
                    const letter = String.fromCharCode(65 + idx);
                    if (
                        letter === markedAnswer.toUpperCase() ||
                        opt.option_text.toLowerCase() === markedAnswer.toLowerCase()
                    ) {
                        opt.is_correct = true;
                        hasCorrect = true;
                    }
                } else if (opt.is_correct) {
                    hasCorrect = true;
                }
            });

            if (!hasCorrect) {
                // Area of rectangle: length of X and width of Y
                const areaMatch = cleanQuestion.match(
                    /(?:length\s+(?:of\s+)?(\d+).*?width\s+(?:of\s+)?(\d+)|width\s+(?:of\s+)?(\d+).*?length\s+(?:of\s+)?(\d+)).*?area/i
                );
                if (areaMatch) {
                    const l = parseInt(areaMatch[1] || areaMatch[3], 10);
                    const w = parseInt(areaMatch[2] || areaMatch[4], 10);
                    const calcArea = l * w;
                    const matchOpt = options.find((o) =>
                        new RegExp('\\b' + calcArea + '\\b').test(o.option_text)
                    );
                    if (matchOpt) {
                        matchOpt.is_correct = true;
                        hasCorrect = true;
                        explanation = `Area of a rectangle = length × width = ${l} cm × ${w} cm = ${calcArea} cm².`;
                    }
                }

                const fracMatch = cleanQuestion.match(/\\frac\{(\d+)\}\{(\d+)\}|(\d+)\s*\/\s*(\d+)/);
                if (!hasCorrect && fracMatch) {
                    const num = parseInt(fracMatch[1] || fracMatch[3], 10);
                    const den = parseInt(fracMatch[2] || fracMatch[4], 10);
                    if (num > den) {
                        const impOpt = options.find((o) => /improper/i.test(o.option_text));
                        if (impOpt) {
                            impOpt.is_correct = true;
                            hasCorrect = true;
                        }
                    } else if (num < den) {
                        const propOpt = options.find((o) => /proper/i.test(o.option_text));
                        if (propOpt) {
                            propOpt.is_correct = true;
                            hasCorrect = true;
                        }
                    }
                }

                const multMatch = cleanQuestion.match(/(\d+)(?:st|nd|rd|th)?\s+multiple\s+of\s+(\d+)/i);
                if (!hasCorrect && multMatch) {
                    const val = parseInt(multMatch[1], 10) * parseInt(multMatch[2], 10);
                    const matchOpt = options.find((o) => o.option_text.trim() === String(val));
                    if (matchOpt) {
                        matchOpt.is_correct = true;
                        hasCorrect = true;
                    }
                }

                // Powers e.g. 5^3
                const powMatch = cleanQuestion.match(/(\d+)\s*\^\s*(\d+)/);
                if (!hasCorrect && powMatch) {
                    const base = parseInt(powMatch[1], 10);
                    const exp = parseInt(powMatch[2], 10);
                    const val = Math.pow(base, exp);
                    const matchOpt = options.find((o) => o.option_text.trim() === String(val));
                    if (matchOpt) {
                        matchOpt.is_correct = true;
                        hasCorrect = true;
                    }
                }

                if (!hasCorrect && options.length > 0) {
                    options[0].is_correct = true;
                }
            }

            const isTrueFalse =
                options.length === 2 &&
                options.some((o) => /true/i.test(o.option_text)) &&
                options.some((o) => /false/i.test(o.option_text));

            results.push({
                question_text: cleanQuestion,
                type: isTrueFalse ? 'true_false' : 'multiple_choice',
                difficulty: 'medium',
                explanation: explanation || null,
                options,
            });
        }
    }

    return results;
}

export function generateOfflineQuestionsForTopic(
    topicName: string,
    subjectName: string = 'General Studies',
    count: number = 10
): ExtractedQuestion[] {
    const templates = [
        {
            q: `What is the foundational concept or primary definition of ${topicName} in ${subjectName}?`,
            correct: `The core scientific principle and systematic methodology of ${topicName}.`,
            distractors: [
                `An incidental condition that only applies in isolated scenarios.`,
                `An obsolete theoretical framework no longer recognized in ${subjectName}.`,
                `A subjective viewpoint without empirical or mathematical basis.`,
            ],
            diff: 'easy',
            exp: `Mastering ${topicName} begins with understanding its core definition and standard principles in ${subjectName}.`,
        },
        {
            q: `Which of the following best summarizes the primary importance or role of ${topicName}?`,
            correct: `It facilitates structured problem analysis and reproducible outcomes in ${subjectName}.`,
            distractors: [
                `It replaces all baseline definitions across the entire curriculum.`,
                `It is applied only when standard procedures fail unexpectedly.`,
                `It eliminates the need to verify experimental or numerical results.`,
            ],
            diff: 'easy',
            exp: `${topicName} provides students with the critical structural foundation needed to solve complex problems.`,
        },
        {
            q: `When approaching an assessment problem on ${topicName}, what is the recommended first step?`,
            correct: `Identify all given parameters, boundary conditions, and governing laws of ${topicName}.`,
            distractors: [
                `Select the largest available number from the multiple choices immediately.`,
                `Ignore the stated conditions and proceed with an arbitrary formula.`,
                `Skip writing out the working or mathematical rationale.`,
            ],
            diff: 'medium',
            exp: `Effective problem solving in ${topicName} requires listing given data and selecting the correct governing relationship.`,
        },
        {
            q: `Which of the following is a key distinguishing characteristic of ${topicName}?`,
            correct: `Its specific operational properties and measurable relationships within ${subjectName}.`,
            distractors: [
                `It has zero distinctive properties compared to other topics.`,
                `It cannot be described through mathematical or empirical means.`,
                `It only applies in non-physical hypothetical models.`,
            ],
            diff: 'medium',
            exp: `Each topic in ${subjectName} exhibits defined characteristics that separate it from related concepts.`,
        },
        {
            q: `In practical applications of ${subjectName}, how is ${topicName} most commonly implemented?`,
            correct: `To solve real-world challenges and optimize analytical processes.`,
            distractors: [
                `To generate random and uncontrolled data variations.`,
                `To restrict applications strictly to theoretical textbook problems.`,
                `To bypass standard unit measurements and conversions.`,
            ],
            diff: 'medium',
            exp: `${topicName} connects classroom theory to practical technology, engineering, and scientific applications.`,
        },
        {
            q: `What is a common trap or misconception students encounter when working on ${topicName}?`,
            correct: `Neglecting baseline assumptions, standard unit conversions, or sign conventions.`,
            distractors: [
                `Verifying the calculation using alternative methods.`,
                `Following standard definitions step-by-step.`,
                `Checking the logical consistency of the derived answer.`,
            ],
            diff: 'medium',
            exp: `Unit inconsistencies and sign errors represent the most common pitfalls when solving ${topicName} questions.`,
        },
        {
            q: `How does modifying the primary independent variable affect ${topicName} under standard conditions?`,
            correct: `It leads to a predictable, governed change in the dependent variables of ${topicName}.`,
            distractors: [
                `It causes an immediate catastrophic collapse of the mathematical system.`,
                `It produces completely random outputs with no mathematical correlation.`,
                `It causes every dependent parameter to become zero instantly.`,
            ],
            diff: 'medium',
            exp: `Physical and mathematical relationships in ${topicName} define predictable responses to variable changes.`,
        },
        {
            q: `Under which of the following circumstances must standard rules for ${topicName} be adapted?`,
            correct: `When operating at extreme limits, boundary constraints, or non-ideal conditions.`,
            distractors: [
                `Whenever calculations are performed during morning hours.`,
                `Only when using manual paper methods instead of computers.`,
                `Never, since all elementary formulas apply universally without boundary limits.`,
            ],
            diff: 'hard',
            exp: `Advanced scenarios in ${topicName} introduce boundary conditions requiring adapted or higher-order formulas.`,
        },
        {
            q: `Which instrument or analytical technique is most appropriate for studying ${topicName}?`,
            correct: `Standard calibrated tools, structured tables, and mathematical models.`,
            distractors: [
                `Uncalibrated estimations without reference standards.`,
                `Guesswork without systematic note-taking.`,
                `Techniques that intentionally discard measurement accuracy.`,
            ],
            diff: 'hard',
            exp: `Scientific exploration of ${topicName} relies on standardized tools and reproducible analytical methods.`,
        },
        {
            q: `What outcome confirms that a comprehensive solution for ${topicName} is correct?`,
            correct: `The final solution satisfies all boundary conditions and unit dimensions consistently.`,
            distractors: [
                `The result contradicts all fundamental laws of ${subjectName}.`,
                `The units do not match the expected dimensional quantity.`,
                `The solution cannot be replicated under identical test conditions.`,
            ],
            diff: 'hard',
            exp: `Dimensional consistency and boundary validation prove the correctness of any ${topicName} solution.`,
        },
    ];

    const targetList = templates.slice(0, Math.max(1, Math.min(count, templates.length)));

    return targetList.map((t) => {
        const rawOptions = [
            { option_text: t.correct, is_correct: true },
            { option_text: t.distractors[0], is_correct: false },
            { option_text: t.distractors[1], is_correct: false },
            { option_text: t.distractors[2], is_correct: false },
        ];
        // Shuffle options
        const options = rawOptions.sort(() => Math.random() - 0.5);

        return {
            question_text: t.q,
            type: 'multiple_choice',
            difficulty: t.diff,
            explanation: t.exp,
            options,
        };
    });
}

