import { Link } from '@inertiajs/react';

export interface SubjectQuiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
}

interface SubjectQuizCardProps {
    quiz: SubjectQuiz;
}

export function SubjectQuizCard({ quiz }: SubjectQuizCardProps) {
    return (
        <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-[var(--color-border)] transition-all">
            <div className="space-y-2">
                <h3 className="font-bold text-[var(--color-text)] text-lg leading-tight">{quiz.title}</h3>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">{quiz.description}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]/40">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                    Time Limit: {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} minutes` : 'Untimed'}
                </span>
                <Link
                    href={`/quizzes/${quiz.id}`}
                    className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition-all shadow-md min-h-[40px] cursor-pointer"
                >
                    Start Quiz
                </Link>
            </div>
        </div>
    );
}
