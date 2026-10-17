import { db } from "../db/database";
import {
    cacheAdminLearners,
    cacheAdminSchools,
    cacheAdminClasses,
    cacheAdminQuestions,
    cacheAdminSubjects,
    cacheAdminSchoolAdmins,
    cacheAdminTeachers,
    getAdminAuthHeaders,
} from "./AdminOfflineService";
import type {
    CachedSubject,
    CachedTopic,
    CachedQuiz,
    CachedFlashcard,
    LocalQuizAttempt,
    LocalLearnerProgress,
    LocalGamification,
    CachedUserProfile,
} from "../db/database";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isStale(cachedAt: string): boolean {
    return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS;
}

// ── Subjects ──

export async function cacheSubjects(subjects: CachedSubject[]): Promise<void> {
    await db.subjects.bulkPut(
        subjects.map((s) => ({ ...s, cached_at: new Date().toISOString() })),
    );
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
        const res = await fetch("/api/v1/subjects");
        if (!res.ok) throw new Error("Failed to fetch subjects");
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
    await db.topics.bulkPut(
        topics.map((t) => ({ ...t, cached_at: new Date().toISOString() })),
    );
}

export async function getCachedTopics(
    subjectId?: number,
): Promise<CachedTopic[]> {
    if (subjectId) {
        return db.topics.where("subject_id").equals(subjectId).toArray();
    }
    return db.topics.toArray();
}

