import type { SchoolItem } from '@/types/admin';
import { formatSchoolCategoryLabel } from '@/utils/format';

interface SchoolCardProps {
    school: SchoolItem;
    onEdit: (school: SchoolItem) => void;
    onDelete: (school: SchoolItem) => void;
}

export default function SchoolCard({ school, onEdit, onDelete }: SchoolCardProps) {

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md group">
            <div>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] flex items-center justify-center font-bold text-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.8}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-[var(--color-text)] text-base group-hover:text-[var(--color-primary)] transition-colors">
                                    {school.name}
                                </h3>
                                {school._pendingSync && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Pending Sync
                                    </span>
                                )}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 uppercase tracking-wider">
                                    {formatSchoolCategoryLabel(school)}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                {[school.city, school.state].filter(Boolean).join(', ') || 'Location unset'}
                            </p>
                        </div>
                    </div>
                    <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            school.is_active !== false
                                ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success-20)]'
                                : 'bg-[var(--color-error-10)] text-[var(--color-error)] border border-[var(--color-error-20)]'
                        }`}
                    >
                        {school.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                </div>

                {school.description && (
                    <p className="text-xs text-[var(--color-muted)] mt-3 line-clamp-2">{school.description}</p>
                )}

                {/* Admin Info Box */}
                <div className="mt-4 p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                        </svg>
                        <span>School Administrator</span>
                    </p>
                    {school.admin ? (
                        <div className="mt-1">
                            <p className="text-xs font-bold text-[var(--color-text)]">{school.admin.name}</p>
                            <p className="text-[11px] text-[var(--color-muted)] truncate">{school.admin.email}</p>
                        </div>
                    ) : (
                        <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-[var(--color-muted)] italic">No school admin assigned</span>
                        </div>
                    )}
                </div>

                {/* Counts / Metadata */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <div>
                        <span className="font-bold text-[var(--color-text)]">
                            {school.classes_count ?? school.classes?.length ?? 0}
                        </span>{' '}
                        Classes
                    </div>
                    <div>
                        <span className="font-bold text-[var(--color-text)]">{school.learners_count ?? 0}</span> Learners
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">
                <button
                    type="button"
                    onClick={() => onEdit(school)}
                    className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                >
                    Edit School
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(school)}
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-5)] border border-transparent hover:border-[var(--color-error-20)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
