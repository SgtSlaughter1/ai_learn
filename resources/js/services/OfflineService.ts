import { belongsTo, getSyncUser } from './SyncQueue';
import { answerHash } from './AnswerKey';
import { clearSnapshots, forgetAuthUser } from './OfflineNavigation';
import { APP_SHELL_CACHE } from './OfflinePrewarm';
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

/** One shape for subjects saved on the device, keeping the class they belong to. */
export function toCachedSubject(s: any): CachedSubject {
    return {
        id: s.id,
        school_id: s.school_id,
        school_name: s.school_name,
        class_id: s.class_id ?? null,
        class_name: s.class_name ?? null,
        class_grade_level: s.class_grade_level ?? null,
        is_general_knowledge: s.is_general_knowledge,
        name: s.name,
        slug: s.slug,
        description: s.description,
        status: 'published',
        sort_order: 0,
        progress_percent: s.progress_percent || 0,
        topics_count: s.topics_count || 0,
        cached_at: new Date().toISOString(),
    };
}

// ── Last server answer per screen (instant first paint) ──

const RESPONSE_PREFIX = 'cached_learner_';

/**
 * Remember the last server answer for a screen so it can be shown on the very first
 * paint next time (then refreshed), instead of a generic copy that changes a moment
 * later. Per-user: cleared on sign-out.
 */
export function rememberResponse(key: string, data: unknown): void {
    try {
        localStorage.setItem(RESPONSE_PREFIX + key, JSON.stringify(data));
    } catch {
        // Storage full or unavailable: the screen just loads normally.
    }
}

export function recallResponse<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(RESPONSE_PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
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

/**
 * Strip plaintext is_correct from every option before a quiz is stored or read, so
 * learners' devices only hold answer hashes (see answer_hash on each question).
 */
export function sanitizeQuizForOffline(quiz: CachedQuiz): CachedQuiz {
    return {
        ...quiz,
        questions: (quiz.questions || []).map((q: any) => ({
            ...q,
            // Explanations usually state the answer; they come back with the verified result.
            explanation: null,
            options: (q.options || []).map((o: any) => ({
                id: o.id,
                option_text: o.option_text,
                ...(o.sort_order !== undefined ? { sort_order: o.sort_order } : {}),
            })),
        })),
    };
}

export async function cacheQuiz(quiz: CachedQuiz): Promise<void> {
    // Older payloads/caches carry plaintext is_correct but no answer_hash. Derive the
    // hash before stripping is_correct, otherwise the quiz could no longer be graded offline.
    const withHashes: CachedQuiz = {
        ...quiz,
        questions: await Promise.all(
            (quiz.questions || []).map(async (q: any) => {
                if (q.answer_hash) return q;
                const correct = (q.options || []).find((o: any) => o.is_correct);
                if (!correct) return q;
                try {
                    return { ...q, answer_hash: await answerHash('q', q.id, correct.id) };
                } catch {
                    return q; // crypto.subtle is unavailable outside secure contexts
                }
            }),
        ),
    };
    const clean = sanitizeQuizForOffline(withHashes);
    await db.quizzes.put({ ...clean, cached_at: new Date().toISOString() });
    void precacheQuizImages(clean);
}

/** The service worker serves /storage/ images from here (vite.config.ts, question-images). */
export const QUESTION_IMAGE_CACHE = 'question-images';

/**
 * Save a quiz's pictures (passage diagrams, question figures) for offline use when the quiz
 * is saved, not only once a learner happens to open that question online.
 */
export async function precacheQuizImages(quiz: Pick<CachedQuiz, 'questions' | 'contexts'>): Promise<void> {
    if (typeof caches === 'undefined') return;
    const urls = new Set<string>();
    const add = (url?: string | null) => {
        if (!url) return;
        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin === window.location.origin) urls.add(parsed.href);
        } catch {
            // not a URL
        }
    };
    (quiz.contexts ?? []).forEach((c) => add(c.image_url));
    (quiz.questions ?? []).forEach((q) => add(q.image_url));
    if (urls.size === 0) return;
    try {
        const cache = await caches.open(QUESTION_IMAGE_CACHE);
        await Promise.all([...urls].map(async (url) => {
            if (await cache.match(url)) return;
            const res = await fetch(url, { credentials: 'same-origin' });
            if (res.ok) await cache.put(url, res);
        }));
    } catch {
        // Storage full or offline: the images load from the network next time.
    }
}

