import type { SubjectItem } from '@/types/admin';

interface SubjectCardProps {
    subject: SubjectItem;
    onManageTopics: (subject: SubjectItem) => void;
    onEdit: (subject: SubjectItem) => void;
    onDelete: (subject: SubjectItem) => void;
    isDeleting?: boolean;
}

export default function SubjectCard({ subject: subj, onManageTopics, onEdit, onDelete, isDeleting = false }: SubjectCardProps) {
    const targetClassName = subj.school_class?.name || subj.class_name;
    const targetClassGrade = subj.school_class?.grade_level || subj.class_grade_level;

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[var(--color-primary)]/50 transition-colors">
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-[var(--color-text)]">{subj.name}</h4>
                            {subj._pendingSync && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Pending Sync
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {targetClassName ? (
                                <span className="text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-5)] px-2 py-0.5 rounded border border-[var(--color-primary)]/20 inline-flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                        />
                                    </svg>
                                    Class: {targetClassName} {targetClassGrade ? `(${targetClassGrade})` : ''}
                                </span>
                            ) : subj.school?.name ? (
                                <span className="text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-5)] px-2 py-0.5 rounded border border-[var(--color-primary)]/20 inline-block">
                                    {subj.school.name} (All Classes)
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-[var(--color-muted)] bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded border border-[var(--color-border)] inline-block">
                                    General Knowledge
                                </span>
                            )}
                        </div>
                    </div>
                    <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            subj.status === 'active'
                                ? 'bg-[var(--color-success-10)] text-[var(--color-success)]'
                                : 'bg-gray-500/10 text-gray-400'
                        }`}
                    >
                        {subj.status}
                    </span>
                </div>
                {subj.description && (
                    <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-4">{subj.description}</p>
                )}
            </div>

            <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between mt-3">
                <span className="text-xs font-bold text-[var(--color-muted)] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    {subj.topics_count ?? 0} topics
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onManageTopics(subj)}
                        className="px-3 py-1.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98] cursor-pointer text-[var(--color-primary)] text-xs font-bold rounded-lg transition-all border border-[var(--color-border)]"
                    >
                        Manage Topics
                    </button>
                    {subj.can?.update !== false && (
                        <button
                            type="button"
                            onClick={() => onEdit(subj)}
                            disabled={isDeleting}
                            className="p-1.5 hover:bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:text-[var(--color-primary)] active:scale-[0.98] cursor-pointer rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            title="Edit Subject"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </button>
                    )}
                    {subj.can?.delete !== false && (
                        <button
                            type="button"
                            onClick={() => onDelete(subj)}
                            disabled={isDeleting}
                            className="p-1.5 hover:bg-[var(--color-error-5)] text-[var(--color-muted)] hover:text-[var(--color-error)] active:scale-[0.98] cursor-pointer rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            title="Delete Subject"
                        >
                            {isDeleting ? (
                                <span className="w-4 h-4 border-2 border-[var(--color-error)]/30 border-t-[var(--color-error)] rounded-full animate-spin inline-block"></span>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
