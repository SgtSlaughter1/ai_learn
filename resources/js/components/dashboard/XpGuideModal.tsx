import { CheckCircle2, FileText, Sparkles, BookOpen, Flame, Trophy } from 'lucide-react';

interface XpGuideModalProps {
    isOpen: boolean;
    onToggle: () => void;
}

const XP_RULES = [
    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, label: 'Correct Answer', xp: '+10 XP', desc: 'Every right answer in any quiz' },
    { icon: <FileText className="w-4 h-4 text-sky-500" />, label: 'Quiz Complete', xp: '+25 XP', desc: 'Finish any quiz attempt' },
    { icon: <Sparkles className="w-4 h-4 text-amber-500" />, label: 'Perfect Score', xp: '+50 XP', desc: 'Get 100% on any quiz' },
    { icon: <BookOpen className="w-4 h-4 text-indigo-500" />, label: 'First Attempt', xp: '+20 XP', desc: 'Try a quiz for the first time' },
    { icon: <Flame className="w-4 h-4 text-orange-500" />, label: 'Daily Streak', xp: '+15+ XP', desc: 'Every 7 days you study in a row' },
    { icon: <Trophy className="w-4 h-4 text-yellow-500" />, label: 'Achievement', xp: '+25 XP', desc: 'Unlock any badge or milestone' },
];

export function XpGuideModal({ isOpen, onToggle }: XpGuideModalProps) {
    return (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] uppercase tracking-wider transition-colors cursor-pointer"
            >
                <svg
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                How to Earn XP
            </button>

            {isOpen && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {XP_RULES.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-start gap-3 p-3 bg-[var(--color-primary)]/5 border border-[var(--color-border)] rounded-xl"
                        >
                            <div className="h-8 w-8 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
                                {item.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[var(--color-text)]">{item.label}</span>
                                    <span className="badge-success text-[9px]">{item.xp}</span>
                                </div>
                                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
