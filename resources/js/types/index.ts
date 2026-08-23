export type UserRole = 'learner' | 'teacher' | 'admin';

export interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    email_verified_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Subject {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: 'active' | 'inactive';
    sort_order: number;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

export interface Topic {
    id: number;
    subject_id: number;
    name: string;
    slug: string;
    level: string;
    description: string | null;
    status: 'active' | 'inactive';
    sort_order: number;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}

export interface Question {
    id: number;
    topic_id: number;
    question_text: string;
    type: 'multiple_choice';
    difficulty: 'easy' | 'medium' | 'hard';
    explanation?: string | null; // Nullable or omitted depending on role permissions
    status: 'active' | 'inactive';
    options?: QuestionOption[];
    created_at?: string;
    updated_at?: string;
}

export interface QuestionOption {
    id: number;
    question_id: number;
    option_text: string;
    sort_order: number;
    is_correct?: boolean; // Securely omitted for student UI
    created_at?: string;
    updated_at?: string;
}

export interface Quiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    status: 'active' | 'inactive';
    questions?: Question[];
    created_at?: string;
    updated_at?: string;
}

export interface QuizAttempt {
    id: string; // UUID primary key
    user_id: number;
    quiz_id: number;
    status: 'started' | 'completed';
    score: number | null;
    total_marks: number | null;
    started_at: string;
    completed_at: string | null;
    created_at?: string;
    updated_at?: string;
    answers?: QuizAnswer[];
}

export interface QuizAnswer {
    id: string; // UUID primary key
    quiz_attempt_id: string;
    question_id: number;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    answered_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface LearnerProgress {
    id: number;
    user_id: number;
    topic_id: number;
    questions_attempted: number;
    questions_correct: number;
    mastery_score: number; // 0 to 100
    ability_score: number; // 500-2500, Elo-like adaptive rating
    last_attempted_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface QuizAdaptiveState {
    id: number;
    quiz_attempt_id: string;
    user_id: number;
    quiz_id: number;
    current_ability: number;
    questions_answered: number;
    correct_count: number;
    answered_question_ids: number[];
    answer_results: AdaptiveAnswerResult[];
    is_completed: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface AdaptiveAnswerResult {
    question_id: number;
    selected_option_id: number | null;
    is_correct: boolean;
    ability_before: number;
    ability_after: number;
    question_difficulty: string;
}

export interface School {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    is_active: boolean;
}

export interface TeacherProfile {
    id: number;
    user_id: number;
    school_id: number;
    employee_id: string | null;
    department: string | null;
    bio: string | null;
    is_active: boolean;
}

export interface LearnerProfile {
    id: number;
    user_id: number;
    school_id: number | null;
    student_id: string | null;
    grade_level: string | null;
    date_of_birth: string | null;
    is_active: boolean;
}

export interface ClassModel {
    id: number;
    school_id: number;
    name: string;
    slug: string;
    grade_level: string | null;
    section: string | null;
    description: string | null;
    is_active: boolean;
}

export interface ClassMembership {
    id: number;
    class_id: number;
    user_id: number;
    role: 'teacher' | 'learner';
    is_active: boolean;
}

export interface ContentPackage {
    id: number;
    subject_id: number;
    level: string;
    version: string;
    file_path: string | null;
    status: 'published' | 'draft';
    created_at?: string;
    updated_at?: string;
}
