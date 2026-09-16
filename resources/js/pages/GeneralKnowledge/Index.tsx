import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { db } from '@/db/database';

interface Subject {
    id: number;
    school_id?: number | null;
    school_name?: string | null;
    is_general_knowledge?: boolean;
    name: string;
    slug: string;
    description: string | null;
    progress_percent: number;
    topics_count: number;
}

export default function Index() {
    const [loading, setLoading] = useState<boolean>(true);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadSubjects() {
            setLoading(true);

            // 1. Try reading from Dexie first (instant offline/cached render)
            try {
                const local = await db.subjects.toArray();
                if (local.length > 0 && isMounted) {
                    setSubjects(local.map((s: any) => ({
                        id: s.id,
                        school_id: s.school_id,
                        school_name: s.school_name,
                        is_general_knowledge: s.is_general_knowledge,
                        name: s.name,
                        slug: s.slug,
                        description: s.description,
                        progress_percent: s.progress_percent || 0,
                        topics_count: s.topics_count || 0,
                    })));
                    setLoading(false);
                }
            } catch (e) {
                console.error('Dexie read error:', e);
            }

            // 2. Fetch fresh data from network if online
            try {
                const res = await fetch('/api/v1/subjects?scope=general');
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setSubjects(data.subjects || []);
                        setLoading(false);
                    }
                    // Save to Dexie for offline use
                    if (data.subjects && data.subjects.length > 0) {
                        await db.subjects.bulkPut(
                            data.subjects.map((s: any) => ({
                                id: s.id,
                                school_id: s.school_id,
                                school_name: s.school_name,
                                is_general_knowledge: s.is_general_knowledge,
                                name: s.name,
                                slug: s.slug,
                                description: s.description,
                                status: 'published',
                                sort_order: 0,
                                progress_percent: s.progress_percent || 0,
                                topics_count: s.topics_count || 0,
                                cached_at: new Date().toISOString(),
                            }))
                        );
                    }
                }
            } catch (err) {
                console.log('Offline mode — loaded subjects from local database');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadSubjects();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredSubjects = subjects.filter((subject) =>
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subject.description && subject.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">General Knowledge</h1>
                    <p className="text-[var(--color-muted)] mt-1">
                        Explore open curricula and practice all questions across schools and platforms.
                    </p>
                </div>
            }
        >
            <Head title="General Knowledge" />

            <div className="space-y-6">
                {/* Search Bar */}
                <div className="max-w-md">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search subjects & question banks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]/80 focus:ring-1 focus:ring-[var(--color-primary)]/80 text-sm transition-all min-h-[48px]"
                        />
                    </div>
                </div>

                {/* Scope Banner */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-[var(--color-text)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <strong className="font-bold text-[var(--color-primary)] block text-sm">Open Practice Bank</strong>
                            <span className="text-[var(--color-muted)]">You have open access to all subjects, diagnostic tests, and curriculum topics regardless of school enrollment.</span>
                        </div>
                    </div>
                </div>

                {/* Subjects Grid / Skeleton Screen */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 flex flex-col justify-between h-[220px] animate-pulse"
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="h-6 bg-[var(--color-background)]/80 rounded w-1/2" />
                                        <div className="h-5 bg-[var(--color-background)]/80 rounded w-16" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-[var(--color-background)]/80 rounded w-full" />
                                        <div className="h-4 bg-[var(--color-background)]/80 rounded w-5/6" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-2 bg-[var(--color-background)]/80 rounded-full w-full" />
                                    <div className="h-10 bg-[var(--color-background)]/80 rounded-xl w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredSubjects.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/10">
                        <p className="text-[var(--color-muted)]">No subjects match your search.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSubjects.map((subject) => (
                            <div
                                key={subject.id}
                                className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-2xl p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-black/20 transition-all group"
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <h2 className="text-xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                                            {subject.name}
                                        </h2>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs font-semibold px-2.5 py-1 bg-[var(--color-primary-5)]/80 text-[var(--color-muted)] rounded-md border border-[var(--color-border)]">
                                                {subject.topics_count} {subject.topics_count === 1 ? 'Topic' : 'Topics'}
                                            </span>
                                            {subject.school_name ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[var(--color-primary-5)] text-[var(--color-primary)] rounded-md border border-[var(--color-primary)]/20">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                    {subject.school_name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[var(--color-surface-elevated)] text-[var(--color-muted)] rounded-md border border-[var(--color-border)]">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Open Curriculum
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-[var(--color-muted)] leading-relaxed line-clamp-3">
                                        {subject.description || 'Explore curricula and complete exercises to master concepts.'}
                                    </p>
                                </div>

                                <div className="mt-8 space-y-4">
                                    {/* Progress Area */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="text-[var(--color-muted)]">Mastery Progress</span>
                                            <span className="text-[var(--color-primary)]">{subject.progress_percent}%</span>
                                        </div>
                                        <div className="w-full bg-[var(--color-background)] rounded-full h-2 overflow-hidden border border-[var(--color-border)]">
                                            <div
                                                className="bg-[var(--color-success)] h-full rounded-full transition-all duration-500"
                                                style={{ width: `${subject.progress_percent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <Link
                                        href={`/subjects/${subject.slug}?scope=general`}
                                        className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:text-white bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] shadow-md transition-all group focus:outline-none min-h-[48px]"
                                    >
                                        Explore Topics
                                        <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
