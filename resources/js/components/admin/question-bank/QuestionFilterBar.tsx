import { useMemo } from 'react';
import type { ClassItem, SubjectItem, TopicItem } from '@/types/admin';
import { formatClassOptionLabel, ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';

interface QuestionFilterBarProps {
    questionSearch: string;
    setQuestionSearch: (v: string) => void;
    questionGradeFilter: string;
    setQuestionGradeFilter: (v: string) => void;
    questionClassFilter: string;
    setQuestionClassFilter: (v: string) => void;
    questionSubjectFilter: string;
    setQuestionSubjectFilter: (v: string) => void;
    questionTopicFilter: string;
    setQuestionTopicFilter: (v: string) => void;
    questionDifficultyFilter: string;
    setQuestionDifficultyFilter: (v: string) => void;
    classes: ClassItem[];
    availableSubjects: SubjectItem[];
    availableTopics: TopicItem[];
    onOpenBulkModal: () => void;
    onOpenAddModal: () => void;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
}

export default function QuestionFilterBar({
    questionSearch,
    setQuestionSearch,
    questionGradeFilter,
    setQuestionGradeFilter,
    questionClassFilter,
    setQuestionClassFilter,
    questionSubjectFilter,
    setQuestionSubjectFilter,
    questionTopicFilter,
    setQuestionTopicFilter,
    questionDifficultyFilter,
    setQuestionDifficultyFilter,
    classes,
    availableSubjects,
    availableTopics,
    onOpenBulkModal,
    onOpenAddModal,
    school,
    allowedGradeLevels,
    isTeacher,
}: QuestionFilterBarProps) {
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

        if (school && (school.category || (school.category_ids && school.category_ids.length > 0) || (school.allowed_grade_levels && school.allowed_grade_levels.length > 0))) {
            const schoolGroups = getGradeLevelsForSchool(school);
            if (schoolGroups && schoolGroups.length > 0 && schoolGroups !== ALL_GRADE_GROUPS) {
                return schoolGroups;
            }
        }

        if (classes && classes.length > 0) {
            return getGradeLevelsForTeacher(classes, school);
        }

        return ALL_GRADE_GROUPS;
    }, [allowedGradeLevels, isTeacher, school, classes]);

    const filteredClasses = classes.filter(
        (c) => !questionGradeFilter || c.grade_level === questionGradeFilter
    );

    return (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input
                    type="text"
                    placeholder="Search questions..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="w-full sm:w-48 px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
                <select
                    value={questionGradeFilter}
                    onChange={(e) => {
                        setQuestionGradeFilter(e.target.value);
                        setQuestionClassFilter('');
                        setQuestionSubjectFilter('');
                        setQuestionTopicFilter('');
                    }}
                    className="flex-1 sm:flex-initial min-w-[120px] px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
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
                    value={questionClassFilter}
                    onChange={(e) => {
                        setQuestionClassFilter(e.target.value);
                        setQuestionSubjectFilter('');
                        setQuestionTopicFilter('');
                    }}
                    className="flex-1 sm:flex-initial min-w-[120px] max-w-full sm:max-w-[160px] px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">{questionGradeFilter ? 'All Classes in Grade' : 'All Classes'}</option>
                    {filteredClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {formatClassOptionLabel(cls)}
                        </option>
                    ))}
                </select>
                <select
                    value={questionSubjectFilter}
                    onChange={(e) => {
                        setQuestionSubjectFilter(e.target.value);
                        setQuestionTopicFilter('');
                    }}
                    className="flex-1 sm:flex-initial min-w-[130px] px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">{questionClassFilter ? 'All Class Subjects' : 'All Subjects'}</option>
                    {availableSubjects.map((s) => {
                        const cls = classes.find((c) => c.id === s.class_id);
                        const label = cls ? `${s.name} (${cls.name})` : s.name;
                        return (
                            <option key={s.id} value={s.id}>
                                {label}
                            </option>
                        );
                    })}
                </select>
                <select
                    value={questionTopicFilter}
                    onChange={(e) => setQuestionTopicFilter(e.target.value)}
                    className="flex-1 sm:flex-initial min-w-[130px] px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">{questionSubjectFilter ? 'All Subject Topics' : 'All Topics'}</option>
                    {availableTopics.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
                <select
                    value={questionDifficultyFilter}
                    onChange={(e) => setQuestionDifficultyFilter(e.target.value)}
                    className="flex-1 sm:flex-initial min-w-[110px] px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                >
                    <option value="">All Difficulties</option>
                    <option value="easy">Easy / Beginner</option>
                    <option value="medium">Medium / Intermediate</option>
                    <option value="hard">Hard / Advanced</option>
                </select>
            </div>

            <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                <button
                    type="button"
                    onClick={onOpenBulkModal}
                    className="flex-1 lg:flex-initial justify-center px-4 py-2.5 bg-[var(--color-primary-10)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white border border-[var(--color-primary)]/25 active:scale-[0.98] cursor-pointer text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                    </svg>
                    <span>AI Bulk Import</span>
                </button>

                <button
                    type="button"
                    onClick={onOpenAddModal}
                    className="flex-1 lg:flex-initial justify-center px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Question</span>
                </button>
            </div>
        </div>
    );
}
