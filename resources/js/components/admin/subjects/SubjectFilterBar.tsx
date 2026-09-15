import type { ClassItem } from '@/types/admin';

interface SubjectFilterBarProps {
    subjectSearch: string;
    setSubjectSearch: (v: string) => void;
    selectedClassFilter: string | number;
    setSelectedClassFilter: (v: string | number) => void;
    classes: ClassItem[];
    onOpenAddSubjectModal: () => void;
}

export default function SubjectFilterBar({
    subjectSearch,
    setSubjectSearch,
    selectedClassFilter,
    setSelectedClassFilter,
    classes,
    onOpenAddSubjectModal,
}: SubjectFilterBarProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-base font-bold text-[var(--color-text)]">Curriculum Hierarchy</h3>
                    <p className="text-xs text-[var(--color-muted)]">Configure subjects mapped to classes and manage topic objectives</p>
                </div>
                <button
                    type="button"
                    onClick={onOpenAddSubjectModal}
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Subject</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    placeholder="Search subjects..."
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-56 focus:border-[var(--color-primary)]"
                />
                <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none"
                >
                    <option value="all">All Classes & General</option>
                    <option value="unassigned">School-wide / Unassigned</option>
                    {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.grade_level})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
