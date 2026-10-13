import { createPortal } from 'react-dom';
import { CheckCircle2, FileText, Sparkles, BookOpen, Flame, Trophy, X, HelpCircle } from 'lucide-react';

interface XpGuideModalProps {
    isOpen: boolean;
    onToggle: () => void;
}

const XP_RULES = [
    { icon: <FileText className="w-4 h-4 text-sky-500" />, label: 'Quiz Completed', xp: '+5 XP', desc: 'Finish any quiz or assignment practice session' },
    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, label: 'Correct Answer', xp: '+1 XP', desc: 'Earned for each correct question answered' },
    { icon: <Sparkles className="w-4 h-4 text-amber-500" />, label: 'Perfect Score', xp: '+3 XP', desc: 'Bonus reward for achieving 100% accuracy' },
    { icon: <BookOpen className="w-4 h-4 text-[var(--color-primary)]" />, label: 'First Topic Attempt', xp: '+2 XP', desc: 'Exploring and completing a new topic for the first time' },
    { icon: <Flame className="w-4 h-4 text-orange-500" />, label: 'Daily Streak Bonus', xp: '+5 XP', desc: 'Maintain study streaks across consecutive active days' },
    { icon: <Trophy className="w-4 h-4 text-yellow-500" />, label: 'Achievement Badge', xp: '+10 to 50 XP', desc: 'Unlock milestones, study achievements, and roadmap awards' },
];

export function XpGuideModal({ isOpen, onToggle }: XpGuideModalProps) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--color-overlay)] backdrop-blur-sm animate-fade-in">
            <div
                className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl text-[var(--color-text)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="relative p-5 sm:p-6 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary-5)] via-amber-500/5 to-transparent">
                    <button
                        onClick={onToggle}
                        className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3.5 pr-8">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">How to Earn XP</h2>
                            <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                Earn experience points across study drills to rank up through tiers.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Rules Grid */}
                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {XP_RULES.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-start gap-3 p-3.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl"
                        >
                            <div className="h-9 w-9 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0 shadow-2xs">
                                {item.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-[var(--color-text)] truncate">{item.label}</span>
                                    <span className="badge-success text-[10px] shrink-0 font-extrabold">{item.xp}</span>
                                </div>
                                <p className="text-[11px] text-[var(--color-muted)] mt-1 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 border-t border-[var(--color-border)] bg-[var(--color-background)]/60 flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--color-muted)] flex items-center gap-1.5 font-medium">
                        <HelpCircle className="w-4 h-4 text-sky-500" />
                        <span>XP syncs automatically offline & online</span>
                    </span>
                    <button
                        type="button"
                        onClick={onToggle}
                        className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
