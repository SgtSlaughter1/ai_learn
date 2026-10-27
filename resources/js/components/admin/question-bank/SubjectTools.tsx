import { useEffect, useState } from 'react';
import { ChevronDown, Sigma } from 'lucide-react';
import MathToolbar from './MathToolbar';

/**
 * The one formatting toolbar for the question form. Every subject gets a short general row;
 * a second row matches the subject, so a chemistry teacher sees chemistry first and an
 * English teacher never sees calculus. The full maths panel opens by itself only for
 * subjects that live on equations, and stays one click away ("More symbols") for the rest.
 * Everything inserts plain RichText syntax: teachers never type LaTeX themselves.
 */

interface Tool {
    label: string;
    title: string;
    insert?: string;
    wrap?: [string, string, string];
    className?: string;
}

const GENERAL_TOOLS: Tool[] = [
    { label: 'B', title: 'Bold the selected words', wrap: ['**', '**', 'word'], className: 'font-extrabold' },
    { label: 'U', title: 'Underline the selected word', wrap: ['__', '__', 'word'], className: 'underline' },
    { label: 'Blank ____', title: 'A blank to fill in', insert: ' _____ ' },
    { label: 'Table', title: 'A small table', insert: '\n\n| Heading 1 | Heading 2 |\n|---|---|\n| | |\n' },
];

/** The symbols most questions in any subject reach for. */
const GENERAL_SYMBOLS: Tool[] = [
    { label: 'x²', title: 'A power', insert: '$x^{2}$' },
    { label: 'a/b', title: 'A fraction', insert: '$\\frac{a}{b}$' },
    { label: '√x', title: 'A square root', insert: '$\\sqrt{x}$' },
    { label: '×', title: 'Times', insert: '$\\times$' },
    { label: '÷', title: 'Divided by', insert: '$\\div$' },
    { label: '°', title: 'Degrees', insert: '$^{\\circ}$' },
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
            { label: 'Poem lines', title: 'Lines that keep their breaks', wrap: ['\n```poem\n', '\n```\n', 'First line\nSecond line'] },
        ],
    },
];

/** Subjects whose questions regularly need equations open with the full maths panel. */
export function usesMathsPanel(subjectName: string): boolean {
    return /math|further|phys|chem/i.test(subjectName);
}

const panelKey = (subjectName: string) => `acedrill.mathsPanel.${subjectName.toLowerCase() || 'none'}`;

function rememberedPanel(subjectName: string): boolean {
    try {
        const saved = window.localStorage.getItem(panelKey(subjectName));
        if (saved !== null) return saved === '1';
    } catch {
        // Storage can be unavailable (private window); fall back to the subject default.
    }
    return usesMathsPanel(subjectName);
}

interface SubjectToolsProps {
    subjectName: string;
    /** Which field a click inserts into, e.g. "Question prompt" or "Option B". */
    targetLabel: string;
    currentText: string;
    onInsert: (text: string) => void;
    onWrap: (before: string, after?: string, placeholder?: string) => void;
    onFormatCurrentText: (formatted: string) => void;
}

export default function SubjectTools({ subjectName, targetLabel, currentText, onInsert, onWrap, onFormatCurrentText }: SubjectToolsProps) {
    const subject = SUBJECT_TOOLS.find((s) => s.match.test(subjectName));
    const [panelOpen, setPanelOpen] = useState(() => rememberedPanel(subjectName));

    // A new subject brings its own default (or the teacher's last choice for it).
    useEffect(() => setPanelOpen(rememberedPanel(subjectName)), [subjectName]);

    const togglePanel = () => {
        const next = !panelOpen;
        setPanelOpen(next);
        try {
            window.localStorage.setItem(panelKey(subjectName), next ? '1' : '0');
        } catch {
            // Not remembered this time; the toggle still works.
        }
    };

    // 44px tall on touch screens, compact with a mouse.
    const button = 'min-h-11 sm:min-h-8 min-w-11 sm:min-w-8 px-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] cursor-pointer transition-colors';
    const run = (tool: Tool) => (tool.wrap ? onWrap(...tool.wrap) : onInsert(tool.insert ?? ''));
    const rowLabel = 'text-[11px] font-bold text-[var(--color-muted)] w-full sm:w-20 shrink-0';

    return (
        <div className="space-y-2 pb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-muted)]">
                <span>
                    Inserts into <span className="font-bold text-[var(--color-primary)]">{targetLabel}</span>
                </span>
            </div>

            <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1.5">
                {GENERAL_TOOLS.map((tool) => (
                    <button key={tool.label} type="button" onClick={() => run(tool)} title={tool.title} className={`${button} ${tool.className ?? ''}`}>
                        {tool.label}
                    </button>
                ))}
                <span aria-hidden className="mx-1 h-5 w-px bg-[var(--color-border)]" />
                {GENERAL_SYMBOLS.map((tool) => (
                    <button key={tool.label} type="button" onClick={() => run(tool)} title={tool.title} aria-label={tool.title} className={`${button} font-mono`}>
                        {tool.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={togglePanel}
                    aria-expanded={panelOpen}
                    className={`${button} ml-auto inline-flex items-center gap-1 ${panelOpen ? 'border-[var(--color-primary)]/50 text-[var(--color-primary)]' : ''}`}
                >
                    <Sigma className="w-3.5 h-3.5" aria-hidden />
                    <span>{panelOpen ? 'Fewer symbols' : 'More symbols'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${panelOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
            </div>

            {subject && (
                <div role="toolbar" aria-label={`${subject.name} tools`} className="flex flex-wrap items-center gap-1.5">
                    <span className={rowLabel}>{subject.name}</span>
                    {subject.tools.map((tool) => (
                        <button key={tool.label} type="button" onClick={() => run(tool)} title={tool.title} className={button}>
                            {tool.label}
                        </button>
                    ))}
                </div>
            )}

            {panelOpen && <MathToolbar onInsert={onInsert} onFormatCurrentText={onFormatCurrentText} currentText={currentText} />}
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
