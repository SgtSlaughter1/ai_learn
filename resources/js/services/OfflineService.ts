import { db } from '../db/database';
import type {
    CachedSubject,
    CachedTopic,
    CachedQuiz,
    CachedFlashcard,
    LocalQuizAttempt,
    LocalLearnerProgress,
    LocalGamification,
    CachedUserProfile,
} from '../db/database';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isStale(cachedAt: string): boolean {
    return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS;
}

// ── Subjects ──

export async function cacheSubjects(subjects: CachedSubject[]): Promise<void> {
    await db.subjects.bulkPut(subjects.map(s => ({ ...s, cached_at: new Date().toISOString() })));
}

export async function getCachedSubjects(): Promise<CachedSubject[]> {
    return db.subjects.toArray();
}

export async function getFreshSubjects(): Promise<CachedSubject[]> {
    const cached = await getCachedSubjects();
    if (cached.length > 0 && !isStale(cached[0].cached_at)) {
        return cached;
    }
    try {
        const res = await fetch('/api/v1/subjects');
        if (!res.ok) throw new Error('Failed to fetch subjects');
        const data = await res.json();
        const subjects: CachedSubject[] = data.subjects || data;
        await cacheSubjects(subjects);
        return subjects;
    } catch {
        return cached;
    }
}

// ── Topics ──

export async function cacheTopics(topics: CachedTopic[]): Promise<void> {
    await db.topics.bulkPut(topics.map(t => ({ ...t, cached_at: new Date().toISOString() })));
}

export async function getCachedTopics(subjectId?: number): Promise<CachedTopic[]> {
    if (subjectId) {
        return db.topics.where('subject_id').equals(subjectId).toArray();
    }
    return db.topics.toArray();
}

export async function getFreshTopics(subjectId: number): Promise<CachedTopic[]> {
    const cached = await getCachedTopics(subjectId);
    if (cached.length > 0 && !isStale(cached[0].cached_at)) {
        return cached;
    }
    try {
        const res = await fetch(`/api/v1/subjects/${subjectId}/topics`);
        if (!res.ok) throw new Error('Failed to fetch topics');
        const data = await res.json();
        const topics: CachedTopic[] = data.topics || data;
        await cacheTopics(topics);
        return topics;
    } catch {
        return cached;
    }
}

// ── Quizzes ──

export async function cacheQuiz(quiz: CachedQuiz): Promise<void> {
    await db.quizzes.put({ ...quiz, cached_at: new Date().toISOString() });
}

export async function getCachedQuiz(id: number | string): Promise<CachedQuiz | undefined> {
    const numId = Number(id);
    if (!isNaN(numId)) {
        const byNum = await db.quizzes.get(numId);
        if (byNum) return byNum;
    }
    return db.quizzes.get(String(id) as any);
}

export async function getFreshQuiz(id: number | string): Promise<CachedQuiz | null> {
    const cached = await getCachedQuiz(id);
    if (cached && !isStale(cached.cached_at)) {
        return cached;
    }
    try {
        const numId = Number(id) || id;
        const res = await fetch(`/api/v1/quizzes/${numId}`);
        if (!res.ok) throw new Error('Failed to fetch quiz');
        const data = await res.json();
        const quiz: CachedQuiz = data.quiz;
        await cacheQuiz(quiz);
        return quiz;
    } catch {
        return cached || null;
    }
}

// ── Flashcards ──

export async function cacheFlashcards(flashcards: CachedFlashcard[]): Promise<void> {
    await db.flashcards.bulkPut(
        flashcards.map(f => ({ ...f, cached_at: new Date().toISOString() }))
    );
}

export async function getCachedFlashcards(): Promise<CachedFlashcard[]> {
    return db.flashcards.toArray();
}

export async function getFreshFlashcards(): Promise<CachedFlashcard[]> {
    const cached = await getCachedFlashcards();
    if (cached.length > 0 && !isStale(cached[0].cached_at)) {
        return cached;
    }
    try {
        const res = await fetch('/api/v1/flashcards/deck');
        if (!res.ok) throw new Error('Failed to fetch flashcards');
        const data = await res.json();
        const cards: CachedFlashcard[] = data.deck || [];
        await cacheFlashcards(cards);
        return cards;
    } catch {
        return cached;
    }
}

// ── Quiz Attempts (Local) ──

export async function saveLocalAttempt(attempt: LocalQuizAttempt): Promise<void> {
    await db.quizAttempts.put(attempt);
}

