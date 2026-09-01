import { Link } from '@inertiajs/react';

export interface TopicProgress {
    questions_attempted: number;
    questions_correct: number;
    mastery_score: number;
}

export interface SubjectTopic {
    id: number;
    subject_id: number;
    name: string;
    slug: string;
    level: string;
    description: string | null;
    progress: TopicProgress | null;
}

interface TopicCardProps {
    topic: SubjectTopic;
    exerciseQuizId?: number;
}

export function TopicCard({ topic, exerciseQuizId }: TopicCardProps) {
    const getProgressStatus = (progress: TopicProgress | null) => {
        if (!progress || progress.questions_attempted === 0) {
            return {
                label: 'Not Started',
                class: 'bg-[var(--color-primary-5)] text-[var(--color-muted)] border-[var(--color-border)]',
            };
        }
        if (progress.mastery_score >= 80) {
            return {
                label: 'Mastered',
                class: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
            };
        }
        return {
            label: 'In Progress',
            class: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20',
        };
    };

    const status = getProgressStatus(topic.progress);

    return (
        <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-border)]/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 flex-1">
                <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                        {topic.level}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${status.class}`}>
                        {status.label}
                    </span>
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">{topic.name}</h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed max-w-3xl">
                    {topic.description}
                </p>
            </div>

            {/* Progress Statistics & CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:justify-end">
                {topic.progress && topic.progress.questions_attempted > 0 && (
                    <div className="text-sm border-l-2 border-[var(--color-border)] pl-4 space-y-0.5">
                        <span className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                            Topic Stats
                        </span>
                        <span className="block font-bold text-[var(--color-text)]">
                            Mastery: {topic.progress.mastery_score}%
                        </span>
                        <span className="block text-xs text-[var(--color-muted)]">
                            {topic.progress.questions_correct}/{topic.progress.questions_attempted} Correct
                        </span>
                    </div>
                )}

                {exerciseQuizId ? (
                    <Link
                        href={`/quizzes/${exerciseQuizId}`}
                        className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none min-h-[48px] cursor-pointer"
                    >
                        Take Exercise
                    </Link>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-bold text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl opacity-50 min-h-[48px] cursor-not-allowed"
                    >
                        No Exercises
                    </button>
                )}
            </div>
        </div>
    );
}
