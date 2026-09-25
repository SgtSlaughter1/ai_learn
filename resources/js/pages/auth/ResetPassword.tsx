import { Head, Link, useForm } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface ResetPasswordProps {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email || '',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (processing) return;
        post('/reset-password', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center px-4 py-8 sm:p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head>
                <title>Create New Password | PassPoint</title>
                <meta name="description" content="Set a new secure password for your PassPoint account." />
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
                            Set New Password
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                            Choose a strong password to protect your learning progress.
                        </p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl shadow-[var(--color-primary)]/5">
                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                        {/* Email Address */}
                        <div className="space-y-1.5 sm:space-y-2">
                            <label htmlFor="email" className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                required
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

                        {/* New Password */}
                        <div className="space-y-1.5 sm:space-y-2">
                            <label htmlFor="password" className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    placeholder="••••••••"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="input-field pr-12 text-xs sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-semibold">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5 sm:space-y-2">
                            <label htmlFor="password_confirmation" className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password_confirmation"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    required
                                    placeholder="••••••••"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    className="input-field pr-12 text-xs sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none cursor-pointer"
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password_confirmation && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-semibold">
                                    {errors.password_confirmation}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary py-3.5 text-sm sm:text-base font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer"
                        >
                            {processing ? 'Updating Password...' : 'Reset & Secure Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