export async function getCachedQuiz(id: number | string): Promise<CachedQuiz | undefined> {
    const numId = Number(id);
    let quiz: CachedQuiz | undefined;
    if (!isNaN(numId)) {
        quiz = await db.quizzes.get(numId);
    }
    if (!quiz) {
        quiz = await db.quizzes.get(String(id) as any);
    }
    return quiz ? sanitizeQuizForOffline(quiz) : undefined;
}

export async function getFreshQuiz(id: number | string): Promise<CachedQuiz | null> {
    const cached = await getCachedQuiz(id);
    // A cached quiz without hashes predates answer hashing and cannot be graded; refresh it.
    const missingHashes = cached?.questions?.some((q: any) => !q.answer_hash);
    if (cached && !missingHashes && !isStale(cached.cached_at)) {
        return cached;
    }
    try {
        const numId = Number(id) || id;
        const res = await fetch(`/api/v1/quizzes/${numId}`);
        if (!res.ok) throw new Error('Failed to fetch quiz');
        const data = await res.json();
        const quiz: CachedQuiz = data.quiz;
        await cacheQuiz(quiz);
        return sanitizeQuizForOffline(quiz);
    } catch {
        return cached || null;
    }
}

/** Re-store quizzes cached before answer hashing so their plaintext answers are removed. */
export async function sanitizeExistingCachedQuizzes(): Promise<void> {
    try {
        const quizzes = await db.quizzes.toArray();
        for (const quiz of quizzes) {
            const exposed = quiz.questions?.some((q: any) =>
                q.explanation || q.options?.some((o: any) => o.is_correct !== undefined)
            );
            if (exposed) {
                await cacheQuiz(quiz);
            }
        }
    } catch {
        // Best effort; getCachedQuiz sanitises on read anyway.
    }
}

