import React, { useState } from 'react';
import type { QuestionItem, SubjectItem, TopicItem, ClassItem } from '@/types/admin';
import { executeAdminAction, getAdminAuthHeaders } from '@/services/AdminOfflineService';
import { parseQuestionsOffline, type ExtractedQuestion } from '@/utils/questionParser';
import QuestionFilterBar from './question-bank/QuestionFilterBar';
import QuestionListItem from './question-bank/QuestionListItem';
import QuestionFormModal, { type QuestionFormData } from './question-bank/QuestionFormModal';
import AIBulkImportModal from './question-bank/AIBulkImportModal';

interface Props {
    questions: QuestionItem[];
    subjects: SubjectItem[];
    classes?: ClassItem[];
    allTopics: TopicItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
}

export default function QuestionBankTab({
    questions,
    subjects,
    classes = [],
    allTopics,
    loading,
    onRefresh,
    showToast,
    school,
    allowedGradeLevels,
}: Props) {
    // ── Filter State ──
    const [questionGradeFilter, setQuestionGradeFilter] = useState('');
    const [questionClassFilter, setQuestionClassFilter] = useState('');
    const [questionSubjectFilter, setQuestionSubjectFilter] = useState('');
    const [questionTopicFilter, setQuestionTopicFilter] = useState('');
    const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState('');
    const [questionSearch, setQuestionSearch] = useState('');

    // ── Single Question Modal State ──
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
    const [questionForm, setQuestionForm] = useState<QuestionFormData>({
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

    // ── AI Bulk Import State ──
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkStep, setBulkStep] = useState<'input' | 'review'>('input');
    const [bulkClassId, setBulkClassId] = useState('');
    const [bulkSubjectId, setBulkSubjectId] = useState('');
    const [bulkTopicId, setBulkTopicId] = useState('');
    const [bulkRawText, setBulkRawText] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const openBulkModal = () => {
        setBulkStep('input');
        setExtractedQuestions([]);
        setBulkRawText('');
        if (allTopics.length > 0 && !bulkTopicId) {
            setBulkTopicId(String(allTopics[0].id));
            if (allTopics[0].subject_id) {
                setBulkSubjectId(String(allTopics[0].subject_id));
            }
        }
        setIsBulkModalOpen(true);
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

    const handleEditQuestion = (q: QuestionItem) => {
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
    };

    const handleExtractWithAI = async () => {
        if (!bulkRawText.trim()) {
            showToast('Please paste or upload question text first', 'error');
            return;
        }

        if (!bulkTopicId) {
            showToast('Please select a target topic for the questions', 'error');
            return;
        }

        setBulkLoading(true);
        try {
            const res = await fetch('/api/v1/admin/questions/ai-extract', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    raw_text: bulkRawText,
                    subject_id: bulkSubjectId ? Number(bulkSubjectId) : undefined,
                    topic_id: bulkTopicId ? Number(bulkTopicId) : undefined,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.questions && data.questions.length > 0) {
                    setExtractedQuestions(data.questions);
                    setBulkStep('review');
                    showToast(`Successfully parsed and solved ${data.questions.length} questions`, 'success');
                    setBulkLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('Backend AI extraction unavailable, attempting offline client parser...', err);
        }

        // Offline Client-Side Fallback Parser
        const offlineQuestions = parseQuestionsOffline(bulkRawText);
        if (offlineQuestions.length > 0) {
            setExtractedQuestions(offlineQuestions);
            setBulkStep('review');
            showToast(`Parsed ${offlineQuestions.length} questions using local offline engine`, 'success');
        } else {
            showToast('Could not identify questions in the text. Please check the format and try again.', 'error');
        }
        setBulkLoading(false);
    };

    const handleSaveBulkQuestions = async () => {
        if (!bulkTopicId || extractedQuestions.length === 0) return;

        setIsSubmittingBulk(true);
        try {
            const res = await fetch('/api/v1/admin/questions/bulk', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    topic_id: Number(bulkTopicId),
                    questions: extractedQuestions.map((q) => ({
                        question_text: q.question_text,
                        type: q.type || 'multiple_choice',
                        difficulty: q.difficulty || 'medium',
                        explanation: q.explanation || null,
                        status: 'active',
                        options: q.options.map((opt, idx) => ({
                            option_text: opt.option_text,
                            is_correct: Boolean(opt.is_correct),
                            sort_order: idx,
                        })),
                    })),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`${data.count || extractedQuestions.length} questions imported successfully`, 'success');
                setIsBulkModalOpen(false);
                setBulkRawText('');
                setExtractedQuestions([]);
                setBulkStep('input');
                onRefresh();
            } else {
                // Offline optimistic fallback: insert each into Dexie
                const selectedTopic = allTopics.find((t) => String(t.id) === String(bulkTopicId));
                let successCount = 0;

                for (const q of extractedQuestions) {
                    const tempId = `temp_q_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                    const optimisticQ: QuestionItem = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        topic_id: Number(bulkTopicId),
                        question_text: q.question_text,
                        type: q.type || 'multiple_choice',
                        difficulty: q.difficulty || 'medium',
                        explanation: q.explanation || null,
                        status: 'active',
                        options: q.options.map((opt, idx) => ({
                            id: idx + 1,
                            option_text: opt.option_text,
                            is_correct: Boolean(opt.is_correct),
                        })),
                        topic: selectedTopic
                            ? {
                                  id: selectedTopic.id,
                                  name: selectedTopic.name,
                                  subject: selectedTopic.subject,
                              }
                            : undefined,
                        _pendingSync: true,
                    };

                    await executeAdminAction({
                        table: 'adminQuestions',
                        action: 'insert',
                        recordId: tempId,
                        endpoint: '/api/v1/admin/questions',
                        method: 'POST',
                        payload: {
                            topic_id: Number(bulkTopicId),
                            question_text: q.question_text,
                            type: q.type || 'multiple_choice',
                            difficulty: q.difficulty || 'medium',
                            explanation: q.explanation || null,
                            status: 'active',
                            options: q.options,
                        },
                        optimisticRecord: optimisticQ,
                    });
                    successCount++;
                }

                showToast(`Saved ${successCount} questions locally (Pending Sync)`, 'success');
                setIsBulkModalOpen(false);
                setBulkRawText('');
                setExtractedQuestions([]);
                setBulkStep('input');
                onRefresh();
            }
        } catch (err) {
            console.error(err);
            showToast('Error saving questions batch', 'error');
        } finally {
            setIsSubmittingBulk(false);
        }
    };

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
            topic: selectedTopic
                ? {
                      id: selectedTopic.id,
                      name: selectedTopic.name,
                      subject: selectedTopic.subject,
                  }
                : undefined,
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

    const gradeClassIds = questionGradeFilter
        ? new Set(classes.filter((c) => c.grade_level === questionGradeFilter).map((c) => c.id))
        : null;

    const availableSubjectsForFilter = subjects.filter((s) => {
        if (questionClassFilter) {
            return String(s.class_id) === questionClassFilter;
        }
        if (gradeClassIds) {
            return s.class_id && gradeClassIds.has(s.class_id);
        }
        return true;
    });

    const availableTopicsForFilter = questionSubjectFilter
        ? allTopics.filter((t) => String(t.subject_id) === questionSubjectFilter)
        : questionClassFilter
        ? allTopics.filter((t) => {
              const matchingSubj = subjects.find((s) => s.id === t.subject_id);
              return matchingSubj && String(matchingSubj.class_id) === questionClassFilter;
          })
        : gradeClassIds
        ? allTopics.filter((t) => {
              const matchingSubj = subjects.find((s) => s.id === t.subject_id);
              return matchingSubj && matchingSubj.class_id && gradeClassIds.has(matchingSubj.class_id);
          })
        : allTopics;

    const filteredQuestions = questions.filter((q) => {
        const matchingSubj = subjects.find((s) => s.id === q.topic?.subject?.id);
        const subjClassId = q.topic?.subject?.class_id ?? matchingSubj?.class_id;

        if (questionClassFilter) {
            if (!subjClassId || String(subjClassId) !== questionClassFilter) return false;
        } else if (gradeClassIds) {
            if (!subjClassId || !gradeClassIds.has(subjClassId)) return false;
        }

        if (questionSubjectFilter && String(q.topic?.subject?.id || '') !== questionSubjectFilter) return false;
        if (questionTopicFilter && String(q.topic_id) !== questionTopicFilter) return false;
        if (questionDifficultyFilter && q.difficulty !== questionDifficultyFilter) return false;
        if (questionSearch && !q.question_text.toLowerCase().includes(questionSearch.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <QuestionFilterBar
                questionSearch={questionSearch}
                setQuestionSearch={setQuestionSearch}
                questionGradeFilter={questionGradeFilter}
                setQuestionGradeFilter={setQuestionGradeFilter}
                questionClassFilter={questionClassFilter}
                setQuestionClassFilter={setQuestionClassFilter}
                questionSubjectFilter={questionSubjectFilter}
                setQuestionSubjectFilter={setQuestionSubjectFilter}
                questionTopicFilter={questionTopicFilter}
                setQuestionTopicFilter={setQuestionTopicFilter}
                questionDifficultyFilter={questionDifficultyFilter}
                setQuestionDifficultyFilter={setQuestionDifficultyFilter}
                classes={classes}
                availableSubjects={availableSubjectsForFilter}
                availableTopics={availableTopicsForFilter}
                school={school}
                allowedGradeLevels={allowedGradeLevels}
                onOpenBulkModal={openBulkModal}
                onOpenAddModal={() => {
                    setEditingQuestion(null);
                    resetQuestionForm();
                    setIsQuestionModalOpen(true);
                }}
            />

            {/* Questions List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                        <div
                            key={n}
                            className="h-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-pulse"
                        />
                    ))}
                </div>
            ) : filteredQuestions.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    No questions found matching your criteria. Click "Add Question" or "AI Bulk Import" to build your offline question bank.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredQuestions.map((q) => (
                        <QuestionListItem
                            key={q.id}
                            question={q}
                            onEdit={handleEditQuestion}
                            onDelete={handleDeleteQuestion}
                        />
                    ))}
                </div>
            )}

            {/* Modal: Question Create / Edit */}
            <QuestionFormModal
                isOpen={isQuestionModalOpen}
                onClose={() => setIsQuestionModalOpen(false)}
                editingQuestion={editingQuestion}
                form={questionForm}
                setForm={setQuestionForm}
                classes={classes}
                subjects={subjects}
                allTopics={allTopics}
                onSubmit={handleSaveQuestion}
            />

            {/* Modal: AI Bulk Import */}
            <AIBulkImportModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                step={bulkStep}
                setStep={setBulkStep}
                bulkClassId={bulkClassId}
                setBulkClassId={setBulkClassId}
                bulkSubjectId={bulkSubjectId}
                setBulkSubjectId={setBulkSubjectId}
                bulkTopicId={bulkTopicId}
                setBulkTopicId={setBulkTopicId}
                rawText={bulkRawText}
                setRawText={setBulkRawText}
                loading={bulkLoading}
                extractedQuestions={extractedQuestions}
                setExtractedQuestions={setExtractedQuestions}
                isSubmitting={isSubmittingBulk}
                classes={classes}
                subjects={subjects}
                allTopics={allTopics}
                onExtract={handleExtractWithAI}
                onSave={handleSaveBulkQuestions}
                showToast={showToast}
            />
        </div>
    );
}
