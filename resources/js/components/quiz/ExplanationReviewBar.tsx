import { useEffect, useState } from 'react';
import { BadgeCheck, Flag, Sparkles } from 'lucide-react';

/** What the server says about an AI explanation it served: null for an offline one. */
export interface ExplanationReview {
    id: number;
    checked: boolean;
    can_report: boolean;
}

const REASONS = [
    { value: 'wrong', label: 'It’s wrong' },
    { value: 'confusing', label: 'It’s confusing' },
    { value: 'inappropriate', label: 'It’s not suitable' },
] as const;

/**
 * Under an AI explanation: says whether a teacher has checked it, and lets the learner report
 * one that looks wrong so a teacher can correct it.
 */
export default function ExplanationReviewBar({ review }: { review?: ExplanationReview | null }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<string>('wrong');
    const [note, setNote] = useState('');
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    // A different explanation starts fresh.
    useEffect(() => {
        setOpen(false);
        setNote('');
        setState('idle');
    }, [review?.id]);

    if (!review) return null;

    const send = async () => {
        setState('sending');
        try {
            const res = await fetch(`/api/v1/ai/explanations/${review.id}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ reason, note: note.trim() || null }),
            });
            setState(res.ok ? 'sent' : 'error');
        } catch {
            setState('error');
        }
    };

    return (
        <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--color-muted)]">
                {review.checked ? (
                    <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                        <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden />
                        Checked by a teacher
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                        Written by AI · it can make mistakes
                    </span>
                )}
                {review.can_report && state !== 'sent' && !open && (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                        <Flag className="w-3.5 h-3.5" aria-hidden />
                        Report a problem
                    </button>
                )}
            </div>

            {state === 'sent' && (
                <p role="status" className="text-xs font-semibold text-[var(--color-success)]">
                    Thanks. A teacher will check this explanation.
                </p>
            )}

            {open && state !== 'sent' && (
                <div className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]/60 space-y-3">
                    <fieldset>
                        <legend className="text-xs font-bold text-[var(--color-text)] mb-2">What’s the problem?</legend>
                        <div className="flex flex-wrap gap-2">
                            {REASONS.map((r) => (
                                <label
                                    key={r.value}
                                    className={`min-h-9 inline-flex items-center px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                                        reason === r.value
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-10)] text-[var(--color-primary)]'
                                            : 'border-[var(--color-border)] text-[var(--color-muted)]'
                                    }`}
                                >
                                    <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
                                    {r.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <label className="block">
                        <span className="text-xs font-bold text-[var(--color-text)]">Tell your teacher more (optional)</span>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value.slice(0, 500))}
                            rows={2}
                            placeholder="For example: the answer should be 4, not 5."
                            className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm text-[var(--color-text)]"
                        />
                    </label>
                    {state === 'error' && <p className="text-xs font-semibold text-[var(--color-error)]">Couldn’t send. Check your connection and try again.</p>}
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="min-h-9 px-3 rounded-lg text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={send}
                            disabled={state === 'sending'}
                            className="min-h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                            {state === 'sending' ? 'Sending…' : 'Send report'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
