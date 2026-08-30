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

export async function getCachedQuiz(id: number): Promise<CachedQuiz | undefined> {
    return db.quizzes.get(id);
}

export async function getFreshQuiz(id: number): Promise<CachedQuiz | null> {
    const cached = await getCachedQuiz(id);
    if (cached && !isStale(cached.cached_at)) {
        return cached;
    }
    try {
        const res = await fetch(`/api/v1/quizzes/${id}`);
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
    return db.quizAttempts.where('synced').equals(0).toArray();
}

export async function markAttemptSynced(id: string): Promise<void> {
    const attempt = await db.quizAttempts.get(id);
    if (attempt) {
        await db.quizAttempts.update(id, { synced: true });
    }
}

// ── Learner Progress (Local) ──

export async function saveLocalProgress(progress: LocalLearnerProgress): Promise<void> {
    await db.learnerProgress.put(progress);
}

export async function getLocalProgress(userId: string): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress.where('user_id').equals(userId).toArray();
}

export async function getUnsyncedProgress(): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress.where('synced').equals(0).toArray();
}

export async function markProgressSynced(id: number): Promise<void> {
    await db.learnerProgress.update(id, { synced: true });
}

// ── Gamification (Local) ──

export async function saveLocalGamification(gamification: LocalGamification): Promise<void> {
    await db.gamification.put(gamification);
}

export async function getLocalGamification(userId: string): Promise<LocalGamification | undefined> {
    const results = await db.gamification.where('user_id').equals(userId).toArray();
    return results[0];
}

export async function getUnsyncedGamification(): Promise<LocalGamification[]> {
    return db.gamification.where('synced').equals(0).toArray();
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
        db.quizAttempts.where('synced').equals(0).count(),
        db.learnerProgress.where('synced').equals(0).count(),
        db.gamification.where('synced').equals(0).count(),
    ]);
    return attempts + progress + gamification;
}

// ── Full Offline Preloading ──

let isPreloading = false;
let hasPreloadedThisSession = false;

/**
 * Pre-warm a route by fetching the full HTML page and storing it in
 * the SW runtime caches. Each cache.put() needs its own Response object
 * so we fetch multiple times — Responses cannot be cloned more than once
 * after their body has been read.
 */
async function prewarmRoute(url: string): Promise<void> {
    const fullUrl = new URL(url, window.location.origin).href;
    const opts: RequestInit = {
        credentials: 'same-origin',
        headers: { 'Accept': 'text/html' },
    };

    const fetchFresh = () => fetch(fullUrl, opts);

    try {
        // Store in app-routes-cache (keyed by both full and relative URL)
        const appCache = await caches.open('app-routes-cache');
        const r1 = await fetchFresh();
        if (r1.ok) await appCache.put(fullUrl, r1);

        // Store in pages-cache (the navigate catch-all cache)
        const pagesCache = await caches.open('pages-cache');
        const r2 = await fetchFresh();
        if (r2.ok) await pagesCache.put(fullUrl, r2);

    } catch {
        // Best-effort — silent fail is fine
    }
}

export async function preloadFullOfflineCurriculum(): Promise<void> {
    if (isPreloading || hasPreloadedThisSession || !navigator.onLine) return;
    isPreloading = true;

    try {
        // 1. Pre-warm main routes
        await prewarmRoute('/dashboard');
        await prewarmRoute('/subjects');
        await prewarmRoute('/flashcards');

        // 2. Fetch and cache all subjects (API data → IndexedDB)
        const subjectsRes = await fetch('/api/v1/subjects');
        if (!subjectsRes.ok) return;
        const subjectsData = await subjectsRes.json();
        const subjectsList = subjectsData.subjects || subjectsData || [];

        if (Array.isArray(subjectsList) && subjectsList.length > 0) {
            await db.subjects.bulkPut(
                subjectsList.map((s: any) => ({
                    id: s.id,
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

            // 3. Fetch and cache topics and quizzes for each subject
            for (const subject of subjectsList) {
                try {
                    await prewarmRoute(`/subjects/${subject.slug}`);

                    const subRes = await fetch(`/api/v1/subjects/${subject.slug}`);
                    if (!subRes.ok) continue;
                    const subData = await subRes.json();

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
                    }

                    if (subData.quizzes && subData.quizzes.length > 0) {
                        for (const q of subData.quizzes) {
                            try {
                                await prewarmRoute(`/quizzes/${q.id}`);

                                const quizRes = await fetch(`/api/v1/quizzes/${q.id}`);
                                if (quizRes.ok) {
                                    const quizData = await quizRes.json();
                                    if (quizData.quiz) {
                                        await db.quizzes.put({
                                            ...quizData.quiz,
                                            cached_at: new Date().toISOString(),
                                        });
                                    }
                                }
                            } catch {
                                // Ignore individual quiz fetch failure
                            }
                        }
                    }
                } catch {
                    // Ignore individual subject fetch failure
                }
            }
        }

        // 4. Fetch and cache flashcards deck
        try {
            const flashRes = await fetch('/api/v1/flashcards/deck');
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
        } catch {
            // Ignore flashcard failure
        }

        console.log('✅ Offline curriculum fully preloaded and cached.');
    } catch (e) {
        console.warn('Background offline preload encountered an error:', e);
    } finally {
        isPreloading = false;
        hasPreloadedThisSession = true;
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
