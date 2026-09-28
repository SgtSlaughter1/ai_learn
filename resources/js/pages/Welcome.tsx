import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { InteractiveBookAnimation } from '@/components/landing/InteractiveBookAnimation';
import FeedbackSection from '@/components/feedback/FeedbackSection';
import FeedbackModal from '@/components/feedback/FeedbackModal';

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
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        );
    }
    if (lower.includes('physic') || lower.includes('energy') || lower.includes('force')) {
        return (
            <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        );
    }
    if (lower.includes('chem') || lower.includes('lab') || lower.includes('element')) {
        return (
            <svg className="w-5 h-5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        );
    }
    if (lower.includes('bio') || lower.includes('life') || lower.includes('genet') || lower.includes('health') || lower.includes('agric')) {
        return (
            <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        );
    }
    if (lower.includes('eng') || lower.includes('lang') || lower.includes('gramm') || lower.includes('vocab')) {
        return (
            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
        );
    }
    if (lower.includes('econ') || lower.includes('commerc') || lower.includes('financ') || lower.includes('account') || lower.includes('busin')) {
        return (
            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        );
    }
    return (
        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
    );
}

export default function Welcome({ subjects = [], stats }: WelcomeProps) {
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

    const rawSubjects = subjects.length > 0 ? subjects : [
        { id: 1, name: 'Mathematics', topics_count: 8 },
        { id: 2, name: 'English Language', topics_count: 8 },
        { id: 3, name: 'Physics', topics_count: 6 },
        { id: 4, name: 'Chemistry', topics_count: 6 },
        { id: 5, name: 'Biology', topics_count: 7 },
        { id: 6, name: 'Economics', topics_count: 5 },
        { id: 7, name: 'Government', topics_count: 5 },
        { id: 8, name: 'Financial Accounting', topics_count: 6 },
    ];

    // Deduplicate subjects by unique name so multiple school classes do not show duplicate cards
    const uniqueSubjectsMap = new Map<string, SubjectItem>();
    for (const s of rawSubjects) {
        const key = s.name.trim().toLowerCase();
        if (!uniqueSubjectsMap.has(key)) {
            uniqueSubjectsMap.set(key, s);
        } else {
            const existing = uniqueSubjectsMap.get(key)!;
            if ((s.topics_count || 0) > (existing.topics_count || 0)) {
                uniqueSubjectsMap.set(key, s);
            }
        }
    }
    const displaySubjects = Array.from(uniqueSubjectsMap.values());

    const examCounts = stats?.exam_counts || {};
    const totalPastCount = stats?.total_past_questions ?? Object.values(examCounts).reduce((a, b) => a + b, 0);

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
            desc: 'Computer based test questions with instant explanations and timer practice.',
            badge: 'UTME CBT',
            count: formatQuestionCount(examCounts['jamb'] ?? 1500, '1,500+ Questions'),
            color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        },
        {
            code: 'waec',
            name: 'WAEC (WASSCE)',
            desc: 'Senior secondary past questions with step by step mathematical working.',
            badge: 'WASSCE',
            count: formatQuestionCount(examCounts['waec'] ?? 1200, '1,200+ Questions'),
            color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        },
        {
            code: 'neco',
            name: 'NECO (SSCE)',
            desc: 'National examination past papers categorized by syllabus topic.',
            badge: 'NECO SSCE',
            count: formatQuestionCount(examCounts['neco'] ?? 900, '900+ Questions'),
            color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        },
        {
            code: 'post_utme',
            name: 'Post-UTME Screening',
            desc: 'University entrance screening practice for Nigerian universities.',
            badge: 'Screening',
            count: formatQuestionCount(examCounts['post_utme'] ?? 400, '400+ Questions'),
            color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        },
    ];

    const faqData = [
        {
            question: "How does AceDrill work without an internet connection?",
            answer: "AceDrill is built as a Progressive Web App. When you open the platform, lesson notes, flashcards, practice quizzes, and past questions are saved securely on your phone, tablet, or computer. You can practice and learn anywhere even in airplane mode."
        },
        {
            question: "Can I practice actual WAEC, JAMB, and NECO past questions?",
            answer: "Yes. AceDrill includes verified past questions organized by subject, year, and topic. Each question includes step by step explanations so you understand the concepts behind every answer."
        },
        {
            question: "Does the AI tutor work when my data is turned off?",
            answer: "Yes. AceDrill contains an offline explanation engine and formula guide that provides step by step math working and concept breakdowns without connecting to the internet."
        },
        {
            question: "How do teachers and schools track student progress?",
            answer: "Teachers and school administrators have dedicated portals with class mastery analytics, automated grading, and test reports. Student scores recorded offline automatically sync to school records when a connection is available."
        },
        {
            question: "Is there any cost to get started?",
            answer: "Students can sign up and start practicing core subjects, flashcards, and past questions for free. Schools and tutorial centres can request a pilot deployment for multi-class management and offline campus servers."
        }
    ];

    return (
        <>
            <Head>
                <title>AceDrill | Offline Learning Platform and AI Tutor for Students</title>
                <meta name="description" content="Master secondary school subjects and practice WAEC, JAMB, and NECO exams offline. Step by step AI explanations, active recall flashcards, and authentic CBT past questions." />
                <meta property="og:title" content="AceDrill: Offline Learning Platform & AI Tutor" />
                <meta property="og:description" content="Study secondary school subjects offline with curriculum lessons, quizzes, AI explanations, and past questions." />
            </Head>

            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] font-sans antialiased">
                {/* ── 1. NAVBAR (CLEAN & UNCONGESTED) ─────────────── */}
                <header className="sticky top-0 z-50 w-full px-4 sm:px-6 pt-3 pb-2">
                    <nav className="max-w-6xl mx-auto px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] shadow-sm flex items-center justify-between gap-2 sm:gap-4">
                        {/* Brand Logo */}
                        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white shadow-xs">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-base sm:text-lg font-black tracking-tight text-[var(--color-primary)] leading-none">AceDrill</span>
                                <span className="text-[9px] sm:text-[10px] font-semibold text-[var(--color-muted)]">Offline Learning</span>
                            </div>
                        </Link>

                        {/* Navigation Links (Clean & Short) */}
                        <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--color-muted)]">
                            <a href="#features" className="hover:text-[var(--color-primary)] transition-colors">
                                Features
                            </a>
                            <a href="#past-questions" className="hover:text-[var(--color-primary)] transition-colors">
                                Past Questions
                            </a>
                            <a href="#faqs" className="hover:text-[var(--color-primary)] transition-colors">
                                FAQs
                            </a>
                            <a href="#feedback" className="hover:text-[var(--color-primary)] transition-colors">
                                Feedback
                            </a>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                            <ThemeToggle />
                            <Link
                                href="/login"
                                className="hidden sm:inline-block px-3 py-1.5 text-xs sm:text-sm font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors whitespace-nowrap"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/login"
                                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
                            >
                                <span className="sm:hidden">Get Started</span>
                                <span className="hidden sm:inline">Get Started Free</span>
                            </Link>
                        </div>
                    </nav>
                </header>

                {/* ── 2. HERO SECTION ───────────────────────────── */}
                <section className="pt-10 sm:pt-16 pb-16 sm:pb-20 border-b border-[var(--color-border)]">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        {/* Main Value Headline */}
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[var(--color-text)] leading-tight max-w-4xl mx-auto">
                            Ace School Exams and National Exams, <br className="hidden sm:inline" />
                            <span className="text-[var(--color-primary)]">Even Without Internet.</span>
                        </h1>

                        {/* Simple Subtitle */}
                        <p className="mt-5 text-base sm:text-lg text-[var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
                            Master curriculum topics, review active recall flashcards, and practice authentic WAEC, JAMB, and NECO past questions on any device without internet data.
                        </p>

                        {/* CTAs */}
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md sm:max-w-none mx-auto">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <span>Start Learning Free</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </Link>

                            <Link
                                href="/past-questions"
                                className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <span>Practice Past Questions</span>
                            </Link>
                        </div>

                        {/* Interactive Animation */}
                        <div className="mt-8">
                            <InteractiveBookAnimation />
                        </div>
                    </div>
                </section>

                {/* ── 3. SOCIAL PROOF & STANDARDS ───────────────── */}
                <section className="py-12 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Standard Cards with clean SVG icons */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto mb-10">
                            {[
                                {
                                    name: 'WAEC / WASSCE',
                                    sub: 'Senior School Certificate',
                                    icon: (
                                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    ),
                                },
                                {
                                    name: 'JAMB / UTME',
                                    sub: 'National CBT Screening',
                                    icon: (
                                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                    ),
                                },
                                {
                                    name: 'NECO SSCE',
                                    sub: 'Senior Secondary Syllabus',
                                    icon: (
                                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    ),
                                },
                            ].map((badge, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] flex items-center gap-3"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                                        {badge.icon}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-[var(--color-text)] leading-tight">{badge.name}</p>
                                        <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{badge.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Impact Numbers */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 sm:p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)]">
                            <div className="text-center p-2">
                                <div className="text-2xl sm:text-3xl font-black text-[var(--color-primary)]">
                                    {totalPastCount > 0 ? `${totalPastCount.toLocaleString()}+` : '4,000+'}
                                </div>
                                <div className="text-xs text-[var(--color-muted)] mt-1 font-medium">Past Exam Questions</div>
                            </div>
                            <div className="text-center p-2 border-l border-[var(--color-border)]">
                                <div className="text-2xl sm:text-3xl font-black text-[var(--color-success)]">100%</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1 font-medium">Offline Capable</div>
                            </div>
                            <div className="text-center p-2 border-l border-[var(--color-border)]">
                                <div className="text-xl sm:text-2xl font-black text-[var(--color-accent)] leading-tight pt-1">Complete</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1 font-medium">Curriculum Coverage</div>
                            </div>
                            <div className="text-center p-2 border-l border-[var(--color-border)]">
                                <div className="text-2xl sm:text-3xl font-black text-[var(--color-primary)]">94%</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1 font-medium">Practice Completion Rate</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 4. PROBLEM STATEMENT ───────────────────────── */}
                <section id="problem" className="py-16 sm:py-20 bg-[var(--color-background)] border-b border-[var(--color-border)]">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] tracking-tight">
                                Built for Real Classroom and Home Challenges
                            </h2>
                            <p className="mt-3 text-sm sm:text-base text-[var(--color-muted)]">
                                Studying should not stop because of high data costs, poor network, or lack of step by step explanations.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                            {/* Without AceDrill */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">Traditional Study Hurdles</h3>
                                </div>

                                <ul className="space-y-3 text-xs sm:text-sm text-[var(--color-muted)]">
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-red-500 font-bold shrink-0">•</span>
                                        <span>Schools struggle to run CBT tests in computer labs due to fragile local networks and server downtime.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-red-500 font-bold shrink-0">•</span>
                                        <span>Learning apps freeze when mobile data expires or internet signal drops at home.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-red-500 font-bold shrink-0">•</span>
                                        <span>Paper past questions often lack detailed mathematical working and explanations.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-red-500 font-bold shrink-0">•</span>
                                        <span>Students enter national CBT exam halls without practicing under timed conditions.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* With AceDrill */}
                            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-primary)]/40 space-y-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">The AceDrill Way</h3>
                                </div>

                                <ul className="space-y-3 text-xs sm:text-sm text-[var(--color-muted)]">
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                                        <span>Runs smoothly on any school computer lab or personal device without complex local networks.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                                        <span>Lessons, flashcards, and quizzes work 100% offline without requiring internet data.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                                        <span>Step by step math derivations and clear tips for every single question.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                                        <span>Realistic CBT simulations build test speed and exam confidence.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 5. FEATURES (CLEAN, SHORT & CONCISE) ─────────── */}
                <section id="features" className="py-16 sm:py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] tracking-tight">
                                Five Core Features Built for Exam Success
                            </h2>
                            <p className="mt-2 text-sm sm:text-base text-[var(--color-muted)]">
                                Everything you need to master topics, revise effectively, and practice past papers.
                            </p>
                        </div>

                        {/* Clean 3-Column / 2-Column Responsive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Feature 1 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors">
                                <div className="space-y-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] flex items-center justify-center font-bold">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        Offline AI Step by Step Explanations
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                        Get instant mathematical working and concept tips whenever you get stuck, without needing internet data.
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-primary)]">
                                    Benefit: Private tutor guidance available anytime.
                                </div>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors">
                                <div className="space-y-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-10)] text-[var(--color-accent)] flex items-center justify-center font-bold">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        National Past Questions CBT
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                        Practice verified JAMB, WAEC, and NECO papers with real exam timers and on-screen calculators.
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-accent)]">
                                    Benefit: Builds real test speed and removes exam anxiety.
                                </div>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors">
                                <div className="space-y-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center font-bold">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        Active Recall Flashcards
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                        Smart flashcards schedule reviews to help you memorize key formulas, scientific laws, and definitions.
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-success)]">
                                    Benefit: Long-term memory retention for exam day.
                                </div>
                            </div>

                            {/* Feature 4 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors">
                                <div className="space-y-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] flex items-center justify-center font-bold">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        Teacher Analytics Portal
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                        Educators can see classroom topic mastery, auto-grade quizzes, and spot weak areas early.
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-primary)]">
                                    Benefit: Saves hours on grading and targets revision.
                                </div>
                            </div>

                            {/* Feature 5 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors md:col-span-2 lg:col-span-2">
                                <div className="space-y-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-10)] text-[var(--color-accent)] flex items-center justify-center font-bold">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">
                                        School Campus Deployment and Sync
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                        Deploy across computer labs without continuous internet. Test attempts and grades sync safely whenever connected.
                                    </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-accent)]">
                                    Benefit: Easy lab setup without expensive dedicated broadband.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 6. HOW IT WORKS ────────────────────────────── */}
                <section id="how-it-works" className="py-16 sm:py-20 bg-[var(--color-background)] border-b border-[var(--color-border)]">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] tracking-tight">
                                How It Works in 4 Steps
                            </h2>
                            <p className="mt-2 text-sm sm:text-base text-[var(--color-muted)]">
                                Get started in seconds on your mobile phone, tablet, or laptop.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                {
                                    step: '1',
                                    title: 'Open or Install',
                                    desc: 'Access in your browser and tap install to save the app on your home screen.',
                                },
                                {
                                    step: '2',
                                    title: 'Study Offline',
                                    desc: 'Read lesson notes, flip active recall flashcards, and take quizzes without internet data.',
                                },
                                {
                                    step: '3',
                                    title: 'Get AI Guidance',
                                    desc: 'See step by step mathematical working and tips for difficult questions.',
                                },
                                {
                                    step: '4',
                                    title: 'Sync Progress',
                                    desc: 'Your scores and study milestones sync automatically when you reconnect.',
                                },
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between"
                                >
                                    <div>
                                        <span className="w-8 h-8 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center text-sm font-black text-[var(--color-primary)] mb-3">
                                            {item.step}
                                        </span>
                                        <h3 className="text-sm font-bold text-[var(--color-text)] mb-1.5">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 7. NATIONAL PAST QUESTIONS CBT ─────────────── */}
                <section id="past-questions" className="py-16 sm:py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-2xl sm:text-4xl font-black text-[var(--color-text)] tracking-tight">
                                National Past Questions CBT Hub
                            </h2>
                            <p className="mt-2 text-sm sm:text-base text-[var(--color-muted)]">
                                Practice real past papers under actual computer-based test conditions.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                            {examTypes.map((exam) => (
                                <div
                                    key={exam.code}
                                    className="p-5 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] flex flex-col justify-between space-y-3"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${exam.color}`}>
                                                {exam.badge}
                                            </span>
                                            <span className="text-[11px] font-medium text-[var(--color-muted)]">
                                                {exam.count}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-bold text-[var(--color-text)]">
                                            {exam.name}
                                        </h3>
                                        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                            {exam.desc}
                                        </p>
                                    </div>

                                    <div className="pt-3 border-t border-[var(--color-border)]">
                                        <Link
                                            href={`/past-questions?exam=${exam.code}`}
                                            className="w-full py-2 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-primary)] text-[var(--color-primary)] hover:text-white font-bold text-xs transition-colors border border-[var(--color-border)] flex items-center justify-center gap-1.5"
                                        >
                                            <span>Practice Questions</span>
                                            <span>&rarr;</span>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Banner */}
                        <div className="p-6 sm:p-8 rounded-2xl bg-[var(--color-primary)] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                            <div className="space-y-1.5 text-center sm:text-left">
                                <h3 className="text-xl sm:text-2xl font-bold">
                                    Practice 4,000+ Past Questions Completely Offline
                                </h3>
                                <p className="text-white/80 text-xs sm:text-sm">
                                    Full timed CBT mocks with question palettes, calculators, and step by step working.
                                </p>
                            </div>

                            <Link
                                href="/past-questions"
                                className="shrink-0 px-6 py-3 bg-white text-[var(--color-primary)] hover:bg-gray-100 font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-xs"
                            >
                                Open Past Questions Hub
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── 8. SUBJECTS PREVIEW SHOWCASE ──────────────── */}
                <section id="subjects" className="py-16 sm:py-20 bg-[var(--color-background)] border-b border-[var(--color-border)]">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-10">
                            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight">
                                Core Secondary Subjects
                            </h2>
                            <p className="mt-2 text-sm text-[var(--color-muted)]">
                                Syllabus aligned topic mastery across Science, Commercial, and Art disciplines.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 max-w-4xl mx-auto">
                            {displaySubjects.map((subject) => (
                                <Link
                                    key={subject.id}
                                    href="/login"
                                    className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-center transition-colors block cursor-pointer"
                                >
                                    <div className="mb-2 flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--color-background)] mx-auto border border-[var(--color-border)]">
                                        {getSubjectIcon(subject.name)}
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-[var(--color-text)] line-clamp-1">
                                        {subject.name}
                                    </div>
                                    {subject.topics_count !== undefined && (
                                        <span className="inline-block mt-0.5 text-[10px] text-[var(--color-muted)]">
                                            {subject.topics_count} topics
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── 9. FAQS ───────────────────────────────────── */}
                <section id="faqs" className="py-16 sm:py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight">
                                Frequently Asked Questions
                            </h2>
                            <p className="mt-2 text-sm text-[var(--color-muted)]">
                                Learn more about learning offline and practicing past questions with AceDrill.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {faqData.map((item, index) => {
                                const isOpen = openFaq === index;
                                return (
                                    <div
                                        key={index}
                                        className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl overflow-hidden transition-colors"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setOpenFaq(isOpen ? null : index)}
                                            className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                                        >
                                            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">
                                                {item.question}
                                            </h3>
                                            <span className={`w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0 text-[var(--color-primary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="px-5 pb-5 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)]/60 pt-3">
                                                {item.answer}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── 10. FEEDBACK SECTION (CLEAN & SIMPLE) ───────── */}
                <FeedbackSection />

                {/* ── 11. FINAL CTA & BRAND HORIZON (FREEBUFF-INSPIRED) ── */}
                <section className="relative overflow-hidden pt-20 sm:pt-28 pb-10 bg-[#0B130E] text-white border-t border-white/10">
                    {/* Subtle Atmospheric Gradient & Glow */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-600/15 rounded-full blur-[120px]" />
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[900px] h-[250px] bg-emerald-900/20 rounded-full blur-[100px]" />
                    </div>

                    <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
                        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white">
                            Master School & National Exams, Even Without Internet.
                        </h2>

                        <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto leading-relaxed">
                            Curriculum-aligned topics, active recall flashcards, and authentic past questions on any device without data fees.
                        </p>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md sm:max-w-none mx-auto">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-[#0B130E] bg-white hover:bg-gray-100 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                            >
                                Start Learning Free →
                            </Link>

                            <Link
                                href="/past-questions"
                                className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl transition-all"
                            >
                                Practice Past Questions
                            </Link>
                        </div>
                    </div>

                    {/* Massive Brand Watermark Horizon */}
                    <div className="relative mt-16 sm:mt-24 mb-2 sm:mb-4 select-none pointer-events-none flex justify-center items-center overflow-hidden">
                        <div className="text-center font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/35 via-white/15 to-transparent text-[16vw] sm:text-[15vw] md:text-[14vw] lg:text-[13rem] xl:text-[15rem] leading-none uppercase scale-y-95">
                            AceDrill
                        </div>
                    </div>

                    {/* Sleek Minimalist Footer Bar */}
                    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-white/10">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-400">
                            {/* Left: Navigation Links */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2">
                                <a href="#features" className="hover:text-white transition-colors">Features</a>
                                <Link href="/past-questions" className="hover:text-white transition-colors">Past Questions</Link>
                                <Link href="/past-questions?exam=waec" className="hover:text-white transition-colors">WAEC</Link>
                                <Link href="/past-questions?exam=jamb" className="hover:text-white transition-colors">JAMB</Link>
                                <Link href="/past-questions?exam=neco" className="hover:text-white transition-colors">NECO</Link>
                                <button
                                    type="button"
                                    onClick={() => setIsFeedbackModalOpen(true)}
                                    className="hover:text-white transition-colors cursor-pointer"
                                >
                                    Feedback
                                </button>
                                <Link href="/login" className="hover:text-white transition-colors">Privacy Policy</Link>
                                <Link href="/login" className="hover:text-white transition-colors">Terms of Service</Link>
                            </div>

                            {/* Right: Copyright & Status */}
                            <div className="flex items-center gap-4 text-gray-400 shrink-0">
                                <span>© {new Date().getFullYear()} AceDrill. All rights reserved.</span>
                                <span className="hidden sm:inline-block text-white/20">|</span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Offline Ready
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Floating Feedback Launcher Button (Clean, no emoji) */}
                <div className="fixed bottom-6 right-6 z-40">
                    <button
                        type="button"
                        onClick={() => setIsFeedbackModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-text)] rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer backdrop-blur-md text-xs font-bold"
                        aria-label="Send Feedback"
                        title="Give Feedback or Report an Issue"
                    >
                        <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span>Feedback</span>
                    </button>
                </div>

                {/* Feedback Modal */}
                <FeedbackModal
                    isOpen={isFeedbackModalOpen}
                    onClose={() => setIsFeedbackModalOpen(false)}
                />

                {/* In-App PWA Install Banner */}
                <PWAInstallPrompt />
            </div>
        </>
    );
}