export async function getLocalAttempt(id: string): Promise<LocalQuizAttempt | undefined> {
    return db.quizAttempts.get(id);
}

export async function getLocalAttempts(userId: string): Promise<LocalQuizAttempt[]> {
    return db.quizAttempts.where('user_id').equals(userId).toArray();
}

export async function getUnsyncedAttempts(): Promise<LocalQuizAttempt[]> {
    return db.quizAttempts.filter(a => !a.synced || (a.synced as any) === 0).toArray();
}

export async function markAttemptSynced(id: string): Promise<void> {
    const attempt = await db.quizAttempts.get(id);
    if (attempt) {
        await db.quizAttempts.update(id, { synced: true });
    }
}

// ── Learner Progress (Local) ──

export async function saveLocalProgress(progress: LocalLearnerProgress): Promise<void> {
    if (!progress.id) {
        const existing = await db.learnerProgress
            .where('user_id')
            .equals(progress.user_id)
            .and(p => p.topic_id === progress.topic_id)
            .first();
        if (existing && existing.id) {
            progress.id = existing.id;
        } else {
            progress.id = Number(progress.topic_id) || Date.now();
        }
    }
    await db.learnerProgress.put(progress);
}

export async function getLocalProgress(userId: string): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress.where('user_id').equals(userId).toArray();
}

export async function getUnsyncedProgress(): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress.filter(p => !p.synced || (p.synced as any) === 0).toArray();
}

export async function markProgressSynced(id: number): Promise<void> {
    await db.learnerProgress.update(id, { synced: true });
}

// ── Gamification (Local) ──

export async function saveLocalGamification(gamification: LocalGamification): Promise<void> {
    if (!gamification.id) {
        const existing = await db.gamification
            .where('user_id')
            .equals(gamification.user_id)
            .first();
        if (existing && existing.id) {
            gamification.id = existing.id;
        } else {
            gamification.id = 1;
        }
    }
    await db.gamification.put(gamification);
}

export async function getLocalGamification(userId: string): Promise<LocalGamification | undefined> {
    const results = await db.gamification.where('user_id').equals(userId).toArray();
    return results[0];
}

export async function getUnsyncedGamification(): Promise<LocalGamification[]> {
    return db.gamification.filter(g => !g.synced || (g.synced as any) === 0).toArray();
}

export async function markGamificationSynced(id: number): Promise<void> {
    await db.gamification.update(id, { synced: true });
}

// ── User Profile (Cached) ──

export async function cacheUserProfile(profile: CachedUserProfile): Promise<void> {
    await db.userProfile.put({ ...profile, cached_at: new Date().toISOString() });
}

export async function getCachedUserProfile(): Promise<CachedUserProfile | undefined> {
    const all = await db.userProfile.toArray();
    return all[0];
}

// ── Stats ──

export async function getPendingSyncCount(): Promise<number> {
    const [attempts, progress, gamification] = await Promise.all([
        db.quizAttempts.filter(a => !a.synced || (a.synced as any) === 0).count(),
        db.learnerProgress.filter(p => !p.synced || (p.synced as any) === 0).count(),
        db.gamification.filter(g => !g.synced || (g.synced as any) === 0).count(),
    ]);
    return attempts + progress + gamification;
}

// ── Full Offline Preloading with Live Progress ──

export interface OfflinePreloadProgress {
    isPreloading: boolean;
    isComplete: boolean;
    totalSubjects: number;
    completedSubjects: number;
    percent: number;
    currentSubjectName?: string;
    cachedSubjectsCount: number;
}

let preloadState: OfflinePreloadProgress = {
    isPreloading: false,
    isComplete: false,
    totalSubjects: 0,
    completedSubjects: 0,
    percent: 0,
    cachedSubjectsCount: 0,
};

type PreloadListener = (state: OfflinePreloadProgress) => void;
const preloadListeners = new Set<PreloadListener>();

export function getOfflinePreloadState(): OfflinePreloadProgress {
    return { ...preloadState };
}

export function subscribeOfflinePreload(listener: PreloadListener): () => void {
    preloadListeners.add(listener);
    listener({ ...preloadState });
    return () => {
        preloadListeners.delete(listener);
    };
}

function updatePreloadState(patch: Partial<OfflinePreloadProgress>) {
    preloadState = { ...preloadState, ...patch };
    preloadListeners.forEach((l) => l({ ...preloadState }));
}

