import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Globe } from 'lucide-react';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { db } from '@/db/database';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';

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
                console.log('Offline mode: loaded subjects from local database');
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
            header={<PageHeader icon={Globe} title="General Knowledge" subtitle="Open study materials and extra practice across all subjects." />}
        >
            <Head>
                <title>General Knowledge & Open Curriculum Library | AceDrill</title>
                <meta name="description" content="Access open curriculum questions, verified educational answers, and general knowledge concepts on AceDrill." />
                <meta property="og:title" content="General Knowledge & Open Curriculum Library | AceDrill" />
                <meta property="og:description" content="Access open curriculum questions, verified educational answers, and general knowledge concepts on AceDrill." />
            </Head>

            <div className="space-y-6">
                <p className="text-sm text-[var(--color-muted)] max-w-3xl leading-relaxed">
                    These questions are for self-study and broad revision. They are not based on your school's class tests or assignments.
                </p>

                {/* Search Bar */}
                <div className="max-w-md">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

                {/* Scope / Clarification Banner */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-[var(--color-text)] shadow-sm">
                    <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-10)] border border-[var(--color-primary-20)] flex items-center justify-center text-[var(--color-primary)] shrink-0 mt-0.5 md:mt-0">
                            <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="space-y-1">
                            <strong className="font-bold text-[var(--color-text)] text-sm block">Open Practice Bank (Not School-Specific)</strong>
                            <p className="text-[var(--color-muted)] leading-relaxed">
                                This library contains open curriculum topics and practice questions for independent study. For tests and questions assigned by your teachers, visit your school curriculum page.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/subjects"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)] hover:underline whitespace-nowrap self-start md:self-center shrink-0"
                    >
                        <span>View My School Curriculum</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>

                {/* Subjects Grid / Skeleton Screen */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                            <div
                                key={n}
                                className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 flex flex-col justify-between h-[230px] shadow-xs"
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <Skeleton variant="text" className="h-6 w-3/5" />
                                        <Skeleton variant="rounded" className="h-6 w-16 rounded-md shrink-0" />
                                    </div>
                                    <SkeletonText lines={2} />
                                </div>
                                <div className="space-y-3 pt-3 border-t border-[var(--color-border)]/40">
                                    <div className="flex justify-between items-center">
                                        <Skeleton variant="text" className="h-3 w-16" />
                                        <Skeleton variant="text" className="h-3 w-10" />
                                    </div>
                                    <Skeleton variant="rounded" className="h-2 w-full rounded-full" />
                                    <Skeleton variant="rounded" className="h-9 w-full rounded-xl" />
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
