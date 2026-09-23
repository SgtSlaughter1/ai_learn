/**
 * Formats mathematical text, HTML entities, superscripts, subscripts,
 * fractions, mixed numbers, and equations from past question sources into clean KaTeX/LaTeX Markdown.
 */
export function formatMathText(text: string | null | undefined): string {
    if (!text) return '';

    let formatted = String(text);

    // 1. Strip Word equation / OCR lenticular and special bracket artifacts (〖...〗, 【...】, etc.)
    formatted = formatted.replace(/[〖【〔〘]/g, '').replace(/[〗】〕〙]/g, '');

    // 2. Decode common HTML entities
    const entityMap: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&times;': ' \\times ',
        '&divide;': ' \\div ',
        '&plusmn;': ' \\pm ',
        '&minus;': ' - ',
        '&radic;': ' \\sqrt ',
        '&le;': ' \\le ',
        '&ge;': ' \\ge ',
        '&ne;': ' \\neq ',
        '&pi;': ' \\pi ',
        '&theta;': ' \\theta ',
        '&alpha;': ' \\alpha ',
        '&beta;': ' \\beta ',
        '&gamma;': ' \\gamma ',
        '&lambda;': ' \\lambda ',
        '&deg;': '^{\\circ}',
        '&micro;': ' \\mu ',
        '&infin;': ' \\infty ',
    };

    for (const [entity, replacement] of Object.entries(entityMap)) {
        formatted = formatted.replaceAll(entity, replacement);
    }

    // Normalize unicode symbols & dashes
    formatted = formatted.replace(/[\u2212\u2013\u2014]/g, '-');
    formatted = formatted.replace(/×/g, ' \\times ');
    formatted = formatted.replace(/÷/g, ' \\div ');
    formatted = formatted.replace(/±/g, ' \\pm ');
    formatted = formatted.replace(/≤/g, ' \\le ');
    formatted = formatted.replace(/≥/g, ' \\ge ');
    formatted = formatted.replace(/≠/g, ' \\neq ');
    formatted = formatted.replace(/√/g, ' \\sqrt ');
    formatted = formatted.replace(/π/g, ' \\pi ');
    formatted = formatted.replace(/θ/g, ' \\theta ');
    formatted = formatted.replace(/α/g, ' \\alpha ');
    formatted = formatted.replace(/β/g, ' \\beta ');
    formatted = formatted.replace(/∞/g, ' \\infty ');

    // 3. Normalize Degree & Temperature OCR artifacts: 1080o, 180o, 20oC, 100oC, 45°, 90º
    formatted = formatted.replace(/(\b\d+(?:\.\d+)?)\s*o\s*C\b/gi, '$1^{\\circ}\\text{C}');
    formatted = formatted.replace(/(\b\d+(?:\.\d+)?)\s*o\s*F\b/gi, '$1^{\\circ}\\text{F}');
    formatted = formatted.replace(/(\b\d+(?:\.\d+)?)\s*(?:o|°|º)(?![a-zA-Z0-9])/g, '$1^{\\circ}');
    formatted = formatted.replace(/(\b\d+(?:\.\d+)?)\s*\\deg\b/g, '$1^{\\circ}');

    // Normalize OCR artifacts & Units
    formatted = formatted.replace(/([\)a-zA-Z0-9\}])\s*<-\s*([0-9]+)/g, '$1^{-$2}');
    formatted = formatted.replace(/([\)a-zA-Z0-9\}])\s*<\s*-\s*([0-9]+)/g, '$1^{-$2}');

    // Convert units like 110cm2 -> 110 cm^2
    formatted = formatted.replace(/(\d+)\s*(cm|mm|km|m)2\b/g, '$1 $2^{2}');
    formatted = formatted.replace(/(\d+)\s*(cm|mm|km|m)3\b/g, '$1 $2^{3}');

    // 4. Convert HTML <sup> and <sub> tags to LaTeX notation FIRST
    for (let i = 0; i < 3; i++) {
        formatted = formatted.replace(/<sup>(.*?)<\/sup>/gi, (_match, p1) => {
            let cleanExp = p1.trim();
            while (cleanExp.startsWith('(') && cleanExp.endsWith(')')) {
                cleanExp = cleanExp.slice(1, -1).trim();
            }
            return `^{${cleanExp}}`;
        });
        formatted = formatted.replace(/<sub>(.*?)<\/sub>/gi, (_match, p1) => {
            let cleanSub = p1.trim();
            while (cleanSub.startsWith('(') && cleanSub.endsWith(')')) {
                cleanSub = cleanSub.slice(1, -1).trim();
            }
            return `_{${cleanSub}}`;
        });
    }

    // Combinations & Permutations normalization: ^{n+1} C_{3} or ^{n}C_{3} -> {}^{n+1}C_{3}
    formatted = formatted.replace(/\^\{([^}]+)\}\s*([CPcp])\s*(?:_\{([^}]+)\}|([a-zA-Z0-9]+))/g, (_m, n, op, r1, r2) => {
        const r = (r1 || r2).trim();
        return `{}^{${n.trim()}}${op.toUpperCase()}_{${r}}`;
    });
    formatted = formatted.replace(/\^([a-zA-Z0-9]+)\s*([CPcp])\s*(?:_\{([^}]+)\}|([a-zA-Z0-9]+))/g, (_m, n, op, r1, r2) => {
        const r = (r1 || r2).trim();
        return `{}^{${n.trim()}}${op.toUpperCase()}_{${r}}`;
    });

    // Fix spacing between LaTeX command and exponent/subscript (e.g. \alpha ^{2} -> \alpha^{2})
    formatted = formatted.replace(/(\\[a-zA-Z]+)\s+([\^_])/g, '$1$2');

    // Add missing space after closing parenthesis before words (e.g. )is -> ) is)
    formatted = formatted.replace(/\)(?=[a-zA-Z]{2,})/g, ') ');

    const nestedBraces = '(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*';
    const nestedParens = '(?:[^()]|\\([^()]*\\))*';

    // 5. Bare exponents: 2^3 -> 2^{3}, 4^(1/3) -> 4^{\dfrac{1}{3}}, 2^-1 -> 2^{-1}, x^2 -> x^{2}
    formatted = formatted.replace(/(?<=[a-zA-Z0-9\)])\s*\^\s*(-?[a-zA-Z0-9]+)(?![a-zA-Z0-9\{])/g, '^{$1}');
    formatted = formatted.replace(/\^\s*\(\s*(-?[a-zA-Z0-9\/]+)\s*\)/g, '^{$1}');
    // Exponents with fractions: ^{3/4} or ^{-1/4} or ^{(-1)/2} or ^{(1/4)} -> ^{\dfrac{3}{4}} or ^{-\dfrac{1}{4}}
    formatted = formatted.replace(/\^\{\s*\(?\s*(-?\d+)\s*\)?\s*\/\s*\(?\s*(\d+)\s*\)?\s*\}/g, (_m, num, den) => {
        const n = parseInt(num, 10);
        if (n < 0) return `^{-\\dfrac{${Math.abs(n)}}{${den}}}`;
        return `^{\\dfrac{${n}}{${den}}}`;
    });
    // Clean any negative numerators in exponents: ^{\frac{-1}{2}} -> ^{-\dfrac{1}{2}}
    formatted = formatted.replace(/\^\{\s*\\(?:dfrac|frac)\{\s*-\s*(\d+)\s*\}\{\s*(\d+)\s*\}\s*\}/g, "^{-\\dfrac{$1}{$2}}");

    // 6. Logarithm normalization:
    formatted = formatted.replace(new RegExp(`\\blog\\s*_\\{(${nestedBraces})\\}\\s*\\^\\{(${nestedBraces})\\}`, 'gi'), (_m, base, arg) => {
        let cleanBase = base.trim();
        while (cleanBase.startsWith('(') && cleanBase.endsWith(')')) {
            cleanBase = cleanBase.slice(1, -1).trim();
        }
        return `\\log_{${cleanBase}} ${arg} `;
    });
    formatted = formatted.replace(new RegExp(`\\blog\\s*_\\{(${nestedBraces})\\}`, 'gi'), (_m, base) => {
        let cleanBase = base.trim();
        while (cleanBase.startsWith('(') && cleanBase.endsWith(')')) {
            cleanBase = cleanBase.slice(1, -1).trim();
        }
        return `\\log_{${cleanBase}} `;
    });
    formatted = formatted.replace(/\blog\s*_([a-zA-Z0-9]+)/gi, (_m, base) => `\\log_{${base}} `);
    formatted = formatted.replace(/\blog\s*(\d+)\s*\/\s*(\d+)\b/gi, (_m, num, den) => `\\log_{\\dfrac{${num}}{${den}}} `);
    formatted = formatted.replace(/\blog\s*(\d+)(?=\s+[a-zA-Z0-9\(\\\.\^]+|\([^\)\n]+\))/gi, (_m, base) => `\\log_{${base}} `);
    formatted = formatted.replace(/(?<=\d|\b)(log|ln)\s*(\d+(?:\.\d+)?|[a-zA-Z])(?![a-zA-Z0-9_\{])/gi, (_match, fn, arg) => `\\${fn.toLowerCase()} ${arg}`);
    formatted = formatted.replace(/\b(log|ln)\b(?!\s*[_\{])/gi, (match) => `\\${match.toLowerCase()} `);

    // 7. Parenthesized fractions with exponents: (81/16)^{...} or (16/81 )^{...} -> \left(\dfrac{81}{16}\right)^{...}
    formatted = formatted.replace(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)(?=\s*\^)/g, '\\left(\\dfrac{$1}{$2}\\right)');

    // 8. Normalize redundant nested parens: ((expr)) -> (expr)
    formatted = formatted.replace(/\(\(\s*([^()]+)\s*\)\)/g, '($1)');

    // 9. Normalize \sqrt with decimals and numbers:
    formatted = formatted.replace(/\\sqrt\s*\(([^)\n]+)\)/g, '\\sqrt{$1}');
    formatted = formatted.replace(/\\sqrt\s*(\d+(?:\.\d+)?)/g, '\\sqrt{$1}');
    formatted = formatted.replace(/\\sqrt\s*([a-zA-Z])(?![a-zA-Z])/g, '\\sqrt{$1}');

    // 10. Mixed numbers: e.g. 3 (2/3) or 3(2/3) or 5 2/3 or 2(2/3) -> 3\dfrac{2}{3}
    formatted = formatted.replace(/(\b\d+)\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g, '$1\\dfrac{$2}{$3}');
    formatted = formatted.replace(/(\b\d+)\s+(\d+)\s*\/\s*(\d+)\b/g, '$1\\dfrac{$2}{$3}');

    // 11. Simple numeric fractions in parentheses: (2/3) or (16/81 ) -> \left(\dfrac{16}{81}\right) or \dfrac{2}{3}
    formatted = formatted.replace(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)(?=\s*\^)/g, '\\left(\\dfrac{$1}{$2}\\right)');
    formatted = formatted.replace(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g, '\\dfrac{$1}{$2}');

    // 12. Standalone numeric/decimal fractions like 5/6, 11/15, 3/4, 0.025/0.05 (outside ^{...}) -> \dfrac
    formatted = formatted.replace(/(?<!\^\{)(?<=\s|\\times|\\div|\\pm|\+|\-|\=|\<|\>|\(|^)(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?=\s|\\times|\\div|\\pm|\+|\-|\=|\<|\>|\)|$)/g, '\\dfrac{$1}{$2}');

    // 13. Handle division of parenthesized expressions:
    formatted = formatted.replace(/\(([^()\n]*(?:\\(?:dfrac|frac)\b)[^()\n]*\\times[^()\n]*)\)\s*\/\s*\(([^()\n]*(?:\\(?:dfrac|frac)\b)[^()\n]*\\times[^()\n]*)\)/g, '($1) \\div ($2)');

    // 14. Handle algebraic & complex fractions (with sqrt, parens, braces, products)
    const termPattern = `(?:` +
        `\\\\sqrt\\{${nestedBraces}\\}|` +
        `\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}|` +
        `\\\\[a-zA-Z]+(?:\\{${nestedBraces}\\})*(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `(?:\\d+\\s*)?\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}|` +
        `[a-zA-Z0-9\.]+(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*` +
    `)`;

    let prev;
    do {
        prev = formatted;
        formatted = formatted.replace(new RegExp(`\\(\\s*(${nestedParens})\\s*\\)\\s*\\/\\s*\\(\\s*(${nestedParens})\\s*\\)`, 'g'), '\\dfrac{$1}{$2}');
        formatted = formatted.replace(new RegExp(`\\{\\s*(${nestedBraces})\\s*\\}\\s*\\/\\s*\\{\\s*(${nestedBraces})\\s*\\}`, 'g'), '\\dfrac{$1}{$2}');
        formatted = formatted.replace(new RegExp(`\\(\\s*(${nestedParens})\\s*\\)\\s*\\/\\s*(${termPattern})`, 'g'), (_m, p1, p2) => {
            return `\\dfrac{${p1.trim()}}{${p2.trim()}}`;
        });
        formatted = formatted.replace(new RegExp(`\\{\\s*(${nestedBraces})\\s*\\}\\s*\\/\\s*(${termPattern})`, 'g'), (_m, p1, p2) => {
            return `\\dfrac{${p1.trim()}}{${p2.trim()}}`;
        });
        formatted = formatted.replace(new RegExp(`(${termPattern})\\s*\\/\\s*\\(\\s*(${nestedParens})\\s*\\)`, 'g'), (_m, p1, p2) => {
            return `\\dfrac{${p1.trim()}}{${p2.trim()}}`;
        });
        formatted = formatted.replace(new RegExp(`(${termPattern})\\s*\\/\\s*\\{\\s*(${nestedBraces})\\s*\\}`, 'g'), (_m, p1, p2) => {
            return `\\dfrac{${p1.trim()}}{${p2.trim()}}`;
        });
    } while (formatted !== prev);

    // Simple algebraic / decimal terms: mn/a^{2}, pq/b^{2}, 2x/3y, a/b^{2}, 0.025/0.05 etc.
    formatted = formatted.replace(/(?<![a-zA-Z0-9\.\^\{\}\_\/\\])([a-zA-Z0-9\.]+(?:[\^_]\{[^{}]+\})*)\s*\/\s*([a-zA-Z0-9\.]+(?:[\^_]\{[^{}]+\})*)(?![a-zA-Z0-9\.\^\{\}\_\/\\])/g, '\\dfrac{$1}{$2}');

    // Strip any existing $ before wrapping
    formatted = formatted.replaceAll('$', '');

    // 15. Find and wrap all math equations and expressions in $...$
    const englishWords = 'simplify|simply|evaluate|solve|calculate|express|determine|expand|factorise|factorize|find|given|sum|angles|angle|polygon|interior|exterior|sides|side|number|value|points|point|between|distance|correct|decimal|place|places|and|or|if|is|the|where|when|for|to|at|in|on|by|of|with|then|such|that|units|unit|from|sale|bags|corn|many|give|him|maximum|profit|realises|trader|equation|subject|formula|make|what|which|how|whose|above|below|table|shows|physics|test|mode|group|students|student|answer|questions|question|ways|done|bearing|girl|walks|kettle|electric|water|temperature|rise|rate|rated|mass|power|man|stairs|flight|height|density|gold|volume|probability|red|black|white|marbles|electrolysis|reaction|anode|platinum|electrodes|substance|resistors|connected|series|molar|nuclear|fission|ethyne|burning|carbon|oxide|produced';

    const singleAtom = `(?:` +
        `(?:\\{\\})?\\^\\{${nestedBraces}\\}[CPcp](?:_\\{${nestedBraces}\\}|_[0-9a-zA-Z]+)?|` +
        `\\\\left\\(\\s*\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}\\s*\\\\right\\)(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `\\(\\s*\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}\\s*\\)(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `\\\\sqrt\\{${nestedBraces}\\}(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `\\\\(?!left|right|log|ln)[a-zA-Z]+(?:\\{${nestedBraces}\\})*(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `(?:\\d+\\s*)?\\((?:[^()\\n]|\\([^()\\n]*\\))+\\)(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `(?<![a-zA-Z])(?!(?:${englishWords})\\b)(?:-?\\d+(?:\\.\\d+)?(?=[a-zA-Z]))?[a-zA-Z]+(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `-?\\d+(?:\\.\\d+)?(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*(?!\\s*\\\\(?:log|ln))` +
    `)`;

    const mathUnit = `(?:(?:\\d+(?:\\.\\d+)?\\s*)?(?:\\\\log|\\\\ln)(?:_\\{${nestedBraces}\\}|_[0-9a-zA-Z]+)?(?:\\s*${singleAtom})*|${singleAtom})`;
    const mathOp = `(?:[-+*/=<>]|\\\\times|\\\\div|\\\\pm|\\\\le|\\\\ge|\\\\neq|\\\\approx)`;

    const mathChainRegex = new RegExp(
        `\\(\\s*${singleAtom}\\s*,\\s*${singleAtom}\\s*\\)|` +
        `(?:${mathUnit}\\s*${mathOp}\\s*)+${mathUnit}|` +
        `\\\\left\\(\\s*\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}\\s*\\\\right\\)(?:[\\^_]\\{${nestedBraces}\\}|[\\^_][a-zA-Z0-9]+)*|` +
        `\\(\\s*\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}\\s*\\)(?:[\\^_]\\{${nestedBraces}\\})*|` +
        `\\d*\\\\(?:dfrac|frac)\\{${nestedBraces}\\}\\{${nestedBraces}\\}(?:[\\^_]\\{${nestedBraces}\\})*|` +
        `\\\\sqrt\\{${nestedBraces}\\}(?:[\\^_]\\{${nestedBraces}\\})*|` +
        `\\((?:[^()\\n]|\\([^()\\n]*\\))+\\)(?:[\\^_]\\{${nestedBraces}\\})+|` +
        `(?:[a-zA-Z0-9\\.]+)(?:[\\^_]\\{${nestedBraces}\\})+|` +
        `(?:\\d+(?:\\.\\d+)?\\s*)?(?:\\\\log|\\\\ln)(?:_\\{${nestedBraces}\\}|_[0-9a-zA-Z]+)?(?:\\s*${singleAtom})+|` +
        `\\\\(?!left|right)[a-zA-Z]+(?:\\{${nestedBraces}\\})*(?:\\s*${mathOp}\\s*${mathUnit}|\\s*=\\s*${mathUnit})?`,
        'gi'
    );

    formatted = formatted.replace(mathChainRegex, (match) => {
        const trimmed = match.trim();
        if (/^[a-zA-Z]{2,}$/.test(trimmed)) return trimmed;
        return '$' + trimmed + '$';
    });

    // 16. Clean any internal $ inside \dfrac{...}{...}, \frac{...}{...}, or \sqrt{...}
    const cleanFracRegex = new RegExp(`\\\\(?:dfrac|frac)\\{(${nestedBraces})\\}\\{(${nestedBraces})\\}`, 'g');
    for (let i = 0; i < 3; i++) {
        formatted = formatted.replace(cleanFracRegex, (_m, num, den) => {
            return `\\dfrac{${num.replaceAll('$', '')}}{${den.replaceAll('$', '')}}`;
        });
        formatted = formatted.replace(/\\sqrt\{([^{}]+)\}/g, (_m, inner) => {
            return `\\sqrt{${inner.replaceAll('$', '')}}`;
        });
    }

    // 17. Merge adjacent inline math blocks separated by math operators or spaces
    for (let i = 0; i < 5; i++) {
        formatted = formatted.replace(/\$\s*([-+*/=<>]|\\times|\\div|\\pm|\\le|\\ge|\\neq)\s*\$/g, (_m, op) => {
            return ` ${op.trim()} `;
        });
        formatted = formatted.replace(/\$\s*\$/g, ' ');
    }

    // Merge math token immediately followed by \times and a number/parenthesis
    formatted = formatted.replace(/\$\s*\\times\s*(\d+|\([^\)\n]+\))\s*\$/g, ' \\times $1 ');
    formatted = formatted.replace(/\$\s*\\times\s*(\d+)/g, ' \\times $1$');
    formatted = formatted.replace(/\$\s*\\times\s*\$/g, ' \\times ');

    // 18. Normalize * to \times inside math blocks
    formatted = formatted.replace(/\$([^\$]+)\$/g, (_match, mathContent) => {
        const cleaned = mathContent.replace(/(?<=[0-9a-zA-Z\)\}])\s*\*\s*(?=[0-9a-zA-Z\(\{])/g, ' \\times ');
        return `$${cleaned}$`;
    });

    // 19. Clean up multiple spaces inside math blocks
    formatted = formatted.replace(/\$([^\$]+)\$/g, (_match, mathContent) => {
        let cleaned = mathContent.replace(/\s+/g, ' ');
        cleaned = cleaned.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
        cleaned = cleaned.replace(/\\(alpha|beta|gamma|theta|pi|mu|lambda)\s*([,)])/g, '\\$1$2');
        return `$${cleaned.trim()}$`;
    });

    // 20. Final cleanup: strip any empty math blocks or double dollar signs
    formatted = formatted.replace(/\$\s*\$/g, '');
    formatted = formatted.replace(/\$\$+([^\$]+)\$\$+/g, (_m, p1) => `$${p1}$`);

    // 21. Replace <br> / <br/> with clean newlines
    formatted = formatted.replace(/<br\s*\/?>/gi, '\n');

    // 22. Strip any other stray HTML wrapper tags
    formatted = formatted.replace(/<\/?(span|div|p|strong|b|em|i|u|font|small|big)[^>]*>/gi, '');

    return formatted;
}
