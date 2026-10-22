/**
 * Text and symbol buttons for the question form, shown above the maths toolbar. The
 * text row is always there (underline for English lexis questions, blanks, tables); a
 * second row matches the subject, so a chemistry teacher sees chemistry first.
 * Everything inserts plain RichText syntax: teachers never type LaTeX themselves.
 */

interface Tool {
    label: string;
    title: string;
    insert?: string;
    wrap?: [string, string, string];
}

const TEXT_TOOLS: Tool[] = [
    { label: 'U', title: 'Underline the selected word (__word__)', wrap: ['__', '__', 'word'] },
    { label: 'B', title: 'Bold (**word**)', wrap: ['**', '**', 'word'] },
    { label: 'Blank ____', title: 'A blank to fill in', insert: ' _____ ' },
    { label: 'Table', title: 'A small table', insert: '\n\n| Heading 1 | Heading 2 |\n|---|---|\n| | |\n' },
    { label: 'Poem lines', title: 'Lines that keep their breaks', wrap: ['\n```poem\n', '\n```\n', 'First line\nSecond line'] },
];

const SUBJECT_TOOLS: { match: RegExp; name: string; tools: Tool[] }[] = [
    {
        match: /chem/i,
        name: 'Chemistry',
        tools: [
            { label: 'H₂O', title: 'A formula, e.g. H2SO4', wrap: ['$\\ce{', '}$', 'H2O'] },
            { label: '→', title: 'Reaction arrow', insert: '$\\ce{->}$' },
            { label: '⇌', title: 'Equilibrium arrow', insert: '$\\ce{<=>}$' },
            { label: 'Na⁺', title: 'An ion', wrap: ['$\\ce{', '}$', 'Na+'] },
            { label: 'SO₄²⁻', title: 'A charged ion', insert: '$\\ce{SO4^2-}$' },
            { label: '(aq)', title: 'State: aqueous', insert: '$\\ce{(aq)}$' },
            { label: '(s)', title: 'State: solid', insert: '$\\ce{(s)}$' },
            { label: '(g)', title: 'State: gas', insert: '$\\ce{(g)}$' },
            { label: '↑', title: 'Gas given off', insert: '$\\ce{ ^}$' },
            { label: '¹⁴₆C', title: 'An isotope', insert: '$\\ce{^{14}_{6}C}$' },
            { label: 'ΔH', title: 'Enthalpy change', insert: '$\\Delta H$' },
        ],
    },
    {
        match: /phys/i,
        name: 'Physics',
        tools: [
            { label: 'F⃗', title: 'A vector', wrap: ['$\\vec{', '}$', 'F'] },
            { label: '×10ⁿ', title: 'Standard form', insert: '$3.0 \\times 10^{8}$' },
            { label: 'm s⁻²', title: 'A unit', insert: '$\\mathrm{m\\,s^{-2}}$' },
            { label: 'Ω', title: 'Ohm', insert: '$\\Omega$' },
            { label: 'μ', title: 'Micro', insert: '$\\mu$' },
            { label: 'λ', title: 'Wavelength', insert: '$\\lambda$' },
            { label: 'ρ', title: 'Density', insert: '$\\rho$' },
            { label: 'θ', title: 'Angle', insert: '$\\theta$' },
            { label: '°C', title: 'Degrees Celsius', insert: '$^{\\circ}\\mathrm{C}$' },
        ],
    },
    {
        match: /geog/i,
        name: 'Geography',
        tools: [
            { label: '045°', title: 'A bearing', insert: '$045^{\\circ}$' },
            { label: '1:50 000', title: 'A map scale', insert: '1:50 000' },
            { label: "06°27'N", title: 'A coordinate', insert: "$06^{\\circ}27'\\mathrm{N}$" },
            { label: 'km²', title: 'Square kilometres', insert: '$\\mathrm{km^2}$' },
        ],
    },
    {
        match: /english|literature|lit\b/i,
        name: 'English',
        tools: [
            { label: 'Speaker:', title: 'A line spoken by a character', insert: '**SPEAKER:** ' },
            { label: 'Stress ˈ', title: 'Mark the stressed syllable in capitals', wrap: ['', '', 'reCORD'] },
            { label: '/fəˈnetɪk/', title: 'Phonetic symbols between slashes', wrap: ['/', '/', 'fəˈnetɪk'] },
        ],
    },
];

interface SubjectToolsProps {
    subjectName: string;
    onInsert: (text: string) => void;
    onWrap: (before: string, after?: string, placeholder?: string) => void;
}

export default function SubjectTools({ subjectName, onInsert, onWrap }: SubjectToolsProps) {
    const subject = SUBJECT_TOOLS.find((s) => s.match.test(subjectName));
    const button = 'min-h-8 min-w-8 px-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-bold hover:border-[var(--color-primary)]/50 cursor-pointer';
    const run = (tool: Tool) => (tool.wrap ? onWrap(...tool.wrap) : onInsert(tool.insert ?? ''));

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider w-14">Text</span>
                {TEXT_TOOLS.map((tool) => (
                    <button key={tool.label} type="button" onClick={() => run(tool)} title={tool.title}
                        className={`${button} ${tool.label === 'U' ? 'underline' : ''} ${tool.label === 'B' ? 'font-extrabold' : ''}`}>
                        {tool.label}
                    </button>
                ))}
            </div>
            {subject && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider w-14">{subject.name}</span>
                    {subject.tools.map((tool) => (
                        <button key={tool.label} type="button" onClick={() => run(tool)} title={tool.title} className={button}>
                            {tool.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const OUTSIDE_MATH = (text: string, index: number) => (text.slice(0, index).match(/\$/g)?.length ?? 0) % 2 === 0;

/**
 * Offer to tidy what was typed plainly: a chemical formula or equation in chemistry
 * (H2SO4, N2 + 3H2 <=> 2NH3) or standard form anywhere (3.0 x 10^8).
 */
export function formulaSuggestion(text: string, subjectName: string): { match: string; replacement: string } | null {
    if (!text) return null;
    const standard = /(\d+(?:\.\d+)?)\s*[x×*]\s*10\^\(?(-?\d+)\)?/.exec(text);
    if (standard && OUTSIDE_MATH(text, standard.index)) {
        return { match: standard[0], replacement: `$${standard[1]} \\times 10^{${standard[2]}}$` };
    }
    if (/chem/i.test(subjectName)) {
        // A formula needs a digit after an element (H2O, CO2, 2NH3); equations join them with + -> <=>.
        const formula = '\\d*(?:[A-Z][a-z]?\\d*)*[A-Z][a-z]?\\d+(?:[A-Z][a-z]?\\d*)*';
        const re = new RegExp(`(?<![\\w$\\\\{])${formula}(?:\\s*(?:\\+|->|<=>|→|⇌)\\s*\\d*(?:[A-Z][a-z]?\\d*)+)*`, 'g');
        for (const m of text.matchAll(re)) {
            // Class names and numbering (SS2, JSS3, P4, Q12) look like formulas but are not.
            if (/^(?:J?S{1,3}\d|P\d|Q\d+)$/.test(m[0])) continue;
            if (m.index !== undefined && OUTSIDE_MATH(text, m.index)) {
                return { match: m[0], replacement: `$\\ce{${m[0].replace(/→/g, '->').replace(/⇌/g, '<=>')}}$` };
            }
        }
    }
    return null;
}
