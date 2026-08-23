import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function Login() {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative shapes */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <Head title="Sign In" />

            <div className="w-full max-w-md space-y-8">
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
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
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
                                <div className="flex items-center space-x-2">
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

                {/* Helper Login Credentials Card */}
                <div className="bg-[var(--color-primary)]/5 border border-[var(--color-border)] p-5 rounded-2xl text-xs text-[var(--color-muted)] space-y-2">
                    <p className="font-bold text-[var(--color-text)]">Demo Accounts Available:</p>
                    <ul className="space-y-1.5 list-disc pl-4">
                        <li><span className="text-[var(--color-text)]">Learner:</span> learner@example.com / password</li>
                        <li><span className="text-[var(--color-text)]">Teacher:</span> teacher@example.com / password</li>
                        <li><span className="text-[var(--color-text)]">Admin:</span> admin@example.com / password</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
