import { Head, Link } from '@inertiajs/react';
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt';

export default function Welcome() {
    return (
        <>
            <Head title="AILEARN — Offline-First Adaptive Learning" />

            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] font-sans">
                {/* ── Navbar ─────────────────────────────────── */}
                <nav className="w-full border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-md">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-[var(--color-primary)]">AILEARN</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/login"
                                className="px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/login"
                                className="px-5 py-2 text-sm font-semibold text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] shadow-md transition-all"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </nav>

                {/* ── Hero ───────────────────────────────────── */}
                <section className="relative overflow-hidden">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-[var(--color-accent)]/5 rounded-full blur-3xl" />

                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs font-semibold mb-6">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
                            Works offline, study anywhere
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--color-primary)] leading-tight">
                            Learn Smarter,<br />
                            <span className="text-[var(--color-accent)]">Even Without Internet</span>
                        </h1>

                        <p className="mt-6 text-lg sm:text-xl text-[var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
                            An AI-powered adaptive learning platform that works completely offline.
                            Take quizzes, track your progress, and get personalized tutoring, no connection required.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-white bg-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg hover:shadow-xl transition-all"
                            >
                                Start Learning Free
                            </Link>
                            <a
                                href="#features"
                                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-[var(--color-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-all"
                            >
                                See How It Works
                            </a>
                        </div>

                        {/* Stats */}
                        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[var(--color-primary)]">100%</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1">Offline Ready</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[var(--color-accent)]">AI</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1">Smart Tutoring</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[var(--color-success)]">∞</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1">Practice Quizzes</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[var(--color-primary)]">Free</div>
                                <div className="text-xs text-[var(--color-muted)] mt-1">No Subscriptions</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Features ───────────────────────────────── */}
                <section id="features" className="py-20 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
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
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Offline-First</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Study anywhere, on the bus, in class, or without WiFi. All your quizzes, progress, and flashcards are stored locally on your device.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">AI Tutor</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Get personalized explanations for every wrong answer. Our AI tutor breaks down complex problems into easy, step-by-step solutions.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Adaptive Quizzes</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Quizzes that get harder when you're doing well and easier when you need practice. The system adapts to your mastery level in real-time.
                                </p>
                            </div>

                            {/* Feature 4 */}
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
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
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
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
                            <div className="p-6 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">Flashcards</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Active recall flashcards for quick revision. Perfect for memorizing formulas, definitions, and key concepts.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── How It Works ───────────────────────────── */}
                <section className="py-20 bg-[var(--color-background)]">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6">
                        <div className="text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)]">
                                How It Works
                            </h2>
                            <p className="mt-3 text-[var(--color-muted)]">
                                Three simple steps to start learning smarter
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center text-xl font-bold mx-auto shadow-lg">
                                    1
                                </div>
                                <h3 className="mt-5 text-lg font-bold text-[var(--color-text)]">Pick a Subject</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Choose from Mathematics, Science, English, and more. Browse topics within each subject.
                                </p>
                            </div>

                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)] text-white flex items-center justify-center text-xl font-bold mx-auto shadow-lg">
                                    2
                                </div>
                                <h3 className="mt-5 text-lg font-bold text-[var(--color-text)]">Take Adaptive Quizzes</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Answer questions at your level. The AI adjusts difficulty based on your performance in real-time.
                                </p>
                            </div>

                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--color-success)] text-white flex items-center justify-center text-xl font-bold mx-auto shadow-lg">
                                    3
                                </div>
                                <h3 className="mt-5 text-lg font-bold text-[var(--color-text)]">Master & Level Up</h3>
                                <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
                                    Get AI explanations for mistakes, earn XP, unlock badges, and watch your mastery grow.
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
                                Subjects Available
                            </h2>
                            <p className="mt-3 text-[var(--color-muted)]">
                                Comprehensive curriculum coverage for your exams
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[
                                { name: 'Mathematics', emoji: '📐', color: 'var(--color-primary)' },
                                { name: 'Further Maths', emoji: '📊', color: 'var(--color-accent)' },
                                { name: 'Physics', emoji: '⚛️', color: 'var(--color-success)' },
                                { name: 'Chemistry', emoji: '🧪', color: 'var(--color-primary-light)' },
                                { name: 'Biology', emoji: '🧬', color: 'var(--color-success)' },
                                { name: 'English', emoji: '📖', color: 'var(--color-accent)' },
                                { name: 'Economics', emoji: '📈', color: 'var(--color-primary)' },
                                { name: 'Literature', emoji: '✍️', color: 'var(--color-primary-light)' },
                            ].map((subject) => (
                                <div
                                    key={subject.name}
                                    className="p-4 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-center hover:shadow-md transition-shadow cursor-default"
                                >
                                    <div className="text-3xl mb-2">{subject.emoji}</div>
                                    <div className="text-sm font-semibold text-[var(--color-text)]">{subject.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ────────────────────────────────────── */}
                <section className="py-20 bg-[var(--color-primary)]">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white">
                            Ready to Start Learning?
                        </h2>
                        <p className="mt-4 text-[var(--color-primary-light)] text-lg">
                            Join students who are already improving their grades with AILEARN.
                            No credit card. No subscription. Just learning.
                        </p>
                        <div className="mt-8">
                            <Link
                                href="/login"
                                className="inline-flex items-center px-10 py-4 text-lg font-bold text-[var(--color-primary)] bg-white rounded-xl hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all"
                            >
                                Get Started, It's Free
                                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
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
                            <span className="font-bold text-[var(--color-primary)]">AILEARN</span>
                        </div>
                        <p className="text-sm text-[var(--color-muted)]">
                            Offline-first adaptive learning for every student.
                        </p>
                        <p className="text-xs text-[var(--color-muted)]/60 mt-4">
                            © {new Date().getFullYear()} AILEARN. Built for learners, by learners.
                        </p>
                    </div>
                </footer>

                {/* In-App PWA Install Banner */}
                <PWAInstallPrompt />
            </div>
        </>
    );
}
