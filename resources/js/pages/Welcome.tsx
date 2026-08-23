import { Head } from '@inertiajs/react';

export default function Welcome() {
    return (
        <>
            <Head title="Welcome" />
            <div className="relative min-h-screen flex flex-col justify-center items-center bg-[var(--color-background)] text-[var(--color-text)] overflow-hidden font-sans">
                {/* Background decorative shapes */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)]/5 rounded-full blur-3xl" />

                <div className="relative max-w-xl w-full mx-4 p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl flex flex-col items-center text-center">
                    {/* Stylized Logo Badge */}
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg mb-6">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-primary)]">
                        Offline AI Learning
                    </h1>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-accent)] uppercase tracking-widest">
                        Platform Scaffold
                    </p>

                    <div className="mt-8 py-4 px-6 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-border)] text-[var(--color-muted)] font-mono text-xs w-full flex items-center justify-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                        <span>Project scaffold is ready.</span>
                    </div>

                    {/* Architecture Badges */}
                    <div className="mt-8 w-full border-t border-[var(--color-border)] pt-6">
                        <h2 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider text-left mb-3">
                            Configured Stack
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">Laravel 11</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">React + TS</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">Inertia.js</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">Tailwind CSS</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">Dexie (IndexedDB)</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">Vite PWA</span>
                            <span className="px-2.5 py-1 rounded bg-[var(--color-primary)]/5 text-[var(--color-text)] text-xs border border-[var(--color-border)]">MySQL</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
