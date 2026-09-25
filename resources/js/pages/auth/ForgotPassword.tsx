import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordProps {
    status?: string;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (processing) return;
        post('/forgot-password');
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center px-4 py-8 sm:p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head>
                <title>Forgot Password | AILEARN</title>
                <meta name="description" content="Reset your AILEARN password to regain access to your offline-first secondary curriculum." />
            </Head>

            <div className="w-full max-w-md space-y-6 sm:space-y-8">
                {/* Back to Login */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors p-1 -ml-1 rounded-lg hover:bg-[var(--color-surface)]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Sign In</span>
                    </Link>
                </div>

                {/* Brand Header */}
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] text-white mx-auto flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
                            Reset Password
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                            Enter your registered email to receive a secure reset link.
                        </p>
                    </div>
                </div>

                {/* Status Message Banner */}
                {status && (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs sm:text-sm flex items-start gap-3 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl shadow-[var(--color-primary)]/5">
                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                        <div className="space-y-1.5 sm:space-y-2">
                            <label htmlFor="email" className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                placeholder="learner@example.com"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="input-field text-xs sm:text-sm"
                            />
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-semibold">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary py-3.5 text-sm sm:text-base font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
                        >
                            {processing ? 'Sending Reset Link...' : 'Email Password Reset Link'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
