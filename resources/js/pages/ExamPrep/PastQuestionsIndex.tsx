import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { PastQuestionsHub } from '@/components/past-questions/PastQuestionsHub';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface PageProps {
    auth?: {
        user?: {
            id: number;
            name: string;
            email: string;
            role: string;
        } | null;
    };
    [key: string]: any;
}

export default function PastQuestionsIndex() {
    const { auth } = usePage<PageProps>().props;

    // Logged in user: render with full sidebar navigation
    if (auth?.user) {
        return (
            <AuthenticatedLayout>
                <Head title="Past Questions & CBT Exam Simulation Hub" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <PastQuestionsHub />
                </div>
            </AuthenticatedLayout>
        );
    }

    // Guest / Public visitor layout
    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] font-sans">
            <Head title="Past Questions & CBT Exam Practice | AceDrill" />

            {/* Glassmorphic Header */}
            <header className="sticky top-0 z-50 w-full px-2.5 sm:px-6 pt-2.5 sm:pt-3 pb-2">
                <nav className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-[var(--color-surface)]/85 backdrop-blur-xl border border-[var(--color-border)]/80 shadow-md shadow-black/[0.03] flex items-center justify-between gap-2 transition-all">
                    {/* Brand Logo */}
                    <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-primary)]">AceDrill</span>
                    </Link>

                    {/* Right Action Links */}
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <ThemeToggle className="shrink-0" />
                        <Link
                            href="/"
                            className="hidden md:inline-flex px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap"
                        >
                            Home
                        </Link>
                        <Link
                            href="/login"
                            className="px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap shrink-0"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/register"
                            className="px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-xs hover:shadow-sm transition-all active:scale-98 whitespace-nowrap shrink-0"
                        >
                            Get Started
                        </Link>
                    </div>
                </nav>
            </header>

            {/* Main Hub Body */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <PastQuestionsHub />
            </main>

            <PWAInstallPrompt />
        </div>
    );
}
