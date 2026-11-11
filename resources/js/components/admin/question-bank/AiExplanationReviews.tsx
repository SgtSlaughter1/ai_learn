import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CheckCircle2, ChevronDown, EyeOff, Flag, Pencil, Sparkles, XCircle } from 'lucide-react';
import { formatMathText } from '@/utils/mathFormatter';
import { NOTIFICATIONS_CHANGED_EVENT, REVIEWS_UPDATED_EVENT } from '@/services/Notifications';

interface ReportedExplanation {
    id: number;
    source: 'question' | 'past_question';
    question_text: string;
    options: { id: number; text: string; is_correct: boolean }[];
    chosen_option_id: number | null;
    body: string;
    review_status: 'ai' | 'approved' | 'corrected' | 'hidden';
    open_reports: number;
    reasons: Record<string, number>;
    notes: string[];
}

const REASON_LABELS: Record<string, string> = { wrong: 'wrong', confusing: 'confusing', inappropriate: 'not suitable' };

function MathText({ text }: { text: string }) {
    return (
        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {formatMathText(text)}
        </Markdown>
    );
}

/**
 * AI explanations that learners reported, for the teachers and admins who manage those questions:
 * approve one that is fine, correct it (by hand or from a fresh AI draft), or hide it so learners
 * get the offline explanation instead. Shows nothing when there is nothing to check.
 */