let hasPreloadedThisSession = false;

function getInertiaVersion(): string {
    try {
        const el = document.getElementById('app') || document.querySelector('[data-page]');
        if (el && el.getAttribute('data-page')) {
            const page = JSON.parse(el.getAttribute('data-page') || '{}');
            return page.version || '';
        }
    } catch {
        // ignore
    }
    return '';
}

/**
 * Pre-warm a route by fetching the full HTML page and storing it in
 * the SW runtime caches.
 */
async function prewarmRoute(url: string): Promise<void> {
    const fullUrl = new URL(url, window.location.origin).href;

    try {
        const appCache = await caches.open('app-routes-cache');
        const pagesCache = await caches.open('pages-cache');

        // 1. Prewarm HTML document
        const htmlRes = await fetch(fullUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'text/html' },
        }).catch(() => null);

        if (htmlRes && htmlRes.ok) {
            await appCache.put(fullUrl, htmlRes.clone());
            await pagesCache.put(fullUrl, htmlRes);
        }

        // 2. Prewarm Inertia JSON payload
        const inertiaVersion = getInertiaVersion();
        const inertiaHeaders: Record<string, string> = {
            'X-Inertia': 'true',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/html, application/xhtml+xml',
        };
        if (inertiaVersion) {
            inertiaHeaders['X-Inertia-Version'] = inertiaVersion;
        }

        const inertiaRes = await fetch(fullUrl, {
            credentials: 'same-origin',
            headers: inertiaHeaders,
        }).catch(() => null);

        if (inertiaRes && inertiaRes.ok) {
            const inertiaReq = new Request(fullUrl, {
                headers: { 'X-Inertia': 'true' },
            });
            await appCache.put(inertiaReq, inertiaRes);
        }
    } catch {
        // Best-effort: silent fail is fine
    }
}

/**
 * 2-Stage Parallelized Offline Curriculum Preloader
 * Stage 1: Instant cache of routes & subjects index (< 1.5s)
 * Stage 2: Concurrent batch worker pool (4 workers) for topics, quizzes & flashcards (~5-7s)
 */
