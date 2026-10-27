import React, { useState, useEffect, useMemo, useRef } from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';
import { RichText } from '@/components/common/RichText';
import 'katex/dist/katex.min.css';
import type { ClassItem, QuestionContextItem, QuestionItem, SubjectItem, TopicItem } from '@/types/admin';
import { formatClassOptionLabel, ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';
import QuestionImageUploader from './QuestionImageUploader';
import PassageSection from './PassageSection';
import SubjectTools, { formulaSuggestion, usesMathsPanel } from './SubjectTools';
import { PassageView } from '@/components/quiz/PassageView';
import { Eye, EyeOff, Plus, Trash2, Image as ImageIcon, Check } from 'lucide-react';

export interface QuestionFormData {
    topic_id: string;
    grade_level?: string;
    marks?: number;
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
    /** The shared passage this question is about (sent whole; see QuestionController::placeInContext). */
    context?: QuestionContextItem | null;
    /** On edit: take the question off its passage. */
    detach_context?: boolean;
    /** After "Save & add next" on a passage: keep it, read-only, for the next question. */
    context_locked?: boolean;
    context_question_number?: number;
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
    /** Platform admins only: may add questions to shared subjects. */
    canEditShared?: boolean;
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
    canEditShared = false,
    showToast,
}: QuestionFormModalProps) {
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [activeFocus, setActiveFocus] = useState<'prompt' | number | 'explanation'>('prompt');
    const [showLivePreview, setShowLivePreview] = useState(true);
    const [showImageUploader, setShowImageUploader] = useState<boolean>(Boolean(form.image_url));
    const [mobileTab, setMobileTab] = useState<'curriculum' | 'editor' | 'preview'>(() => (editingQuestion ? 'editor' : 'curriculum'));
    const [allowMultipleCorrect, setAllowMultipleCorrect] = useState<boolean>(() => {
        return form.options.filter((o) => o.is_correct).length > 1;
    });

    const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const topicSelectRef = useRef<HTMLSelectElement | null>(null);
    // Once a topic is chosen the placement rarely changes, so it shows as one summary line
    // until the teacher asks to change it. (The topic can arrive just after opening, when the
    // bank's filter fills it in, so this is "expanded on request", not "collapsed on open".)
    const [curriculumOpen, setCurriculumOpen] = useState(false);
    // What the teacher had typed when the modal opened (or after the last Save & Next), to tell
    // whether closing would throw work away. A passage carried over to the next question is
    // already saved, so it doesn't count.
    const contentKey = (f: typeof form) =>
        JSON.stringify([
            f.question_text.trim(),
            (f.explanation ?? '').trim(),
            f.image_url ?? '',
            f.options.map((o) => [o.option_text.trim(), o.is_correct]),
            f.context && !f.context_locked ? [f.context.body ?? '', f.context.image_url ?? ''] : null,
        ]);
    const savedSnapshotRef = useRef('');
    const confirmingCloseRef = useRef(false);
    // Typed something, and it differs from what was there: a blank form (fresh, or just reset by
    // Save & Next) never asks.
    const hasText = Boolean(
        form.question_text.trim() || (form.explanation ?? '').trim() || form.image_url
        || form.options.some((o) => o.option_text.trim())
        || (form.context && !form.context_locked && (form.context.body?.trim() || form.context.image_url))
    );
    const hasUnsavedWork = hasText && contentKey(form) !== savedSnapshotRef.current;

    const requestClose = async () => {
        if (confirmingCloseRef.current) return;
        if (hasUnsavedWork) {
            confirmingCloseRef.current = true;
            const discard = await confirmAction({
                title: 'Discard this question?',
                message: "What you've typed hasn't been saved and will be lost.",
                confirmLabel: 'Discard',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            confirmingCloseRef.current = false;
            if (!discard) return;
        }
        onClose();
    };
    const requestCloseRef = useRef(requestClose);
    requestCloseRef.current = requestClose;

    // Closing or reloading the browser tab warns too.
    useEffect(() => {
        if (!isOpen || !hasUnsavedWork) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isOpen, hasUnsavedWork]);
    // The field that stopped the last save, shown under that field. The browser's own
    // "Please fill out this field" bubble is off (noValidate): it can't reach fields on a
    // hidden mobile step, so Save used to fail there with no message.
    const [invalid, setInvalid] = useState<{ field: 'topic' | 'prompt' | 'passage' | number; message: string } | null>(null);
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

    const prevIsOpenRef = useRef(false);

    // Sync selected grade, class, and subject only when modal first opens or when switching editing question
    useEffect(() => {
        if (!isOpen) {
            prevIsOpenRef.current = false;
            return;
        }

        const justOpened = !prevIsOpenRef.current;
        prevIsOpenRef.current = true;

        if (justOpened) {
            // Placement already known (editing, or carried over from the last question): start writing.
            setMobileTab(editingQuestion || form.topic_id ? 'editor' : 'curriculum');
            setCurriculumOpen(false);
            savedSnapshotRef.current = contentKey(form);

            if (form.image_url) {
                setShowImageUploader(true);
            }

            // Detect if question has multiple correct answers
            const isMulti = form.options.filter((o) => o.is_correct).length > 1;
            setAllowMultipleCorrect(isMulti);

            if (form.grade_level) {
                setSelectedGradeLevel(form.grade_level);
            } else if (editingQuestion?.grade_level) {
                setSelectedGradeLevel(editingQuestion.grade_level);
            }

            if (form.topic_id) {
                const currentTopic = allTopics.find((t) => String(t.id) === String(form.topic_id));
                if (currentTopic) {
                    const subId = currentTopic.subject_id ? String(currentTopic.subject_id) : '';
                    setSelectedSubjectId(subId);

                    if (currentTopic.level && !form.grade_level && !editingQuestion?.grade_level) {
                        setSelectedGradeLevel(currentTopic.level);
                    }

                    if (subId) {
                        const currentSubject = subjects.find((s) => String(s.id) === subId);
                        if (currentSubject && currentSubject.class_id) {
                            setSelectedClassId(String(currentSubject.class_id));
                            const currentCls = classes.find((c) => String(c.id) === String(currentSubject.class_id));
                            if (currentCls?.grade_level && !form.grade_level && !editingQuestion?.grade_level) {
                                setSelectedGradeLevel(currentCls.grade_level);
                            }
                        }
                    }
                }
            }
        }
    }, [isOpen, editingQuestion, allTopics, subjects, classes, form.image_url, form.grade_level, form.topic_id, form.options]);

    const subjectName = useMemo(() => {
        const topic = allTopics.find((t) => String(t.id) === String(form.topic_id));
        const subjectId = selectedSubjectId || (topic?.subject_id ? String(topic.subject_id) : '');
        return subjects.find((sub) => String(sub.id) === subjectId)?.name ?? topic?.subject?.name ?? '';
    }, [allTopics, form.topic_id, selectedSubjectId, subjects]);
    const suggestion = useMemo(() => formulaSuggestion(form.question_text, subjectName), [form.question_text, subjectName]);

    const setContext = (context: QuestionContextItem | null) => setForm((prev) => ({
        ...prev,
        context,
        context_locked: context ? prev.context_locked : false,
        // Unticking the passage on a question that was on one takes it off when saved.
        detach_context: !context && Boolean(editingQuestion?.context_id),
    }));

    // Filtered classes based on selected grade level
    const availableClasses = classes.filter(
        (c) => !selectedGradeLevel || c.grade_level === selectedGradeLevel
    );

    // Shared subjects (no school) belong to the platform: only a platform admin may add to them,
    // so nobody else is offered one and then refused on save.
    const canAuthorIn = (subjectId: number | string | null | undefined) => {
        if (canEditShared) return true;
        const subject = subjects.find((s) => String(s.id) === String(subjectId));
        return subject ? subject.school_id != null : false;
    };

    // Filtered subjects based on selected class and/or grade
    const availableSubjects = subjects.filter((s) => {
        if (!canAuthorIn(s.id)) return false;
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
        // The question being edited keeps showing its own topic.
        if (editingQuestion && String(t.id) === String(form.topic_id)) return true;
        if (!canAuthorIn(t.subject_id)) return false;
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
        setForm((prev) => ({ ...prev, grade_level: newGrade }));
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
                setForm((prev) => ({ ...prev, grade_level: matched.grade_level }));
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
        // If current topic belongs to a different subject, reset topic_id so user can pick from the new subject's topics
        if (form.topic_id) {
            const currentTopic = allTopics.find((t) => String(t.id) === String(form.topic_id));
            if (currentTopic && newSubjectId && String(currentTopic.subject_id) !== String(newSubjectId)) {
                setForm((prev) => ({ ...prev, topic_id: '' }));
            }
        }
    };

    // Toggle Answer Mode between Single Answer and Multiple Answers
    const handleToggleMultipleMode = (enableMultiple: boolean) => {
        setAllowMultipleCorrect(enableMultiple);
        if (!enableMultiple) {
            // When switching to single answer mode, retain only the first currently checked answer
            const firstCorrectIndex = form.options.findIndex((o) => o.is_correct);
            const targetIndex = firstCorrectIndex >= 0 ? firstCorrectIndex : 0;
            const nextOptions = form.options.map((o, i) => ({
                ...o,
                is_correct: i === targetIndex,
            }));
            setForm((prev) => ({
                ...prev,
                type: 'multiple_choice',
                options: nextOptions,
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                type: 'multiple_select',
            }));
        }
    };

    // Toggle Option Correctness with support for single-choice and multi-select
    const toggleOptionCorrect = (idx: number) => {
        if (allowMultipleCorrect) {
            const currentlyCorrect = Boolean(form.options[idx]?.is_correct);
            const totalCorrect = form.options.filter((o) => o.is_correct).length;

            // Safeguard: Prevent deselecting the only remaining correct answer
            if (currentlyCorrect && totalCorrect <= 1) {
                showToast?.('At least one option must remain marked as correct.', 'error');
                return;
            }

            const nextOptions = form.options.map((o, i) =>
                i === idx ? { ...o, is_correct: !o.is_correct } : o
            );
            setForm((prev) => ({ ...prev, options: nextOptions }));
        } else {
            // Single choice mode: mark clicked option as correct, unmark all others
            const nextOptions = form.options.map((o, i) => ({
                ...o,
                is_correct: i === idx,
            }));
            setForm((prev) => ({ ...prev, options: nextOptions }));
        }
    };

    // Keyboard shortcuts: Cmd/Ctrl+Enter saves, Cmd/Ctrl+Shift+Enter saves and adds the next one,
    // Esc closes. Both saves go through handleFormSubmit, so a shortcut can't skip the checks.
    const submitRef = useRef<(e: React.FormEvent, next?: boolean) => void>(() => {});
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                submitRef.current(e as unknown as React.FormEvent, e.shiftKey && Boolean(onSaveAndAddNext) && !editingQuestion);
            } else if (e.key === 'Escape') {
                requestCloseRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onSaveAndAddNext, editingQuestion, onClose]);

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

    // Wrap the selected text in the focused field (underline, bold), or insert a placeholder.
    const handleWrapSelection = (before: string, after: string = before, placeholder: string = 'word') => {
        const el: HTMLInputElement | HTMLTextAreaElement | null =
            activeFocus === 'prompt' ? promptTextareaRef.current
            : activeFocus === 'explanation' ? explanationTextareaRef.current
            : typeof activeFocus === 'number' ? optionInputRefs.current[activeFocus] : null;
        const text = el?.value ?? '';
        const start = el?.selectionStart ?? text.length;
        const end = el?.selectionEnd ?? text.length;
        handleInsertMath(before + (text.slice(start, end) || placeholder) + after);
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

    useEffect(() => setInvalid(null), [form]);

    const handleFormSubmit = (e: React.FormEvent, isSaveAndNext: boolean = false) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        // Show the step that holds the field, then focus it once it is visible.
        const block = (field: 'topic' | 'prompt' | 'passage' | number, message: string, target?: HTMLElement | null) => {
            setInvalid({ field, message });
            setMobileTab(field === 'topic' ? 'curriculum' : 'editor');
            requestAnimationFrame(() => {
                target?.focus();
                target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        };
        if (!form.topic_id) {
            setCurriculumOpen(true);
            return block('topic', 'Choose a topic for this question.', topicSelectRef.current);
        }
        if (!form.question_text.trim()) {
            return block('prompt', 'Write the question.', promptTextareaRef.current);
        }
        if (form.context && !form.context.body?.trim() && !form.context.image_url) {
            return block('passage', 'Add the passage text or a picture, or untick "This question is about a passage".');
        }
        const emptyOption = form.options.findIndex((o) => !o.option_text.trim());
        if (emptyOption !== -1) {
            const letter = String.fromCharCode(65 + emptyOption);
            return block(emptyOption, `Option ${letter} is empty. Fill it in or remove it.`, optionInputRefs.current[emptyOption]);
        }
        setInvalid(null);
        if (isSaveAndNext && onSaveAndAddNext) {
            onSaveAndAddNext(e);
        } else {
            onSubmit(e);
        }
    };

    submitRef.current = handleFormSubmit;

    if (!isOpen) return null;

    const fieldError = (field: 'topic' | 'prompt' | 'passage' | number) =>
        invalid?.field === field ? (
            <p id="question-error" role="alert" className="mt-1 text-xs font-semibold text-[var(--color-error)]">
                {invalid.message}
            </p>
        ) : null;

    return (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }} className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div role="dialog" aria-modal="true" aria-labelledby="question-modal-title" className="bg-[var(--color-surface)] border-0 sm:border border-[var(--color-border)] rounded-none sm:rounded-2xl md:rounded-3xl p-3 sm:p-6 max-w-5xl xl:max-w-6xl w-full shadow-2xl space-y-3 sm:space-y-4 h-full sm:h-auto max-h-screen sm:max-h-[94vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5 sm:pb-3 shrink-0">
                    <div>
                        <h3 id="question-modal-title" className="text-base sm:text-xl font-bold text-[var(--color-text)] tracking-tight">
                            {editingQuestion ? 'Edit Question' : 'Add New Question'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowLivePreview(!showLivePreview);
                                if (!showLivePreview) {
                                    setMobileTab('preview');
                                } else if (mobileTab === 'preview') {
                                    setMobileTab('editor');
                                }
                            }}
                            className={`px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                showLivePreview
                                    ? 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                                    : 'bg-[var(--color-background)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                            }`}
                            title="Toggle Student Preview Card"
                        >
                            {showLivePreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{showLivePreview ? 'Live Preview On' : 'Preview Off'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={requestClose}
                            className="p-1.5 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Viewport Mode Switcher (Visible on mobile/tablet < lg, hidden on desktop lg+) */}
                <div className="flex lg:hidden items-center p-1 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] shrink-0 gap-1">
                    <button
                        type="button"
                        onClick={() => setMobileTab('curriculum')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            mobileTab === 'curriculum'
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs border border-[var(--color-border)]'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        <span>1. Curriculum</span>
                        {form.topic_id ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="Topic not chosen" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('editor')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            mobileTab === 'editor'
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs border border-[var(--color-border)]'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        <span>2. Question</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('preview')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            mobileTab === 'preview'
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs border border-[var(--color-border)]'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>3. Preview</span>
                    </button>
                </div>

                {/* Form Body: 2-Column Split Studio on Desktop */}
                <form noValidate onSubmit={(e) => handleFormSubmit(e)} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        
                        {/* ======================================================================= */}
                        {/* STEP 1 (Left on Desktop, First on Mobile): Curriculum & Settings        */}
                        {/* ======================================================================= */}
                        <div className="lg:col-span-5 space-y-3.5 lg:sticky lg:top-0">
                            
                            {/* Curriculum: one summary line once a topic is chosen, the full form otherwise */}
                            {form.topic_id && !curriculumOpen ? (
                                <div className={`flex-wrap items-center gap-3 px-3.5 py-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] ${mobileTab === 'curriculum' ? 'flex' : 'hidden lg:flex'}`}>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-[var(--color-text)] truncate">
                                            {[selectedGradeLevel || form.grade_level, subjectName, allTopics.find((t) => String(t.id) === String(form.topic_id))?.name]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                            {form.marks ?? 1} {(form.marks ?? 1) === 1 ? 'mark' : 'marks'} · {form.difficulty.charAt(0).toUpperCase() + form.difficulty.slice(1)}
                                            {form.status !== 'active' && ' · Inactive'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCurriculumOpen(true)}
                                        aria-expanded={false}
                                        className="min-h-11 sm:min-h-8 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] cursor-pointer shrink-0"
                                    >
                                        Change
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMobileTab('editor')}
                                        className="lg:hidden w-full min-h-11 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold cursor-pointer"
                                    >
                                        Next: write the question
                                    </button>
                                </div>
                            ) : (
                            <div className={`p-3.5 sm:p-4 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] space-y-3 shadow-2xs ${mobileTab === 'curriculum' ? 'block' : 'hidden lg:block'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)]">
                                            Target Curriculum
                                        </span>
                                        {(selectedGradeLevel || form.grade_level) && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 uppercase">
                                                {selectedGradeLevel || form.grade_level}
                                            </span>
                                        )}
                                    </div>
                                    {form.topic_id && (
                                        <button
                                            type="button"
                                            onClick={() => setCurriculumOpen(false)}
                                            className="min-h-11 sm:min-h-8 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] cursor-pointer"
                                        >
                                            Done
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">1. Grade</label>
                                        <select
                                            value={selectedGradeLevel}
                                            onChange={(e) => handleGradeLevelChange(e.target.value)}
                                            className="w-full h-9 sm:h-8.5 px-3 pr-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs cursor-pointer"
                                        >
                                            <option value="">All Grades</option>
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
                                        <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">2. Class</label>
                                        <select
                                            value={selectedClassId}
                                            onChange={(e) => handleClassChange(e.target.value)}
                                            className="w-full h-9 sm:h-8.5 px-3 pr-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs cursor-pointer"
                                        >
                                            <option value="">All Classes</option>
                                            {availableClasses.map((cls) => (
                                                <option key={cls.id} value={cls.id}>
                                                    {formatClassOptionLabel(cls)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">3. Subject</label>
                                        <select
                                            value={selectedSubjectId}
                                            onChange={(e) => handleSubjectChange(e.target.value)}
                                            className="w-full h-9 sm:h-8.5 px-3 pr-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs cursor-pointer"
                                        >
                                            <option value="">Select Subject...</option>
                                            {availableSubjects.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-1 sm:col-span-1">
                                        <label htmlFor="question-topic" className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">4. Topic *</label>
                                        <select
                                            id="question-topic"
                                            ref={topicSelectRef}
                                            aria-invalid={invalid?.field === 'topic'}
                                            aria-describedby={invalid?.field === 'topic' ? 'question-error' : undefined}
                                            value={form.topic_id}
                                            onChange={(e) => {
                                                const topId = e.target.value;
                                                const matched = allTopics.find((t) => String(t.id) === topId);
                                                setForm((prev) => ({
                                                    ...prev,
                                                    topic_id: topId,
                                                    ...(!prev.grade_level && matched?.level ? { grade_level: matched.level } : {}),
                                                }));
                                                if (matched?.level && !selectedGradeLevel) {
                                                    setSelectedGradeLevel(matched.level);
                                                }
                                            }}
                                            className={`w-full h-9 sm:h-8.5 px-3 pr-8 bg-[var(--color-surface)] border rounded-xl font-semibold outline-none text-sm sm:text-xs cursor-pointer ${
                                                invalid?.field === 'topic'
                                                    ? 'border-[var(--color-error)] text-[var(--color-muted)]'
                                                    : form.topic_id
                                                    ? 'border-emerald-500/60 text-[var(--color-text)]'
                                                    : 'border-[var(--color-border)] text-[var(--color-muted)] focus:border-[var(--color-primary)]'
                                            }`}
                                        >
                                            <option value="">Select Topic...</option>
                                            {availableTopics.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({t.level})
                                                </option>
                                            ))}
                                        </select>
                                        {fieldError('topic')}
                                    </div>

                                    <div className="col-span-1 sm:col-span-2 grid grid-cols-[4.5rem_1fr_1fr] gap-2 pt-2 border-t border-[var(--color-border)]/60">
                                        <div>
                                            <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">Marks</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={form.marks ?? 1}
                                                onChange={(e) => setForm({ ...form, marks: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-full h-9 sm:h-8.5 px-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs text-center"
                                                placeholder="1"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">Difficulty</label>
                                            <select
                                                value={form.difficulty}
                                                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                                                className="w-full h-9 sm:h-8.5 px-2.5 pr-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs cursor-pointer"
                                            >
                                                <option value="easy">Easy</option>
                                                <option value="medium">Medium</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block font-bold text-[var(--color-text)] mb-1 text-[11px]">Status</label>
                                            <select
                                                value={form.status}
                                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                                className="w-full h-9 sm:h-8.5 px-2.5 pr-7 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] text-sm sm:text-xs cursor-pointer"
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Step navigation button on mobile */}
                                <div className="pt-2 border-t border-[var(--color-border)]/50 flex sm:hidden items-center justify-between">
                                    <span className="text-[10px] text-[var(--color-muted)]">Step 1: Placement</span>
                                    <button
                                        type="button"
                                        onClick={() => setMobileTab('editor')}
                                        className="px-3.5 py-1.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                    >
                                        <span>Next: Write Question →</span>
                                    </button>
                                </div>
                            </div>
                            )}

                            {/* Live Student Exam Simulation Preview */}
                            {showLivePreview && (
                                <div className={`p-3.5 sm:p-4 rounded-2xl bg-[var(--color-background)] border-2 border-[var(--color-primary)]/20 space-y-2.5 shadow-xs ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
                                    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1.5">
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Student Card Preview</span>
                                        </span>
                                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wide">
                                            {(selectedGradeLevel || form.grade_level) ? `${selectedGradeLevel || form.grade_level} • ` : ''}
                                            {allowMultipleCorrect ? 'Multiple Answers' : 'Single Answer'} • {form.difficulty} • {form.marks ?? 1} {(form.marks ?? 1) === 1 ? 'Mark' : 'Marks'}
                                        </span>
                                    </div>

                                    {form.context && (form.context.body || form.context.image_url) && (
                                        <div className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] max-h-56 overflow-y-auto">
                                            <PassageView context={form.context} label={form.context_question_number ? `Question ${form.context_question_number} on this passage` : null} compact />
                                        </div>
                                    )}

                                    {/* Rendered prompt */}
                                    {form.question_text ? (
                                        <div className="text-xs font-semibold text-[var(--color-text)] leading-relaxed [&_p]:inline">
                                            <RichText text={form.question_text} />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-[var(--color-muted)] italic">
                                            Type a question prompt on the right to see live preview...
                                        </div>
                                    )}

                                    {allowMultipleCorrect && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold italic">
                                            Note: More than one answer is correct. Select all that apply.
                                        </p>
                                    )}

                                    {/* Rendered diagram */}
                                    {form.image_url && (
                                        <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
                                            <img src={form.image_url} alt="Question diagram" className="max-h-40 w-auto object-contain mx-auto" />
                                        </div>
                                    )}

                                    {/* Rendered Options Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                        {form.options.map((opt, i) => (
                                            <div
                                                key={i}
                                                className={`p-2 rounded-xl border flex items-center gap-2 text-xs transition-all ${
                                                    opt.is_correct
                                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-bold'
                                                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                                                }`}
                                            >
                                                <span
                                                    className={`w-4 h-4 text-[9px] font-black shrink-0 flex items-center justify-center ${
                                                        allowMultipleCorrect ? 'rounded-md' : 'rounded-full'
                                                    } ${
                                                        opt.is_correct
                                                             ? 'bg-emerald-500 text-white'
                                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]'
                                                    }`}
                                                >
                                                    {opt.is_correct ? '✓' : String.fromCharCode(65 + i)}
                                                </span>
                                                <div className="flex-1 min-w-0 [&_p]:inline text-[11px]">
                                                    <RichText text={opt.option_text || `(Empty ${String.fromCharCode(65 + i)})`} />
                                                </div>
                                                {opt.is_correct && (
                                                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                                                        ✓ Correct
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Rendered Explanation */}
                                    {form.explanation && (
                                        <div className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-muted)] space-y-1">
                                            <span className="text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider block">
                                                Solution:
                                            </span>
                                            <div className="text-[var(--color-text)] [&_p]:inline leading-relaxed">
                                                <RichText text={form.explanation} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Mobile navigation button from preview */}
                                    <div className="pt-2 border-t border-[var(--color-border)]/50 flex sm:hidden items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setMobileTab('editor')}
                                            className="px-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>← Back to Write Question</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMobileTab('curriculum')}
                                            className="px-2.5 py-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                                        >
                                            Edit Curriculum
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ======================================================================= */}
                        {/* STEP 2 (Right on Desktop, Second on Mobile): Authoring Studio           */}
                        {/* ======================================================================= */}
                        <div className={`space-y-3.5 lg:col-span-7 ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}>
                            
                            <SubjectTools
                                subjectName={subjectName}
                                targetLabel={activeFocus === 'prompt'
                                    ? 'the question'
                                    : typeof activeFocus === 'number'
                                    ? `option ${String.fromCharCode(65 + activeFocus)}`
                                    : 'the explanation'}
                                currentText={getActiveText()}
                                onInsert={handleInsertMath}
                                onWrap={handleWrapSelection}
                                onFormatCurrentText={handleFormatActiveText}
                            />

                            <PassageSection
                                value={form.context ?? null}
                                onChange={setContext}
                                topicId={form.topic_id}
                                locked={Boolean(form.context && form.context_locked)}
                                onUnlock={() => setForm((prev) => ({ ...prev, context_locked: false }))}
                                questionNumber={form.context_question_number}
                                showToast={showToast}
                            />
                            {fieldError('passage')}

                            {/* Question Prompt Field */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="question-prompt" className="font-bold text-[var(--color-text)] text-xs">Question Prompt *</label>
                                </div>
                                <textarea
                                    id="question-prompt"
                                    ref={promptTextareaRef}
                                    aria-invalid={invalid?.field === 'prompt'}
                                    aria-describedby={invalid?.field === 'prompt' ? 'question-error' : undefined}
                                    rows={3}
                                    value={form.question_text}
                                    onFocus={() => setActiveFocus('prompt')}
                                    onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                                    className={`w-full px-3.5 py-2.5 bg-[var(--color-background)] border rounded-2xl text-[var(--color-text)] outline-none resize-none font-mono text-[15px] sm:text-xs transition-colors leading-relaxed ${
                                        invalid?.field === 'prompt'
                                            ? 'border-[var(--color-error)] ring-2 ring-[var(--color-error)]/20'
                                            : activeFocus === 'prompt'
                                            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 shadow-xs'
                                            : 'border-[var(--color-border)]'
                                    }`}
                                    placeholder={usesMathsPanel(subjectName) ? 'e.g. Solve for x: 2x² + 5x − 3 = 0' : 'e.g. Choose the word nearest in meaning to the underlined word.'}
                                />
                                {fieldError('prompt')}
                                {suggestion && (
                                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20 text-[11px]">
                                        <span className="flex-1 min-w-[180px] text-[var(--color-text)]">
                                            Show <code className="font-mono">{suggestion.match}</code> as <span className="text-sm"><RichText text={suggestion.replacement} inline /></span>?
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setForm((prev) => ({ ...prev, question_text: prev.question_text.replace(suggestion.match, suggestion.replacement) }))}
                                            className="min-h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white font-bold cursor-pointer"
                                        >
                                            Yes, tidy it
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Diagram / Figure (Compact Collapsible Trigger) */}
                            {form.image_url || showImageUploader ? (
                                <QuestionImageUploader
                                    imageUrl={form.image_url}
                                    onChange={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
                                    onHide={() => setShowImageUploader(false)}
                                    showToast={showToast}
                                    label={form.context ? 'Picture for this question only' : 'Question picture (optional)'}
                                    description={form.context
                                        ? 'Only this question shows it. A picture every question needs belongs on the passage above.'
                                        : 'A diagram, graph or illustration. Drag and drop, browse, or paste (Ctrl+V).'}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowImageUploader(true)}
                                    className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] transition-all font-semibold cursor-pointer"
                                >
                                    <ImageIcon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                    <span>{form.context ? '+ Add a picture for this question only' : '+ Add a picture to this question (optional)'}</span>
                                </button>
                            )}

                            {/* Answer Choices: 2×2 Compact Grid with Mode Toggle */}
                            <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-0.5">
                                    <div>
                                        <label className="font-bold text-[var(--color-text)] text-xs flex items-center gap-1.5">
                                            <span>Answer Choices *</span>
                                            <span className="text-[10px] font-semibold text-[var(--color-muted)]">
                                                ({form.options.filter((o) => o.is_correct).length} correct selected)
                                            </span>
                                        </label>
                                        <p className="text-[10px] text-[var(--color-muted)]">
                                            {allowMultipleCorrect
                                                ? 'Multiple correct answers allowed. Click options to toggle.'
                                                : 'Single correct answer. Click an option to mark it as correct.'}
                                        </p>
                                    </div>

                                    {/* Segmented Pill: Single Answer vs Multiple Answers */}
                                    <div className="flex items-center gap-2">
                                        <div className="inline-flex p-0.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleMultipleMode(false)}
                                                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                                    !allowMultipleCorrect
                                                        ? 'bg-[var(--color-background)] text-[var(--color-primary)] shadow-xs'
                                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                                }`}
                                            >
                                                Single Answer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleMultipleMode(true)}
                                                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                                    allowMultipleCorrect
                                                        ? 'bg-emerald-500 text-white shadow-xs'
                                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                                }`}
                                            >
                                                Multiple Answers
                                            </button>
                                        </div>

                                        {form.options.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setForm({
                                                        ...form,
                                                        options: [...form.options, { option_text: '', is_correct: false }],
                                                    });
                                                }}
                                                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer pl-1.5 border-l border-[var(--color-border)]"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Add</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {form.options.map((opt, idx) => {
                                        const isFocused = activeFocus === idx;

                                        return (
                                            <div
                                                key={idx}
                                                className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 select-none group ${
                                                    opt.is_correct
                                                        ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/20'
                                                        : isFocused
                                                        ? 'border-[var(--color-primary)] bg-[var(--color-background)] shadow-2xs'
                                                        : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-emerald-500/40 hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {/* Letter Badge Toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleOptionCorrect(idx)}
                                                        className={`w-8 h-8 sm:w-7 sm:h-7 font-black text-xs flex items-center justify-center shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                                                            allowMultipleCorrect ? 'rounded-lg' : 'rounded-full'
                                                        } ${
                                                            opt.is_correct
                                                                ? 'bg-emerald-500 text-white shadow-xs'
                                                                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] group-hover:text-[var(--color-text)] group-hover:border-emerald-500/50'
                                                        }`}
                                                        title={`Option ${String.fromCharCode(65 + idx)}: Tap to toggle correct answer`}
                                                    >
                                                        {opt.is_correct ? <Check className="w-4 h-4 stroke-[3]" /> : String.fromCharCode(65 + idx)}
                                                    </button>

                                                    {/* Option text input */}
                                                    <input
                                                        ref={(el) => {
                                                            optionInputRefs.current[idx] = el;
                                                        }}
                                                        type="text"
                                                        aria-label={`Option ${String.fromCharCode(65 + idx)}`}
                                                        aria-invalid={invalid?.field === idx}
                                                        aria-describedby={invalid?.field === idx ? 'question-error' : undefined}
                                                        value={opt.option_text}
                                                        onFocus={() => setActiveFocus(idx)}
                                                        onChange={(e) => {
                                                            const nextOptions = [...form.options];
                                                            nextOptions[idx].option_text = e.target.value;
                                                            setForm({ ...form, options: nextOptions });
                                                        }}
                                                        className="flex-1 px-2 py-1.5 bg-transparent border-0 text-[var(--color-text)] outline-none text-[15px] sm:text-xs font-mono placeholder:text-[var(--color-muted)]/60 min-w-0 cursor-text select-text"
                                                        placeholder={`Option ${String.fromCharCode(65 + idx)} text...`}
                                                    />

                                                    {form.options.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const nextOptions = form.options.filter((_, i) => i !== idx);
                                                                if (opt.is_correct && nextOptions.length > 0 && !nextOptions.some((o) => o.is_correct)) {
                                                                    nextOptions[0].is_correct = true;
                                                                }
                                                                setForm({ ...form, options: nextOptions });
                                                            }}
                                                            className="p-1.5 sm:p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-5)] transition-colors cursor-pointer shrink-0"
                                                            title="Remove option"
                                                        >
                                                            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Card Footer: Clear status indicator & 1-click pill */}
                                                <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border)]/50 text-[11px]">
                                                    <div className="flex items-center gap-1.5 truncate pr-1">
                                                        {opt.is_correct ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                                                Correct answer
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--color-muted)] group-hover:text-[var(--color-text)]">
                                                                Incorrect option
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleOptionCorrect(idx)}
                                                        className={`px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-lg font-bold text-[11px] sm:text-[10px] transition-all cursor-pointer shrink-0 select-none active:scale-95 ${
                                                            opt.is_correct
                                                                ? 'bg-emerald-500 text-white shadow-xs hover:bg-emerald-600'
                                                                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400'
                                                        }`}
                                                    >
                                                        {opt.is_correct ? '✓ Correct' : 'Mark as correct'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {typeof invalid?.field === 'number' && fieldError(invalid.field)}
                            </div>

                            {/* Explanation / Solution Notes */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="font-bold text-[var(--color-text)] text-xs">
                                        Explanation (optional)
                                    </label>
                                    <span className="text-[10px] text-[var(--color-muted)]">Shown after quiz completion</span>
                                </div>
                                <textarea
                                    ref={explanationTextareaRef}
                                    rows={2}
                                    value={form.explanation}
                                    onFocus={() => setActiveFocus('explanation')}
                                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                                    className={`w-full px-3.5 py-2 bg-[var(--color-background)] border rounded-2xl text-[var(--color-text)] outline-none resize-none font-mono text-[15px] sm:text-xs transition-colors leading-relaxed ${
                                        activeFocus === 'explanation'
                                            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 shadow-xs'
                                            : 'border-[var(--color-border)]'
                                    }`}
                                    placeholder={usesMathsPanel(subjectName) ? 'The working, step by step.' : 'Why the right answer is right.'}
                                />
                            </div>

                            {/* Mobile step navigation buttons */}
                            <div className="pt-2 border-t border-[var(--color-border)]/50 flex sm:hidden items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setMobileTab('curriculum')}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] flex items-center gap-1 cursor-pointer"
                                >
                                    <span>← Back to Curriculum</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileTab('preview')}
                                    className="px-3 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-primary)] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <Eye className="w-3 h-3" />
                                    <span>Preview Card →</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Actions Footer */}
                    <div className="pt-2.5 sm:pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 border-t border-[var(--color-border)] shrink-0">
                        <div className="hidden sm:flex text-[11px] text-[var(--color-muted)] items-center gap-1.5 flex-wrap">
                            <span className="font-semibold">Shortcuts:</span>
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

                        {/* On mobile: Compact context chip showing selected topic & marks */}
                        <div className="sm:hidden flex items-center justify-between text-[11px] text-[var(--color-muted)] px-1">
                            <span className="truncate max-w-[200px] font-semibold text-[var(--color-text)]">
                                {allTopics.find((t) => String(t.id) === String(form.topic_id))?.name || 'No Topic Selected'}
                            </span>
                            <span className="font-bold text-[var(--color-primary)] shrink-0">
                                {form.marks ?? 1} {(form.marks ?? 1) === 1 ? 'Mark' : 'Marks'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={requestClose}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)] sm:bg-transparent border sm:border-0 border-[var(--color-border)] rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                            >
                                Cancel
                            </button>
                            {!editingQuestion && onSaveAndAddNext && (
                                <button
                                    type="button"
                                    onClick={(e) => handleFormSubmit(e, true)}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto justify-center px-3.5 sm:px-4 py-2.5 sm:py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:border-[var(--color-primary)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                                    title={form.context ? 'Save this question and write the next one about the same passage' : 'Save this question and immediately start drafting the next one with curriculum preserved'}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{form.context ? 'Save & add next for this passage' : 'Save & Next'}</span>
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`${!editingQuestion && onSaveAndAddNext ? 'col-span-2 sm:col-auto' : ''} w-full sm:w-auto justify-center px-5 py-2.5 sm:py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2`}
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
