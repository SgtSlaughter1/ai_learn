import { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface SubjectTab {
    id: string;
    title: string;
    badge: string;
    formula: string;
    leftPageHeading: string;
    leftPageBullets: string[];
    sampleQuestion: {
        stem: string;
        options: { id: string; text: string; correct: boolean }[];
        explanation: string;
    };
}

function MathDisplay({ math }: { math: string }) {
    try {
        const html = katex.renderToString(math, {
            throwOnError: false,
            displayMode: true,
        });
        return <div className="katex-display-wrapper overflow-x-auto py-1 max-w-full text-center" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
        return <div className="font-mono text-xs text-center">{math}</div>;
    }
}

function FormattedMathText({ text }: { text: string }) {
    if (!text) return null;
    const parts = text.split(/(\$[^$]+\$)/g);
    return (
        <span>
            {parts.map((part, index) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                    const math = part.slice(1, -1);
                    try {
                        const html = katex.renderToString(math, {
                            throwOnError: false,
                            displayMode: false,
                        });
                        return <span key={index} className="inline-math px-0.5" dangerouslySetInnerHTML={{ __html: html }} />;
                    } catch {
                        return <span key={index}>{part}</span>;
                    }
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
}

const subjectsData: SubjectTab[] = [
    {
        id: 'math',
        title: 'Mathematics',
        badge: 'Calculus & Roots',
        formula: 'f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} \\quad \\text{and} \\quad x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        leftPageHeading: 'Module 4: Differential Calculus & Roots',
        leftPageBullets: [
            'First Principles & Limits',
            'Derivatives of Square Roots & Fractions',
            'Maxima, Minima & Rates of Change',
        ],
        sampleQuestion: {
            stem: 'Evaluate the derivative of $f(x) = \\sqrt{x}$ at $x = 4$.',
            options: [
                { id: 'A', text: '$\\frac{1}{2\\sqrt{4}} = \\frac{1}{4}$', correct: true },
                { id: 'B', text: '$\\frac{1}{2}$', correct: false },
                { id: 'C', text: '$\\frac{1}{8}$', correct: false },
            ],
            explanation: 'By the power rule, $\\frac{d}{dx}(\\sqrt{x}) = \\frac{1}{2\\sqrt{x}}$. Substituting $x = 4$ yields $\\frac{1}{2\\sqrt{4}} = \\frac{1}{4}$.',
        },
    },
    {
        id: 'physics',
        title: 'Physics',
        badge: 'Mechanics & Oscillations',
        formula: 'E_k = \\frac{1}{2}mv^2 \\quad \\text{and} \\quad T = 2\\pi\\sqrt{\\frac{L}{g}}',
        leftPageHeading: 'Module 7: Simple Harmonic Motion',
        leftPageBullets: [
            'Kinetic & Potential Energy Equations',
            'Pendulum Periods with Square Roots',
            'Work-Energy Theorem & Fractions',
        ],
        sampleQuestion: {
            stem: 'Calculate the period $T$ of a simple pendulum with $L = 0.98\\text{ m}$ ($g = 9.8\\text{ m/s}^2$).',
            options: [
                { id: 'A', text: '$T = 2\\pi\\sqrt{\\frac{0.98}{9.8}} \\approx 1.99\\text{ s}$', correct: true },
                { id: 'B', text: '$T = 0.50\\text{ s}$', correct: false },
                { id: 'C', text: '$T = 4.00\\text{ s}$', correct: false },
            ],
            explanation: 'Using $T = 2\\pi\\sqrt{\\frac{L}{g}} = 2\\pi\\sqrt{\\frac{1}{10}} \\approx 2(3.1416)(0.3162) \\approx 1.99\\text{ s}$.',
        },
    },
    {
        id: 'chemistry',
        title: 'Chemistry',
        badge: 'Gas Laws & Diffusion',
        formula: 'PV = nRT \\quad \\text{and} \\quad \\frac{R_1}{R_2} = \\sqrt{\\frac{M_2}{M_1}}',
        leftPageHeading: 'Module 3: Graham\'s Law of Diffusion',
        leftPageBullets: [
            'Ideal Gas Law Relationships',
            'Diffusion Rates & Root Molar Mass Fractions',
            'Chemical Equilibrium Dynamics',
        ],
        sampleQuestion: {
            stem: 'According to Graham\'s Law, what is the ratio of diffusion rates $\\frac{R_1}{R_2}$ of two gases?',
            options: [
                { id: 'A', text: '$\\frac{R_1}{R_2} = \\sqrt{\\frac{M_2}{M_1}}$', correct: true },
                { id: 'B', text: '$\\frac{R_1}{R_2} = \\frac{M_1}{M_2}$', correct: false },
                { id: 'C', text: '$\\frac{R_1}{R_2} = \\sqrt{\\frac{M_1}{M_2}}$', correct: false },
            ],
            explanation: 'Graham\'s Law states that the rate of diffusion is inversely proportional to the square root of molar mass: $\\frac{R_1}{R_2} = \\sqrt{\\frac{M_2}{M_1}}$.',
        },
    },
];

export function InteractiveBookAnimation() {
    const [activeTab, setActiveTab] = useState<string>('math');
    const [mobilePageMode, setMobilePageMode] = useState<'theory' | 'quiz'>('theory');
    const [selectedOption, setSelectedOption] = useState<string | null>('A');
    const [isHovered, setIsHovered] = useState<boolean>(false);

    const currentSubject = subjectsData.find((s) => s.id === activeTab) || subjectsData[0];

    const handleOptionSelect = (optionId: string) => {
        setSelectedOption(optionId);
    };

    return (
        <div className="relative w-full max-w-4xl mx-auto my-8 sm:my-12 select-none px-2 sm:px-4">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[var(--color-primary)]/10 via-[var(--color-accent)]/10 to-[var(--color-success)]/10 rounded-3xl blur-2xl -z-10 opacity-70 animate-pulse pointer-events-none" />

            {/* Subject Selector Tabs */}
            <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
                <div className="inline-flex p-1 sm:p-1.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs max-w-full overflow-x-auto">
                    {subjectsData.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSelectedOption('A');
                                }}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                                    isActive
                                        ? 'bg-[var(--color-primary)] text-white shadow-md scale-[1.02]'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isActive ? 'bg-[var(--color-accent)]' : 'bg-transparent border border-current'}`} />
                                {tab.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Top Badge: Offline Knowledge Vault (Visible on Mobile above the book) */}
            <div className="flex md:hidden items-center justify-center mb-3">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-[var(--color-success)]/15 flex items-center justify-center text-[var(--color-success)]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-text)]">Offline Knowledge Vault (100% Local)</span>
                </div>
            </div>

            {/* Mobile Page Switcher (Left page vs Right page toggle on phones) */}
            <div className="flex md:hidden items-center justify-center gap-1 mb-3">
                <button
                    type="button"
                    onClick={() => setMobilePageMode('theory')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                        mobilePageMode === 'theory'
                            ? 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                >
                    Page 1: Theory & Goals
                </button>
                <span className="text-[var(--color-border)]">|</span>
                <button
                    type="button"
                    onClick={() => setMobilePageMode('quiz')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                        mobilePageMode === 'quiz'
                            ? 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                >
                    Page 2: Practice Checkpoint
                </button>
            </div>

            {/* 3D Open Book Container */}
            <div
                className="relative perspective-1000 transition-transform duration-500 ease-out"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Desktop-Only Top-Left Floating Badge: Offline Vault */}
                <div
                    className={`hidden md:flex absolute -top-5 -left-6 z-30 bg-[var(--color-surface)] border border-[var(--color-border)] px-3.5 py-2 rounded-xl shadow-lg items-center gap-2.5 transition-all duration-300 ${
                        isHovered ? '-translate-y-1 scale-105' : ''
                    }`}
                >
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 flex items-center justify-center text-[var(--color-success)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-[var(--color-text)]">Offline Knowledge Vault</div>
                        <div className="text-[9px] text-[var(--color-success)] font-semibold">100% Synced Locally</div>
                    </div>
                </div>

                {/* Book Base Hardcover Shadow & Shell */}
                <div className="relative mx-auto rounded-2xl sm:rounded-3xl p-2 sm:p-4 bg-gradient-to-b from-[#143124] to-[#0D2118] border-2 border-[#204936] shadow-2xl">
                    {/* Golden Bookmark Ribbon (Visible on desktop, compact on mobile) */}
                    <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-4 h-10 bg-gradient-to-b from-[var(--color-accent)] to-[#B3792A] rounded-b-md shadow-md z-20" />

                    {/* Book Pages Spread */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#FDFCFA] rounded-xl sm:rounded-2xl border border-[#E2DFD6] overflow-hidden shadow-inner min-h-[360px]">
                        {/* ── Left Page: Curriculum & Theory (Visible if desktop OR if mobilePageMode === 'theory') ── */}
                        <div
                            className={`p-5 sm:p-8 flex-col justify-between border-b md:border-b-0 md:border-r border-[#EBE7DC] relative bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F2] to-[#F5F2E9] ${
                                mobilePageMode === 'theory' ? 'flex' : 'hidden md:flex'
                            }`}
                        >
                            {/* Page Header */}
                            <div>
                                <div className="flex items-center justify-between mb-3 sm:mb-4">
                                    <span className="px-2.5 py-1 rounded-md bg-[var(--color-primary-10)] text-[var(--color-primary)] font-bold text-[10px] tracking-wider uppercase">
                                        {currentSubject.badge}
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--color-muted)]">Page 42</span>
                                </div>

                                <h3 className="text-base sm:text-xl font-bold text-[var(--color-text)] leading-snug">
                                    {currentSubject.leftPageHeading}
                                </h3>

                                <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
                                    <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider block mb-1">
                                        Core Theorem / Formula
                                    </span>
                                    <div className="text-xs sm:text-sm text-[var(--color-primary)] font-bold bg-[var(--color-background)] px-2 py-1.5 rounded-lg border border-[var(--color-border)]">
                                        <MathDisplay math={currentSubject.formula} />
                                    </div>
                                </div>

                                <div className="mt-4 sm:mt-5 space-y-2">
                                    <span className="text-[11px] font-bold text-[var(--color-text)] block">
                                        Curriculum Learning Goals:
                                    </span>
                                    {currentSubject.leftPageBullets.map((bullet, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                                            <span>{bullet}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Page Footer / Page Number */}
                            <div className="pt-4 sm:pt-6 mt-4 border-t border-[#EBE7DC] flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                                <span>PassPoint Standard</span>
                                <span className="font-serif italic font-semibold">Offline Ready</span>
                            </div>
                        </div>

                        {/* ── Right Page: Interactive Diagnostic Practice (Visible if desktop OR if mobilePageMode === 'quiz') ── */}
                        <div
                            className={`p-5 sm:p-8 flex-col justify-between relative bg-gradient-to-bl from-[#FFFFFF] via-[#FAF8F2] to-[#F5F2E9] ${
                                mobilePageMode === 'quiz' ? 'flex' : 'hidden md:flex'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-3 sm:mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                        <span className="text-[11px] font-bold text-[var(--color-accent)] uppercase tracking-wider">
                                            Adaptive Checkpoint
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-[var(--color-muted)]">Page 43</span>
                                </div>

                                <div className="text-xs sm:text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                                    <FormattedMathText text={currentSubject.sampleQuestion.stem} />
                                </div>

                                {/* Multiple Choice Options */}
                                <div className="mt-3 sm:mt-4 space-y-2">
                                    {currentSubject.sampleQuestion.options.map((opt) => {
                                        const isSelected = selectedOption === opt.id;
                                        const isCorrect = opt.correct;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => handleOptionSelect(opt.id)}
                                                className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                                                    isSelected
                                                        ? isCorrect
                                                            ? 'bg-[var(--color-success)]/10 border-[var(--color-success)] text-[var(--color-success)] shadow-xs font-bold'
                                                            : 'bg-[var(--color-error)]/10 border-[var(--color-error)] text-[var(--color-error)] font-bold'
                                                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary-light)]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 sm:gap-3">
                                                    <span
                                                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center border shrink-0 ${
                                                            isSelected
                                                                ? isCorrect
                                                                    ? 'bg-[var(--color-success)] text-white border-[var(--color-success)]'
                                                                    : 'bg-[var(--color-error)] text-white border-[var(--color-error)]'
                                                                : 'bg-[var(--color-background)] text-[var(--color-muted)] border-[var(--color-border)]'
                                                        }`}
                                                    >
                                                        {opt.id}
                                                    </span>
                                                    <span className="text-xs">
                                                        <FormattedMathText text={opt.text} />
                                                    </span>
                                                </div>

                                                {isSelected && (
                                                    <span className="text-[10px] sm:text-[11px] font-bold shrink-0 ml-2">
                                                        {isCorrect ? 'Correct' : 'Review'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Step-by-Step AI Explanation Card */}
                                {selectedOption && (
                                    <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] animate-fadeIn">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Instant Explanation
                                        </div>
                                        <div className="text-[11px] sm:text-xs text-[var(--color-muted)] leading-relaxed">
                                            <FormattedMathText text={currentSubject.sampleQuestion.explanation} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Page Footer */}
                            <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-[#EBE7DC] flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                                <span className="font-mono text-[var(--color-primary)] font-bold">+25 XP for Mastery</span>
                                <span>WAEC & NECO Aligned</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop-Only Bottom-Right Floating Badge: Adaptive AI Tutor */}
                <div
                    className={`hidden md:flex absolute -bottom-5 -right-6 z-30 bg-[var(--color-surface)] border border-[var(--color-border)] px-3.5 py-2 rounded-xl shadow-lg items-center gap-2.5 transition-all duration-300 ${
                        isHovered ? 'translate-y-1 scale-105' : ''
                    }`}
                >
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-[var(--color-text)]">Adaptive AI Tutor</div>
                        <div className="text-[9px] text-[var(--color-muted)] font-semibold">Step-by-Step Clarity</div>
                    </div>
                </div>

                {/* Bottom Badge: Adaptive AI Tutor (Visible on Mobile below the book) */}
                <div className="flex md:hidden items-center justify-center mt-3">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-[var(--color-accent)]/15 flex items-center justify-center text-[var(--color-accent)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="text-[11px] font-bold text-[var(--color-text)]">Adaptive AI Tutor (Step-by-Step)</span>
                    </div>
                </div>

                {/* Subtle Bottom Ambient Reflection */}
                <div className="w-3/4 h-2 sm:h-3 mx-auto bg-black/10 rounded-full blur-md mt-2" />
            </div>
        </div>
    );
}
export default InteractiveBookAnimation;
