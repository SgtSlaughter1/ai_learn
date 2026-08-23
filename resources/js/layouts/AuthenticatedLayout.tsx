import { Link, usePage } from '@inertiajs/react';
import React, { useState } from 'react';
import ChatWidget from '@/components/ui/ChatWidget';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface PageProps {
    auth: {
        user: User;
    };
    [key: string]: any;
}

export default function AuthenticatedLayout({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
    const { auth } = usePage<PageProps>().props;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeRouteClass = (path: string) => {
        const currentPath = window.location.pathname;
        const isActive = path === '/' ? currentPath === '/' : currentPath.startsWith(path);
        return isActive
            ? 'bg-white/10 text-white border-l-4 border-[var(--color-accent)] font-semibold'
            : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent';
    };

    const isTeacher = auth?.user?.role === 'teacher';
    const isAdmin = auth?.user?.role === 'admin';

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col md:flex-row relative">
            {/* Mobile Header Bar */}
            <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
                <Link
                    href="/dashboard"
                    className="text-xl font-bold text-[var(--color-primary)]"
                >
                    Antigravity AI
                </Link>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-md focus:outline-none min-h-[48px] min-w-[48px] flex items-center justify-center"
                    aria-label="Toggle Menu"
                >
                    <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        {isMobileMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Sidebar Container */}
            <aside
                className={`fixed inset-y-0 left-0 transform ${
                    isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                } md:relative md:translate-x-0 transition duration-200 ease-in-out z-40 w-64 bg-[var(--color-primary)] flex flex-col justify-between pt-[72px] md:pt-0`}
            >
                <div>
                    {/* Sidebar Brand Header */}
                    <div className="px-6 py-8 hidden md:block">
                        <Link
                            href="/dashboard"
                            className="text-2xl font-bold text-white"
                        >
                            Antigravity AI
                        </Link>
                        <p className="text-xs text-[var(--color-primary-light)] mt-1">Offline-First Learning</p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="mt-4 space-y-1">
                        {isAdmin ? (
                            <>
                                <Link
                                    href="/admin/dashboard"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/admin/dashboard')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                    </svg>
                                    Admin Dashboard
                                </Link>
                                <Link
                                    href="/subjects"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/subjects')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13M12 19.247V21" />
                                    </svg>
                                    View Subjects
                                </Link>
                            </>
                        ) : isTeacher ? (
                            <Link
                                href="/teacher/dashboard"
                                className={`flex items-center px-6 py-3.5 text-sm transition-all ${
                                    activeRouteClass('/teacher/dashboard')
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Teacher Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/dashboard"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/dashboard')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Dashboard
                                </Link>

                                <Link
                                    href="/subjects"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/subjects')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    Subjects
                                </Link>

                                <Link
                                    href="/flashcards"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/flashcards')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    Active Recall
                                </Link>
                            </>
                        )}
                    </nav>
                </div>

                {/* Sidebar Profile Card footer */}
                <div className="p-6 border-t border-[var(--color-primary-light)]/20">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-[var(--color-primary-light)]/20 flex items-center justify-center border border-[var(--color-primary-light)]/30">
                            <span className="text-white font-bold uppercase">{auth?.user?.name.slice(0, 2)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-semibold text-white truncate">{auth?.user?.name}</h2>
                            <p className="text-xs text-[var(--color-primary-light)] truncate">{auth?.user?.email}</p>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/30">
                                    {auth?.user?.role}
                                </span>
                                <Link
                                    href="/logout"
                                    method="post"
                                    as="button"
                                    className="text-xs text-[var(--color-error)] hover:opacity-80 font-bold transition-colors cursor-pointer focus:outline-none"
                                >
                                    Logout
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Background Backdrop for Mobile Sidebar Drawer */}
            {isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-30 md:hidden"
                />
            )}

            {/* Page Shell Main Content */}
            <main className="flex-1 flex flex-col overflow-x-hidden min-h-screen">
                {/* Header Area */}
                {header && (
                    <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-6 md:px-8">
                        <div className="max-w-7xl mx-auto">
                            {header}
                        </div>
                    </header>
                )}

                {/* Main Content Body */}
                <div className="flex-1 py-8 px-6 md:px-8 max-w-7xl w-full mx-auto pb-24">
                    {children}
                </div>
            </main>

            {/* Persistent AI Companion Floating Widget (Global across all pages) */}
            <ChatWidget />
        </div>
    );
}
