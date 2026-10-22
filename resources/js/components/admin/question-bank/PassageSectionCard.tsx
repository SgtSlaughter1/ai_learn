import { useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import type { QuestionContextItem, QuestionItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';
import { confirmAction } from '@/components/common/ConfirmModal';
import { PassageView, CONTEXT_TYPE_LABELS } from '@/components/quiz/PassageView';
import QuestionListItem from './QuestionListItem';

interface PassageSectionCardProps {
    context: QuestionContextItem;
    questions: QuestionItem[];
    onEditQuestion: (q: QuestionItem) => void;
    onDeleteQuestion: (q: QuestionItem) => void;
    deletingQuestionId: number | null;
    /** Open the question form on this passage for one more question. */
    onAddQuestion: (context: QuestionContextItem, questions: QuestionItem[]) => void;
    onChanged: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

/**
 * A shared passage in the question bank list, with its questions nested in the order
 * learners get them: read it, edit it once for all of them, reorder or add questions.
 */
export default function PassageSectionCard({
    context, questions, onEditQuestion, onDeleteQuestion, deletingQuestionId, onAddQuestion, onChanged, showToast,
}: PassageSectionCardProps) {
    const [open, setOpen] = useState(true);
    const [showPassage, setShowPassage] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<QuestionContextItem>(context);
    const [busy, setBusy] = useState(false);
    const synced = typeof context.id === 'number';
    const typeLabel = CONTEXT_TYPE_LABELS[context.type] ?? 'Passage';

    const run = async (method: 'PATCH' | 'DELETE', endpoint: string, payload: object, done: string) => {
        setBusy(true);
        const res = await executeAdminAction({
            table: 'questionContexts', action: method === 'DELETE' ? 'delete' : 'update', recordId: String(context.id),
            endpoint, method, payload,
        });
        setBusy(false);
        if (res.success) {
            showToast(res.offline ? `${done} (will sync when online)` : done, 'success');
            onChanged();
        } else {
            showToast(res.error || 'That did not work. Try again.', 'error');
        }
        return res.success;
    };

    const savePassage = async () => {
        if (!draft.body?.trim() && !draft.image_url) {
            showToast('Add the passage text or a picture.', 'error');
            return;
        }
        if (!(await confirmAction({
            title: 'Save the passage?',
            message: `The change shows on all ${questions.length} question${questions.length === 1 ? '' : 's'} on it.`,
            confirmLabel: 'Save passage',
        }))) return;
        const ok = await run('PATCH', `/api/v1/admin/question-contexts/${context.id}`, {
            type: draft.type, title: draft.title, instructions: draft.instructions, body: draft.body, show_line_numbers: draft.show_line_numbers,
        }, 'Passage saved');
        if (ok) setEditing(false);
    };

    const move = async (index: number, delta: number) => {
        const ids = questions.map((q) => q.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        await run('PATCH', `/api/v1/admin/question-contexts/${context.id}/order`, { question_ids: ids }, 'Order saved');
    };

    const remove = async () => {
        if (!(await confirmAction({
            title: `Delete this ${typeLabel.toLowerCase()}?`,
            message: 'Learners will no longer see it. Next you choose what happens to its questions.',
            confirmLabel: 'Continue',
            tone: 'danger',
        }))) return;
        const deleteQuestions = await confirmAction({
            title: `Also delete its ${questions.length} question${questions.length === 1 ? '' : 's'}?`,
            message: 'Questions like "in line 7" make no sense without the passage. Keep them only if they still work on their own.',
            confirmLabel: 'Delete the questions too',
            cancelLabel: 'Keep them as single questions',
            tone: 'danger',
        });
        await run('DELETE', `/api/v1/admin/question-contexts/${context.id}${deleteQuestions ? '?delete_questions=1' : ''}`, {},
            deleteQuestions ? 'Passage and its questions deleted' : 'Passage deleted; its questions are now single questions');
    };

    const button = 'min-h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <section className="rounded-2xl border-2 border-[var(--color-primary)]/25 bg-[var(--color-primary-5)] p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <BookOpen className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-extrabold text-[var(--color-text)]">{context.title || typeLabel}</p>
                    <p className="text-[11px] text-[var(--color-muted)]">
                        {typeLabel} · {questions.length} question{questions.length === 1 ? '' : 's'} · {questions[0]?.topic?.subject?.name} • {questions[0]?.topic?.name}
                        {!synced && ' · waiting to sync'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={button} onClick={() => setShowPassage((v) => !v)} aria-expanded={showPassage}>
                        {showPassage ? 'Hide passage' : 'Read passage'}
                    </button>
                    <button type="button" className={button} disabled={!synced || busy} onClick={() => { setDraft(context); setEditing(true); setShowPassage(true); }}>
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit passage
                    </button>
                    <button type="button" className={button} onClick={() => onAddQuestion(context, questions)}>
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add a question
                    </button>
                    <button type="button" className={`${button} text-[var(--color-error)]`} disabled={!synced || busy} onClick={remove} aria-label="Delete this passage">
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" className={button} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Collapse questions' : 'Show questions'}>
                        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {questions.length < 2 && (
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                    Only 1 question on this passage. Add more, or keep it: it still works as one question.
                </p>
            )}

            {showPassage && (
                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 sm:p-4">
                    {editing ? (
                        <div className="space-y-2 text-xs">
                            <label className="block space-y-1">
                                <span className="font-bold">Title</span>
                                <input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                    className="w-full h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm" />
                            </label>
                            <label className="block space-y-1">
                                <span className="font-bold">Instruction learners see</span>
                                <input value={draft.instructions ?? ''} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                                    className="w-full h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm" />
                            </label>
                            <label className="block space-y-1">
                                <span className="font-bold">Text</span>
                                <textarea rows={8} value={draft.body ?? ''} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm leading-relaxed" />
                            </label>
                            <label className="flex items-center gap-2 font-bold">
                                <input type="checkbox" checked={draft.show_line_numbers} onChange={(e) => setDraft({ ...draft, show_line_numbers: e.target.checked })} className="accent-[var(--color-primary)]" />
                                Number the lines
                            </label>
                            <div className="flex gap-2 justify-end">
                                <button type="button" className={button} onClick={() => setEditing(false)}>Cancel</button>
                                <button type="button" disabled={busy} onClick={savePassage}
                                    className="min-h-9 px-4 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                                    Save passage
                                </button>
                            </div>
                        </div>
                    ) : (
                        <PassageView context={context} compact />
                    )}
                </div>
            )}

            {open && (
                <ol className="space-y-3">
                    {questions.map((q, i) => (
                        <li key={q.id} className="flex gap-2 items-start">
                            <div className="flex flex-col items-center gap-1 pt-4 shrink-0">
                                <span className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white text-xs font-extrabold flex items-center justify-center">{i + 1}</span>
                                <button type="button" aria-label={`Move question ${i + 1} up`} disabled={!synced || busy || i === 0} onClick={() => move(i, -1)}
                                    className="w-7 h-7 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center cursor-pointer disabled:opacity-30">
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" aria-label={`Move question ${i + 1} down`} disabled={!synced || busy || i === questions.length - 1} onClick={() => move(i, 1)}
                                    className="w-7 h-7 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center cursor-pointer disabled:opacity-30">
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <QuestionListItem question={q} onEdit={onEditQuestion} onDelete={onDeleteQuestion} isDeleting={deletingQuestionId === q.id} />
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
