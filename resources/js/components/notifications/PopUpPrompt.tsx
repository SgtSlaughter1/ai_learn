import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { markPopUpsAsked, popUpState, popUpsAsked, setPopUps } from '@/services/Notifications';

const DELAY_MS = 4000;

/**
 * Asks once per device whether to show pop-ups, a few seconds after signing in, so the choice
 * isn't hidden in the bell. Either answer can be changed later in the profile.
 */
export default function PopUpPrompt({ userId, isLearner }: { userId: string | number | undefined; isLearner: boolean }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (userId === undefined || popUpsAsked(userId) || popUpState(userId) !== 'ask') return;
        const timer = window.setTimeout(() => {
            // Don't stack on top of another dialog; the next page visit asks instead.
            if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
            if (popUpState(userId) === 'ask' && !popUpsAsked(userId)) setOpen(true);
        }, DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [userId]);

    if (!open) return null;

    const answer = async (on: boolean) => {
        setBusy(true);
        if (on) await setPopUps(userId, true);
        else markPopUpsAsked(userId);
        setOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="popup-prompt-title"
                className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
            >
                <span className="w-11 h-11 inline-flex items-center justify-center rounded-2xl bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                    <BellRing className="w-5 h-5" aria-hidden />
                </span>
                <h2 id="popup-prompt-title" className="mt-4 text-lg font-bold text-[var(--color-text)]">
                    Turn on pop-ups?
                </h2>
                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                    {isLearner
                        ? 'We’ll let you know on this device when your teacher sends you practice.'
                        : 'We’ll let you know on this device when learners report an AI explanation, so a wrong one doesn’t stay up.'}{' '}
                    Pop-ups never show names or scores, and you can turn them off any time in your profile.
                </p>
                <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    <button
                        type="button"
                        onClick={() => answer(false)}
                        disabled={busy}
                        className="min-h-11 px-4 rounded-xl text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    >
                        Not now
                    </button>
                    <button
                        type="button"
                        onClick={() => answer(true)}
                        disabled={busy}
                        autoFocus
                        className="min-h-11 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-bold disabled:opacity-60 cursor-pointer"
                    >
                        Turn on pop-ups
                    </button>
                </div>
            </div>
        </div>
    );
}
