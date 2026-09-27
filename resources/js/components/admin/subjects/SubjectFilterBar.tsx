import { useMemo } from 'react';
import type { ClassItem } from '@/types/admin';
import { formatClassOptionLabel, ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';

interface SubjectFilterBarProps {
    subjectSearch: string;
    setSubjectSearch: (v: string) => void;
    gradeFilter: string;
    setGradeFilter: (v: string) => void;
    selectedClassFilter: string | number;
    setSelectedClassFilter: (v: string | number) => void;
    classes: ClassItem[];
    onOpenAddSubjectModal: () => void;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
}

export default function SubjectFilterBar({
    subjectSearch,
    setSubjectSearch,
    gradeFilter,
    setGradeFilter,
    selectedClassFilter,
    setSelectedClassFilter,
    classes,
    onOpenAddSubjectModal,
    school,
    allowedGradeLevels,
    isTeacher,
}: SubjectFilterBarProps) {
    const availableGradeGroups = useMemo(() => {
        if (allowedGradeLevels && allowedGradeLevels.length > 0) {
            const allowedSet = new Set(allowedGradeLevels.map((g) => g.toUpperCase()));
            return ALL_GRADE_GROUPS.map((grp) => ({
                ...grp,
                options: grp.options.filter((opt) => allowedSet.has(opt.value.toUpperCase())),
            })).filter((grp) => grp.options.length > 0);
        }
        if (isTeacher) {
            return getGradeLevelsForTeacher(classes, school);
        }
        if (school) {
            return getGradeLevelsForSchool(school);
        }
        if (classes && classes.length > 0) {
            return getGradeLevelsForTeacher(classes, school);
        }
        return ALL_GRADE_GROUPS;
    }, [allowedGradeLevels, isTeacher, school, classes]);

    const filteredClasses = classes.filter(
        (c) => !gradeFilter || c.grade_level === gradeFilter
    );

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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
                    className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-52 focus:border-[var(--color-primary)]"
                />
                <select
                    value={gradeFilter}
                    onChange={(e) => {
                        setGradeFilter(e.target.value);
                        setSelectedClassFilter('all');
                    }}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">All Grade Levels</option>
                    {availableGradeGroups.map((grp) => (
                        <optgroup key={grp.group} label={grp.group}>
                            {grp.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="all">{gradeFilter ? 'All Classes in Grade' : 'All Classes & General'}</option>
                    <option value="unassigned">School-wide / Unassigned</option>
                    {filteredClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {formatClassOptionLabel(cls)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
