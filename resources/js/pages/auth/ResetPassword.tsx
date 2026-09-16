import { Head, Link, useForm } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';

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
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head>
                <title>Create New Password — AILEARN</title>
                <meta name="robots" content="noindex, nofollow" />
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
                        Create New Password
                    </h1>
                    <p className="text-sm text-[var(--color-muted)]">
                        Please enter your new secure password below.
                    </p>
                </div>

                {/* Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl shadow-xl shadow-[var(--color-primary)]/5">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
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

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text)] mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                                    <Lock className="h-5 w-5" />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    placeholder="••••••••"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all min-h-[48px]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-medium">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text)] mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                                    <Lock className="h-5 w-5" />
                                </span>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    required
                                    placeholder="••••••••"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all min-h-[48px]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none cursor-pointer"
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            {errors.password_confirmation && (
                                <p className="mt-1.5 text-xs text-[var(--color-error)] font-medium">
                                    {errors.password_confirmation}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer min-h-[48px] mt-2"
                        >
                            {processing ? 'Resetting Password...' : 'Reset Password & Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
