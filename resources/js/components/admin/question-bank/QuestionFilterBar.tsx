import type { ClassItem, SubjectItem, TopicItem } from '@/types/admin';

interface QuestionFilterBarProps {
    questionSearch: string;
    setQuestionSearch: (v: string) => void;
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
}

export default function QuestionFilterBar({
    questionSearch,
    setQuestionSearch,
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
}: QuestionFilterBarProps) {
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    placeholder="Search question text..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-52 focus:border-[var(--color-primary)]"
                />
                <select
                    value={questionClassFilter}
                    onChange={(e) => {
                        setQuestionClassFilter(e.target.value);
                        setQuestionSubjectFilter('');
                        setQuestionTopicFilter('');
                    }}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] max-w-[160px] outline-none"
                >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.grade_level})
                        </option>
                    ))}
                </select>
                <select
                    value={questionSubjectFilter}
                    onChange={(e) => {
                        setQuestionSubjectFilter(e.target.value);
                        setQuestionTopicFilter('');
                    }}
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] min-w-[170px] outline-none"
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
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] min-w-[190px] outline-none"
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
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none"
                >
                    <option value="">All Difficulties</option>
                    <option value="easy">Easy / Beginner</option>
                    <option value="medium">Medium / Intermediate</option>
                    <option value="hard">Hard / Advanced</option>
                </select>
            </div>

            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={onOpenBulkModal}
                    className="px-4 py-2.5 bg-[var(--color-primary-10)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white border border-[var(--color-primary)]/25 active:scale-[0.98] cursor-pointer text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
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
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
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
