import { Link, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import ChatWidget from '@/components/ui/ChatWidget';
import SyncIndicator from '@/components/ui/SyncIndicator';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import { preloadFullOfflineCurriculum } from '@/services/OfflineService';

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
    const { url } = usePage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Trigger background curriculum preloading whenever user is online
        preloadFullOfflineCurriculum();
    }, []);

    const activeRouteClass = (path: string) => {
        const currentPath = url || window.location.pathname;
        const isActive = path === '/' ? currentPath === '/' : currentPath.startsWith(path);
        return isActive
            ? 'bg-white/10 text-white border-l-4 border-[var(--color-accent)] font-semibold'
            : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent';
    };

    const isTeacher = auth?.user?.role === 'teacher';
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const isSchoolAdmin = auth?.user?.role === 'school_admin' || auth?.user?.role === 'admin';
    const isAdmin = isSuperAdmin || isSchoolAdmin;

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col relative">
            {/* Mobile Header Bar */}
            <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-5 py-3.5 flex items-center justify-between sticky top-0 z-50">
                <Link
                    href="/dashboard"
                    className="text-xl font-bold text-[var(--color-primary)] tracking-tight"
                >
                    AILEARN
                </Link>
                <div className="flex items-center gap-3">
                    <div className="bg-[var(--color-background)] border border-[var(--color-border)] px-2.5 py-1 rounded-full scale-90">
                        <SyncIndicator />
                    </div>

                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-md focus:outline-none min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
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
                        <span className="text-white font-bold text-xl tracking-tight">AILEARN</span>
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

                    {/* Mobile-Only User Profile Card at Top of Drawer */}
                    <div className="md:hidden p-5 border-b border-white/10 bg-black/10">
                        <div className="flex items-center gap-3.5">
                            <div className="h-11 w-11 rounded-full bg-white/15 text-white border border-white/20 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                {auth?.user?.name?.slice(0, 2) || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">{auth?.user?.name}</h3>
                                <p className="text-xs text-[var(--color-primary-light)] truncate">{auth?.user?.email}</p>
                                <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/30">
                                    {auth?.user?.role === 'super_admin' ? 'Super Admin' : auth?.user?.role === 'school_admin' ? 'School Admin' : (auth?.user?.role || 'Learner')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Sidebar Brand Header */}
                    <div className="px-6 py-6 border-b border-white/10 hidden md:block">
                        <Link
                            href="/dashboard"
                            className="text-2xl font-bold text-white tracking-tight"
                        >
                            AILEARN
                        </Link>
                        <p className="text-xs text-[var(--color-primary-light)] mt-0.5 font-medium">Offline-First Learning</p>
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                            <SyncIndicator className="text-white" />
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="mt-4 space-y-1">
                        {isAdmin ? (
                            <Link
                                href="/admin/dashboard"
                                className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/admin/dashboard')}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                </svg>
                                Admin Dashboard
                            </Link>
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
                                    Curriculum
                                </Link>

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
                            <span className="text-white font-bold uppercase">{auth?.user?.name?.slice(0, 2) || 'U'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-semibold text-white truncate">{auth?.user?.name}</h2>
                            <p className="text-xs text-[var(--color-primary-light)] truncate">{auth?.user?.email}</p>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/30">
                                    {auth?.user?.role === 'super_admin' ? 'Super Admin' : auth?.user?.role === 'school_admin' ? 'School Admin' : (auth?.user?.role || 'Learner')}
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

        {/* Page Shell Main Content */}
        <div className="flex-1 flex flex-col min-w-0 md:pl-64 min-h-screen">
            {/* Header Area */}
            {header && (
                <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-6 md:px-8">
                    <div className="max-w-7xl mx-auto">
                        {header}
                    </div>
                </header>
            )}

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