export default function AiExplanationReviews({ showToast }: { showToast: (text: string, type?: 'success' | 'error') => void }) {
    const [items, setItems] = useState<ReportedExplanation[]>([]);
    const [expanded, setExpanded] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!navigator.onLine) return;
        try {
            const res = await fetch('/api/v1/admin/ai-explanations', { headers: { Accept: 'application/json' } });
            if (res.ok) setItems((await res.json()).data ?? []);
        } catch {
            // Offline or a server error: the queue simply isn't shown this time.
        }
    }, []);

    useEffect(() => {
        void load();
        // A new report while this is open shows up without a reload.
        window.addEventListener(REVIEWS_UPDATED_EVENT, load);
        return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, load);
    }, [load]);

    const review = async (item: ReportedExplanation, action: 'approve' | 'correct' | 'hide') => {
        setBusy(`${action}:${item.id}`);
        try {
            const res = await fetch(`/api/v1/admin/ai-explanations/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(action === 'correct' ? { action, body: draft } : { action }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                showToast(data.message || 'Could not save the review. Please try again.', 'error');
                if (res.status === 409 || res.status === 404) setItems((list) => list.filter((i) => i.id !== item.id));
                return;
            }
            setItems((list) => list.filter((i) => i.id !== item.id));
            setEditingId(null);
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
            showToast(
                action === 'approve'
                    ? 'Explanation approved. Learners now see it as checked.'
                    : action === 'correct'
                      ? 'Correction saved. Learners now see your version.'
                      : 'Explanation hidden. Learners get the offline explanation.',
                'success'
            );
        } catch {
            showToast('You seem to be offline. Reviews need a connection.', 'error');
        } finally {
            setBusy(null);
        }
    };

    const askAi = async (item: ReportedExplanation) => {
        setBusy(`draft:${item.id}`);
        try {
            const res = await fetch(`/api/v1/admin/ai-explanations/${item.id}/draft`, { method: 'POST', headers: { Accept: 'application/json' } });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.body) setDraft(data.body);
            else showToast(data.message || 'The AI couldn’t write a new version. Edit the text yourself.', 'error');
        } catch {
            showToast('You seem to be offline. The AI needs a connection.', 'error');
        } finally {
            setBusy(null);
        }
    };

    if (items.length === 0) return null;

    return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5" aria-label="AI explanations to check">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
            >
                <span className="flex items-center gap-3">
                    <span className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <Flag className="w-4 h-4" aria-hidden />
                    </span>
                    <span>
                        <span className="block text-sm font-bold text-[var(--color-text)]">
                            {items.length} AI explanation{items.length === 1 ? '' : 's'} reported by learners
                        </span>
                        <span className="block text-xs text-[var(--color-muted)]">Check each one: approve it, correct it, or hide it from learners.</span>
                    </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-[var(--color-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
            </button>

            {expanded && (
                <ul className="px-4 pb-4 space-y-3">
                    {items.map((item) => {
                        const editing = editingId === item.id;
                        const reasons = Object.entries(item.reasons)
                            .map(([reason, count]) => `${count} ${REASON_LABELS[reason] ?? reason}`)
                            .join(' · ');
                        return (
                            <li key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                    <span className="text-amber-700 dark:text-amber-400">
                                        Reported: {reasons || `${item.open_reports} report${item.open_reports === 1 ? '' : 's'}`}
                                    </span>
                                    {item.review_status === 'hidden' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-error-5)] text-[var(--color-error)]">
                                            <EyeOff className="w-3 h-3" aria-hidden />
                                            Hidden from learners
                                        </span>
                                    )}
                                    {item.source === 'past_question' && (
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-muted)]">Past question</span>
                                    )}
                                </div>

                                <div className="text-sm font-bold text-[var(--color-text)] chat-markdown">
                                    <MathText text={item.question_text} />
                                </div>
                                <ul className="grid gap-1.5 sm:grid-cols-2 text-xs">
                                    {item.options.map((o) => (
                                        <li
                                            key={o.id}
                                            className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 border ${
                                                o.is_correct
                                                    ? 'border-[var(--color-success)]/40 bg-[var(--color-success-5)]'
                                                    : o.id === item.chosen_option_id
                                                      ? 'border-[var(--color-error)]/40 bg-[var(--color-error-5)]'
                                                      : 'border-[var(--color-border)]'
                                            }`}
                                        >
                                            {o.is_correct ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-success)]" aria-label="Correct answer" />
                                            ) : o.id === item.chosen_option_id ? (
                                                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-error)]" aria-label="Learner's answer" />
                                            ) : (
                                                <span className="w-3.5 shrink-0" />
                                            )}
                                            <span className="chat-markdown [&_p]:inline">
                                                <MathText text={o.text} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                {item.chosen_option_id === null && <p className="text-xs text-[var(--color-muted)]">Shown to learners who skipped the question.</p>}

                                {item.notes.length > 0 && (
                                    <ul className="space-y-1">
                                        {item.notes.map((note, i) => (
                                            <li key={i} className="text-xs italic text-[var(--color-muted)] border-l-2 border-amber-500/40 pl-2">
                                                “{note}”
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {editing ? (
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-[var(--color-text)]" htmlFor={`explanation-${item.id}`}>
                                            Corrected explanation (Markdown; use $…$ for maths)
                                        </label>
                                        <textarea
                                            id={`explanation-${item.id}`}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            rows={9}
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm font-mono text-[var(--color-text)]"
                                        />
                                        <p className="text-[11px] text-[var(--color-muted)]">
                                            The AI’s rewrite can be wrong too. Read it through before you save: learners will see it as checked by a teacher.
                                        </p>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => askAi(item)}
                                                disabled={busy !== null}
                                                className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 cursor-pointer"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" aria-hidden />
                                                {busy === `draft:${item.id}` ? 'Writing…' : 'Ask AI to rewrite'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(null)}
                                                className="min-h-9 px-3 rounded-lg text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => review(item, 'correct')}
                                                disabled={busy !== null || draft.trim() === ''}
                                                className="min-h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                                            >
                                                {busy === `correct:${item.id}` ? 'Saving…' : 'Save correction'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] p-3 text-sm text-[var(--color-text)] chat-markdown max-h-72 overflow-y-auto">
                                            <MathText text={item.body} />
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => review(item, 'hide')}
                                                disabled={busy !== null || item.review_status === 'hidden'}
                                                className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-40 cursor-pointer"
                                            >
                                                <EyeOff className="w-3.5 h-3.5" aria-hidden />
                                                Hide
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId(item.id);
                                                    setDraft(item.body);
                                                }}
                                                disabled={busy !== null}
                                                className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 cursor-pointer"
                                            >
                                                <Pencil className="w-3.5 h-3.5" aria-hidden />
                                                Correct it
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => review(item, 'approve')}
                                                disabled={busy !== null}
                                                className="min-h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                                                {busy === `approve:${item.id}` ? 'Saving…' : 'It’s fine, approve'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
