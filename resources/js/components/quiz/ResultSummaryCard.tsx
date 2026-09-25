import { Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';

interface ResultSummaryCardProps {
    quizTitle: string;
    score: number;
    totalMarks: number;
    percentage: number;
    feedback: {
        title: string;
        desc: string;
        colorClass: string;
    };
}

export function ResultSummaryCard({
    quizTitle,
    score,
    totalMarks,
    percentage,
    feedback,
}: ResultSummaryCardProps) {
    return (
        <div className="space-y-6">
            {/* Header card */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl backdrop-blur-md">
                <div className="space-y-3 text-center md:text-left">
                    <span className="text-[10px] font-extrabold px-2.5 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                        Assessment Completed
                    </span>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-text)] leading-tight">
                        {quizTitle}
                    </h1>
                    <p className="text-[var(--color-muted)] text-sm max-w-xl leading-relaxed">
                        {feedback.desc}
                    </p>
                </div>

                {/* Circular Radial Score Dial */}
                <div className="relative h-32 w-32 flex items-center justify-center bg-[var(--color-background)]/60 rounded-full border border-[var(--color-border)] shadow-inner shrink-0">
                    <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="stroke-slate-850"
                            strokeWidth="8"
                            fill="transparent"
                        />
                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className={`transition-all duration-1000 ${
                                percentage >= 80
                                    ? 'stroke-emerald-500'
                                    : percentage >= 50
                                    ? 'stroke-amber-500'
                                    : 'stroke-rose-500'
                            }`}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * percentage) / 100}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="text-center">
                        <span className="block text-2xl font-black text-[var(--color-text)]">{percentage}%</span>
                        <span className="block text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                            {score}/{totalMarks} Marks
                        </span>
                    </div>
                </div>
            </div>

            {/* Score status alert banner */}
            <div
                className={`p-5 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-4 ${feedback.colorClass}`}
            >
                <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{feedback.title}</span>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/dashboard"
                        className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text)] hover:text-white px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-primary)] border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-xl transition-all cursor-pointer min-h-[38px] flex items-center shadow-2xs"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
