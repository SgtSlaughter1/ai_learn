import { Head, Link, useForm } from '@inertiajs/react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
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
            <Head title="Forgot Password | AceDrill" />

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
                    <div className="space-y-2">
                        <BrandLogo tone="reversed" className="h-10 w-auto" />
                        <span className="block text-[10px] uppercase font-bold tracking-widest text-white/70">Account Security</span>
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
            {/* ═══════════════════════════════════════════════════════════
               RIGHT COLUMN: Recovery Form (Elevated Mobile & Desktop Card)
               ═══════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between min-h-screen lg:min-h-0 lg:h-full overflow-y-auto bg-[var(--color-background)]">
                {/* Top Nav: Back to Sign In (Mobile only) & Theme Toggle */}
                <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-center justify-between lg:justify-end shrink-0">
                    <Link
                        href="/login"
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-semibold transition-all shadow-xs hover:shadow-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                    </Link>

                    <ThemeToggle />
                </div>

                {/* Central Card Container */}
                <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-4 py-4 sm:py-6">
                    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm shadow-black/[0.03]">
                        {/* Centered Brand Emblem & Header */}
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center font-bold shadow-sm mb-3">
                                <BrandLogo variant="symbol" tone="reversed" className="w-8 h-8" title="" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--color-text)]">
                                Reset Password
                            </h1>
                            <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1.5">
                                Enter your registered email to receive a password reset link
                            </p>
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className="mb-5 p-3.5 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs flex items-start gap-2.5 shadow-xs">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{status}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email Input */}
                            <div className="space-y-1.5 text-left">
                                <label htmlFor="email" className="block text-xs font-bold text-[var(--color-text)]">
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
                                className="w-full btn-primary py-3 text-xs sm:text-sm font-bold shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 rounded-xl mt-2"
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
                        <div className="text-center pt-5 mt-2 border-t border-[var(--color-border)]/60">
                            <p className="text-xs text-[var(--color-muted)]">
                                Remember your password?{' '}
                                <Link
                                    href="/login"
                                    className="font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors hover:underline ml-1"
                                >
                                    Sign In
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <p className="text-center text-[11px] text-[var(--color-muted)] mt-4">
                        Protected by offline-first local encryption.
                    </p>
                </div>
            </div>
        </div>
    );
}
