import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

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
        <div className="min-h-screen lg:h-screen w-full bg-[var(--color-background)] text-[var(--color-text)] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            <Head>
                <title>Forgot Password | AceDrill</title>
                <meta name="description" content="Reset your AceDrill password to regain access to your offline-first secondary curriculum." />
            </Head>

            {/* ═══════════════════════════════════════════════════════════
               LEFT COLUMN: Brand Hero (Desktop Only, Hidden on Mobile)
               ═══════════════════════════════════════════════════════════ */}
            <div className="hidden lg:flex relative lg:w-5/12 xl:w-1/2 bg-[var(--color-primary)] text-white p-8 lg:p-10 xl:p-14 flex-col justify-between shrink-0 lg:h-full overflow-hidden">
                {/* Subtle organic background gradients */}
                <div className="absolute -top-20 -left-20 w-80 h-80 bg-[var(--color-accent)]/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top Nav: Back to Sign In */}
                <div className="relative z-10 flex items-center justify-between">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/15 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Sign In</span>
                    </Link>
                </div>

                {/* Main Hero Content */}
                <div className="relative z-10 my-auto space-y-6 max-w-md">
                    {/* Brand Emblem */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] text-[var(--color-primary)] flex items-center justify-center font-black shadow-md">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-white">AceDrill</span>
                            <span className="block text-[10px] uppercase font-bold tracking-widest text-white/70">Account Security</span>
                        </div>
                    </div>

                    {/* Headline & Description */}
                    <div className="space-y-2.5">
                        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-white">
                            Forgot your password? <br />
                            <span className="text-[var(--color-accent)]">We've got your back.</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                            Don't worry! Enter your email address to receive a secure recovery link and jump right back into your offline studies.
                        </p>
                    </div>

                    {/* Compact Feature Highlights */}
                    <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center shrink-0">
                                <KeyRound className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">Instant Recovery Link</p>
                                <p className="text-[11px] text-white/70">Delivered directly to your registered email inbox.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">Your Progress Stays Safe</p>
                                <p className="text-[11px] text-white/70">All quiz attempts, mastery scores, and XP remain intact.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">Quick 2-Minute Process</p>
                                <p className="text-[11px] text-white/70">Set a new strong password and resume immediately.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <div className="relative z-10 pt-3 text-[11px] text-white/60 border-t border-white/10">
                    AceDrill Offline Learning Environment
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
               RIGHT COLUMN: Recovery Form (Maintained on Mobile)
               ═══════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-5 sm:p-8 lg:p-10 xl:p-14 min-h-screen lg:min-h-0 lg:h-full overflow-y-auto">
                {/* Top Nav: Back to Sign In (Mobile only) & Theme Toggle */}
                <div className="flex items-center justify-between w-full mb-6 sm:mb-8 lg:mb-0">
                    <Link
                        href="/login"
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-semibold transition-colors shadow-xs"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                    </Link>

                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </div>

                {/* Centered Form Wrapper */}
                <div className="w-full max-w-sm mx-auto my-auto py-2 sm:py-4 space-y-5">
                    {/* Brand Emblem (Mobile Only) */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center font-bold shadow-xs">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black tracking-tight text-[var(--color-primary)] leading-none">AceDrill</span>
                            <span className="text-[10px] font-semibold text-[var(--color-muted)]">Account Recovery</span>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="space-y-1">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
                            Reset Password
                        </h2>
                        <p className="text-xs sm:text-sm text-[var(--color-muted)]">
                            Enter your registered email to receive a password reset link.
                        </p>
                    </div>

                    {/* Status Message */}
                    {status && (
                        <div className="p-3.5 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs flex items-start gap-2.5 shadow-xs">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{status}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email Input */}
                        <div className="space-y-1">
                            <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="input-field text-xs sm:text-sm"
                                placeholder="name@example.com"
                                required
                                autoFocus
                                autoComplete="email"
                            />
                            {errors.email && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary py-3 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending Reset Link...</span>
                                </>
                            ) : (
                                <span>Email Password Reset Link</span>
                            )}
                        </button>
                    </form>

                    {/* Bottom Return to Sign In */}
                    <div className="pt-2 text-center text-xs text-[var(--color-muted)]">
                        Remember your password?{' '}
                        <Link
                            href="/login"
                            className="font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors hover:underline"
                        >
                            Sign in here
                        </Link>
                    </div>
                </div>

                {/* Mobile Bottom Footer */}
                <div className="lg:hidden text-center text-[10px] text-[var(--color-muted)] pt-6">
                    © {new Date().getFullYear()} AceDrill Learning. All rights reserved.
                </div>
            </div>
        </div>
    );
}
