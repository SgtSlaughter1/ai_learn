export interface ExamMeta {
    code: string;
    name: string;
    fullName: string;
    description: string;
    badge: string;
    color: string;
    gradient: string;
    bgLight: string;
    questionCount: number;
    defaultDurationMinutes: number;
    defaultQuestionCount: number;
    available_years?: number[];
}

export interface PastQuestionOption {
    id: number;
    key: string;
    label: string;
    option_text: string;
    is_correct?: boolean;
    is_selected?: boolean;
}

export interface PastQuestionTopic {
    id: number;
    name: string;
    level?: string;
}

export interface PastQuestionSubject {
    id: number;
    name: string;
    slug: string;
    questions_count?: number;
    available_exams?: string[];
    available_years_by_exam?: Record<string, number[]>;
    counts_by_exam?: Record<string, number>;
}

export interface PastQuestionItem {
    id: number;
    exam_code: string;
    exam_display_name?: string;
    exam_year: number;
    paper_type?: string;
    question_number?: number;
    question_text: string;
    passage_text?: string;
    image_url?: string;
    difficulty: string;
    explanation?: string;
    topic: PastQuestionTopic;
    subject: PastQuestionSubject;
    options: PastQuestionOption[];
}

export interface TopicBreakdownItem {
    topic_id: number;
    topic_name: string;
    subject_name: string;
    total: number;
    correct: number;
    accuracy: number;
    status: 'strong' | 'moderate' | 'weak';
}

export interface DetailedQuestionResult {
    question_id: number;
    question_number?: number;
    question_text: string;
    passage_text?: string;
    image_url?: string;
    explanation?: string;
    topic: {
        id: number;
        name: string;
    };
    subject: {
        name: string;
    };
    selected_option_id: number | null;
    selected_option_text?: string;
    correct_option_id: number;
    correct_option_text?: string;
    is_correct: boolean;
    options: PastQuestionOption[];
}

export interface ExamSimulationResult {
    exam_code: string;
    exam_year?: number;
    total_questions: number;
    correct_answers: number;
    wrong_answers: number;
    score_percentage: number;
    time_spent_seconds: number;
    topic_breakdown: TopicBreakdownItem[];
    weak_topics: TopicBreakdownItem[];
    detailed_results: DetailedQuestionResult[];
    /** Taken offline without the answer key: saved, and scored by the server once it syncs. */
    scoring_pending?: boolean;
    answered_count?: number;
}
