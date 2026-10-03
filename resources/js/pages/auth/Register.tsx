import { Head, Link, useForm } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import { Eye, EyeOff, ArrowLeft, BookOpen, WifiOff, Award, UserCheck } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (processing) return;
        post('/register', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="min-h-screen lg:h-screen w-full bg-[var(--color-background)] text-[var(--color-text)] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            <Head>
                <title>Create Learner Account | AceDrill</title>
                <meta name="description" content="Sign up for a free AceDrill learner account to access offline learning materials, past questions, and AI tutoring." />
            </Head>

            {/* ═══════════════════════════════════════════════════════════
               LEFT COLUMN: Brand Hero (Desktop Only, Hidden on Mobile)
               ═══════════════════════════════════════════════════════════ */}
            <div className="hidden lg:flex relative lg:w-5/12 xl:w-1/2 bg-[var(--color-primary)] text-white p-8 lg:p-10 xl:p-14 flex-col justify-between shrink-0 lg:h-full overflow-hidden">
                {/* Subtle organic background gradients */}
                <div className="absolute -top-20 -left-20 w-80 h-80 bg-[var(--color-accent)]/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top Nav: Back to Home */}
                <div className="relative z-10 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/15 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Home</span>
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
                            <span className="block text-[10px] uppercase font-bold tracking-widest text-white/70">Learner Portal</span>
                        </div>
                    </div>

                    {/* Headline & Description */}
                    <div className="space-y-2.5">
                        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-white">
                            Start learning today, <br />
                            <span className="text-[var(--color-accent)]">completely free.</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                            Create your independent learner account to practice JAMB/WAEC CBTs, master topics with AI tutoring, and study anywhere with offline support.
                        </p>
                    </div>

                    {/* Compact Feature Highlights */}
                    <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center shrink-0">
                                <UserCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">Instant Self-Signup</p>
                                <p className="text-[11px] text-white/70">No school registration required to start learning.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                                <Award className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">National CBT Exam Prep</p>
                                <p className="text-[11px] text-white/70">Unlimited practice with instant scoring &amp; explanations.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                                <WifiOff className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white leading-tight">100% Offline Capable</p>
                                <p className="text-[11px] text-white/70">Works smoothly on mobile or PC with or without data.</p>
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
               RIGHT COLUMN: Registration Form Alone (Maintained on Mobile)
               ═══════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-5 sm:p-8 lg:p-10 xl:p-14 min-h-screen lg:min-h-0 lg:h-full overflow-y-auto">
                {/* Top Nav: Back to Home (Mobile only) & Theme Toggle */}
                <div className="flex items-center justify-between w-full mb-6 sm:mb-8 lg:mb-0">
                    <Link
                        href="/"
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-semibold transition-colors shadow-xs"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Home</span>
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
                            <span className="text-[10px] font-semibold text-[var(--color-muted)]">Learner Sign Up</span>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="space-y-1">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
                            Create Account
                        </h2>
                        <p className="text-xs sm:text-sm text-[var(--color-muted)]">
                            Sign up as an independent learner to start studying.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {/* Full Name Input */}
                        <div className="space-y-1">
                            <label htmlFor="name" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Full Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                name="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="input-field text-xs sm:text-sm"
                                placeholder="Amina Bello"
                                required
                                autoFocus
                                autoComplete="name"
                            />
                            {errors.name && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.name}</p>
                            )}
                        </div>

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
                                placeholder="amina@example.com"
                                required
                                autoComplete="username"
                            />
                            {errors.email && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1">
                            <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="input-field pr-11 text-xs sm:text-sm"
                                    placeholder="•••••••• (Min 6 characters)"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password Input */}
                        <div className="space-y-1">
                            <label htmlFor="password_confirmation" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password_confirmation"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    className="input-field pr-11 text-xs sm:text-sm"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none cursor-pointer"
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password_confirmation && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.password_confirmation}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary py-3 text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer mt-2"
                        >
                            {processing ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span>Creating Account...</span>
                                </div>
                            ) : (
                                <span>Create Free Account</span>
                            )}
                        </button>
                    </form>

                    {/* Sign In Link */}
                    <div className="text-center pt-2">
                        <p className="text-xs text-[var(--color-muted)]">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline"
                            >
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer Note */}
                <div className="text-center text-[11px] text-[var(--color-muted)] pt-4">
                    Protected by offline-first encryption.
                </div>
            </div>
        </div>
    );
}
