import { Link, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import ChatWidget from '@/components/ui/ChatWidget';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import UserProfileMenu from '@/components/ui/UserProfileMenu';
import { preloadFullOfflineCurriculum } from '@/services/OfflineService';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    has_school_access?: boolean;
}

interface PageProps {
    auth: {
        user: User;
    };
    [key: string]: any;
}

export default function AuthenticatedLayout({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
    const { auth } = usePage<PageProps>().props;
    const { url } = usePage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Trigger background curriculum preloading whenever user is online
        preloadFullOfflineCurriculum();
    }, []);

    const activeRouteClass = (path: string) => {
        const currentUrl = url || (typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '');
        const currentPath = currentUrl.split('?')[0];
        const searchParams = new URLSearchParams(
            currentUrl.includes('?')
                ? currentUrl.split('?')[1]
                : (typeof window !== 'undefined' ? window.location.search : '')
        );
        const isGeneralScope = searchParams.get('scope') === 'general';

        if (path === '/general-knowledge') {
            const isActive = currentPath === '/general-knowledge' || (currentPath.startsWith('/subjects') && isGeneralScope);
            return isActive
                ? 'bg-white/10 text-white border-l-4 border-[var(--color-accent)] font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent';
        }

        if (path === '/subjects') {
            const isActive = currentPath.startsWith('/subjects') && !isGeneralScope;
            return isActive
                ? 'bg-white/10 text-white border-l-4 border-[var(--color-accent)] font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent';
        }

        const isActive = path === '/' ? currentPath === '/' : currentPath.startsWith(path);
        return isActive
            ? 'bg-white/10 text-white border-l-4 border-[var(--color-accent)] font-semibold'
            : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent';
    };

    const isSuperAdmin = auth?.user?.role === 'platform_admin';
    const isSchoolAdmin = auth?.user?.role === 'school_admin';
    const isTeacher = auth?.user?.role === 'teacher';
    const isAdmin = isSuperAdmin || isSchoolAdmin;
    const hasSchool = auth?.user?.has_school_access !== false;

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col relative">
            {/* Mobile Header Bar */}
            <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
                <Link
                    href="/dashboard"
                    className="text-xl font-bold text-[var(--color-primary)] tracking-tight"
                >
                    AceDrill
                </Link>
                <div className="flex items-center gap-2">
                    <UserProfileMenu user={auth?.user} />

                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-md focus:outline-none min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
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
            </div>

            {/* Mobile Backdrop Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Fixed Sidebar Container */}
            <aside
                className={`fixed inset-y-0 left-0 transform ${
                    isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                } md:translate-x-0 transition-transform duration-200 ease-in-out z-50 w-72 md:w-64 bg-[var(--color-primary)] flex flex-col justify-between h-screen overflow-y-auto shadow-2xl md:shadow-none`}
            >
                <div>
                    {/* Mobile Close Button & Header */}
                    <div className="md:hidden flex items-center justify-between p-5 border-b border-white/10 bg-black/20">
                        <span className="text-white font-bold text-xl tracking-tight">AceDrill</span>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 focus:outline-none cursor-pointer"
                            aria-label="Close Menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Desktop Sidebar Brand Header */}
                    <div className="px-6 py-6 border-b border-white/10 hidden md:block">
                        <Link
                            href="/dashboard"
                            className="text-2xl font-bold text-white tracking-tight"
                        >
                            AceDrill
                        </Link>
                        <p className="text-xs text-[var(--color-primary-light)] mt-0.5 font-medium">Offline-First Learning</p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="mt-4 space-y-1">
                        {isAdmin ? (
                            <Link
                                href="/admin/dashboard"
                                className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/admin/dashboard') || activeRouteClass('/super-admin/dashboard') || activeRouteClass('/school-admin/dashboard')}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                </svg>
                                {isSuperAdmin ? 'Super Admin Portal' : 'School Admin Portal'}
                            </Link>
                        ) : isTeacher ? (
                            <Link
                                href="/teacher/dashboard"
                                className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/teacher/dashboard') || activeRouteClass('/dashboard')}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
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

                                {hasSchool && (
                                    <Link
                                        href="/subjects"
                                        className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/subjects')}`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        Curriculum
                                    </Link>
                                )}

                                <Link
                                    href="/general-knowledge"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/general-knowledge')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    General Knowledge
                                </Link>

                                <Link
                                    href="/past-questions"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/past-questions')}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    <span className="flex-1">Past Questions</span>
                                    <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-400/20 text-emerald-300 rounded border border-emerald-400/30">
                                        CBT
                                    </span>
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
            </aside>

            {/* Page Shell Main Content */}
            <div className="flex-1 flex flex-col min-w-0 md:pl-64 min-h-screen">
                {/* Desktop Top Header Bar */}
                <header className="hidden md:flex bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 lg:px-8 py-3.5 items-center justify-between sticky top-0 z-30 shadow-xs">
                    <div className="min-w-0 flex-1">
                        {header ? (
                            header
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
                                <span>AceDrill</span>
                                <span>/</span>
                                <span className="text-[var(--color-text)] font-bold capitalize">
                                    {url.split('/')[1]?.replace('-', ' ') || 'Dashboard'}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <UserProfileMenu user={auth?.user} />
                    </div>
                </header>

                {/* Main Content Body */}
                <main className="flex-1 px-3.5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-24">
                    {children}
                </main>
            </div>

            {/* Persistent AI Companion Floating Widget (Global across all pages) */}
            <ChatWidget />

            {/* In-App PWA Install Banner */}
            <PWAInstallPrompt />
        </div>
    );
}

