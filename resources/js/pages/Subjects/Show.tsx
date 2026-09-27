import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { db } from '@/db/database';
import { LevelFilterTabs } from '@/components/subjects/LevelFilterTabs';
import { TopicCard, SubjectTopic } from '@/components/subjects/TopicCard';
import { SubjectQuizCard, SubjectQuiz } from '@/components/subjects/SubjectQuizCard';
import { Skeleton } from '@/components/common/Skeleton';

interface Subject {
    id: number;
    name: string;
    slug: string;
    description: string | null;
}

interface Props {
    slug: string;
}

export default function Show({ slug }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [subject, setSubject] = useState<Subject | null>(null);
    const [topics, setTopics] = useState<SubjectTopic[]>([]);
    const [quizzes, setQuizzes] = useState<SubjectQuiz[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<string>('all');

    const effectiveSlug =
        slug ||
        (typeof window !== 'undefined'
            ? window.location.pathname.split('/').filter(Boolean).pop() || ''
            : '');

    useEffect(() => {
        let isMounted = true;

        async function loadSubjectDetails() {
            // 1. Try reading from Dexie first (instant offline/cached render)
            try {
                const localSubject = await db.subjects.where('slug').equals(effectiveSlug).first();
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
                    const filteredQuizzes = localQuizzes.filter(
                        (q: any) => !q.subject_id || q.subject_id === localSubject.id
                    );
                    if (filteredQuizzes.length > 0 && isMounted) {
                        setQuizzes(
                            filteredQuizzes.map((q: any) => ({
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
                const classIdParam = typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('class_id')
                    : null;
                const classQuery = classIdParam ? `?class_id=${classIdParam}` : '';
                const res = await fetch(`/api/v1/subjects/${effectiveSlug}${classQuery}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setSubject(data.subject);
                        setTopics(data.topics || []);
                        setQuizzes(data.quizzes || []);
                        if (data.selected_level) {
                            setSelectedLevel(data.selected_level);
                        }
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
                        for (const q of data.quizzes) {
                            const existing = await db.quizzes.get(q.id);
                            const questionsToSave =
                                q.questions && q.questions.length > 0
                                    ? q.questions
                                    : existing?.questions && existing.questions.length > 0
                                    ? existing.questions
                                    : [];

                            await db.quizzes.put({
                                ...q,
                                status: 'published',
                                cached_at: new Date().toISOString(),
                                questions: questionsToSave,
                            });
                        }
                    }
                }
            } catch {
                console.log('Offline mode: loaded subject details from local database');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadSubjectDetails();

        return () => {
            isMounted = false;
        };
    }, [slug]);

    const uniqueLevels = ['all', ...Array.from(new Set(topics.map((t) => t.level)))];
    const filteredTopics = selectedLevel === 'all' ? topics : topics.filter((t) => t.level === selectedLevel);

    return (
        <AuthenticatedLayout
            header={
                <div className="space-y-3">
                    {loading ? (
                        <div className="space-y-2.5">
                            <Skeleton variant="text" className="h-8 w-1/3" />
                            <Skeleton variant="text" className="h-4 w-2/3" />
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
                                {subject?.name}
                            </h1>
                            <p className="text-[var(--color-muted)] max-w-3xl leading-relaxed">
                                {subject?.description}
                            </p>
                        </>
                    )}
                </div>
            }
        >
            <Head>
                <title>{loading ? 'Loading Subject...' : `${subject?.name || 'Subject'} Syllabus & Topics | AceDrill`}</title>
                <meta name="description" content={subject?.description || `Study ${subject?.name || 'this subject'} syllabus, interactive topics, and quizzes on AceDrill.`} />
                <meta property="og:title" content={`${subject?.name || 'Subject'} | AceDrill Curriculum`} />
                <meta property="og:description" content={subject?.description || `Study ${subject?.name || 'this subject'} offline with AI tutoring.`} />
                {subject && (
                    <script type="application/ld+json">
                        {JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Course",
                            "name": subject.name,
                            "description": subject.description || `Secondary school course covering ${subject.name} curriculum topics.`,
                            "provider": {
                                "@type": "EducationalOrganization",
                                "name": "AceDrill",
                                "url": "https://acedrill.app"
                            }
                        })}
                    </script>
                )}
            </Head>

            <div className="space-y-12">
                {/* Level Filter Tabs */}
                {!loading && (
                    <LevelFilterTabs
                        levels={uniqueLevels}
                        selectedLevel={selectedLevel}
                        onSelectLevel={setSelectedLevel}
                    />
                )}

                {/* Topics List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-[var(--color-text)] tracking-tight">Curriculum Topics</h2>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((n) => (
                                <div
                                    key={n}
                                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 h-[110px] flex items-center justify-between shadow-xs"
                                >
                                    <div className="space-y-2.5 flex-1 mr-4">
                                        <div className="flex items-center gap-2">
                                            <Skeleton variant="rounded" className="h-4 w-12 rounded-md" />
                                            <Skeleton variant="text" className="h-5 w-1/3" />
                                        </div>
                                        <Skeleton variant="text" className="h-4 w-2/3" />
                                    </div>
                                    <Skeleton variant="rounded" className="h-10 w-32 rounded-xl shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : filteredTopics.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/10">
                            <p className="text-[var(--color-muted)]">No topics are currently published under this level.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTopics.map((topic) => (
                                <TopicCard
                                    key={topic.id}
                                    topic={topic}
                                    exerciseQuizId={quizzes[0]?.id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Quizzes & Assessments Section */}
                <div className="space-y-6 pt-8 border-t border-[var(--color-border)]">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
                            Assessments & Quizzes
                        </h2>
                        <p className="text-sm text-[var(--color-muted)]">
                            Evaluate your overall subject mastery with these evaluations.
                        </p>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2].map((n) => (
                                <div
                                    key={n}
                                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between shadow-xs space-y-4"
                                >
                                    <div className="space-y-2">
                                        <Skeleton variant="text" className="h-5 w-3/5" />
                                        <Skeleton variant="text" className="h-4 w-4/5" />
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <Skeleton variant="rounded" className="h-4 w-20 rounded-md" />
                                        <Skeleton variant="rounded" className="h-9 w-28 rounded-xl" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : quizzes.length === 0 ? (
                        <div className="text-center py-10 border border-[var(--color-border)] bg-[var(--color-background)]/20 rounded-2xl">
                            <p className="text-[var(--color-muted)] text-sm">
                                No diagnostic assessments are currently active for this subject.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quizzes.map((quiz) => (
                                <SubjectQuizCard key={quiz.id} quiz={quiz} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
