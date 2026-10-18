import Dexie, { type Table } from 'dexie';

// ── Offline Table Interfaces ──

export interface CachedSubject {
    id: number;
    school_id?: number | null;
    school_name?: string | null;
    class_id?: number | null;
    class_name?: string | null;
    class_grade_level?: string | null;
    progress_percent?: number;
    topics_count?: number;
    is_general_knowledge?: boolean;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    sort_order: number;
    cached_at: string;
}

export interface CachedTopic {
    id: number;
    subject_id: number;
    name: string;
    slug: string;
    level: string;
    description: string | null;
    status: string;
    sort_order: number;
    cached_at: string;
}

export interface CachedQuiz {
    id: number;
    school_id?: number | null;
    is_general_knowledge?: boolean;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    status: string;
    questions: CachedQuestion[];
    cached_at: string;
}

export interface CachedQuestion {
    id: number;
    school_id?: number | null;
    topic_id: number;
    question_text: string;
    image_url?: string | null;
    type: string;
    difficulty: string;
    explanation: string | null;
    status: string;
    answer_hash?: string | null;
    marks?: number;
    options: CachedQuestionOption[];
}

export interface CachedQuestionOption {
    id: number;
    question_id: number;
    option_text: string;
    sort_order: number;
    is_correct?: boolean;
}

export interface CachedFlashcard {
    id: number;
    subject_name: string;
    topic_name: string;
    question_text: string;
    correct_answer: string;
    explanation: string;
    cached_at: string;
}

export interface LocalQuizAttempt {
    id: string;
    user_id: string;
    quiz_id: number;
    quiz_title?: string;
    status: 'started' | 'completed';
    score: number | null;
    total_marks: number | null;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    answers: LocalQuizAnswer[];
    synced: boolean;
    sync_status?: 'pending' | 'failed';
    sync_error?: string | null;
    sync_attempts?: number;
    next_sync_at?: string | null;
}

export interface LocalQuizAnswer {
    id: string;
    quiz_attempt_id: string;
    question_id: number;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    correct_option_id?: number | null;
    answered_at: string | null;
}

export interface LocalLearnerProgress {
    id?: number;
    user_id: string;
    topic_id: number;
    questions_attempted: number;
    questions_correct: number;
    mastery_score: number;
    ability_score?: number;
    last_attempted_at: string | null;
    synced: boolean;
}

export interface LocalGamification {
    id?: number;
    user_id: string;
    total_xp: number;
    level: number;
    tier?: string;
    current_streak: number;
    longest_streak: number;
    streak_freeze_count?: number;
    last_active_date: string | null;
    synced: boolean;
}

import type { Learner, SchoolItem, ClassItem, QuestionItem, SchoolAdminItem, TeacherItem } from '../types/admin';

export interface SyncQueueItem {
    id?: number;
    table_name: string;
    action: 'insert' | 'update' | 'delete';
    record_id: string;
    endpoint: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    payload: string;
    created_at: string;
    synced: boolean;
    retries: number;
    error?: string;
    /** Sent as the Idempotency-Key header on every attempt, so the server applies the change once. */
    idempotency_key?: string;
    /** Account that made the change; it is only ever synced under that account. Null for legacy items. */
    user_id?: string | null;
    /** 'pending' = will sync; 'failed' = the server rejected it, kept for the user to retry or discard. */
    status?: 'pending' | 'failed';
    /** True once a request may have reached the server; such items are never merged with later edits. */
    sent?: boolean;
    next_attempt_at?: string | null;
}

export interface CachedUserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    school_id?: number | null;
    school_name?: string | null;
    cached_at: string;
}

/**
 * The server data (Inertia props) of a page the user opened while online, so the page
 * can be rendered on the device when it is opened again offline.
 */
export interface PageSnapshot {
    /** pathname + search, e.g. "/teacher/dashboard?class_id=3" */
    key: string;
    component: string;
    props: Record<string, unknown>;
    user_id: string | null;
    saved_at: string;
}

// ── Dexie Database ──

export class OfflineDB extends Dexie {
    subjects!: Table<CachedSubject, number>;
    topics!: Table<CachedTopic, number>;
    quizzes!: Table<CachedQuiz, number>;
    flashcards!: Table<CachedFlashcard, number>;
    quizAttempts!: Table<LocalQuizAttempt, string>;
    learnerProgress!: Table<LocalLearnerProgress, number>;
    gamification!: Table<LocalGamification, number>;
    syncQueue!: Table<SyncQueueItem, number>;
    userProfile!: Table<CachedUserProfile, string>;
    adminLearners!: Table<Learner, string>;
    adminSchools!: Table<SchoolItem, number>;
    adminClasses!: Table<ClassItem, number>;
    adminQuestions!: Table<QuestionItem, number>;
    adminSchoolAdmins!: Table<SchoolAdminItem, string>;
    adminTeachers!: Table<TeacherItem, string>;
    pageSnapshots!: Table<PageSnapshot, string>;

    constructor() {
        super('AceDrillDatabase');

        // Versions are only ever added, never edited, so existing devices upgrade in place
        // and keep their unsynced work.
        this.version(4).stores({
            subjects: 'id, school_id, slug, status, cached_at, _pendingSync',
            topics: 'id, subject_id, slug, level, status, cached_at, _pendingSync',
            quizzes: 'id, school_id, status, cached_at',
            flashcards: 'id, subject_name, topic_name, cached_at',
            quizAttempts: 'id, user_id, quiz_id, status, synced, completed_at',
            learnerProgress: 'id, user_id, topic_id, synced',
            gamification: 'id, user_id, synced',
            syncQueue: '++id, table_name, action, synced, created_at',
            userProfile: 'id, role, school_id',
            adminLearners: 'id, name, email, _pendingSync',
            adminSchools: 'id, name, _pendingSync',
            adminClasses: 'id, school_id, name, _pendingSync',
            adminQuestions: 'id, topic_id, school_id, _pendingSync',
            adminSchoolAdmins: 'id, email, school_id, _pendingSync',
            adminTeachers: 'id, email, name, _pendingSync',
        });

        this.version(5).stores({
            syncQueue: '++id, table_name, action, synced, created_at, status, record_id, user_id',
        }).upgrade(async (tx) => {
            await tx.table('syncQueue').toCollection().modify((item: SyncQueueItem) => {
                item.status = item.status ?? 'pending';
                item.idempotency_key = item.idempotency_key ?? crypto.randomUUID();
                item.user_id = item.user_id ?? null;
                // It may already have been attempted, so never merge later edits into it.
                item.sent = item.sent ?? (item.retries ?? 0) > 0;
            });
        });

        this.version(6).stores({
            pageSnapshots: 'key, user_id, saved_at',
        });
    }
}

export const db = new OfflineDB();

// Never delete the database on an open/upgrade error: it holds unsynced work.
// A VersionError means an older cached copy of the app is running against a newer
// database; reloading picks up the current app, which opens it normally.
db.open().catch((err) => {
    console.error('[OfflineDB] Could not open the offline database:', err);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:offline-db-error', { detail: { name: err?.name } }));
    }
});
