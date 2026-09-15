import type { ClassItem } from '@/types/admin';

interface ClassCardProps {
    classItem: ClassItem;
    onViewRoster: (cls: ClassItem) => void;
    onEdit: (cls: ClassItem) => void;
    onDelete: (cls: ClassItem) => void;
}

export default function ClassCard({ classItem: cls, onViewRoster, onEdit, onDelete }: ClassCardProps) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[var(--color-primary)]/50 transition-colors">
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-[var(--color-text)]">{cls.name}</h4>
                        {cls._pendingSync && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Pending Sync
                            </span>
                        )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-5)] text-[var(--color-primary)] text-xs font-extrabold border border-[var(--color-border)]">
                        {cls.grade_level}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-[var(--color-muted)] font-medium">
                    {cls.program && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-semibold text-[var(--color-text)]">
                            Track: {cls.program.name}
                        </span>
                    )}
                    {(cls.arm || cls.section) && (
                        <span>Arm: <strong className="text-[var(--color-text)]">{cls.arm || cls.section}</strong></span>
                    )}
                </div>
                {cls.description && (
                    <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-4">{cls.description}</p>
                )}
            </div>

            <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between mt-3">
                <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                    </svg>
                    <span>{cls.learner_count ?? 0}</span> learners
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onViewRoster(cls)}
                        className="px-3 py-1.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98] border border-[var(--color-border)]"
                    >
                        View Roster
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(cls)}
                        className="p-1.5 hover:bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:text-[var(--color-primary)] rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-[0.98]"
                        title="Edit Class"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(cls)}
                        className="p-1.5 hover:bg-[var(--color-error-5)] text-[var(--color-muted)] hover:text-[var(--color-error)] rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-[0.98]"
                        title="Delete Class"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
