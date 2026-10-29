import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import LegalText from '@/components/legal/LegalText';
import ReviewNotice from '@/components/legal/ReviewNotice';
import { signOutSafely } from '@/services/SignOut';

interface Props {
    version: string;
    isLearner: boolean;
    summary: string | null;
    /** They agreed to an earlier version: say what changed rather than greeting them as new. */
    returning: boolean;
    inReview: boolean;
}

/**
 * Shown before using the app until the current Terms and Privacy Policy are agreed to. Adults tick
 * and agree; learners (whose parents consent through the school) read the short summary and continue.
 */
export default function Consent({ version, isLearner, summary, returning, inReview }: Props) {
    const [agreed, setAgreed] = useState(isLearner);
    const [busy, setBusy] = useState(false);

    const accept = () => {
        if (!agreed || busy) return;
        setBusy(true);
        router.post('/consent', {}, { onFinish: () => setBusy(false) });
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center px-4 py-10">
            <Head title="Before you continue | AceDrill" />
            <BrandLogo className="h-8 w-auto" title="AceDrill" />

            <main className="mt-8 w-full max-w-xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <ShieldCheck className="w-5 h-5" aria-hidden />
                    </span>
                    <h1 className="text-xl font-extrabold tracking-tight">
                        {returning ? 'We updated our terms' : isLearner ? 'How AceDrill looks after your data' : 'Before you continue'}
                    </h1>
                </div>

                {inReview && <ReviewNotice className="mt-4" />}

                {isLearner ? (
                    <>
                        <p className="mt-4 text-sm text-[var(--color-muted)]">
                            Your school and your parent or guardian have agreed to you using AceDrill. Here is what that means for you.
                        </p>
                        <div className="mt-2 text-sm">{summary && <LegalText markdown={summary} />}</div>
                    </>
                ) : (
                    <>
                        <p className="mt-4 text-sm leading-relaxed">
                            {returning
                                ? 'Our Terms of Use and Privacy Policy have changed. Please read them and agree to keep using AceDrill.'
                                : 'To use AceDrill, please read and agree to our Terms of Use and Privacy Policy. They explain what we keep, who sees it, and how the AI features use your data.'}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm font-bold">
                            <li>
                                <Link href="/terms" className="text-[var(--color-primary)] underline underline-offset-2">
                                    Terms of Use
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="text-[var(--color-primary)] underline underline-offset-2">
                                    Privacy Policy
                                </Link>
                            </li>
                        </ul>
                        <label className="mt-5 flex items-start gap-3 text-sm cursor-pointer">
                            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]" />
                            <span>I have read and agree to the Terms of Use and Privacy Policy (version {version}).</span>
                        </label>
                    </>
                )}

                <button
                    type="button"
                    onClick={accept}
                    disabled={!agreed || busy}
                    className="mt-6 w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    {busy ? 'Saving…' : isLearner ? 'Continue' : 'Agree and continue'}
                </button>

                <button
                    type="button"
                    onClick={() => void signOutSafely({})}
                    className="mt-3 w-full text-center text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                    Sign out
                </button>
            </main>
        </div>
    );
}
