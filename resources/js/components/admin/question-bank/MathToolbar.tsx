import { useState } from 'react';
import { Sigma, Sparkles, BookOpen, Check } from 'lucide-react';
import { formatMathText } from '@/utils/mathFormatter';

export interface MathSnippet {
    label: string;
    latex: string;
    display: string;
    description?: string;
}

interface MathToolbarProps {
    onInsert: (snippet: string) => void;
    onFormatCurrentText?: (formatted: string) => void;
    currentText?: string;
}

export default function MathToolbar({
    onInsert,
    onFormatCurrentText,
    currentText = '',
}: MathToolbarProps) {
    const [activeCategory, setActiveCategory] = useState<'fractions' | 'functions' | 'quadratic' | 'trig_calc' | 'symbols'>('fractions');
    const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false);
    const [formatSuccess, setFormatSuccess] = useState(false);

    const categories = [
        { id: 'fractions', label: 'Fractions & Powers' },
        { id: 'functions', label: 'Functions & Algebra' },
        { id: 'quadratic', label: 'Quadratic & Polynomials' },
        { id: 'trig_calc', label: 'Trig & Calculus' },
        { id: 'symbols', label: 'Symbols & Greek' },
    ] as const;

    const snippets: Record<typeof categories[number]['id'], MathSnippet[]> = {
        fractions: [
            { label: 'Fraction', latex: '$\\frac{a}{b}$', display: 'a/b', description: 'Simple fraction' },
            { label: 'Power', latex: '$x^{2}$', display: 'x²', description: 'Square / Exponent' },
            { label: 'Power n', latex: '$x^{n}$', display: 'xⁿ', description: 'General exponent' },
            { label: 'Subscript', latex: '$x_{1}$', display: 'x₁', description: 'Variable index' },
            { label: 'Square Root', latex: '$\\sqrt{x}$', display: '√x', description: 'Radical' },
            { label: 'Nth Root', latex: '$\\sqrt[n]{x}$', display: 'ⁿ√x', description: 'Nth order radical' },
            { label: 'Mixed Fraction', latex: '$2\\frac{1}{2}$', display: '2 ½', description: 'Mixed number' },
            { label: 'Bracket Fraction', latex: '$\\left(\\frac{a}{b}\\right)$', display: '(a/b)', description: 'Parenthesized fraction' },
            { label: 'Fraction Power', latex: '$\\left(\\frac{a}{b}\\right)^{n}$', display: '(a/b)ⁿ', description: 'Fraction with power' },
            { label: 'Negative Power', latex: '$x^{-1}$', display: 'x⁻¹', description: 'Reciprocal exponent' },
        ],
        functions: [
            { label: 'f(x)', latex: '$f(x) = $', display: 'f(x)', description: 'Function notation' },
            { label: 'f⁻¹(x)', latex: '$f^{-1}(x) = $', display: 'f⁻¹(x)', description: 'Inverse function' },
            { label: 'g(x)', latex: '$g(x) = $', display: 'g(x)', description: 'Second function' },
            { label: 'Composite', latex: '$(f \\circ g)(x)$', display: '(f ∘ g)(x)', description: 'Function composition' },
            { label: 'Limit', latex: '$\\lim_{x \\to a} f(x)$', display: 'lim f(x)', description: 'Limit as x approaches a' },
            { label: 'Limit to 0', latex: '$\\lim_{x \\to 0}$', display: 'lim(x→0)', description: 'Limit to zero' },
            { label: 'Limit to ∞', latex: '$\\lim_{x \\to \\infty}$', display: 'lim(x→∞)', description: 'Limit to infinity' },
            { label: 'Absolute Value', latex: '$|x|$', display: '|x|', description: 'Absolute magnitude' },
            { label: 'Domain Set', latex: '$\\{x \\in \\mathbb{R} \\mid x > 0\\}$', display: '{x ∈ ℝ | x > 0}', description: 'Domain / Range notation' },
            { label: 'Logarithm', latex: '$\\log_{b}(x)$', display: 'log_b(x)', description: 'Base b logarithm' },
            { label: 'Natural Log', latex: '$\\ln(x)$', display: 'ln(x)', description: 'Natural log' },
        ],
        quadratic: [
            { label: 'Standard Form', latex: '$ax^2 + bx + c = 0$', display: 'ax² + bx + c = 0', description: 'Standard quadratic equation' },
            { label: 'Quadratic Formula', latex: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$', display: 'x = (-b ± √Δ)/(2a)', description: 'General quadratic solution formula' },
            { label: 'Discriminant', latex: '$\\Delta = b^2 - 4ac$', display: 'Δ = b² - 4ac', description: 'Discriminant formula' },
            { label: 'Vertex Form', latex: '$y = a(x - h)^2 + k$', display: 'a(x - h)² + k', description: 'Parabola vertex form' },
            { label: 'Factored Form', latex: '$(x - p)(x - q) = 0$', display: '(x - p)(x - q) = 0', description: 'Roots factored form' },
            { label: 'Square Complete', latex: '$\\left(x + \\frac{b}{2a}\\right)^2$', display: '(x + b/2a)²', description: 'Completed square' },
            { label: 'Difference Squares', latex: '$a^2 - b^2 = (a - b)(a + b)$', display: 'a² - b²', description: 'Difference of two squares' },
            { label: 'Cubic Equation', latex: '$ax^3 + bx^2 + cx + d = 0$', display: 'ax³ + bx² + ...', description: 'Third degree polynomial' },
            { label: 'Polynomial Roots', latex: '$x_1, x_2 = $', display: 'x₁, x₂ =', description: 'Solution roots' },
        ],
        trig_calc: [
            { label: 'sin(θ)', latex: '$\\sin(\\theta)$', display: 'sin(θ)', description: 'Sine function' },
            { label: 'cos(θ)', latex: '$\\cos(\\theta)$', display: 'cos(θ)', description: 'Cosine function' },
            { label: 'tan(θ)', latex: '$\\tan(\\theta)$', display: 'tan(θ)', description: 'Tangent function' },
            { label: 'sin² + cos²', latex: '$\\sin^2(\\theta) + \\cos^2(\\theta) = 1$', display: 'sin²θ + cos²θ = 1', description: 'Pythagorean trig identity' },
            { label: 'Derivative', latex: '$\\frac{dy}{dx}$', display: 'dy/dx', description: 'First derivative' },
            { label: 'Partial Deriv', latex: '$\\frac{\\partial f}{\\partial x}$', display: '∂f/∂x', description: 'Partial derivative' },
            { label: 'f\'(x)', latex: '$f\'(x)$', display: 'f\'(x)', description: 'Prime derivative' },
            { label: 'Integral', latex: '$\\int f(x) \\, dx$', display: '∫ f(x) dx', description: 'Indefinite integral' },
            { label: 'Definite Integral', latex: '$\\int_{a}^{b} f(x) \\, dx$', display: '∫_a^b f(x) dx', description: 'Definite integral bounds' },
            { label: 'Summation', latex: '$\\sum_{i=1}^{n}$', display: '∑_(i=1)^n', description: 'Summation series' },
        ],
        symbols: [
            { label: '±', latex: '$\\pm$', display: '±', description: 'Plus-minus' },
            { label: '×', latex: '$\\times$', display: '×', description: 'Multiplication' },
            { label: '÷', latex: '$\\div$', display: '÷', description: 'Division' },
            { label: '≤', latex: '$\\le$', display: '≤', description: 'Less than or equal' },
            { label: '≥', latex: '$\\ge$', display: '≥', description: 'Greater than or equal' },
            { label: '≠', latex: '$\\neq$', display: '≠', description: 'Not equal' },
            { label: '≈', latex: '$\\approx$', display: '≈', description: 'Approximately equal' },
            { label: '∞', latex: '$\\infty$', display: '∞', description: 'Infinity' },
            { label: '°', latex: '$^{\\circ}$', display: '°', description: 'Degrees' },
            { label: 'π', latex: '$\\pi$', display: 'π', description: 'Pi constant' },
            { label: 'θ', latex: '$\\theta$', display: 'θ', description: 'Theta angle' },
            { label: 'α', latex: '$\\alpha$', display: 'α', description: 'Alpha' },
            { label: 'β', latex: '$\\beta$', display: 'β', description: 'Beta' },
            { label: 'Δ', latex: '$\\Delta$', display: 'Δ', description: 'Delta / Change' },
            { label: 'λ', latex: '$\\lambda$', display: 'λ', description: 'Lambda' },
            { label: 'μ', latex: '$\\mu$', display: 'μ', description: 'Micro / Mu' },
            { label: '∈', latex: '$\\in$', display: '∈', description: 'Element of' },
            { label: '∉', latex: '$\\notin$', display: '∉', description: 'Not an element of' },
            { label: '∪', latex: '$\\cup$', display: '∪', description: 'Union' },
            { label: '∩', latex: '$\\cap$', display: '∩', description: 'Intersection' },
        ],
    };

    const handleAutoFormat = () => {
        if (!currentText || !onFormatCurrentText) return;
        const formatted = formatMathText(currentText);
        onFormatCurrentText(formatted);
        setFormatSuccess(true);
        setTimeout(() => setFormatSuccess(false), 2000);
    };

    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 space-y-2.5 shadow-xs transition-colors">
            {/* Top Toolbar Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                        <Sigma className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-text)]">
                        Math Formula Studio
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] hidden sm:inline">
                        (Click snippet to insert LaTeX equation)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {onFormatCurrentText && (
                        <button
                            type="button"
                            onClick={handleAutoFormat}
                            disabled={!currentText.trim()}
                            title="Auto-detect fractions, powers, and equations in text and convert them to KaTeX notation"
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                formatSuccess
                                    ? 'bg-[var(--color-success)] text-white'
                                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-5)]'
                            }`}
                        >
                            {formatSuccess ? (
                                <>
                                    <Check className="w-3 h-3" />
                                    <span>Formatted!</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
                                    <span>Auto-Format Math</span>
                                </>
                            )}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsCheatsheetOpen(!isCheatsheetOpen)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all flex items-center gap-1 cursor-pointer"
                    >
                        <BookOpen className="w-3 h-3" />
                        <span>Cheatsheet</span>
                    </button>
                </div>
            </div>

            {/* Category Navigation Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                            activeCategory === cat.id
                                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Snippets Palette */}
            <div className="flex items-center gap-1.5 flex-wrap max-h-36 overflow-y-auto p-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                {snippets[activeCategory].map((s, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onInsert(s.latex)}
                        title={`${s.description || s.label}: Click to insert ${s.latex}`}
                        className="px-2.5 py-1 rounded-lg bg-[var(--color-background)] hover:bg-[var(--color-primary-5)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 text-[var(--color-text)] hover:text-[var(--color-primary)] text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                        <span>{s.display}</span>
                    </button>
                ))}
            </div>

            {/* Cheatsheet Guide Accordion */}
            {isCheatsheetOpen && (
                <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] space-y-2 text-[var(--color-text)] animate-fade-in">
                    <div className="font-extrabold text-[var(--color-primary)] flex items-center justify-between">
                        <span>LaTeX Mathematical Formatting Quick Guide:</span>
                        <span className="text-[10px] text-[var(--color-muted)] font-normal">Wrap inline math in $...$</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[10px] font-mono">
                        <div className="p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                            <span className="font-bold text-[var(--color-accent)] block not-italic">Fractions & Roots:</span>
                            <code>$\frac&#123;1&#125;&#123;2&#125;$</code> → ½<br />
                            <code>$\sqrt&#123;16&#125;$</code> → 4<br />
                            <code>$\sqrt[3]&#123;27&#125;$</code> → 3
                        </div>
                        <div className="p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                            <span className="font-bold text-[var(--color-accent)] block not-italic">Quadratic Formula:</span>
                            <code>$x = \frac&#123;-b \pm \sqrt&#123;b^2 - 4ac&#125;&#125;&#123;2a&#125;$</code><br />
                            <code>$ax^2 + bx + c = 0$</code>
                        </div>
                        <div className="p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                            <span className="font-bold text-[var(--color-accent)] block not-italic">Functions & Sets:</span>
                            <code>$f(x) = 2x + 1$</code><br />
                            <code>$f^&#123;-1&#125;(x)$</code> (Inverse)<br />
                            <code>$\log_&#123;10&#125;(100)$</code>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
