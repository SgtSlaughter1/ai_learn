import { Link, usePage } from '@inertiajs/react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import React, { useEffect, useState } from 'react';
import ChatWidget from '@/components/ui/ChatWidget';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import UserProfileMenu from '@/components/ui/UserProfileMenu';
import { prepareOfflineData } from '@/services/OfflinePrewarm';
import { OfflineReadinessBadge } from '@/components/dashboard/OfflineReadinessBadge';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { SessionExpiredBanner } from '@/components/sync/SessionExpiredBanner';
import NotificationBell from '@/components/ui/NotificationBell';
import { useNotifications } from '@/services/Notifications';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { currentSection, openSection, sectionHref } from '@/services/DashboardSection';
import {
    BarChart3, BookOpen, Building2, CircleHelp, ClipboardCheck, GraduationCap, LayoutGrid, ShieldCheck, Trophy, Users, UsersRound, Zap,
    type LucideIcon,
} from 'lucide-react';

type Section = { key: string; label: string; icon: LucideIcon };

const ADMIN_SECTIONS: (Section & { platformOnly?: boolean })[] = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'schools', label: 'Schools', icon: Building2, platformOnly: true },
    { key: 'school_admins', label: 'School Admins', icon: ShieldCheck, platformOnly: true },
    { key: 'teachers', label: 'Teachers', icon: Users },
    { key: 'classes', label: 'Classes', icon: UsersRound },
    { key: 'learners', label: 'Learners', icon: GraduationCap },
    { key: 'subjects', label: 'Subjects', icon: BookOpen },
    { key: 'questions', label: 'Question Bank', icon: CircleHelp },
];

const TEACHER_SECTIONS: Section[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'struggling', label: 'Targeted Practice', icon: Zap },
    { key: 'learners', label: 'Class Roster', icon: Users },
    { key: 'top', label: 'Top Performers', icon: Trophy },
    { key: 'questions', label: 'Question Bank', icon: CircleHelp },
];

const ADMIN_DASHBOARDS = ['/admin/dashboard', '/super-admin/dashboard', '/school-admin/dashboard'];

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    has_school_access?: boolean;
    recess_enabled?: boolean;
    cbt_enabled?: boolean;
}

interface PageProps {
    auth: {
        user: User;
        can?: Record<string, boolean> | null;
    };
    [key: string]: any;
}

