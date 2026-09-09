import { useState } from 'react';
import { QuestionItem, SubjectItem, TopicItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';

interface Props {
    questions: QuestionItem[];
    subjects: SubjectItem[];
    allTopics: TopicItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function QuestionBankTab({ questions, subjects, allTopics, loading, onRefresh, showToast }: Props) {
    const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
    const [questionTopicFilter, setQuestionTopicFilter] = useState('');
    const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState('');
    const [questionSearch, setQuestionSearch] = useState('');
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
    const [questionForm, setQuestionForm] = useState({
        topic_id: '',
        question_text: '',
        type: 'multiple_choice',
        difficulty: 'medium',
        explanation: '',
        status: 'active',
        options: [
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false },
        ],
    });

    const handleSaveQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = editingQuestion ? `/api/v1/admin/questions/${editingQuestion.id}` : '/api/v1/admin/questions';
        const method = editingQuestion ? 'PUT' : 'POST';
        const tempId = editingQuestion ? String(editingQuestion.id) : `temp_q_${Date.now()}`;

        const selectedTopic = allTopics.find((t) => String(t.id) === String(questionForm.topic_id));
        const optimisticQuestion: QuestionItem = {
            id: editingQuestion ? editingQuestion.id : Date.now(),
            topic_id: Number(questionForm.topic_id),
            question_text: questionForm.question_text,
            type: questionForm.type,
            difficulty: questionForm.difficulty,
            explanation: questionForm.explanation || null,
            status: questionForm.status,
            options: questionForm.options.map((opt, i) => ({
                id: i + 1,
                option_text: opt.option_text,
                is_correct: opt.is_correct,
            })),
            topic: selectedTopic ? {
                id: selectedTopic.id,
                name: selectedTopic.name,
                subject: selectedTopic.subject,
            } : undefined,
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminQuestions',
            action: editingQuestion ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: questionForm,
            optimisticRecord: optimisticQuestion,
        });

        if (res.success) {
            showToast(res.message || 'Question saved successfully', 'success');
            setIsQuestionModalOpen(false);
            setEditingQuestion(null);
            resetQuestionForm();
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save question', 'error');
        }
    };

    const handleDeleteQuestion = async (q: QuestionItem) => {
        if (!confirm('Are you sure you want to delete this question?')) return;
        const res = await executeAdminAction({
            table: 'adminQuestions',
            action: 'delete',
            recordId: String(q.id),
            endpoint: `/api/v1/admin/questions/${q.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Question deleted');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete question', 'error');
        }
    };

    const resetQuestionForm = () => {
        setQuestionForm({
            topic_id: allTopics[0]?.id ? String(allTopics[0].id) : '',
            question_text: '',
            type: 'multiple_choice',
            difficulty: 'medium',
            explanation: '',
            status: 'active',
            options: [
                { option_text: '', is_correct: true },
                { option_text: '', is_correct: false },
                { option_text: '', is_correct: false },
                { option_text: '', is_correct: false },
            ],
        });
    };

    const filteredQuestions = questions.filter((q) => {
        if (questionSubjectFilter && String(q.topic?.subject?.id || '') !== questionSubjectFilter) return false;
        if (questionTopicFilter && String(q.topic_id) !== questionTopicFilter) return false;
        if (questionDifficultyFilter && q.difficulty !== questionDifficultyFilter) return false;
        if (questionSearch && !q.question_text.toLowerCase().includes(questionSearch.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search question text..."
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-56"
                    />
                    <select
                        value={questionSubjectFilter}
                        onChange={(e) => setQuestionSubjectFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] max-w-[180px]"
                    >
                        <option value="">All Subjects</option>
                        {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <select
                        value={questionTopicFilter}
                        onChange={(e) => setQuestionTopicFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] max-w-[200px]"
                    >
                        <option value="">All Topics</option>
                        {allTopics.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.level})</option>
                        ))}
                    </select>
                    <select
                        value={questionDifficultyFilter}
                        onChange={(e) => setQuestionDifficultyFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)]"
                    >
                        <option value="">All Difficulties</option>
                        <option value="easy">Easy / Beginner</option>
                        <option value="medium">Medium / Intermediate</option>
                        <option value="hard">Hard / Advanced</option>
                    </select>
                </div>

                <button
                    onClick={() => {
                        setEditingQuestion(null);
                        resetQuestionForm();
                        setIsQuestionModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Question</span>
                </button>
            </div>

            {/* Questions List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="h-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filteredQuestions.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    No questions found matching your criteria. Click "Add Question" to build your offline question bank.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredQuestions.map((q) => (
                        <div key={q.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[var(--color-primary)]/40 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] text-[10px] font-bold uppercase border border-[var(--color-border)]">
                                            {q.topic?.subject?.name || 'Subject'} • {q.topic?.name || 'Topic'}
                                        </span>
                                        {q._pendingSync && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                Pending Sync
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            q.difficulty === 'easy' ? 'bg-[var(--color-success-10)] text-[var(--color-success)]' : q.difficulty === 'hard' ? 'bg-[var(--color-error-10)] text-[var(--color-error)]' : 'bg-[var(--color-accent-10)] text-[var(--color-accent)]'
                                        }`}>
                                            {q.difficulty}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-[var(--color-text)] pt-1">{q.question_text}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingQuestion(q);
                                            setQuestionForm({
                                                topic_id: String(q.topic_id),
                                                question_text: q.question_text,
                                                type: q.type,
                                                difficulty: q.difficulty,
                                                explanation: q.explanation || '',
                                                status: q.status,
                                                options: q.options.map((opt) => ({
                                                    option_text: opt.option_text,
                                                    is_correct: opt.is_correct,
                                                })),
                                            });
                                            setIsQuestionModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all border border-[var(--color-border)]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteQuestion(q)}
                                        className="px-3 py-1.5 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {/* Options Grid */}
                            <div className="grid md:grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                                {q.options.map((opt, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                                            opt.is_correct
                                                ? 'border-[var(--color-success)]/40 bg-[var(--color-success-10)] text-[var(--color-success)] font-bold'
                                                : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]'
                                        }`}
                                    >
                                        <span>{opt.option_text}</span>
                                        {opt.is_correct && (
                                            <span className="text-xs flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Correct Answer</span>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {q.explanation && (
                                <div className="text-[11px] text-[var(--color-muted)] bg-[var(--color-primary-5)] border border-[var(--color-border)] p-2.5 rounded-xl flex items-start gap-2">
                                    <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <strong className="text-[var(--color-text)] font-semibold">Explanation:</strong> {q.explanation}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Question Create / Edit */}
            {isQuestionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">
                                {editingQuestion ? 'Edit Question' : 'Add New Question'}
                            </h3>
                            <button onClick={() => setIsQuestionModalOpen(false)} className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuestion} className="space-y-5 text-xs">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Target Topic *</label>
                                    <select
                                        required
                                        value={questionForm.topic_id}
                                        onChange={(e) => setQuestionForm({ ...questionForm, topic_id: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="">Select Topic...</option>
                                        {allTopics.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.level})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Difficulty Level *</label>
                                    <select
                                        value={questionForm.difficulty}
                                        onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="easy">Easy / Beginner</option>
                                        <option value="medium">Medium / Intermediate</option>
                                        <option value="hard">Hard / Advanced</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Question Type</label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="qtype"
                                            value="multiple_choice"
                                            checked={questionForm.type === 'multiple_choice'}
                                            onChange={() => {
                                                setQuestionForm({
                                                    ...questionForm,
                                                    type: 'multiple_choice',
                                                    options: [
                                                        { option_text: '', is_correct: true },
                                                        { option_text: '', is_correct: false },
                                                        { option_text: '', is_correct: false },
                                                        { option_text: '', is_correct: false },
                                                    ],
                                                });
                                            }}
                                            className="text-[var(--color-primary)] cursor-pointer"
                                        />
                                        <span className="font-semibold text-[var(--color-text)]">Multiple Choice (4 Options)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="qtype"
                                            value="true_false"
                                            checked={questionForm.type === 'true_false'}
                                            onChange={() => {
                                                setQuestionForm({
                                                    ...questionForm,
                                                    type: 'true_false',
                                                    options: [
                                                        { option_text: 'True', is_correct: true },
                                                        { option_text: 'False', is_correct: false },
                                                    ],
                                                });
                                            }}
                                            className="text-[var(--color-primary)] cursor-pointer"
                                        />
                                        <span className="font-semibold text-[var(--color-text)]">True / False</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Question Prompt *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={questionForm.question_text}
                                    onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none font-medium text-sm focus:border-[var(--color-primary)]"
                                    placeholder="Write your question prompt here..."
                                />
                            </div>

                            {/* Options Configuration */}
                            <div className="space-y-3">
                                <label className="block font-bold text-[var(--color-muted)]">
                                    Answer Options & Correct Answer Designation *
                                </label>
                                {questionForm.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                                        <input
                                            type="radio"
                                            name="correct_option"
                                            checked={opt.is_correct}
                                            onChange={() => {
                                                const updated = questionForm.options.map((o, i) => ({
                                                    ...o,
                                                    is_correct: i === idx,
                                                }));
                                                setQuestionForm({ ...questionForm, options: updated });
                                            }}
                                            className="h-4 w-4 text-emerald-500 cursor-pointer"
                                            title="Mark as correct answer"
                                        />
                                        <span className="font-bold text-[var(--color-muted)] w-6 text-center">
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <input
                                            type="text"
                                            required
                                            value={opt.option_text}
                                            onChange={(e) => {
                                                const updated = [...questionForm.options];
                                                updated[idx].option_text = e.target.value;
                                                setQuestionForm({ ...questionForm, options: updated });
                                            }}
                                            className="flex-1 px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                            placeholder={`Option ${String.fromCharCode(65 + idx)} text...`}
                                        />
                                        {opt.is_correct && (
                                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                Correct
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Answer Explanation</label>
                                <textarea
                                    rows={2}
                                    value={questionForm.explanation}
                                    onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                                    placeholder="Explain why the selected answer is correct..."
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                                <button type="button" onClick={() => setIsQuestionModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] cursor-pointer">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                                    {editingQuestion ? 'Update Question' : 'Save Question'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