export async function getFreshTopics(
    subjectId: number,
): Promise<CachedTopic[]> {
    const cached = await getCachedTopics(subjectId);
    if (cached.length > 0 && !isStale(cached[0].cached_at)) {
        return cached;
    }
    try {
        const res = await fetch(`/api/v1/subjects/${subjectId}/topics`);
        if (!res.ok) throw new Error("Failed to fetch topics");
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
 * Sanitize quiz object before saving or retrieving from IndexedDB so that options NEVER
 * retain plaintext 'is_correct' flags (neither true nor false), preventing DevTools inspection.
 */
export function sanitizeQuizForOffline(quiz: CachedQuiz): CachedQuiz {
    return {
        ...quiz,
        questions: (quiz.questions || []).map((q: any) => ({
            ...q,
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
                    return { ...q, answer_hash: await answerHashFor(q.id, correct.id) };
                } catch {
                    return q; // crypto.subtle is unavailable outside secure contexts
                }
            }),
        ),
    };
    const clean = sanitizeQuizForOffline(withHashes);
    await db.quizzes.put({ ...clean, cached_at: new Date().toISOString() });
}

export async function getCachedQuiz(
    id: number | string,
): Promise<CachedQuiz | undefined> {
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

export async function getFreshQuiz(
    id: number | string,
): Promise<CachedQuiz | null> {
    const cached = await getCachedQuiz(id);
    const hasDirtyOptions = cached?.questions?.some((q: any) =>
        !q.answer_hash || q.options?.some((o: any) => o.is_correct !== undefined)
    );

    if (cached && !hasDirtyOptions && !isStale(cached.cached_at)) {
        return cached;
    }

    try {
        const numId = Number(id) || id;
        const res = await fetch(`/api/v1/quizzes/${numId}`);
        if (!res.ok) throw new Error("Failed to fetch quiz");
        const data = await res.json();
        const quiz: CachedQuiz = data.quiz;
        await cacheQuiz(quiz);
        return sanitizeQuizForOffline(quiz);
    } catch {
        return cached || null;
    }
}

/**
 * Automatically cleans any legacy cached quizzes in IndexedDB that may have
 * stored plaintext is_correct flags.
 */
export async function sanitizeExistingCachedQuizzes(): Promise<void> {
    try {
        const quizzes = await db.quizzes.toArray();
        for (const quiz of quizzes) {
            const hasExposed = quiz.questions?.some((q: any) =>
                q.options?.some((o: any) => o.is_correct !== undefined)
            );
            if (hasExposed) {
                await cacheQuiz(quiz);
            }
        }
    } catch {}
}

// Run background sanitization
if (typeof window !== 'undefined') {
    sanitizeExistingCachedQuizzes().catch(() => {});
}

// ── Flashcards ──

export async function cacheFlashcards(
    flashcards: CachedFlashcard[],
): Promise<void> {
    await db.flashcards.bulkPut(
        flashcards.map((f) => ({ ...f, cached_at: new Date().toISOString() })),
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
        const res = await fetch("/api/v1/flashcards/deck");
        if (!res.ok) throw new Error("Failed to fetch flashcards");
        const data = await res.json();
        const cards: CachedFlashcard[] = data.deck || [];
        await cacheFlashcards(cards);
        return cards;
    } catch {
        return cached;
    }
}

// ── Quiz Cryptographic Grading Helpers (Offline Safe) ──

/**
 * Verify whether an option is correct by comparing against the cryptographic salted hash.
 * This ensures the client never needs plaintext 'is_correct: true' stored in IndexedDB.
 */
export async function verifyOptionHash(
    questionId: number,
    optionId: number,
    answerHash?: string | null
): Promise<boolean> {
    if (!answerHash || !optionId) return false;
    try {
        return (await answerHashFor(questionId, optionId)) === answerHash;
    } catch {
        return false;
    }
}

/** Same scheme as the server's answer_hash (QuizWebController / SubjectWebController). */
async function answerHashFor(questionId: number, optionId: number): Promise<string> {
    const data = new TextEncoder().encode(`acedrill_salt_q_${questionId}_opt_${optionId}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Identify the correct option ID from a list of options using the salted hash.
 * Used upon quiz submission to record which option was correct for the post-exam review screen.
 */
export async function findCorrectOptionId(
    questionId: number,
    options: Array<{ id: number; is_correct?: boolean }>,
    answerHash?: string | null
): Promise<number | null> {
    if (answerHash) {
        for (const opt of options) {
            const isMatch = await verifyOptionHash(questionId, opt.id, answerHash);
            if (isMatch) return opt.id;
        }
    }
    const fallback = options.find((o) => Boolean(o.is_correct));
    return fallback ? fallback.id : null;
}

// ── Quiz Attempts (Local) ──

export async function saveLocalAttempt(
    attempt: LocalQuizAttempt,
): Promise<void> {
    await db.quizAttempts.put(attempt);
}

export async function getLocalAttempt(
    id: string,
): Promise<LocalQuizAttempt | undefined> {
    return db.quizAttempts.get(id);
}

export async function getLocalAttempts(
    userId: string,
): Promise<LocalQuizAttempt[]> {
    return db.quizAttempts.where("user_id").equals(userId).toArray();
}

export async function getUnsyncedAttempts(): Promise<LocalQuizAttempt[]> {
    return db.quizAttempts
        .filter((a) => !a.synced || (a.synced as any) === 0)
        .toArray();
}

export async function markAttemptSynced(id: string): Promise<void> {
    const attempt = await db.quizAttempts.get(id);
    if (attempt) {
        await db.quizAttempts.update(id, { synced: true });
    }
}

// ── Learner Progress (Local) ──

export async function saveLocalProgress(
    progress: LocalLearnerProgress,
): Promise<void> {
    if (!progress.id) {
        const existing = await db.learnerProgress
            .where("user_id")
            .equals(progress.user_id)
            .and((p) => p.topic_id === progress.topic_id)
            .first();
        if (existing && existing.id) {
            progress.id = existing.id;
        } else {
            progress.id = Number(progress.topic_id) || Date.now();
        }
    }
    await db.learnerProgress.put(progress);
}

export async function getLocalProgress(
    userId: string,
): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress.where("user_id").equals(userId).toArray();
}

export async function getUnsyncedProgress(): Promise<LocalLearnerProgress[]> {
    return db.learnerProgress
        .filter((p) => !p.synced || (p.synced as any) === 0)
        .toArray();
}

export async function markProgressSynced(id: number): Promise<void> {
    await db.learnerProgress.update(id, { synced: true });
}

// ── Gamification (Local) ──

export async function saveLocalGamification(
    gamification: LocalGamification,
): Promise<void> {
    if (!gamification.id) {
        const existing = await db.gamification
            .where("user_id")
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

export async function getLocalGamification(
    userId: string,
): Promise<LocalGamification | undefined> {
    const results = await db.gamification
        .where("user_id")
        .equals(userId)
        .toArray();
    return results[0];
}

export async function getUnsyncedGamification(): Promise<LocalGamification[]> {
    return db.gamification
        .filter((g) => !g.synced || (g.synced as any) === 0)
        .toArray();
}

export async function markGamificationSynced(id: number): Promise<void> {
    await db.gamification.update(id, { synced: true });
}

export async function getUnsyncedTotalCount(): Promise<{
    total: number;
    attempts: number;
    progress: number;
    queue: number;
}> {
    try {
        const [attempts, progress, queue] = await Promise.all([
            getUnsyncedAttempts().catch(() => []),
            getUnsyncedProgress().catch(() => []),
            db.syncQueue.filter((q) => !q.synced || (q.synced as any) === 0).toArray().catch(() => []),
        ]);
        const total = attempts.length + progress.length + queue.length;
        return {
            total,
            attempts: attempts.length,
            progress: progress.length,
            queue: queue.length,
        };
    } catch {
        return { total: 0, attempts: 0, progress: 0, queue: 0 };
    }
}

export async function purgeUserCacheOnLogout(): Promise<void> {
    try {
        await Promise.all([
            db.userProfile.clear().catch(() => {}),
            db.learnerProgress.clear().catch(() => {}),
            db.gamification.clear().catch(() => {}),
            db.quizAttempts.clear().catch(() => {}),
            db.syncQueue.clear().catch(() => {}),
            db.adminSchools.clear().catch(() => {}),
            db.adminLearners.clear().catch(() => {}),
            db.adminClasses.clear().catch(() => {}),
            db.adminQuestions.clear().catch(() => {}),
            db.adminSchoolAdmins.clear().catch(() => {}),
            db.adminTeachers.clear().catch(() => {}),
        ]);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('cached_admin_stats');
            localStorage.removeItem('cached_teacher_stats');
            localStorage.removeItem('cached_learner_stats');
        }
    } catch (e) {
        console.warn('[OfflineService] Failed purging local user cache on logout:', e);
    }
}

export async function cacheUserProfile(
    profile: CachedUserProfile,
): Promise<void> {
    await db.userProfile.put({
        ...profile,
        cached_at: new Date().toISOString(),
    });
}

export async function getCachedUserProfile(): Promise<
    CachedUserProfile | undefined
> {
    const all = await db.userProfile.toArray();
    return all[0];
}

// ── Stats ──

export async function getPendingSyncCount(): Promise<number> {
    const [attempts, progress, gamification, adminQueue] = await Promise.all([
        db.quizAttempts
            .filter((a) => !a.synced || (a.synced as any) === 0)
            .count(),
        db.learnerProgress
            .filter((p) => !p.synced || (p.synced as any) === 0)
            .count(),
        db.gamification
            .filter((g) => !g.synced || (g.synced as any) === 0)
            .count(),
        db.syncQueue.filter((q) => !q.synced).count(),
    ]);
    return attempts + progress + gamification + adminQueue;
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
        const el =
            document.getElementById("app") ||
            document.querySelector("[data-page]");
        if (el && el.getAttribute("data-page")) {
            const page = JSON.parse(el.getAttribute("data-page") || "{}");
            return page.version || "";
        }
    } catch {
        // ignore
    }
    return "";
}

/**
 * Pre-warm a route by fetching the full HTML page and storing it in
 * the SW runtime caches.
 */
async function prewarmRoute(url: string): Promise<void> {
    const fullUrl = new URL(url, window.location.origin).href;

    try {
        const appCache = await caches.open("app-routes-cache");
        const pagesCache = await caches.open("pages-cache");

        // 1. Prewarm HTML document
        const htmlRes = await fetch(fullUrl, {
            credentials: "same-origin",
            headers: { Accept: "text/html" },
        }).catch(() => null);

        if (htmlRes && htmlRes.ok) {
            await appCache.put(fullUrl, htmlRes.clone());
            await pagesCache.put(fullUrl, htmlRes);
        }

        // 2. Prewarm Inertia JSON payload
        const inertiaVersion = getInertiaVersion();
        const inertiaHeaders: Record<string, string> = {
            "X-Inertia": "true",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html, application/xhtml+xml",
        };
        if (inertiaVersion) {
            inertiaHeaders["X-Inertia-Version"] = inertiaVersion;
        }

        const inertiaRes = await fetch(fullUrl, {
            credentials: "same-origin",
            headers: inertiaHeaders,
        }).catch(() => null);

        if (inertiaRes && inertiaRes.ok) {
            const inertiaReq = new Request(fullUrl, {
                headers: { "X-Inertia": "true" },
            });
            await appCache.put(inertiaReq, inertiaRes);
        }
    } catch {
        // Best-effort: silent fail is fine
    }
}

/**
 * Multi-Role Offline Data & Curriculum Preloader
 * Downloads critical routes, statistics, question bank, classes, learners, and curriculum
 * Supports: 'learner', 'teacher', 'school_admin', 'platform_admin'
 */
export async function preloadFullOfflineData(
    role?: string,
    force = false,
): Promise<void> {
    if ((preloadState.isPreloading || hasPreloadedThisSession) && !force)
        return;
    if (!navigator.onLine) return;

    const initialCachedCount = await (async () => {
        try {
            const [sub, q, c, l, qz] = await Promise.all([
                db.subjects.count().catch(() => 0),
                db.adminQuestions.count().catch(() => 0),
                db.adminClasses.count().catch(() => 0),
                db.adminLearners.count().catch(() => 0),
                db.quizzes.count().catch(() => 0),
            ]);
            return sub + q + c + l + qz;
        } catch {
            return 0;
        }
    })();

    updatePreloadState({
        isPreloading: true,
        isComplete: false,
        percent: 5,
        cachedSubjectsCount: initialCachedCount,
    });

    try {
        const isTeacher = role === "teacher";
        const isAdmin = role === "school_admin";
        const isSuperAdmin = role === "platform_admin";
        const isAnyAdmin = isAdmin || isSuperAdmin;

        // ── STAGE 1: Pre-warm Routes & Essential Snapshots (< 1.5s) ──
        const routesToPrewarm = [
            "/dashboard",
            "/subjects",
            "/flashcards",
            "/past-questions",
        ];
        if (isTeacher) routesToPrewarm.push("/teacher/dashboard");
        if (isAdmin) {
            routesToPrewarm.push("/admin/dashboard");
            routesToPrewarm.push("/school-admin/dashboard");
        }
        if (isSuperAdmin) {
            routesToPrewarm.push("/super-admin/dashboard");
            routesToPrewarm.push("/admin/dashboard");
        }

        await Promise.allSettled(routesToPrewarm.map((r) => prewarmRoute(r)));
        updatePreloadState({ percent: 15 });

        // ── STAGE 2: Role-Specific API Caches ──
        const adminHeaders = getAdminAuthHeaders();

        if (isTeacher) {
            // Teacher: Cache teacher stats, question bank, classes, and learners
            await Promise.allSettled([
                fetch("/api/v1/teacher/stats", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((data) => {
                        if (data && data.overview) {
                            try {
                                localStorage.setItem(
                                    "cached_teacher_stats_all",
                                    JSON.stringify(data),
                                );
                            } catch {}
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/questions", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.questions || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminQuestions(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/classes", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.classes || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminClasses(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/learners", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.learners || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminLearners(items);
                        }
                    })
                    .catch(() => null),
            ]);
            updatePreloadState({ percent: 35 });
        } else if (isAnyAdmin) {
            // Admin (School Admin) or Super Admin (Platform Admin)
            const adminPromises: Promise<any>[] = [
                fetch("/api/v1/admin/stats", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((data) => {
                        const statsData =
                            data?.status === "success"
                                ? data.data
                                : data?.overview
                                  ? data
                                  : null;
                        if (statsData) {
                            try {
                                localStorage.setItem(
                                    "cached_admin_stats",
                                    JSON.stringify(statsData),
                                );
                                localStorage.setItem(
                                    "cached_school_admin_stats",
                                    JSON.stringify(statsData),
                                );
                                if (isSuperAdmin)
                                    localStorage.setItem(
                                        "cached_super_admin_stats",
                                        JSON.stringify(statsData),
                                    );
                            } catch {}
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/schools", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.schools || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminSchools(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/classes", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.classes || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminClasses(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/teachers", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.teachers || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminTeachers(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/learners", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.learners || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminLearners(items);
                        }
                    })
                    .catch(() => null),
                fetch("/api/v1/admin/questions", {
                    headers: adminHeaders,
                    credentials: "include",
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then(async (data) => {
                        const items = data?.questions || data?.data || [];
                        if (Array.isArray(items) && items.length > 0) {
                            await cacheAdminQuestions(items);
                        }
                    })
                    .catch(() => null),
            ];

            if (isSuperAdmin) {
                adminPromises.push(
                    fetch("/api/v1/admin/school-admins", {
                        headers: adminHeaders,
                        credentials: "include",
                    })
                        .then((r) => (r.ok ? r.json() : null))
                        .then(async (data) => {
                            const items = data?.admins || data?.data || [];
                            if (Array.isArray(items) && items.length > 0) {
                                await cacheAdminSchoolAdmins(items);
                            }
                        })
                        .catch(() => null),
                );
            }

            await Promise.allSettled(adminPromises);
            updatePreloadState({ percent: 45 });
        }

        // ── STAGE 3: Curriculum Catalog & Subjects Index ──
        // Learners and teachers need both their school's subjects (where class quizzes
        // live) and the general-knowledge catalogue. Each subject remembers which scope
        // it came from so its details are fetched with the same scope.
        const fetchSubjectList = async (endpoint: string, scope: string | null) => {
            const res = await fetch(endpoint, {
                headers: isAnyAdmin ? adminHeaders : {},
                credentials: "include",
            }).catch(() => null);
            if (!res || !res.ok) return null;
            const data = await res.json();
            const list = data?.subjects || data?.data || data || [];
            return Array.isArray(list)
                ? list.map((s: any) => ({ ...s, _scope: scope }))
                : [];
        };

        const subjectLists = isAnyAdmin
            ? [await fetchSubjectList("/api/v1/admin/subjects", null)]
            : await Promise.all([
                  fetchSubjectList("/api/v1/subjects", "school"),
                  fetchSubjectList("/api/v1/subjects?scope=general", "general"),
              ]);

        let subjectsList: any[] = [];
        if (subjectLists.some((list) => list !== null)) {
            const byId = new Map<number, any>();
            for (const s of subjectLists.flatMap((list) => list || [])) {
                if (!byId.has(s.id)) byId.set(s.id, s);
            }
            subjectsList = [...byId.values()];
            if (subjectsList.length > 0) {
                if (isAnyAdmin) {
                    await cacheAdminSubjects(subjectsList);
                } else {
                    await db.subjects.bulkPut(
                        subjectsList.map((s: any) => ({
                            id: s.id,
                            school_id: s.school_id,
                            school_name: s.school_name,
                            is_general_knowledge: s.is_general_knowledge,
                            name: s.name,
                            slug: s.slug,
                            description: s.description,
                            status: "published",
                            sort_order: 0,
                            progress_percent: s.progress_percent || 0,
                            topics_count: s.topics_count || 0,
                            cached_at: new Date().toISOString(),
                        })),
                    );
                }
            }
        }

        // Fallback to general subjects if admin subjects returned empty
        if (subjectsList.length === 0) {
            const fallbackRes = await fetch(
                "/api/v1/subjects?scope=general",
            ).catch(() => null);
            if (fallbackRes && fallbackRes.ok) {
                const fbData = await fallbackRes.json();
                subjectsList = fbData?.subjects || fbData || [];
                if (Array.isArray(subjectsList) && subjectsList.length > 0) {
                    await db.subjects.bulkPut(
                        subjectsList.map((s: any) => ({
                            id: s.id,
                            school_id: s.school_id,
                            school_name: s.school_name,
                            is_general_knowledge: s.is_general_knowledge,
                            name: s.name,
                            slug: s.slug,
                            description: s.description,
                            status: "published",
                            sort_order: 0,
                            progress_percent: s.progress_percent || 0,
                            topics_count: s.topics_count || 0,
                            cached_at: new Date().toISOString(),
                        })),
                    );
                }
            }
        }

        const totalSubjects = subjectsList.length;
        let completedSubjects = 0;
        const basePercent = isTeacher ? 35 : isAnyAdmin ? 45 : 15;
        const remainingPercent = 100 - basePercent;

        updatePreloadState({
            totalSubjects,
            completedSubjects: 0,
            percent: basePercent,
        });

        // ── STAGE 4: Concurrent Worker Pool for Topics, Quizzes & Flashcards ──
        if (totalSubjects > 0) {
            const downloadSubjectCurriculum = async (subject: any) => {
                try {
                    const slug = subject.slug || subject.id;
                    const [, subRes] = await Promise.all([
                        prewarmRoute(`/subjects/${slug}`),
                        fetch(
                            `/api/v1/subjects/${slug}?scope=${subject._scope || "general"}`,
                        ).catch(() => null),
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
                                    status: "published",
                                    sort_order: 0,
                                    cached_at: new Date().toISOString(),
                                })),
                            );

                            // Save topic progress if present
                            const progressList: LocalLearnerProgress[] = [];
                            for (const t of subData.topics) {
                                if (t.progress) {
                                    progressList.push({
                                        id: t.progress.id || t.id,
                                        user_id: "current",
                                        topic_id: t.id,
                                        questions_attempted:
                                            t.progress.questions_attempted || 0,
                                        questions_correct:
                                            t.progress.questions_correct || 0,
                                        mastery_score:
                                            t.progress.mastery_score || 0,
                                        ability_score:
                                            t.progress.ability_score || 0,
                                        synced: true,
                                        last_attempted_at:
                                            new Date().toISOString(),
                                    });
                                }
                            }
                            if (progressList.length > 0) {
                                await db.learnerProgress.bulkPut(progressList);
                            }
                        }

                        // Save quizzes
                        if (subData.quizzes && subData.quizzes.length > 0) {
                            await Promise.allSettled(
                                subData.quizzes.map(async (q: any) => {
                                    try {
                                        await prewarmRoute(`/quizzes/${q.id}`);
                                        if (
                                            q.questions &&
                                            q.questions.length > 0
                                        ) {
                                            await cacheQuiz({
                                                ...q,
                                                status: "published",
                                            });
                                        } else {
                                            const quizRes = await fetch(
                                                `/api/v1/quizzes/${q.id}`,
                                            ).catch(() => null);
                                            if (quizRes && quizRes.ok) {
                                                const quizData =
                                                    await quizRes.json();
                                                if (quizData.quiz) {
                                                    await cacheQuiz({
                                                        ...quizData.quiz,
                                                        status: "published",
                                                    });
                                                }
                                            }
                                        }
                                    } catch {}
                                }),
                            );
                        }
                    }
                } catch {
                } finally {
                    completedSubjects++;
                    const progressRatio = completedSubjects / totalSubjects;
                    const calculatedPercent = Math.min(
                        99,
                        Math.round(
                            basePercent + progressRatio * remainingPercent,
                        ),
                    );
                    updatePreloadState({
                        completedSubjects,
                        percent: calculatedPercent,
                        currentSubjectName: subject.name,
                    });
                }
            };

            const CONCURRENCY = 4;
            let queueIndex = 0;
            const workers = Array.from(
                { length: Math.min(CONCURRENCY, subjectsList.length) },
                async () => {
                    while (queueIndex < subjectsList.length) {
                        const item = subjectsList[queueIndex++];
                        await downloadSubjectCurriculum(item);
                    }
                },
            );

            // Also fetch and cache flashcards deck in parallel
            const flashcardsPromise = fetch("/api/v1/flashcards/deck")
                .then(async (flashRes) => {
                    if (flashRes.ok) {
                        const flashData = await flashRes.json();
                        if (flashData.deck && flashData.deck.length > 0) {
                            await db.flashcards.bulkPut(
                                flashData.deck.map((f: any) => ({
                                    ...f,
                                    cached_at: new Date().toISOString(),
                                })),
                            );
                        }
                    }
                })
                .catch(() => null);

            await Promise.all([...workers, flashcardsPromise]);
        }

        const finalCachedCount = await (async () => {
            try {
                const [sub, q, c, l, qz] = await Promise.all([
                    db.subjects.count().catch(() => 0),
                    db.adminQuestions.count().catch(() => 0),
                    db.adminClasses.count().catch(() => 0),
                    db.adminLearners.count().catch(() => 0),
                    db.quizzes.count().catch(() => 0),
                ]);
                return sub + q + c + l + qz;
            } catch {
                return totalSubjects;
            }
        })();

        updatePreloadState({
            isPreloading: false,
            isComplete: true,
            percent: 100,
            completedSubjects: totalSubjects,
            cachedSubjectsCount: finalCachedCount,
        });
        hasPreloadedThisSession = true;
        console.log(
            `[OfflineService] Offline data preloading for role "${role || "learner"}" completed.`,
        );
    } catch (e) {
        console.warn("Background offline preload encountered an error:", e);
        updatePreloadState({
            isPreloading: false,
            isComplete: false,
        });
    }
}

/**
 * Legacy alias for learner offline curriculum preload
 */
export async function preloadFullOfflineCurriculum(
    force = false,
): Promise<void> {
    return preloadFullOfflineData("learner", force);
}

// ── Wipe (for logout) ──

export async function clearAllOfflineData(): Promise<void> {
    await db.transaction(
        "rw",
        db.subjects,
        db.topics,
        db.quizzes,
        db.flashcards,
        async () => {
            await db.subjects.clear();
            await db.topics.clear();
            await db.quizzes.clear();
            await db.flashcards.clear();
        },
    );
    await db.transaction(
        "rw",
        db.quizAttempts,
        db.learnerProgress,
        db.gamification,
        db.syncQueue,
        db.userProfile,
        async () => {
            await db.quizAttempts.clear();
            await db.learnerProgress.clear();
            await db.gamification.clear();
            await db.syncQueue.clear();
            await db.userProfile.clear();
        },
    );
}