export default function AuthenticatedLayout({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
    const { auth } = usePage<PageProps>().props;
    const { url } = usePage();
    const { isOnline } = useNetworkStatus();
    const [currentPathWithQuery, setCurrentPathWithQuery] = useState(url);

    useEffect(() => {
        setCurrentPathWithQuery(url);
    }, [url]);

    useEffect(() => {
        const handleLocationChange = () => {
            if (typeof window !== 'undefined') {
                setCurrentPathWithQuery(window.location.pathname + window.location.search);
            }
        };
        window.addEventListener('popstate', handleLocationChange);
        window.addEventListener('urlchange', handleLocationChange);
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            window.removeEventListener('urlchange', handleLocationChange);
        };
    }, []);

    useEffect(() => {
        // Download what this role needs offline (curriculum for learners, school data for staff).
        prepareOfflineData(auth?.user?.role, auth?.can);
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

    // Admins and teachers move between their dashboard's sections from the sidebar.
    const currentPath = currentPathWithQuery.split('?')[0];
    const staffBase = isTeacher ? '/teacher/dashboard' : ADMIN_DASHBOARDS.includes(currentPath) ? currentPath : '/admin/dashboard';
    const staffSections: Section[] | null = isTeacher
        ? TEACHER_SECTIONS
        : isAdmin
        ? ADMIN_SECTIONS.filter((section) => !section.platformOnly || isSuperAdmin)
        : null;
    const onStaffDashboard = currentPath === staffBase;
    const activeSection = currentSection(currentPathWithQuery.split('?')[1] ?? '');

    // The bell, browser pop-ups, and a badge on the Question Bank for reported AI explanations.
    const notifications = useNotifications(auth?.user?.id);
    const reviewCount = staffSections ? notifications.summary?.reviews ?? 0 : 0;
    const bell = auth?.user && (
        <NotificationBell
            summary={notifications.summary}
            onSummary={notifications.setSummary}
            permission={notifications.permission}
            onEnablePopUps={notifications.enablePopUps}
            isLearner={!staffSections}
        />
    );
    const reviewBadge = reviewCount > 0 && (
        <span
            className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-white"
            aria-label={`${reviewCount} reported AI explanation${reviewCount === 1 ? '' : 's'} to check`}
        >
            {reviewCount > 9 ? '9+' : reviewCount}
        </span>
    );
    const mobileReviewDot = reviewCount > 0 && (
        <span className="absolute top-1 right-[calc(50%-18px)] w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-[var(--color-surface)]" aria-label={`${reviewCount} reported AI explanations to check`} />
    );

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col relative">
            {/* Mobile Clean Top Header Bar */}
            <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                <Link href="/dashboard" className="flex items-center" aria-label="AceDrill dashboard">
                    <BrandLogo className="h-7 w-auto" title="" />
                </Link>
                <div className="flex items-center gap-2">
                    <SyncStatus compact fallback={<OfflineReadinessBadge isOnline={isOnline} compact />} />
                    {bell}
                    <UserProfileMenu user={auth?.user} />
                </div>
            </div>

            {/* Desktop Fixed Sidebar Container (Hidden on mobile) */}
            <aside
                className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-primary)] flex-col justify-between h-screen overflow-y-auto"
            >
                <div>
                    {/* Desktop Sidebar Brand Header */}
                    <div className="px-6 py-6 border-b border-white/10">
                        <Link href="/dashboard" className="inline-flex" aria-label="AceDrill dashboard">
                            <BrandLogo tone="reversed" className="h-9 w-auto" title="" />
                        </Link>
                        <p className="text-xs text-[var(--color-primary-light)] mt-0.5 font-medium">Offline-First Learning</p>
                    </div>

                    {/* Navigation Items */}
                    <nav className="mt-4 space-y-1">
                        {staffSections ? (
                            <>
                                <p className="px-6 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/45">
                                    {isSuperAdmin ? 'Platform' : isAdmin ? 'School admin' : 'Teaching'}
                                </p>
                                {staffSections.map(({ key, label, icon: Icon }) => {
                                    const active = onStaffDashboard && activeSection === key;
                                    return (
                                        <Link
                                            key={key}
                                            href={sectionHref(staffBase, key)}
                                            onClick={(e) => openSection(e, staffBase, key)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex items-center px-6 py-3 text-sm transition-all border-l-4 ${
                                                active
                                                    ? 'bg-white/10 text-white border-[var(--color-accent)] font-semibold'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white border-transparent'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5 mr-3" aria-hidden />
                                            {label}
                                            {key === 'questions' && reviewBadge}
                                        </Link>
                                    );
                                })}
                                <Link
                                    href="/school-exams"
                                    aria-current={currentPath.startsWith('/school-exams') ? 'page' : undefined}
                                    className={`flex items-center px-6 py-3 text-sm transition-all ${activeRouteClass('/school-exams')}`}
                                >
                                    <ClipboardCheck className="w-5 h-5 mr-3" aria-hidden />
                                    School Exams
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/dashboard"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/dashboard')}`}
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
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    General Knowledge
                                </Link>

                                <Link
                                    href="/past-questions"
                                    className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/past-questions')}`}
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
                                >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    Active Recall
                                </Link>

                                {hasSchool && auth?.user?.cbt_enabled !== false && (
                                    <Link
                                        href="/exams"
                                        className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/exams')}`}
                                    >
                                        <ClipboardCheck className="w-5 h-5 mr-3" aria-hidden />
                                        School Exams
                                    </Link>
                                )}

                                {auth?.user?.recess_enabled !== false && (
                                    <Link
                                        href="/recess"
                                        className={`flex items-center px-6 py-3.5 text-sm transition-all ${activeRouteClass('/recess')}`}
                                    >
                                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zm3-6v2m4-2v2m4-2v2" />
                                        </svg>
                                        Recess
                                    </Link>
                                )}
                            </>
                        )}
                    </nav>
                </div>
            </aside>

            {/* Page Shell Main Content */}
            <div className="flex-1 flex flex-col min-w-0 md:pl-64 min-h-screen">
                {/* Desktop Top Header Bar */}
                <header className="hidden md:flex bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 lg:px-8 py-3 items-center justify-between sticky top-0 z-30 shadow-xs">
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
                        {/* The full status pill only where it leaves the page title room. */}
                        <div className="hidden xl:block">
                            <SyncStatus fallback={<OfflineReadinessBadge isOnline={isOnline} />} />
                        </div>
                        <div className="xl:hidden">
                            <SyncStatus compact fallback={<OfflineReadinessBadge isOnline={isOnline} compact />} />
                        </div>
                        {bell}
                        <UserProfileMenu user={auth?.user} />
                    </div>
                </header>

                {/* Main Content Body */}
                <main className="flex-1 px-3.5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-28 md:pb-16">
                    <SessionExpiredBanner />
                    {header && <div className="md:hidden mb-4">{header}</div>}
                    {children}
                </main>
            </div>

            {/* Mobile Bottom Navigation Bar (High-ergonomics thumb zone for phone screens) */}
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--color-surface)]/95 backdrop-blur-lg border-t border-[var(--color-border)] z-30 px-2 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-all"
                aria-label="Mobile Navigation"
            >
                {isTeacher ? (
                    <div className="grid grid-cols-4 items-center justify-around w-full max-w-md mx-auto">
                        <Link
                            href="/teacher/dashboard"
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/teacher/dashboard') && (!currentPathWithQuery.includes('tab=') || currentPathWithQuery.includes('tab=overview'))
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Overview</span>
                        </Link>
                        <Link
                            href="/teacher/dashboard?tab=struggling"
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] relative ${
                                currentPathWithQuery.startsWith('/teacher/dashboard') && currentPathWithQuery.includes('tab=struggling')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Targeted</span>
                        </Link>
                        <Link
                            href="/teacher/dashboard?tab=learners"
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/teacher/dashboard') && currentPathWithQuery.includes('tab=learners')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>Roster</span>
                        </Link>
                        <Link
                            href="/teacher/dashboard?tab=questions"
                            preserveState
                            preserveScroll
                            className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/teacher/dashboard') && currentPathWithQuery.includes('tab=questions')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Questions</span>
                            {mobileReviewDot}
                        </Link>
                    </div>
                ) : (isSuperAdmin || isAdmin) ? (
                    <div className="grid grid-cols-4 items-center justify-around w-full max-w-md mx-auto">
                        <Link
                            href={isSuperAdmin ? '/super-admin/dashboard' : '/admin/dashboard'}
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                (currentPathWithQuery.startsWith('/admin') || currentPathWithQuery.startsWith('/super-admin') || currentPathWithQuery.startsWith('/school-admin')) &&
                                (!currentPathWithQuery.includes('tab=') || currentPathWithQuery.includes('tab=overview'))
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Overview</span>
                        </Link>
                        <Link
                            href={isSuperAdmin ? '/super-admin/dashboard?tab=schools' : '/admin/dashboard?tab=classes'}
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.includes('tab=classes') || currentPathWithQuery.includes('tab=schools')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>{isSuperAdmin ? 'Schools' : 'Classes'}</span>
                        </Link>
                        <Link
                            href={isSuperAdmin ? '/super-admin/dashboard?tab=school_admins' : '/admin/dashboard?tab=learners'}
                            preserveState
                            preserveScroll
                            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.includes('tab=learners') || currentPathWithQuery.includes('tab=school_admins')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>{isSuperAdmin ? 'Admins' : 'Learners'}</span>
                        </Link>
                        <Link
                            href={isSuperAdmin ? '/super-admin/dashboard?tab=questions' : '/admin/dashboard?tab=questions'}
                            preserveState
                            preserveScroll
                            className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.includes('tab=questions')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Questions</span>
                            {mobileReviewDot}
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-5 items-center justify-around w-full max-w-lg mx-auto">
                        <Link
                            href="/dashboard"
                            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[9px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery === '/dashboard' || currentPathWithQuery === '/' || currentPathWithQuery.startsWith('/learner/dashboard')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="truncate">Dashboard</span>
                        </Link>

                        <Link
                            href="/subjects"
                            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[9px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/subjects') && !currentPathWithQuery.includes('scope=general')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <span className="truncate">Curriculum</span>
                        </Link>

                        <Link
                            href="/general-knowledge"
                            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[9px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/general-knowledge') || (currentPathWithQuery.startsWith('/subjects') && currentPathWithQuery.includes('scope=general'))
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="truncate">Knowledge</span>
                        </Link>

                        <Link
                            href="/past-questions"
                            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[9px] font-bold transition-all min-h-[48px] relative ${
                                currentPathWithQuery.startsWith('/past-questions')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <div className="relative flex items-center justify-center">
                                <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                <span className="absolute -top-1.5 -right-3 text-[7px] font-black px-1 rounded bg-[var(--color-accent)] text-white leading-tight">
                                    CBT
                                </span>
                            </div>
                            <span className="truncate">Past Qs</span>
                        </Link>

                        <Link
                            href="/flashcards"
                            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[9px] font-bold transition-all min-h-[48px] ${
                                currentPathWithQuery.startsWith('/flashcards')
                                    ? 'text-[var(--color-primary)] font-extrabold bg-[var(--color-primary-10)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="truncate">Recall</span>
                        </Link>
                    </div>
                )}
            </nav>

            {/* Persistent AI Companion Floating Widget (Global across all pages) */}
            <ChatWidget />

            {/* In-App PWA Install Banner */}
            <PWAInstallPrompt />
        </div>
    );
}

