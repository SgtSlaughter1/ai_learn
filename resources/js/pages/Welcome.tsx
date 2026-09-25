import { Head, Link } from '@inertiajs/react';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import { InteractiveBookAnimation } from '@/components/landing/InteractiveBookAnimation';

interface SubjectItem {
    id: number;
    name: string;
    slug?: string;
    description?: string;
    topics_count?: number;
    school_id?: number | null;
}

interface WelcomeStats {
    total_subjects?: number;
    total_past_questions?: number;
    exam_counts?: Record<string, number>;
}

interface WelcomeProps {
    subjects?: SubjectItem[];
    stats?: WelcomeStats;
}

function getSubjectIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes('math') || lower.includes('algebra') || lower.includes('calc') || lower.includes('geometry')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        );
    }
    if (lower.includes('physic') || lower.includes('energy') || lower.includes('force')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        );
    }
    if (lower.includes('chem') || lower.includes('lab') || lower.includes('element')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        );
    }
    if (lower.includes('bio') || lower.includes('life') || lower.includes('genet') || lower.includes('health') || lower.includes('agric')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        );
    }
    if (lower.includes('eng') || lower.includes('lang') || lower.includes('gramm') || lower.includes('vocab')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
        );
    }
    if (lower.includes('econ') || lower.includes('commerc') || lower.includes('financ') || lower.includes('account') || lower.includes('busin')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        );
    }
    if (lower.includes('lit') || lower.includes('art') || lower.includes('write') || lower.includes('history')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        );
    }
    if (lower.includes('comput') || lower.includes('tech') || lower.includes('ict') || lower.includes('data') || lower.includes('code')) {
        return (
            <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        );
    }
    return (
        <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
    );
}