if (typeof window !== 'undefined') {
    sanitizeExistingCachedQuizzes().catch(() => {});
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

/** Changes still waiting to reach the server for the signed-in account (set-aside items excluded). */
export async function getPendingSyncCount(userId: string | null = getSyncUser()): Promise<number> {
    const mine = (owner: string | null | undefined) => !userId || belongsTo(owner, userId);
    const [attempts, progress, adminQueue] = await Promise.all([
        db.quizAttempts.filter(a => (!a.synced || (a.synced as any) === 0) && a.sync_status !== 'failed' && mine(a.user_id)).count(),
        db.learnerProgress.filter(p => (!p.synced || (p.synced as any) === 0) && mine(p.user_id)).count(),
        db.syncQueue.filter(q => !q.synced && q.status !== 'failed' && mine(q.user_id)).count(),
    ]);
    return attempts + progress + adminQueue;
}

/** Changes the server rejected; they are kept so the user can retry or discard them. */
export async function getFailedSyncCount(userId: string | null = getSyncUser()): Promise<number> {
    const mine = (owner: string | null | undefined) => !userId || belongsTo(owner, userId);
    const [attempts, adminQueue] = await Promise.all([
        db.quizAttempts.filter(a => a.sync_status === 'failed' && mine(a.user_id)).count(),
        db.syncQueue.filter(q => q.status === 'failed' && mine(q.user_id)).count(),
    ]);
    return attempts + adminQueue;
}

// ── Full Offline Preloading with Live Progress ──

/** Progress of downloading what this user needs offline (any role). */
export interface OfflinePreloadProgress {
    isPreloading: boolean;
    isComplete: boolean;
    total: number;
    completed: number;
    percent: number;
    currentLabel?: string;
    /** Short line once ready, e.g. "22 subjects saved" or "School data saved". */
    savedSummary: string | null;
    /** One sentence on what's available offline, for the badge's details. */
    savedDetail: string | null;
}

let preloadState: OfflinePreloadProgress = {
    isPreloading: false,
    isComplete: false,
    total: 0,
    completed: 0,
    percent: 0,
    savedSummary: null,
    savedDetail: null,
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

const CURRICULUM_DETAIL = 'Your subjects, quizzes and revision cards are saved on this device. Work done offline syncs automatically when you reconnect.';

function curriculumSummary(count: number): string {
    return `${count} subject${count === 1 ? '' : 's'} saved`;
}

export interface PreloadStep {
    label: string;
    run: () => Promise<unknown>;
}

/**
 * Run download steps one after another, reporting progress to the readiness badge.
 * A failed step is skipped (the rest still download); the summary is remembered so the
 * badge shows "ready" on later visits without re-downloading first.
 */
export async function runPreloadSteps(steps: PreloadStep[], summary: string, detail: string): Promise<void> {
    if (preloadState.isPreloading || hasPreloadedThisSession || !navigator.onLine || steps.length === 0) return;

    updatePreloadState({ isPreloading: true, isComplete: false, total: steps.length, completed: 0, percent: 0 });
    for (const [index, step] of steps.entries()) {
        updatePreloadState({ currentLabel: step.label });
        try {
            await step.run();
        } catch (e) {
            console.warn(`[OfflineService] Offline download step "${step.label}" failed:`, e);
        }
        updatePreloadState({ completed: index + 1, percent: Math.round(((index + 1) / steps.length) * 100) });
    }

    hasPreloadedThisSession = true;
    rememberResponse('offline_ready', { summary, detail });
    updatePreloadState({ isPreloading: false, isComplete: true, savedSummary: summary, savedDetail: detail, currentLabel: undefined });
}

/** What the badge can show before this visit's download finishes. */
export function rememberedReadiness(): { summary: string; detail: string } | null {
    return recallResponse<{ summary: string; detail: string }>('offline_ready');
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
        savedSummary: initialCachedCount > 0 ? curriculumSummary(initialCachedCount) : null,
    });

    try {
        // ── STAGE 1: Instant Critical Pack (< 1.5s) ──
        // Page shells are not fetched here: offline, pages are rendered on the device
        // (see OfflineNavigation.ts), so only their data needs to be stored.
        // Fetch and cache subjects catalog
        // Both the learner's school curriculum and general knowledge; the API falls back to
        // general for learners without a school, so de-duplicate by id.
        const scopes = ['school', 'general'] as const;
        const scopeLists = await Promise.all(scopes.map(async (scope) => {
            const res = await fetch(`/api/v1/subjects?scope=${scope}`, { headers: { Accept: 'application/json' } }).catch(() => null);
            if (!res || !res.ok) return null;
            const data = await res.json().catch(() => null);
            const list = data?.subjects || data || [];
            return Array.isArray(list) ? list.map((s: any) => ({ ...s, __scope: scope })) : [];
        }));
        if (scopeLists.every((list) => list === null)) {
            updatePreloadState({ isPreloading: false });
            return;
        }

        const seenSubjectIds = new Set<number>();
        const subjectsList = scopeLists.flat().filter((s: any) => {
            if (!s || seenSubjectIds.has(s.id)) return false;
            seenSubjectIds.add(s.id);
            return true;
        });

        if (!Array.isArray(subjectsList) || subjectsList.length === 0) {
            updatePreloadState({ isPreloading: false, isComplete: true });
            return;
        }

        // Save subjects index to Dexie
        await db.subjects.bulkPut(subjectsList.map(toCachedSubject));

        const totalSubjects = subjectsList.length;
        let completedSubjects = 0;

        updatePreloadState({
            total: totalSubjects,
            completed: 0,
            percent: 0,
            savedSummary: curriculumSummary(totalSubjects),
            savedDetail: CURRICULUM_DETAIL,
        });

        // ── STAGE 2: Concurrent Worker Pool for Topics & Quizzes (Pool of 4) ──
        const downloadSubjectCurriculum = async (subject: any) => {
            try {
                const subRes = await fetch(`/api/v1/subjects/${subject.slug}?scope=${subject.__scope}`, { headers: { Accept: 'application/json' } }).catch(() => null);

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
                                    user_id: getSyncUser() ?? 'current',
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
                                    if (q.questions && q.questions.length > 0) {
                                        await cacheQuiz({ ...q, status: 'published' });
                                    } else {
                                        const quizRes = await fetch(`/api/v1/quizzes/${q.id}`).catch(() => null);
                                        if (quizRes && quizRes.ok) {
                                            const quizData = await quizRes.json();
                                            if (quizData.quiz) {
                                                await cacheQuiz({ ...quizData.quiz, status: 'published' });
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
                    completed: completedSubjects,
                    percent: Math.min(100, Math.round((completedSubjects / totalSubjects) * 100)),
                    currentLabel: subject.name,
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
            completed: totalSubjects,
            savedSummary: curriculumSummary(totalSubjects),
            savedDetail: CURRICULUM_DETAIL,
        });
        rememberResponse('offline_ready', { summary: curriculumSummary(totalSubjects), detail: CURRICULUM_DETAIL });
        hasPreloadedThisSession = true;
        console.log('[OfflineService] 2-stage parallel offline curriculum preloading completed.');

        // Then the past-question bank, so CBT practice and simulations work offline too.
        void preloadPastQuestions();
    } catch (e) {
        console.warn('Background offline preload encountered an error:', e);
        updatePreloadState({
            isPreloading: false,
            isComplete: false,
        });
    }
}

// ── Past questions ──

/** Questions kept per exam for offline use (the API's maximum per request). */
const PAST_QUESTIONS_PER_EXAM = 100;

/**
 * Keep a pool of each exam's past questions on the device (the same localStorage keys the
 * past-questions hub already reads), so simulations and practice can start offline.
 * Answer keys stay on the server; offline simulations are scored when they sync.
 */
export async function preloadPastQuestions(): Promise<void> {
    if (!navigator.onLine) return;
    try {
        const metaRes = await fetch('/api/v1/past-questions/meta', { headers: { Accept: 'application/json' } });
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        if (!meta?.success || !meta.data) return;
        localStorage.setItem('cached_past_questions_meta', JSON.stringify(meta.data));

        const exams: Array<{ code: string; questionCount?: number }> = meta.data.exams || [];
        for (const exam of exams.filter((e) => (e.questionCount ?? 1) > 0)) {
            const params = new URLSearchParams({ exam_code: exam.code, mode: 'simulation', limit: String(PAST_QUESTIONS_PER_EXAM) });
            const res = await fetch(`/api/v1/past-questions/questions?${params}`, { headers: { Accept: 'application/json' } }).catch(() => null);
            const data = res?.ok ? await res.json().catch(() => null) : null;
            if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) continue;
            try {
                localStorage.setItem(`cached_pq_${exam.code}_all`, JSON.stringify(data.data));
            } catch {
                break; // storage full: keep the exams already saved
            }
        }
    } catch (e) {
        console.warn('[OfflineService] Past questions preload failed:', e);
    }
}

// ── Sign-out cleanup ──

const PRIVATE_CACHE_NAMES = ['app-routes-cache', 'pages-cache', 'api-cache', APP_SHELL_CACHE];

/**
 * Remove the signed-out user's data from this device so the next person cannot see it.
 * Unsynced work is kept (it stays tagged with its owner and syncs the next time that
 * person signs in); everything already on the server is cleared.
 */
export async function clearUserOfflineData(userId: string | null): Promise<void> {
    const owned = (owner: string | null | undefined) => !userId || belongsTo(owner, userId);

    forgetAuthUser();
    await clearSnapshots().catch(() => {});

    await db.transaction('rw', [db.quizAttempts, db.learnerProgress, db.gamification, db.userProfile], async () => {
        await db.quizAttempts.filter(a => owned(a.user_id) && (a.synced === true || (a.synced as any) === 1)).delete();
        await db.learnerProgress.filter(p => owned(p.user_id)).delete();
        await db.gamification.filter(g => owned(g.user_id)).delete();
        await db.userProfile.clear();
    });

    // Admin/teacher caches: keep only records with changes still waiting to sync.
    const adminTables = [db.adminLearners, db.adminSchools, db.adminClasses, db.adminQuestions, db.adminSchoolAdmins, db.adminTeachers];
    for (const table of adminTables) {
        await (table as any).filter((r: any) => !r._pendingSync).delete();
    }

    try {
        // Per-user dashboard copies kept for offline display.
        const privatePrefixes = ['cached_dashboard_', 'cached_admin_', 'cached_teacher_', RESPONSE_PREFIX];
        Object.keys(localStorage)
            .filter(k => privatePrefixes.some(prefix => k.startsWith(prefix)))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // ignore
    }

    // Cached pages and API responses contain the previous user's data.
    if (typeof caches !== 'undefined') {
        await Promise.all(PRIVATE_CACHE_NAMES.map(name => caches.delete(name).catch(() => false)));
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
