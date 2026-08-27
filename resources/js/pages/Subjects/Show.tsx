import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';

import { db } from '@/db/database';

interface TopicProgress {
    questions_attempted: number;
    questions_correct: number;
    mastery_score: number;
}

interface Topic {
    id: number;
    subject_id: number;
    name: string;
    slug: string;
    level: string;
    description: string | null;
    progress: TopicProgress | null;
}

interface Subject {
    id: number;
    name: string;
    slug: string;
    description: string | null;
}

interface Quiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
}

interface Props {
    slug: string;
}

export default function Show({ slug }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [subject, setSubject] = useState<Subject | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    
    const [selectedLevel, setSelectedLevel] = useState<string>('all');

    useEffect(() => {
        let isMounted = true;

        async function loadSubjectDetails() {
            // 1. Try reading from Dexie first (instant offline/cached render)
            try {
                const localSubject = await db.subjects.where('slug').equals(slug).first();
                if (localSubject && isMounted) {
                    setSubject(localSubject);
                    const localTopics = await db.topics.where('subject_id').equals(localSubject.id).toArray();
                    if (localTopics.length > 0 && isMounted) {
                        setTopics(
                            localTopics.map((t: any) => ({
                                id: t.id,
                                subject_id: t.subject_id,
                                name: t.name,
                                slug: t.slug,
                                level: t.level,
                                description: t.description,
                                progress: t.progress || null,
                            }))
                        );
                    }
                    const localQuizzes = await db.quizzes.toArray();
                    if (localQuizzes.length > 0 && isMounted) {
                        setQuizzes(
                            localQuizzes.map((q: any) => ({
                                id: q.id,
                                title: q.title,
                                description: q.description,
                                time_limit_minutes: q.time_limit_minutes,
                            }))
                        );
                    }
                    setLoading(false);
                }
            } catch (e) {
                console.error('Dexie subject read error:', e);
            }

            // 2. Fetch fresh data from network if online
            try {
                const res = await fetch(`/api/v1/subjects/${slug}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setSubject(data.subject);
                        setTopics(data.topics || []);
                        setQuizzes(data.quizzes || []);
                        setLoading(false);
                    }
                    // Cache in Dexie for offline use
                    if (data.subject) {
                        await db.subjects.put({
                            ...data.subject,
                            status: 'published',
                            sort_order: 0,
                            cached_at: new Date().toISOString(),
                        });
                    }
                    if (data.topics && data.topics.length > 0) {
                        await db.topics.bulkPut(
                            data.topics.map((t: any) => ({
                                ...t,
                                status: 'published',
                                sort_order: 0,
                                cached_at: new Date().toISOString(),
                            }))
                        );
                    }
                    if (data.quizzes && data.quizzes.length > 0) {
                        await db.quizzes.bulkPut(
                            data.quizzes.map((q: any) => ({
                                ...q,
                                status: 'published',
                                cached_at: new Date().toISOString(),
                                questions: q.questions || [],
                            }))
                        );
                    }
                }
            } catch (err) {
                console.log('Offline mode — loaded subject details from local database');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadSubjectDetails();

        return () => {
            isMounted = false;
        };
    }, [slug]);

    // Extract unique levels present in topics for filter tabs
    const uniqueLevels = ['all', ...Array.from(new Set(topics.map((t) => t.level)))];

    const filteredTopics = selectedLevel === 'all'
        ? topics
        : topics.filter((t) => t.level === selectedLevel);

    const getProgressStatus = (progress: TopicProgress | null) => {
        if (!progress || progress.questions_attempted === 0) {
            return { label: 'Not Started', class: 'bg-[var(--color-primary-5)] text-[var(--color-muted)] border-[var(--color-border)]' };
        }
        if (progress.mastery_score >= 80) {
            return { label: 'Mastered', class: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' };
        }
        return { label: 'In Progress', class: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20' };
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-[var(--color-muted)]">
                        <Link href="/subjects" className="hover:text-[var(--color-primary)] transition-colors">Subjects</Link>
                        <span>&gt;</span>
                        <span className="text-[var(--color-text)]">{loading ? 'Loading...' : subject?.name}</span>
                    </div>
                    {loading ? (
                        <div className="space-y-2.5">
                            <div className="h-8 bg-[var(--color-surface)] rounded w-1/4 animate-pulse" />
                            <div className="h-4 bg-[var(--color-surface)] rounded w-1/2 animate-pulse" />
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">{subject?.name}</h1>
                            <p className="text-[var(--color-muted)] max-w-3xl leading-relaxed">{subject?.description}</p>
                        </>
                    )}
                </div>
            }
        >
            <Head title={loading ? 'Loading Subject...' : subject?.name || 'Subject'} />

            <div className="space-y-12">
                {/* Level Filter Tabs */}
                {!loading && uniqueLevels.length > 2 && (
                    <div className="flex space-x-1.5 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl max-w-md animate-fade-in">
                        {uniqueLevels.map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setSelectedLevel(lvl)}
                                className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all focus:outline-none min-h-[40px] ${
                                    selectedLevel === lvl
                                        ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/10'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)]/40'
                                }`}
                            >
                                {lvl === 'all' ? 'All Levels' : lvl}
                            </button>
                        ))}
                    </div>
                )}

                {/* Topics List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-[var(--color-text)] tracking-tight">Curriculum Topics</h2>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2].map((n) => (
                                <div
                                    key={n}
                                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 h-[110px] animate-pulse flex items-center justify-between"
                                >
                                    <div className="space-y-2.5 flex-1">
                                        <div className="h-4 bg-[var(--color-background)]/80 rounded w-12" />
                                        <div className="h-5 bg-[var(--color-background)]/80 rounded w-1/3" />
                                        <div className="h-4 bg-[var(--color-background)]/80 rounded w-2/3" />
                                    </div>
                                    <div className="h-10 bg-[var(--color-background)]/80 rounded-xl w-32 shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : filteredTopics.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/10">
                            <p className="text-[var(--color-muted)]">No topics are currently published under this level.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTopics.map((topic) => {
                                const status = getProgressStatus(topic.progress);
                                return (
                                    <div
                                        key={topic.id}
                                        className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-border)]/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                                    >
                                        <div className="space-y-2.5 flex-1">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                                                    {topic.level}
                                                </span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${status.class}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-[var(--color-text)]">{topic.name}</h3>
                                            <p className="text-sm text-[var(--color-muted)] leading-relaxed max-w-3xl">
                                                {topic.description}
                                            </p>
                                        </div>

                                        {/* Progress Statistics & CTA */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:justify-end">
                                            {topic.progress && topic.progress.questions_attempted > 0 && (
                                                <div className="text-sm border-l-2 border-[var(--color-border)] pl-4 space-y-0.5">
                                                    <span className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Topic Stats</span>
                                                    <span className="block font-bold text-[var(--color-text)]">
                                                        Mastery: {topic.progress.mastery_score}%
                                                    </span>
                                                    <span className="block text-xs text-[var(--color-muted)]">
                                                        {topic.progress.questions_correct}/{topic.progress.questions_attempted} Correct
                                                    </span>
                                                </div>
                                            )}

                                            {quizzes.length > 0 ? (
                                                <Link
                                                    href={`/quizzes/${quizzes[0].id}`}
                                                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none min-h-[48px] cursor-pointer"
                                                >
                                                    Take Exercise
                                                </Link>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl opacity-50 min-h-[48px] cursor-not-allowed"
                                                >
                                                    No Exercises
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Available Quizzes & Assessments Section */}
                <div className="space-y-6 pt-8 border-t border-[var(--color-border)]">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">Assessments & Quizzes</h2>
                        <p className="text-sm text-[var(--color-muted)]">Evaluate your overall subject mastery with these evaluations.</p>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2].map((n) => (
                                <div
                                    key={n}
                                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 h-[140px] rounded-2xl animate-pulse flex flex-col justify-between"
                                >
                                    <div className="space-y-2">
                                        <div className="h-5 bg-[var(--color-background)]/80 rounded w-1/2" />
                                        <div className="h-4 bg-[var(--color-background)]/80 rounded w-5/6" />
                                    </div>
                                    <div className="h-8 bg-[var(--color-background)]/80 rounded-xl w-24 align-self-end mt-4" />
                                </div>
                            ))}
                        </div>
                    ) : quizzes.length === 0 ? (
                        <div className="text-center py-10 border border-[var(--color-border)] bg-[var(--color-background)]/20 rounded-2xl">
                            <p className="text-[var(--color-muted)] text-sm">No diagnostic assessments are currently active for this subject.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-[var(--color-border)] transition-all"
                                >
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-[var(--color-text)] text-lg leading-tight">{quiz.title}</h3>
                                        <p className="text-xs text-[var(--color-muted)] leading-relaxed">{quiz.description}</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]/40">
                                        <span className="text-xs font-semibold text-[var(--color-muted)]">
                                            Time Limit: {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} minutes` : 'Untimed'}
                                        </span>
                                        <Link
                                            href={`/quizzes/${quiz.id}`}
                                            className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)] rounded-xl transition-all shadow-md min-h-[40px] cursor-pointer"
                                        >
                                            Start Quiz
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