export default function Welcome({ subjects = [], stats }: WelcomeProps) {
    const displaySubjects = subjects.length > 0 ? subjects : [
        { id: 1, name: 'Mathematics', topics_count: 8 },
        { id: 2, name: 'Physics', topics_count: 6 },
        { id: 3, name: 'Chemistry', topics_count: 6 },
        { id: 4, name: 'Biology', topics_count: 7 },
        { id: 5, name: 'English Language', topics_count: 8 },
        { id: 6, name: 'Economics', topics_count: 5 },
        { id: 7, name: 'Financial Accounting', topics_count: 6 },
        { id: 8, name: 'Government', topics_count: 5 },
    ];

    const examCounts = stats?.exam_counts || {};
    const totalPastCount = stats?.total_past_questions ?? Object.values(examCounts).reduce((a, b) => a + b, 0);
    const totalSubjectsCount = stats?.total_subjects ?? (subjects.length > 0 ? subjects.length : displaySubjects.length);

    const formatQuestionCount = (count?: number, fallback = 'Questions') => {
        if (count && count > 0) {
            return `${count.toLocaleString()} Questions`;
        }
        return fallback;
    };

    const examTypes = [
        {
            code: 'jamb',
            name: 'JAMB (UTME)',
            badge: 'Tertiary Entrance',
            count: formatQuestionCount(examCounts['jamb'], '2,300+ Questions'),
            desc: 'Real Computer-Based Test simulation with timer, calculator, question palette, and topic breakdown.',
            color: 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary-20)]',
        },
        {
            code: 'waec',
            name: 'WAEC (WASSCE)',
            badge: 'Senior Secondary',
            count: formatQuestionCount(examCounts['waec'], '1,000+ Questions'),
            desc: 'Authentic Senior School Certificate Examination papers with step-by-step mathematical working.',
            color: 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]',
        },
        {
            code: 'neco',
            name: 'NECO (SSCE)',
            badge: 'National SSCE',
            count: formatQuestionCount(examCounts['neco'], '150+ Questions'),
            desc: 'National Senior Certificate past papers with syllabus topic alignment and error analysis.',
            color: 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent-20)]',
        },
        {
            code: 'post_utme',
            name: 'Post-UTME',
            badge: 'Screening Drills',
            count: formatQuestionCount(examCounts['post_utme'], '470+ Questions'),
            desc: 'Aptitude and subject screening papers for top Nigerian federal and state universities.',
            color: 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary-20)]',
        },
    ];

    const faqData = [
        {
            question: "Where and how can I practice national Past Questions on PassPoint?",
            answer: "You can practice directly in the Past Questions & CBT Hub (accessible at /past-questions or via the top menu). It offers two modes: self-paced Interactive Practice Mode (with instant step-by-step AI solutions) and Timed CBT Simulation (with standard exam timers, question palette, and weak-topic scorecards)."
        },
        {
            question: "Do past questions and CBT simulations work completely offline?",
            answer: `Yes! All ${totalPastCount > 0 ? totalPastCount.toLocaleString() + '+' : '4,000+'} authentic questions, option choices, passages, and step-by-step mathematical solutions are cached directly on your device via our Progressive Web App (PWA). You can practice on your phone, tablet, or laptop anywhere with zero data or internet connection.`
        },
        {
            question: "How does the AI Tutor work with past questions?",
            answer: "Every past question includes an 'Ask AI Tutor' button. When offline, it provides instant step-by-step mathematical derivations and topic formulas from local storage. When online, it connects to our AI engine for deeper interactive explanations and syllabus tips."
        },
        {
            question: "What curriculum and exams does PassPoint cover?",
            answer: `PassPoint supports Junior & Senior Secondary school curricula aligned with WAEC, NECO, JAMB/UTME, and NERDC standards across ${totalSubjectsCount} core subjects including Mathematics, English, Physics, Chemistry, Biology, Economics, Accounting, and Government.`
        },
        {
            question: "How does student progress sync when back online?",
            answer: "When an internet connection is detected, PassPoint automatically syncs your completed offline quiz attempts, past exam scores, XP points, and topic mastery scores to the cloud seamlessly."
        }
    ];

    const structuredFaqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqData.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    };

    return (
        <>
            <Head>
                <title>PassPoint | Offline Learning Platform and AI Tutor for Nigerian Students</title>
                <meta name="description" content="Interactive offline-first learning platform for Nigerian students with AI-powered explanations, adaptive quizzes, curriculum-aligned lessons, and national past questions practice." />
                <meta property="og:title" content="PassPoint: Offline Learning Platform and AI Tutor" />
                <meta property="og:description" content="Study secondary school subjects offline with curriculum lessons, adaptive quizzes, intelligent AI tutoring, and authentic JAMB, WAEC, NECO past questions." />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="PassPoint: Offline Learning Platform and AI Tutor" />
                <meta name="twitter:description" content="Study secondary school subjects offline with curriculum lessons, adaptive quizzes, intelligent AI tutoring, and past questions." />
                <script type="application/ld+json">
                    {JSON.stringify(structuredFaqSchema)}
                </script>
            </Head>

            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] font-sans">
                {/* ── Navbar ─────────────────────────────────── */}
                <header className="sticky top-0 z-50 w-full px-3 sm:px-6 pt-2.5 sm:pt-3 pb-2">
                    <nav className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2 sm:py-3 rounded-2xl bg-[var(--color-surface)]/85 backdrop-blur-xl border border-[var(--color-border)]/70 shadow-lg shadow-black/[0.03] flex items-center justify-between gap-2 transition-all">
                        {/* Brand Logo */}
                        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 group">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-primary)]">PassPoint</span>
                        </Link>

                        {/* Centered Navigation Links (Desktop) */}
                        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--color-muted)]">
                            <a href="#features" className="hover:text-[var(--color-primary)] transition-colors py-1">
                                Features
                            </a>
                            <a href="#past-questions" className="hover:text-[var(--color-primary)] transition-colors py-1">
                                Past Questions
                            </a>
                            <a href="#subjects" className="hover:text-[var(--color-primary)] transition-colors py-1">
                                Subjects
                            </a>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                            <Link
                                href="/login"
                                className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/login"
                                className="px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] shadow-sm hover:shadow-md transition-all active:scale-98 whitespace-nowrap"
                            >
                                Get Started
                            </Link>
                        </div>
                    </nav>
                </header>

                {/* ── Hero ───────────────────────────────────── */}
                <section className="relative overflow-hidden">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-[var(--color-accent)]/5 rounded-full blur-3xl" />

                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--color-primary)] leading-tight">
                            Master Any Subject,<br />
                            <span className="text-[var(--color-accent)]">Even Without Internet</span>
                        </h1>

                        <p className="mt-6 text-lg sm:text-xl text-[var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
                            Interactive offline-first learning platform for Nigerian students with AI-powered explanations, adaptive quizzes, past questions CBT practice, and curriculum-aligned lessons.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                Start Learning Free
                            </Link>
                            <Link
                                href="/past-questions"
                                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-[var(--color-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-all flex items-center justify-center"
                            >
                                Explore Past Questions
                            </Link>
                        </div>

                        {/* Interactive Educational 3D Book Experience */}
                        <InteractiveBookAnimation />

                        {/* Stats */}
                        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
                            <div className="text-center p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
                                <div className="text-2xl font-extrabold text-[var(--color-primary)]">{totalSubjectsCount}+</div>
                                <div className="text-xs font-bold text-[var(--color-muted)] mt-1">Core Subjects</div>
                            </div>
                            <div className="text-center p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
                                <div className="text-2xl font-extrabold text-[var(--color-accent)]">100%</div>
                                <div className="text-xs font-bold text-[var(--color-muted)] mt-1">Offline Capable</div>
                            </div>
                            <div className="text-center p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
                                <div className="text-2xl font-extrabold text-[var(--color-success)]">AI</div>
                                <div className="text-xs font-bold text-[var(--color-muted)] mt-1">Powered Tutor</div>
                            </div>
                            <div className="text-center p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
                                <div className="text-2xl font-extrabold text-[var(--color-primary)]">
                                    {totalPastCount > 0 ? totalPastCount.toLocaleString() + '+' : '4,000+'}
                                </div>
                                <div className="text-xs font-bold text-[var(--color-muted)] mt-1">Past Questions</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── National Past Questions & CBT Hub Showcase ─────────────── */}
                <section id="past-questions" className="py-20 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
                        <div className="text-center max-w-2xl mx-auto space-y-3">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                National Exam Simulation Engine
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-primary)]">
                                Authentic Past Questions for All Major Exams
                            </h2>
                            <p className="text-sm sm:text-base text-[var(--color-muted)] leading-relaxed">
                                Practice thousands of verified questions from real past papers. No scattered PDFs. Everything is organized by exam body and subject with realistic computer-based test practice.
                            </p>
                        </div>

                        {/* Exam Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {examTypes.map((exam) => (
                                <div
                                    key={exam.code}
                                    className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2 min-w-0">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold uppercase border shrink leading-tight truncate max-w-[65%] ${exam.color}`}>
                                                {exam.badge}
                                            </span>
                                            <span className="text-[11px] sm:text-xs font-bold text-[var(--color-muted)] shrink-0 whitespace-nowrap pt-0.5">
                                                {exam.count}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-[var(--color-text)]">
                                            {exam.name}
                                        </h3>
                                        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                            {exam.desc}
                                        </p>
                                    </div>

                                    <div className="pt-3 border-t border-[var(--color-border)]">
                                        <Link
                                            href="/past-questions"
                                            className="w-full py-2.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-primary)] text-[var(--color-primary)] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors border border-[var(--color-border)] flex items-center justify-center gap-1.5"
                                        >
                                            <span>Practice Questions</span>
                                            <span>&rarr;</span>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Where Can It Be Practiced Feature Box */}
                        <div className="p-8 rounded-3xl bg-[var(--color-primary)] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2 max-w-xl text-left">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full inline-block">
                                    Where to Practice
                                </span>
                                <h3 className="text-2xl font-extrabold">
                                    Practice Anywhere: Online or 100% Offline
                                </h3>
                                <p className="text-white/80 text-sm leading-relaxed">
                                    Access the Past Questions Hub on your smartphone, tablet, or PC. Install as a Progressive Web App (PWA) to take complete CBT mock exams and practice step-by-step working with zero internet connection.
                                </p>
                            </div>

                            <Link
                                href="/past-questions"
                                className="shrink-0 px-8 py-3.5 bg-white text-[var(--color-primary)] hover:bg-gray-100 font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all"
                            >
                                Open Past Questions Hub
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Features ───────────────────────────────── */}
                <section id="features" className="py-20 bg-[var(--color-background)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6">
                        <div className="text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)]">
                                Everything You Need to Ace Your Exams
                            </h2>
                            <p className="mt-3 text-[var(--color-muted)] max-w-xl mx-auto">
                                Built for students who want to learn at their own pace, anywhere.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Feature 1 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Offline-First</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Study anywhere, on the bus, in class, or without WiFi. All your past papers, quizzes, progress, and flashcards are stored locally on your device.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">AI Tutor</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Get personalized explanations for every wrong answer. Our AI tutor breaks down complex problems into easy, step-by-step mathematical working.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Timed CBT Simulation</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Realistic exam conditions with countdown timer, question palette, calculator, and post-exam weak-topic diagnostic scorecard.
                                </p>
                            </div>

                            {/* Feature 4 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Track Progress</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    See your mastery grow across every subject. Visual charts show where you're strong and where you need more practice.
                                </p>
                            </div>

                            {/* Feature 5 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Earn XP & Badges</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Stay motivated with gamification. Earn experience points, unlock badges, and maintain streaks as you learn.
                                </p>
                            </div>

                            {/* Feature 6 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Active Flashcards</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Active recall flashcards for quick revision. Perfect for memorizing formulas, definitions, and key concepts.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Subjects Preview ───────────────────────── */}
                <section className="py-20 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)]">
                                15+ Core Subjects Covered
                            </h2>
                            <p className="mt-3 text-[var(--color-muted)]">
                                Aligned with Nigerian secondary curriculum (NERDC, WAEC & JAMB)
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {displaySubjects.map((subject) => (
                                <Link
                                    key={subject.id}
                                    href="/login"
                                    className="p-5 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] text-center hover:shadow-lg transition-all duration-200 group block cursor-pointer"
                                >
                                    <div className="mb-3 flex items-center justify-center h-12 w-12 rounded-xl bg-[var(--color-surface)] group-hover:scale-110 transition-transform mx-auto border border-[var(--color-border)]">
                                        {getSubjectIcon(subject.name)}
                                    </div>
                                    <div className="text-sm font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
                                        {subject.name}
                                    </div>
                                    {subject.topics_count !== undefined && (
                                        <span className="inline-block mt-1 text-[11px] font-semibold text-[var(--color-muted)]">
                                            {subject.topics_count} topics
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Frequently Asked Questions ── */}
                <section className="py-20 bg-[var(--color-background)] border-b border-[var(--color-border)]" aria-labelledby="faq-heading">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6">
                        <div className="text-center mb-12">
                            <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)]">
                                Frequently Asked Questions
                            </h2>
                            <p className="mt-3 text-[var(--color-muted)] text-base">
                                Everything you need to know about practicing past questions and learning offline with PassPoint.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {faqData.map((item, index) => (
                                <details
                                    key={index}
                                    className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 transition-all [&_summary::-webkit-details-marker]:hidden"
                                    open={index === 0 || index === 1}
                                >
                                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 text-[var(--color-text)] font-semibold text-lg hover:text-[var(--color-primary)] transition-colors">
                                        <h3 className="text-lg font-bold text-[var(--color-primary)]">
                                            {item.question}
                                        </h3>
                                        <span className="shrink-0 rounded-full bg-[var(--color-background)] p-1.5 text-[var(--color-primary)] group-open:-rotate-180 transition-transform duration-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <p className="mt-4 text-sm sm:text-base text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)] pt-4">
                                        {item.answer}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ────────────────────────────────────── */}
                <section className="py-20 bg-[var(--color-primary)]">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white">
                            Ready to Ace Your Next Exam?
                        </h2>
                        <p className="mt-4 text-[var(--color-primary-light)] text-lg">
                            Join thousands of students practicing past questions and mastering curriculum topics with PassPoint.
                            No credit card required. 100% Offline ready.
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[var(--color-primary)] bg-white rounded-xl hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all"
                            >
                                Start Learning Free
                            </Link>
                            <Link
                                href="/past-questions"
                                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-white/15 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                            >
                                Practice Past Questions
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Footer ─────────────────────────────────── */}
                <footer className="py-10 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="font-bold text-[var(--color-primary)]">PassPoint</span>
                        </div>
                        <p className="text-sm text-[var(--color-muted)]">
                            Offline-first adaptive learning and national past questions CBT engine.
                        </p>
                        <p className="text-xs text-[var(--color-muted)]/60 mt-4">
                            © {new Date().getFullYear()} PassPoint. Built for learners, by learners.
                        </p>
                    </div>
                </footer>

                {/* In-App PWA Install Banner */}
                <PWAInstallPrompt />
            </div>
        </>
    );
}
