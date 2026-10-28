/** School CBT: shapes sent by SchoolExamController (staff) and LearnerExamController (learners). */
import type { QuizContext } from '@/components/quiz/PassageView';

export type StaffExamStatus = 'draft' | 'scheduled' | 'open' | 'ended';

export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'ended';

export interface StaffExamSummary {
    id: number;
    title: string;
    subject: string | null;
    classes: string[];
    duration_minutes: number;
    opens_at: string;
    closes_at: string;
    status: StaffExamStatus;
    question_count: number;
    total_marks: number;
    results_released: boolean;
    started_count: number | null;
    submitted_count: number | null;
}

export interface StaffExamDetail extends StaffExamSummary {
    instructions: string | null;
    pass_mark: number | null;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_score_immediately: boolean;
    access_code: string | null;
    has_attempts: boolean;
}

export interface BuilderOptions {
    classes: { id: number; name: string; grade_level: string | null }[];
    subjects: { id: number; name: string; class_id: number | null }[];
}

export interface BankQuestion {
    id: number;
    question_text: string;
    difficulty: string | null;
    marks: number | null;
    topic_name: string | null;
}

export interface ExamForm {
    subject_id: number | null;
    title: string;
    instructions: string;
    duration_minutes: number;
    opens_at: string;
    closes_at: string;
    pass_mark: number | null;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_score_immediately: boolean;
    class_ids: number[];
    questions: (BankQuestion & { marks: number })[];
}

export interface RoomLearner {
    user_id: string;
    name: string;
    class_name: string;
    attempt_id: number | null;
    status: AttemptStatus | null;
    answered_count: number | null;
    left_screen_count: number | null;
    extra_minutes: number | null;
    started_at: string | null;
    deadline_at: string | null;
    submitted_at: string | null;
}

export interface ResultLearner {
    user_id: string;
    name: string;
    class_name: string;
    status: AttemptStatus | null;
    score: number | null;
    max_score: number | null;
    percentage: number | null;
    left_screen_count: number | null;
    submitted_at: string | null;
}

export interface ExamResults {
    released_at: string | null;
    pass_mark: number | null;
    summary: { expected: number; sat: number; average: number | null; highest: number | null; lowest: number | null; passed: number | null };
    topics: { topic_id: number; name: string; marks: number; max_marks: number; accuracy: number }[];
    learners: ResultLearner[];
}

export interface LearnerExamItem {
    id: number;
    title: string;
    subject: string | null;
    duration_minutes: number;
    opens_at: string;
    closes_at: string;
    question_count: number;
    is_open: boolean;
    attempt_status: AttemptStatus | null;
    percentage: number | null;
    results_released: boolean;
}

export interface LearnerExamHeader {
    id: number;
    title: string;
    subject: string | null;
    instructions: string | null;
    duration_minutes: number;
    question_count: number;
    total_marks: number;
    opens_at: string;
    closes_at: string;
    is_open: boolean;
}

export interface PaperQuestion {
    id: number;
    context_id: number | null;
    question_text: string;
    image_url: string | null;
    type: string;
    marks: number;
    options: { id: number; option_text: string }[];
}

export interface AnswerSheet {
    status: AttemptStatus;
    seconds_left: number;
    answers: Record<string, number>;
    left_screen_count: number;
    questions: PaperQuestion[];
    contexts: (QuizContext & { id: number })[];
}

export interface ReviewQuestion extends PaperQuestion {
    selected_option_id: number | null;
    correct_option_id: number | null;
    explanation: string | null;
}
