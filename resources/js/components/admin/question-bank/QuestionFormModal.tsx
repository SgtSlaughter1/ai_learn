import React, { useState, useEffect, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { ClassItem, QuestionItem, SubjectItem, TopicItem } from '@/types/admin';
import { formatClassOptionLabel, ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';
import QuestionImageUploader from './QuestionImageUploader';
import MathToolbar from './MathToolbar';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';

export interface QuestionFormData {
    topic_id: string;
    question_text: string;
    image_url?: string | null;
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
    onSaveAndAddNext?: (e?: React.FormEvent) => void;
    isSubmitting?: boolean;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
    showToast?: (text: string, type?: 'success' | 'error') => void;
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
    onSaveAndAddNext,
    isSubmitting = false,
    school,
    allowedGradeLevels,
    isTeacher,
    showToast,
}: QuestionFormModalProps) {
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [activeFocus, setActiveFocus] = useState<'prompt' | number | 'explanation'>('prompt');
    const [showLivePreview, setShowLivePreview] = useState(true);

    const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const explanationTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const optionInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    }, [allowedGradeLevels, isTeacher, classes, school]);

    // Sync selected grade, class, and subject when modal opens or when editing a question / topic
    useEffect(() => {
        if (!isOpen) return;

        if (form.topic_id) {
            const currentTopic = allTopics.find((t) => String(t.id) === String(form.topic_id));
            if (currentTopic) {
                const subId = currentTopic.subject_id ? String(currentTopic.subject_id) : '';
                setSelectedSubjectId(subId);

                if (currentTopic.level) {
                    setSelectedGradeLevel(currentTopic.level);
                }

                if (subId) {
                    const currentSubject = subjects.find((s) => String(s.id) === subId);
                    if (currentSubject && currentSubject.class_id) {
                        setSelectedClassId(String(currentSubject.class_id));
                        const currentCls = classes.find((c) => String(c.id) === String(currentSubject.class_id));
                        if (currentCls?.grade_level) {
                            setSelectedGradeLevel(currentCls.grade_level);
                        }
                    }
                }
            }
        }
    }, [isOpen, form.topic_id, allTopics, subjects, classes]);

    if (!isOpen) return null;

    // Filtered classes based on selected grade level
    const availableClasses = classes.filter(
        (c) => !selectedGradeLevel || c.grade_level === selectedGradeLevel
    );

    // Filtered subjects based on selected class and/or grade
    const availableSubjects = subjects.filter((s) => {
        if (selectedClassId) {
            return !s.class_id || String(s.class_id) === String(selectedClassId);
        }
        if (selectedGradeLevel) {
            const cls = classes.find((c) => c.id === s.class_id);
            if (cls && cls.grade_level !== selectedGradeLevel) return false;
        }
        return true;
    });

    // Filtered topics based on selected subject, class, and grade
    const availableTopics = allTopics.filter((t) => {
        if (selectedSubjectId && String(t.subject_id) !== String(selectedSubjectId)) {
            return false;
        }
        if (selectedGradeLevel && t.level && t.level !== selectedGradeLevel) {
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

    const handleGradeLevelChange = (newGrade: string) => {
        setSelectedGradeLevel(newGrade);
        if (newGrade && selectedClassId) {
            const currentCls = classes.find((c) => String(c.id) === selectedClassId);
            if (currentCls && currentCls.grade_level !== newGrade) {
                setSelectedClassId('');
            }
        }
    };

    const handleClassChange = (newClassId: string) => {
        setSelectedClassId(newClassId);
        if (newClassId) {
            const matched = classes.find((c) => String(c.id) === newClassId);
            if (matched?.grade_level) {
                setSelectedGradeLevel(matched.grade_level);
            }
        }
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
        const matchingTopics = allTopics.filter((t) => !newSubjectId || String(t.subject_id) === newSubjectId);
        if (matchingTopics.length > 0) {
            setForm((prev) => ({ ...prev, topic_id: String(matchingTopics[0].id) }));
        } else {
            setForm((prev) => ({ ...prev, topic_id: '' }));
        }
    };

    // Keyboard shortcut handler for power educators (Alex): Cmd/Ctrl+Enter to save, Cmd/Ctrl+Shift+Enter to Save & Add Next
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey && onSaveAndAddNext && !editingQuestion) {
                    onSaveAndAddNext(e as any);
                } else {
                    const formElement = promptTextareaRef.current?.closest('form');
                    if (formElement) {
                        formElement.requestSubmit();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onSaveAndAddNext, editingQuestion]);

    // Math Insertion Logic: Inserts snippet at current cursor or appends to active target field
    const handleInsertMath = (snippet: string) => {
        if (activeFocus === 'prompt') {
            const textarea = promptTextareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart ?? form.question_text.length;
                const end = textarea.selectionEnd ?? form.question_text.length;
                const nextText =
                    form.question_text.substring(0, start) +
                    snippet +
                    form.question_text.substring(end);
                setForm((prev) => ({ ...prev, question_text: nextText }));
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + snippet.length, start + snippet.length);
                }, 0);
            } else {
                setForm((prev) => ({ ...prev, question_text: prev.question_text + ' ' + snippet }));
            }
        } else if (typeof activeFocus === 'number') {
            const idx = activeFocus;
            const input = optionInputRefs.current[idx];
            const currentOptText = form.options[idx]?.option_text || '';
            let nextOptText = '';
            if (input) {
                const start = input.selectionStart ?? currentOptText.length;
                const end = input.selectionEnd ?? currentOptText.length;
                nextOptText =
                    currentOptText.substring(0, start) + snippet + currentOptText.substring(end);
                setTimeout(() => {
                    input.focus();
                    input.setSelectionRange(start + snippet.length, start + snippet.length);
                }, 0);
            } else {
                nextOptText = currentOptText + ' ' + snippet;
            }
            setForm((prev) => {
                const nextOptions = [...prev.options];
                if (nextOptions[idx]) {
                    nextOptions[idx] = { ...nextOptions[idx], option_text: nextOptText };
                }
                return { ...prev, options: nextOptions };
            });
        } else if (activeFocus === 'explanation') {
            const textarea = explanationTextareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart ?? form.explanation.length;
                const end = textarea.selectionEnd ?? form.explanation.length;
                const nextText =
                    form.explanation.substring(0, start) +
                    snippet +
                    form.explanation.substring(end);
                setForm((prev) => ({ ...prev, explanation: nextText }));
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + snippet.length, start + snippet.length);
                }, 0);
            } else {
                setForm((prev) => ({ ...prev, explanation: prev.explanation + ' ' + snippet }));
            }
        }
    };

    // Auto-Format text in the currently focused field
    const handleFormatActiveText = (formatted: string) => {
        if (activeFocus === 'prompt') {
            setForm((prev) => ({ ...prev, question_text: formatted }));
        } else if (typeof activeFocus === 'number') {
            setForm((prev) => {
                const nextOptions = [...prev.options];
                if (nextOptions[activeFocus]) {
                    nextOptions[activeFocus] = { ...nextOptions[activeFocus], option_text: formatted };
                }
                return { ...prev, options: nextOptions };
            });
        } else if (activeFocus === 'explanation') {
            setForm((prev) => ({ ...prev, explanation: formatted }));
        }
    };

    const getActiveText = () => {
        if (activeFocus === 'prompt') return form.question_text;
        if (typeof activeFocus === 'number') return form.options[activeFocus]?.option_text || '';
        if (activeFocus === 'explanation') return form.explanation;
        return form.question_text;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-5 sm:space-y-6 max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">
                            {editingQuestion ? 'Edit Question' : 'Add New Question'}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                            Curriculum mapping, diagram attachment, and mathematical expression editor.
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

                <form onSubmit={onSubmit} className="space-y-6 text-xs">
                    {/* Cascading Grade -> Class -> Subject -> Topic Selection */}
                    <div className="p-4 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] space-y-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] block">
                            Target Curriculum & Placement
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">1. Grade Level</label>
                                <select
                                    value={selectedGradeLevel}
                                    onChange={(e) => handleGradeLevelChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
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
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">2. Target Class</label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => handleClassChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                >
                                    <option value="">All Classes / School-wide</option>
                                    {availableClasses.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {formatClassOptionLabel(cls)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-text)] mb-1">3. Target Subject</label>
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
                                <label className="block font-bold text-[var(--color-text)] mb-1">4. Target Topic *</label>
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

                    {/* Difficulty & Status */}
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
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Image / Diagram Attachment Section */}
                    <QuestionImageUploader
                        imageUrl={form.image_url}
                        onChange={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
                        showToast={showToast}
                        label="Question Diagram / Figure (Optional)"
                        description="Attach a diagram, graph, or illustration. Supports drag-and-drop, browsing, and clipboard screenshot paste (Ctrl+V)."
                    />

                    {/* Mathematical Formula Studio Palette */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[var(--color-muted)]">
                                Inserting into:{' '}
                                <strong className="text-[var(--color-primary)]">
                                    {activeFocus === 'prompt'
                                        ? 'Question Prompt'
                                        : typeof activeFocus === 'number'
                                        ? `Option ${String.fromCharCode(65 + activeFocus)}`
                                        : 'Explanation'}
                                </strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowLivePreview(!showLivePreview)}
                                className="text-[10px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] flex items-center gap-1 cursor-pointer"
                            >
                                {showLivePreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{showLivePreview ? 'Hide Math Preview' : 'Show Math Preview'}</span>
                            </button>
                        </div>

                        <MathToolbar
                            onInsert={handleInsertMath}
                            onFormatCurrentText={handleFormatActiveText}
                            currentText={getActiveText()}
                        />
                    </div>

                    {/* Question Prompt Field */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="font-bold text-[var(--color-text)]">Question Prompt *</label>
                            <span className="text-[10px] text-[var(--color-muted)]">Supports LaTeX $x^2$ and Markdown</span>
                        </div>
                        <textarea
                            ref={promptTextareaRef}
                            required
                            rows={3}
                            value={form.question_text}
                            onFocus={() => setActiveFocus('prompt')}
                            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                            className={`w-full px-4 py-2.5 bg-[var(--color-background)] border rounded-xl text-[var(--color-text)] outline-none resize-none font-mono text-xs transition-colors ${
                                activeFocus === 'prompt'
                                    ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20'
                                    : 'border-[var(--color-border)]'
                            }`}
                            placeholder="Enter the question text here (e.g., Solve for x in $2x^2 + 5x - 3 = 0$ or find $\lim_{x \to 0} \frac{\sin x}{x}$)."
                        />

                        {/* Live KaTeX Math Preview for Prompt */}
                        {showLivePreview && form.question_text && (
                            <div className="mt-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] space-y-1">
                                <p className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--color-primary)]">
                                    Prompt Live Preview:
                                </p>
                                <div className="text-xs font-semibold [&_p]:inline">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {form.question_text}
                                    </Markdown>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Multiple Choice Options */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-[var(--color-text)]">Answer Choices * (Select radio for correct answer)</label>
                            <span className="text-[10px] text-[var(--color-muted)]">At least 2 options required</span>
                        </div>

                        {form.options.map((opt, idx) => {
                            const isFocused = activeFocus === idx;
                            const hasMath = opt.option_text.includes('$') || opt.option_text.includes('\\');

                            return (
                                <div
                                    key={idx}
                                    className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                        isFocused
                                            ? 'border-[var(--color-primary)] bg-[var(--color-background)] shadow-2xs'
                                            : 'border-[var(--color-border)] bg-[var(--color-background)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="correct_option"
                                            checked={opt.is_correct}
                                            onChange={() => {
                                                const nextOptions = form.options.map((o, i) => ({
                                                    ...o,
                                                    is_correct: i === idx,
                                                }));
                                                setForm({ ...form, options: nextOptions });
                                            }}
                                            className="w-4 h-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                                        />
                                        <span className="font-bold text-[var(--color-muted)] w-4 text-center shrink-0">
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <input
                                            ref={(el) => {
                                                optionInputRefs.current[idx] = el;
                                            }}
                                            type="text"
                                            required
                                            value={opt.option_text}
                                            onFocus={() => setActiveFocus(idx)}
                                            onChange={(e) => {
                                                const nextOptions = [...form.options];
                                                nextOptions[idx].option_text = e.target.value;
                                                setForm({ ...form, options: nextOptions });
                                            }}
                                            className="flex-1 px-3 py-1.5 bg-transparent border-0 text-[var(--color-text)] outline-none text-xs font-mono"
                                            placeholder={`Option ${String.fromCharCode(65 + idx)} (e.g. $x = \\frac{1}{2}$ or $y = \\pm 4$)`}
                                        />

                                        {form.options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextOptions = form.options.filter((_, i) => i !== idx);
                                                    if (opt.is_correct && nextOptions.length > 0) {
                                                        nextOptions[0].is_correct = true;
                                                    }
                                                    setForm({ ...form, options: nextOptions });
                                                }}
                                                className="p-1 rounded text-[var(--color-error)] hover:bg-[var(--color-error-5)] cursor-pointer"
                                                title="Remove this option"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Option Math Preview Pill */}
                                    {showLivePreview && hasMath && opt.option_text && (
                                        <div className="ml-9 px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] [&_p]:inline flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                                                Preview:
                                            </span>
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {opt.option_text}
                                            </Markdown>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {form.options.length < 5 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setForm({
                                        ...form,
                                        options: [...form.options, { option_text: '', is_correct: false }],
                                    });
                                }}
                                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer pt-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Option</span>
                            </button>
                        )}
                    </div>

                    {/* Explanation / Solution Notes */}
                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">
                            Explanation / Solution Working (Optional)
                        </label>
                        <textarea
                            ref={explanationTextareaRef}
                            rows={2}
                            value={form.explanation}
                            onFocus={() => setActiveFocus('explanation')}
                            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                            className={`w-full px-4 py-2 bg-[var(--color-background)] border rounded-xl text-[var(--color-text)] outline-none resize-none font-mono text-xs transition-colors ${
                                activeFocus === 'explanation'
                                    ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20'
                                    : 'border-[var(--color-border)]'
                            }`}
                            placeholder="Explanation shown after user attempts question (supports LaTeX working steps)..."
                        />
                        {showLivePreview && form.explanation && (
                            <div className="mt-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] [&_p]:inline">
                                <span className="text-[10px] font-extrabold uppercase text-[var(--color-primary)] block mb-1">
                                    Explanation Preview:
                                </span>
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {form.explanation}
                                </Markdown>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--color-border)]">
                        <div className="text-[11px] text-[var(--color-muted)] flex items-center gap-1.5 flex-wrap">
                            <span className="hidden sm:inline font-semibold">Shortcuts:</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[10px]">⌘/Ctrl + ↵</kbd>
                            <span>Save</span>
                            {!editingQuestion && onSaveAndAddNext && (
                                <>
                                    <span className="text-[var(--color-muted)]">•</span>
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[10px]">⌘/Ctrl + ⇧ + ↵</kbd>
                                    <span>Save &amp; Add Next</span>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto justify-center px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            {!editingQuestion && onSaveAndAddNext && (
                                <button
                                    type="button"
                                    onClick={(e) => onSaveAndAddNext(e)}
                                    disabled={isSubmitting || !form.question_text.trim()}
                                    className="w-full sm:w-auto justify-center px-4 py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:border-[var(--color-primary)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                                    title="Save this question and immediately start drafting the next one with class, subject, and topic preserved"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Save &amp; Add Next</span>
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || !form.question_text.trim()}
                                className="w-full sm:w-auto justify-center px-5 py-2.5 sm:py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{editingQuestion ? 'Updating...' : 'Saving...'}</span>
                                    </>
                                ) : (
                                    <span>{editingQuestion ? 'Update Question' : 'Save Question'}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
