export interface RevisionBadge {
    label: string;
    description: string;
    color: 'error' | 'accent' | 'success' | 'primary';
    icon: string;
}

export interface RevisionOption {
    id: number;
    key: string;
    label: string;
    option_text: string;
    is_correct?: boolean;
}

export interface RevisionQueueItem {
    id: number;
    item_type: 'question' | 'past_question';
    question_id?: number | null;
    past_question_id?: number | null;
    subject_name: string;
    topic_name: string;
    exam_code?: string | null;
    exam_year?: number | null;
    question_text: string;
    passage_text?: string | null;
    /** A school question about a shared passage carries that passage. */
    context?: import('@/components/quiz/PassageView').QuizContext | null;
    image_url?: string | null;
    explanation?: string | null;
    /** Offline marking (see AnswerKey.ts): hash of the correct option and the sealed explanation. */
    answer_hash?: string | null;
    explanation_sealed?: string | null;
    repetition_level: number;
    consecutive_correct: number;
    interval_days: number;
    last_reviewed_at?: string | null;
    badge: RevisionBadge;
    options: RevisionOption[];
}

export interface RevisionStats {
    total_in_memory: number;
    due_today: number;
    mastered_items: number;
    learning_items: number;
    retention_rate: number;
}

export interface TodayRevisionData {
    total_due_today: number;
    estimated_minutes: number;
    stats: RevisionStats;
    items: RevisionQueueItem[];
}

export interface RevisionSubmitResult {
    success: boolean;
    is_correct: boolean;
    correct_option_id?: number;
    correct_option_text?: string;
    explanation?: string;
    new_interval_days: number;
    next_review_in: string;
    is_mastered: boolean;
    xp_earned: number;
    total_xp?: number;
    level?: number;
}

export interface RevisionSessionCompleteResult {
    bonus_xp: number;
    total_xp?: number;
    level?: number;
    tier?: string;
    new_achievements?: any[];
    completed_count: number;
    correct_count: number;
    streak_maintained: boolean;
}
