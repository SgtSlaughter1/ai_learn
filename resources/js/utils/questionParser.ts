export interface ExtractedOption {
    option_text: string;
    is_correct: boolean;
    sort_order?: number;
}

export interface ExtractedQuestion {
    question_text: string;
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