export async function preloadFullOfflineCurriculum(): Promise<void> {
    if (preloadState.isPreloading || hasPreloadedThisSession || !navigator.onLine) return;

    const initialCachedCount = await db.subjects.count().catch(() => 0);
    updatePreloadState({
        isPreloading: true,
        isComplete: false,
        cachedSubjectsCount: initialCachedCount,
    });

    try {
        // ── STAGE 1: Instant Critical Pack (< 1.5s) ──
        // 1. Pre-warm top routes in parallel
        await Promise.allSettled([
            prewarmRoute('/dashboard'),
            prewarmRoute('/subjects'),
            prewarmRoute('/flashcards'),
        ]);

        // 2. Fetch and cache subjects catalog
        const subjectsRes = await fetch('/api/v1/subjects?scope=general').catch(() => null);
        if (!subjectsRes || !subjectsRes.ok) {
            updatePreloadState({ isPreloading: false });
            return;
        }

        const subjectsData = await subjectsRes.json();
        const subjectsList = subjectsData.subjects || subjectsData || [];

        if (!Array.isArray(subjectsList) || subjectsList.length === 0) {
            updatePreloadState({ isPreloading: false, isComplete: true });
            return;
        }

        // Save subjects index to Dexie
        await db.subjects.bulkPut(
            subjectsList.map((s: any) => ({
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

        const totalSubjects = subjectsList.length;
        let completedSubjects = 0;

        updatePreloadState({
            totalSubjects,
            completedSubjects: 0,
            percent: 0,
            cachedSubjectsCount: totalSubjects,
        });

        // ── STAGE 2: Concurrent Worker Pool for Topics & Quizzes (Pool of 4) ──
        const downloadSubjectCurriculum = async (subject: any) => {
            try {
                // Prewarm route and fetch subject details in parallel
                const [, subRes] = await Promise.all([
                    prewarmRoute(`/subjects/${subject.slug}`),
                    fetch(`/api/v1/subjects/${subject.slug}?scope=general`).catch(() => null),
                ]);

                if (subRes && subRes.ok) {
                    const subData = await subRes.json();

                    // Save topics
                    if (subData.topics && subData.topics.length > 0) {
                        await db.topics.bulkPut(
                            subData.topics.map((t: any) => ({
                                id: t.id,
                                subject_id: subject.id,
                                name: t.name,
                                slug: t.slug,
                                level: t.level,
                                description: t.description,
                                status: 'published',
                                sort_order: 0,
                                cached_at: new Date().toISOString(),
                            }))
                        );

                        // Save topic progress
                        const progressList: LocalLearnerProgress[] = [];
                        for (const t of subData.topics) {
                            if (t.progress) {
                                progressList.push({
                                    id: t.progress.id || t.id,
                                    user_id: 'current',
                                    topic_id: t.id,
                                    questions_attempted: t.progress.questions_attempted || 0,
                                    questions_correct: t.progress.questions_correct || 0,
                                    mastery_score: t.progress.mastery_score || 0,
                                    ability_score: t.progress.ability_score || 0,
                                    synced: true,
                                    last_attempted_at: new Date().toISOString(),
                                });
                            }
                        }
                        if (progressList.length > 0) {
                            await db.learnerProgress.bulkPut(progressList);
                        }
                    }

                    // Save quizzes in parallel
                    if (subData.quizzes && subData.quizzes.length > 0) {
                        await Promise.allSettled(
                            subData.quizzes.map(async (q: any) => {
                                try {
                                    await prewarmRoute(`/quizzes/${q.id}`);
                                    if (q.questions && q.questions.length > 0) {
                                        await db.quizzes.put({
                                            ...q,
                                            status: 'published',
                                            cached_at: new Date().toISOString(),
                                        });
                                    } else {
                                        const quizRes = await fetch(`/api/v1/quizzes/${q.id}`).catch(() => null);
                                        if (quizRes && quizRes.ok) {
                                            const quizData = await quizRes.json();
                                            if (quizData.quiz) {
                                                await db.quizzes.put({
                                                    ...quizData.quiz,
                                                    status: 'published',
                                                    cached_at: new Date().toISOString(),
                                                });
                                            }
                                        }
                                    }
                                } catch {
                                    // ignore individual quiz errors
                                }
                            })
                        );
                    }
                }
            } catch {
                // ignore individual subject errors
            } finally {
                completedSubjects++;
                updatePreloadState({
                    completedSubjects,
                    percent: Math.min(100, Math.round((completedSubjects / totalSubjects) * 100)),
                    currentSubjectName: subject.name,
                });
            }
        };

        // Worker Pool with Concurrency of 4
        const CONCURRENCY = 4;
        let queueIndex = 0;
        const workers = Array.from({ length: Math.min(CONCURRENCY, subjectsList.length) }, async () => {
            while (queueIndex < subjectsList.length) {
                const item = subjectsList[queueIndex++];
                await downloadSubjectCurriculum(item);
            }
        });

        // Also fetch and cache flashcards deck in parallel
        const flashcardsPromise = fetch('/api/v1/flashcards/deck')
            .then(async (flashRes) => {
                if (flashRes.ok) {
                    const flashData = await flashRes.json();
                    if (flashData.deck && flashData.deck.length > 0) {
                        await db.flashcards.bulkPut(
                            flashData.deck.map((f: any) => ({
                                ...f,
                                cached_at: new Date().toISOString(),
                            }))
                        );
                    }
                }
            })
            .catch(() => null);

        await Promise.all([...workers, flashcardsPromise]);

        updatePreloadState({
            isPreloading: false,
            isComplete: true,
            percent: 100,
            completedSubjects: totalSubjects,
        });
        hasPreloadedThisSession = true;
        console.log('[OfflineService] 2-stage parallel offline curriculum preloading completed.');
    } catch (e) {
        console.warn('Background offline preload encountered an error:', e);
        updatePreloadState({
            isPreloading: false,
            isComplete: false,
        });
    }
}

// ── Wipe (for logout) ──

export async function clearAllOfflineData(): Promise<void> {
    await db.transaction('rw', db.subjects, db.topics, db.quizzes, db.flashcards, async () => {
        await db.subjects.clear();
        await db.topics.clear();
        await db.quizzes.clear();
        await db.flashcards.clear();
    });
    await db.transaction('rw', db.quizAttempts, db.learnerProgress, db.gamification, db.syncQueue, db.userProfile, async () => {
        await db.quizAttempts.clear();
        await db.learnerProgress.clear();
        await db.gamification.clear();
        await db.syncQueue.clear();
        await db.userProfile.clear();
    });
}
