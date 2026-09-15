import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { ClassItem, QuestionItem, SubjectItem, TopicItem } from '@/types/admin';

export interface QuestionFormData {
    topic_id: string;
    question_text: string;
    type: string;
    difficulty: string;
    explanation: string;
    status: string;
    options: {
        option_text: string;
        is_correct: boolean;
    }[];
}

interface QuestionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingQuestion: QuestionItem | null;
    form: QuestionFormData;
    setForm: React.Dispatch<React.SetStateAction<QuestionFormData>>;
    classes?: ClassItem[];
    subjects?: SubjectItem[];
    allTopics: TopicItem[];
    onSubmit: (e: React.FormEvent) => void;
}

export default function QuestionFormModal({
    isOpen,
    onClose,
    editingQuestion,
    form,
    setForm,
    classes = [],
    subjects = [],
    allTopics,
    onSubmit,
}: QuestionFormModalProps) {
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

    // Sync selected class and subject when modal opens or when editing a question / topic
    useEffect(() => {
        if (!isOpen) return;

        if (form.topic_id) {
            const currentTopic = allTopics.find((t) => String(t.id) === String(form.topic_id));
            if (currentTopic) {
                const subId = currentTopic.subject_id ? String(currentTopic.subject_id) : '';
                setSelectedSubjectId(subId);

                if (subId) {
                    const currentSubject = subjects.find((s) => String(s.id) === subId);
                    if (currentSubject && currentSubject.class_id) {
                        setSelectedClassId(String(currentSubject.class_id));
                    }
                }
            }
        }
    }, [isOpen, form.topic_id, allTopics, subjects]);

    if (!isOpen) return null;

    // Filtered subjects based on selected class
    const availableSubjects = subjects.filter((s) => {
        if (!selectedClassId) return true;
        return !s.class_id || String(s.class_id) === String(selectedClassId);
    });

    // Filtered topics based on selected subject and class
    const availableTopics = allTopics.filter((t) => {
        if (selectedSubjectId && String(t.subject_id) !== String(selectedSubjectId)) {
            return false;
        }
        if (selectedClassId && !selectedSubjectId) {
            const subj = subjects.find((s) => String(s.id) === String(t.subject_id));
            if (subj && subj.class_id && String(subj.class_id) !== String(selectedClassId)) {
                return false;
            }
        }
        return true;
    });

    const handleClassChange = (newClassId: string) => {
        setSelectedClassId(newClassId);
        // If current subject doesn't belong to newly selected class, reset subject
        if (newClassId && selectedSubjectId) {
            const currentSub = subjects.find((s) => String(s.id) === String(selectedSubjectId));
            if (currentSub && currentSub.class_id && String(currentSub.class_id) !== newClassId) {
                setSelectedSubjectId('');
                setForm((prev) => ({ ...prev, topic_id: '' }));
            }
        }
    };

    const handleSubjectChange = (newSubjectId: string) => {
        setSelectedSubjectId(newSubjectId);
        // Auto-select first matching topic if available
        const matchingTopics = allTopics.filter((t) => !newSubjectId || String(t.subject_id) === newSubjectId);
        if (matchingTopics.length > 0) {
            setForm((prev) => ({ ...prev, topic_id: String(matchingTopics[0].id) }));
        } else {
            setForm((prev) => ({ ...prev, topic_id: '' }));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">
                            {editingQuestion ? 'Edit Question' : 'Add New Question'}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                            Assign questions to a specific class cohort, subject curriculum, and learning topic.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-5 text-xs">
                    {/* Cascading Class -> Subject -> Topic Selection */}
                    <div className="p-4 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] space-y-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] block">
                            Target Curriculum & Placement
                        </span>

                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">1. Target Class</label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => handleClassChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                >
                                    <option value="">All Classes / School-wide</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.name} ({cls.grade_level})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">2. Target Subject</label>
                                <select
                                    value={selectedSubjectId}
                                    onChange={(e) => handleSubjectChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                >
                                    <option value="">Select Subject...</option>
                                    {availableSubjects.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">3. Target Topic *</label>
                                <select
                                    required
                                    value={form.topic_id}
                                    onChange={(e) => setForm({ ...form, topic_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                >
                                    <option value="">Select Topic...</option>
                                    {availableTopics.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Difficulty Level *</label>
                            <select
                                value={form.difficulty}
                                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="easy">Easy / Beginner</option>
                                <option value="medium">Medium / Intermediate</option>
                                <option value="hard">Hard / Advanced</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="active">Active (Visible in Assessments)</option>
                                <option value="inactive">Inactive (Draft)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Question Type</label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="qtype"
                                    value="multiple_choice"
                                    checked={form.type === 'multiple_choice'}
                                    onChange={() => {
                                        setForm({
                                            ...form,
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
                                    checked={form.type === 'true_false'}
                                    onChange={() => {
                                        setForm({
                                            ...form,
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
                        <label className="block font-bold text-[var(--color-text)] mb-1">Question Prompt *</label>
                        <textarea
                            required
                            rows={3}
                            value={form.question_text}
                            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none font-medium text-sm focus:border-[var(--color-primary)]"
                            placeholder="Write your question prompt here... (supports LaTeX math e.g. $x^2 + y^2 = r^2$)"
                        />
                        {form.question_text &&
                            (form.question_text.includes('$') ||
                                form.question_text.includes('\\') ||
                                form.question_text.includes('^')) && (
                                <div className="mt-2 p-3 bg-[var(--color-primary-5)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] [&_p]:inline">
                                    <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider block mb-1">
                                        Live Math Preview:
                                    </span>
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {form.question_text}
                                    </Markdown>
                                </div>
                            )}
                    </div>

                    {/* Options Configuration */}
                    <div className="space-y-3">
                        <label className="block font-bold text-[var(--color-text)]">
                            Answer Options & Correct Answer Designation *
                        </label>
                        {form.options.map((opt, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]"
                            >
                                <input
                                    type="radio"
                                    name="correct_option"
                                    checked={opt.is_correct}
                                    onChange={() => {
                                        const updated = form.options.map((o, i) => ({
                                            ...o,
                                            is_correct: i === idx,
                                        }));
                                        setForm({ ...form, options: updated });
                                    }}
                                    className="h-4 w-4 text-[var(--color-success)] cursor-pointer"
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
                                        const updated = [...form.options];
                                        updated[idx].option_text = e.target.value;
                                        setForm({ ...form, options: updated });
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    placeholder={`Option ${String.fromCharCode(65 + idx)} text...`}
                                />
                                {opt.is_correct && (
                                    <span className="text-[10px] font-bold text-[var(--color-success)] bg-[var(--color-success-10)] border border-[var(--color-success)]/20 px-2 py-0.5 rounded">
                                        Correct
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Answer Explanation</label>
                        <textarea
                            rows={2}
                            value={form.explanation}
                            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                            placeholder="Explain why the selected answer is correct..."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                            {editingQuestion ? 'Update Question' : 'Save Question'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
