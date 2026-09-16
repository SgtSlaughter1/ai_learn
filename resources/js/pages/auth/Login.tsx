import { Head, Link, useForm } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
    status?: string;
}

export default function Login({ status }: LoginProps) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (processing) return;
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    const fillCredentials = (userEmail: string, userPass: string) => {
        setData((prev) => ({
            ...prev,
            email: userEmail,
            password: userPass,
        }));
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head>
                <title>Sign In — AILEARN Portal</title>
                <meta name="description" content="Sign in to your AILEARN account to access your offline-first secondary curriculum, quizzes, and personalized AI tutor." />
            </Head>

            <div className="w-full max-w-md space-y-8">
                {/* Back to Home */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Home
                </Link>
                {/* Brand Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-primary)]">
                        AILEARN
                    </h1>
                    <p className="text-sm text-[var(--color-muted)]">
                        Sign in to access your offline-first curriculum.
                    </p>
                </div>

                {/* Status Message Banner */}
                {status && (
                    <div className="p-4 rounded-2xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-sm flex items-start gap-3">
                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{status}</span>
                    </div>
                )}

                {/* Login Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl shadow-xl shadow-[var(--color-primary)]/5">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="input-field"
                                placeholder="learner@example.com"
                                required
                                autoComplete="username"
                            />
                            {errors.email && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                    Password
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="input-field pr-11"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none cursor-pointer"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-[var(--color-error)] font-semibold mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Remember Me checkbox */}
                        <div className="flex items-center">
                            <label className="flex items-center space-x-2.5 text-sm text-[var(--color-muted)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    name="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 focus:ring-offset-0 focus:outline-none"
                                />
                                <span>Remember my login</span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full btn-primary"
                        >
                            {processing ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span>Signing In...</span>
                                </div>
                            ) : (
                                <span>Sign In</span>
                            )}
                        </button>
                    </form>
                </div>

                {/* Helper Login Credentials Card with Click-to-Fill */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm text-xs text-[var(--color-muted)] space-y-3">
                    <p className="font-bold text-[var(--color-text)] flex items-center justify-between">
                        <span>Demo Accounts (Tap to fill):</span>
                        <span className="text-[10px] font-normal text-[var(--color-muted)]">pwd: password</span>
                    </p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => fillCredentials('platformadmin@example.com', 'password')}
                            className="w-full text-left p-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-hover)] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--color-text)] leading-tight">Platform Admin</p>
                                    <p className="text-[10px] text-[var(--color-muted)]">Global platform & schools</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">platformadmin@example.com</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => fillCredentials('schooladmin@example.com', 'password')}
                            className="w-full text-left p-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-hover)] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text)] shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--color-text)] leading-tight">School Admin</p>
                                    <p className="text-[10px] text-[var(--color-muted)]">AILEARN Academy activities</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">schooladmin@example.com</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => fillCredentials('learner@example.com', 'password')}
                            className="w-full text-left p-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-hover)] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--color-text)] leading-tight">Learner</p>
                                    <p className="text-[10px] text-[var(--color-muted)]">SS1 Student assessments</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">learner@example.com</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
