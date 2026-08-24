import Dexie, { type Table } from 'dexie';

// ── Offline Table Interfaces ──

export interface CachedSubject {
    id: number;
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
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    status: string;
    questions: CachedQuestion[];
    cached_at: string;
}

export interface CachedQuestion {
    id: number;
    topic_id: number;
    question_text: string;
    type: string;
    difficulty: string;
    explanation: string | null;
    status: string;
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
    status: 'started' | 'completed';
    score: number | null;
    total_marks: number | null;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    answers: LocalQuizAnswer[];
    synced: boolean;
}

export interface LocalQuizAnswer {
    id: string;
    quiz_attempt_id: string;
    question_id: number;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    answered_at: string | null;
}

export interface LocalLearnerProgress {
    id?: number;
    user_id: string;
    topic_id: number;
    questions_attempted: number;
    questions_correct: number;
    mastery_score: number;
    ability_score: number;
    last_attempted_at: string | null;
    synced: boolean;
}

export interface LocalGamification {
    id?: number;
    user_id: string;
    total_xp: number;
    level: number;
    rank: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    synced: boolean;
}

export interface SyncQueueItem {
    id?: number;
    table_name: string;
    action: 'insert' | 'update' | 'delete';
    record_id: string;
    payload: string;
    created_at: string;
    synced: boolean;
    retries: number;
}

export interface CachedUserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    cached_at: string;
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

    constructor() {
        super('OfflineAIDatabase');

        this.version(1).stores({
            subjects: 'id, slug, status, cached_at',
            topics: 'id, subject_id, slug, level, status, cached_at',
            quizzes: 'id, status, cached_at',
            flashcards: 'id, subject_name, topic_name, cached_at',
            quizAttempts: 'id, user_id, quiz_id, status, synced, completed_at',
            learnerProgress: 'id, user_id, topic_id, synced',
            gamification: 'id, user_id, synced',
            syncQueue: '++id, table_name, action, synced, created_at',
            userProfile: 'id, role',
        });
    }
}

export const db = new OfflineDB();
