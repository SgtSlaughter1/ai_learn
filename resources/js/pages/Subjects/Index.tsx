import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { BookOpen } from 'lucide-react';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { db } from '@/db/database';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';
import { recallResponse, rememberResponse, toCachedSubject } from '@/services/OfflineService';

interface Subject {
    id: number;
    school_id?: number | null;
    school_name?: string | null;
    class_id?: number | null;
    class_name?: string | null;
    class_grade_level?: string | null;
    is_general_knowledge?: boolean;
    name: string;
    slug: string;
    description: string | null;
    progress_percent: number;
    topics_count: number;
}

interface ClassItem {
    id: number;
    name: string;
    grade_level: string | null;
    section: string | null;
}

interface UserSchool {
    id: number;
    name: string;
}

interface SubjectsResponse {
    subjects: Subject[];
    user_school?: UserSchool | null;
}

const responseKey = (classId: number | null) => `subjects_school_${classId ?? 'all'}`;

export default function Index() {
    const [selectedClassId, setSelectedClassId] = useState<number | null>(() => {
        if (typeof window !== 'undefined') {
            const urlParam = new URLSearchParams(window.location.search).get('class_id');
            if (urlParam) return Number(urlParam);
            const stored = localStorage.getItem('selected_class_id');
            if (stored) return Number(stored);
        }
        return null;
    });
    // First paint uses the last server answer for this same filter, so the page doesn't
    // show a generic list (school names instead of classes) and then change.
    const [initial] = useState(() => recallResponse<SubjectsResponse>(responseKey(selectedClassId)));
    const [loading, setLoading] = useState<boolean>(!initial);
    const [subjects, setSubjects] = useState<Subject[]>(initial?.subjects ?? []);
    const [classes, setClasses] = useState<ClassItem[]>(() => recallResponse<ClassItem[]>('class_options') ?? []);
    const [userSchool, setUserSchool] = useState<UserSchool | null>(initial?.user_school ?? null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleClassSelect = (classId: number | null) => {
        setSelectedClassId(classId);
        if (classId) {
            localStorage.setItem('selected_class_id', String(classId));
            const url = new URL(window.location.href);
            url.searchParams.set('class_id', String(classId));
            window.history.replaceState({}, '', url.toString());
        } else {
            localStorage.removeItem('selected_class_id');
            const url = new URL(window.location.href);
            url.searchParams.delete('class_id');
            window.history.replaceState({}, '', url.toString());
        }
    };

    useEffect(() => {

        fetch('/api/v1/classes')
            .then((res) => {
                if (!res.ok) throw new Error(`Classes request failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (data.classes && data.classes.length > 0) {
                    setClasses(data.classes);
                    rememberResponse('class_options', data.classes);
                }
            })
            .catch(() => {
                // Offline: use the class list from the last time this page loaded online.
                const cached = recallResponse<ClassItem[]>('class_options');
                if (cached?.length) setClasses(cached);
            });
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadSubjects() {
            const remembered = recallResponse<SubjectsResponse>(responseKey(selectedClassId));
            if (remembered) {
                // 1a. The last server answer for this filter: identical to what's coming.
                setSubjects(remembered.subjects);
                if (remembered.user_school) setUserSchool(remembered.user_school);
                setLoading(false);
            } else {
                // 1b. First visit to this filter: school subjects saved on the device.
                setLoading(true);
                try {
                    const local = await db.subjects.toArray();
                    const schoolSubjects = local.filter((s) => s.school_id !== null && s.school_id !== undefined
                        && (!selectedClassId || s.class_id === selectedClassId));
                    if (schoolSubjects.length > 0 && isMounted) {
                        setSubjects(schoolSubjects.map((s) => ({
                            ...s,
                            description: s.description,
                            progress_percent: s.progress_percent || 0,
                            topics_count: s.topics_count || 0,
                        })));
                        setLoading(false);
                    }
                } catch (e) {
                    console.error('Dexie read error:', e);
                }
            }

            // 2. Fetch fresh data from network if online
            try {
                const params = new URLSearchParams();
                params.set('scope', 'school');
                if (selectedClassId) params.set('class_id', String(selectedClassId));

                const res = await fetch(`/api/v1/subjects?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setSubjects(data.subjects || []);
                        if (data.user_school) {
                            setUserSchool(data.user_school);
                        }
                        setLoading(false);
                    }
                    rememberResponse(responseKey(selectedClassId), { subjects: data.subjects || [], user_school: data.user_school ?? null });
                    // Save to Dexie for offline use
                    if (data.subjects && data.subjects.length > 0) {
                        await db.subjects.bulkPut(data.subjects.map(toCachedSubject));
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
    }, [selectedClassId]);

    const filteredSubjects = subjects.filter((subject) =>
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subject.description && subject.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <AuthenticatedLayout
            header={<PageHeader icon={BookOpen} title="School Curriculum" subtitle={`Curriculum and practice quizzes for ${userSchool?.name || 'your school'}.`} />}
        >
            <Head title="School Curriculum & Subjects | AceDrill" />

            <div className="space-y-6">
                <Link
                    href="/general-knowledge"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-xs font-bold text-[var(--color-text)] transition-all self-start shadow-sm"
                >
                    <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Open General Knowledge</span>
                </Link>

                {/* Search Bar & Class Filter */}
                <div className="flex flex-col gap-3">
                    {/* Class Filter Tabs */}
                    {classes.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                            <button
                                type="button"
                                onClick={() => handleClassSelect(null)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[40px] cursor-pointer border shrink-0 ${
                                    selectedClassId === null
                                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                                        : 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                All Classes
                            </button>
                            {classes.map((cls) => (
                                <button
                                    key={cls.id}
                                    type="button"
                                    onClick={() => handleClassSelect(cls.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[40px] cursor-pointer border shrink-0 ${
                                        selectedClassId === cls.id
                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                                            : 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    {cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="w-full max-w-md">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-muted)]">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search school subjects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]/80 focus:ring-1 focus:ring-[var(--color-primary)]/80 text-sm transition-all min-h-[48px]"
                            />
                        </div>
                    </div>
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
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <Skeleton variant="rounded" className="h-6 w-16 rounded-md" />
                                            <Skeleton variant="rounded" className="h-4 w-20 rounded-md" />
                                        </div>
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
                    <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/10 space-y-3">
                        <p className="text-[var(--color-muted)]">No curriculum subjects assigned to your school yet.</p>
                        <Link
                            href="/general-knowledge"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Explore General Knowledge</span>
                        </Link>
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
                                            {subject.class_name ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[var(--color-primary-10)] text-[var(--color-primary)] rounded-md border border-[var(--color-primary)]/20">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                    {subject.class_name} {subject.class_grade_level ? `(${subject.class_grade_level})` : ''}
                                                </span>
                                            ) : subject.school_name ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[var(--color-primary-5)] text-[var(--color-primary)] rounded-md border border-[var(--color-primary)]/20">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                    {subject.school_name}
                                                </span>
                                            ) : null}
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
                                        href={`/subjects/${subject.slug}`}
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
