import { Head, Link, useForm } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
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

            <Head title="Sign In" />

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
                        Antigravity AI
                    </h1>
                    <p className="text-sm text-[var(--color-muted)]">
                        Sign in to access your offline-first curriculum.
                    </p>
                </div>

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
                            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                Password
                            </label>
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
                <div className="bg-[var(--color-primary)]/5 border border-[var(--color-border)] p-5 rounded-2xl text-xs text-[var(--color-muted)] space-y-2.5">
                    <p className="font-bold text-[var(--color-text)]">Quick Fill Demo Accounts (Tap to fill):</p>
                    <div className="space-y-1.5">
                        <button
                            type="button"
                            onClick={() => fillCredentials('learner@example.com', 'password')}
                            className="w-full text-left p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors cursor-pointer flex items-center justify-between group"
                        >
                            <span className="font-semibold text-[var(--color-text)]">Learner</span>
                            <span className="text-[11px] text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">learner@example.com / password</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => fillCredentials('teacher@example.com', 'password')}
                            className="w-full text-left p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors cursor-pointer flex items-center justify-between group"
                        >
                            <span className="font-semibold text-[var(--color-text)]">Teacher</span>
                            <span className="text-[11px] text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">teacher@example.com / password</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => fillCredentials('admin@example.com', 'password')}
                            className="w-full text-left p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors cursor-pointer flex items-center justify-between group"
                        >
                            <span className="font-semibold text-[var(--color-text)]">Admin</span>
                            <span className="text-[11px] text-[var(--color-muted)] group-hover:text-[var(--color-primary)]">admin@example.com / password</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
