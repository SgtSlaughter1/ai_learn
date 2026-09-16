import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';

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
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head>
                <title>Forgot Password — AILEARN</title>
                <meta name="description" content="Reset your AILEARN password to regain access to your offline-first secondary curriculum." />
            </Head>

            <div className="w-full max-w-md space-y-8">
                {/* Back to Login */}
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                </Link>

                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
                        Reset Password
                    </h1>
                    <p className="text-sm text-[var(--color-muted)]">
                        Enter your registered email and we'll send you a password reset link.
                    </p>
                </div>

                {/* Status Message Banner */}
                {status && (
                    <div className="p-4 rounded-2xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-sm flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl shadow-xl shadow-[var(--color-primary)]/5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text)] mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                                    <Mail className="h-5 w-5" />
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    placeholder="learner@example.com"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all min-h-[48px]"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-medium">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer min-h-[48px]"
                        >
                            {processing ? 'Sending Reset Link...' : 'Email Password Reset Link'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
