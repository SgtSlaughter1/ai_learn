import type { SchoolItem } from '@/types/admin';
import { getGradeLevelsForSchool } from '@/utils/format';

interface ClassFilterBarProps {
    schools: SchoolItem[];
    classSchoolFilter: string;
    setClassSchoolFilter: (v: string) => void;
    classGradeFilter: string;
    setClassGradeFilter: (v: string) => void;
    onOpenCreateModal: () => void;
}

export default function ClassFilterBar({
    schools,
    classSchoolFilter,
    setClassSchoolFilter,
    classGradeFilter,
    setClassGradeFilter,
    onOpenCreateModal,
}: ClassFilterBarProps) {
    const selectedSchool = schools.find((s) => String(s.id) === classSchoolFilter) || (schools.length === 1 ? schools[0] : null);
    const gradeGroups = getGradeLevelsForSchool(selectedSchool);

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
                {schools.length > 1 && (
                    <select
                        value={classSchoolFilter}
                        onChange={(e) => setClassSchoolFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                    >
                        <option value="">All Schools</option>
                        {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                )}
                <select
                    value={classGradeFilter}
                    onChange={(e) => setClassGradeFilter(e.target.value)}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">All Grade Levels</option>
                    {gradeGroups.map((grp) => (
                        <optgroup key={grp.group} label={grp.group}>
                            {grp.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create New Class</span>
            </button>
        </div>
    );
}
