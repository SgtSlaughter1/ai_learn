export interface Overview {
    total_schools: number;
    total_school_admins?: number;
    total_teachers?: number;
    total_learners: number;
    total_classes: number;
    total_subjects: number;
    total_topics: number;
    total_quizzes: number;
    total_questions: number;
    total_attempts: number;
    total_questions_answered: number;
    avg_mastery: number;
    struggling_learners: number;
}

export interface CategoryItem {
    id: number;
    name: string;
    code: string;
    description?: string | null;
}

export interface SchoolItem {
    id: number;
    name: string;
    category?: 'primary' | 'junior' | 'senior' | 'combined' | string;
    category_ids?: number[];
    category_names?: string[];
    category_type_label?: string;
    slug?: string;
    address?: string | null;
    city: string | null;
    state?: string | null;
    phone?: string | null;
    email?: string | null;
    description?: string | null;
    is_active?: boolean;
    admin_user_id?: string | null;
    admin?: {
        id: string;
        name: string;
        email: string;
    } | null;
    classes_count?: number;
    learners_count?: number;
    classes?: { id: number; name: string; grade_level?: string }[];
    allowed_grade_levels?: string[];
    grade_options?: Array<{ value: string; label: string; group: string }>;
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
}

export interface SchoolAdminItem {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at?: string;
    administered_school?: {
        id: number;
        name: string;
        city?: string | null;
        state?: string | null;
    } | null;
    school_id?: number | null;
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
}

export interface TeacherItem {
    id: string;
    name: string;
    email: string;
    role: string;
    teacher_profile?: {
        id: number;
        school_id: number;
        employee_id?: string | null;
        department?: string | null;
        bio?: string | null;
        is_active: boolean;
        school?: {
            id: number;
            name: string;
        };
    } | null;
    classes?: Array<{
        id: number;
        name: string;
        grade_level?: string | null;
        arm?: string | null;
        section?: string | null;
        school_class_arm?: string | null;
    }>;
    created_at?: string;
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
}

export interface TopLearner {
    id: string;
    name: string;
    email: string;
    school: string;
    grade_level: string;
    total_xp: number;
    tier?: string;
    level: number;
}

export interface StrugglingLearner {
    id: string;
    name: string;
    email: string;
    school: string;
    grade_level: string;
    avg_mastery: number;
    questions_attempted: number;
}

export interface Stats {
    is_super_admin?: boolean;
    role?: string;
    school?: { id: number; name: string; city?: string | null; state?: string | null } | null;
    overview: Overview;
    grade_distribution: Record<string, number>;
    top_learners: TopLearner[];
    struggling_learners?: StrugglingLearner[];
}

export interface ProgramItem {
    id: number;
    name: string;
    code: string;
    slug?: string;
    description?: string | null;
}

export interface ClassItem {
    id: number;
    school_id: number;
    program_id?: number | null;
    program?: ProgramItem | null;
    name: string;
    slug: string;
    grade_level: string;
    arm?: string | null;
    section?: string | null;
    school_class_arm?: string | null;
    description: string | null;
    is_active: boolean;
    learner_count?: number;
    school?: { id: number; name: string };
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
}

export interface ClassLearner {
    id: string;
    name: string;
    email: string;
    level: number;
    tier?: string;
    total_xp: number;
    streak: number;
    topics_covered: number;
    avg_mastery: number;
    total_attempted: number;
    total_correct: number;
}

export interface Learner {
    id: string;
    name: string;
    email: string;
    learner_profile?: {
        id: number;
        school_id: number | null;
        student_id: string | null;
        grade_level: string | null;
        is_active: boolean;
        school?: { id: number; name: string };
    };
    gamification?: {
        total_xp: number;
        level: number;
        tier?: string;
    };
    classes?: { id: number; name: string }[];
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
}

/** What the current user may do with a record, computed by the server's policies. */
export interface RecordAbilities {
    update: boolean;
    delete: boolean;
}

export interface TopicItem {
    id: number;
    subject_id: number;
    name: string;
    slug: string;
    level: string;
    description: string | null;
    status: string;
    sort_order: number;
    questions_count?: number;
    subject?: { id: number; name: string; slug: string; class_id?: number | null };
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
    can?: RecordAbilities;
}

export interface SubjectItem {
    id: number;
    school_id?: number | null;
    school?: { id: number; name: string } | null;
    class_id?: number | null;
    school_class?: { id: number; name: string; grade_level?: string } | null;
    class_name?: string | null;
    class_grade_level?: string | null;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    sort_order: number;
    topics_count?: number;
    topics?: TopicItem[];
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
    can?: RecordAbilities;
}

export interface QuestionOptionItem {
    id?: number;
    option_text: string;
    is_correct: boolean;
    sort_order?: number;
}

export interface QuestionItem {
    id: number;
    school_id?: number | null;
    school?: { id: number; name: string } | null;
    topic_id: number;
    grade_level?: string | null;
    marks?: number;
    question_text: string;
    image_url?: string | null;
    type: string;
    difficulty: string;
    explanation: string | null;
    status: string;
    options: QuestionOptionItem[];
    topic?: {
        id: number;
        name: string;
        level?: string;
        subject?: {
            id: number;
            name: string;
            school_id?: number | null;
            class_id?: number | null;
            class_name?: string | null;
            school_class?: { id: number; name: string; grade_level?: string } | null;
        };
    };
    _pendingSync?: boolean;
    _offlineDeleted?: boolean;
    can?: RecordAbilities;
}
