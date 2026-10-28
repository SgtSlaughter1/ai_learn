import { Head, Link } from '@inertiajs/react';
import { ClipboardCheck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { AttemptStatusBadge } from '@/components/exams/ExamStatusBadge';
import { formatWhen } from '@/components/exams/examText';
import { ResultQuestionBreakdown, type ResultAnswer } from '@/components/quiz/ResultQuestionBreakdown';
import type { QuizContext } from '@/components/quiz/PassageView';
import type { AttemptStatus, LearnerExamHeader, ReviewQuestion } from '@/types/exams';

interface Props {
    exam: LearnerExamHeader & { pass_mark: number | null; results_released: boolean };
    attempt: {
        status: AttemptStatus;
        submitted_at: string | null;
        answered_count: number;
        score: number | null;
        max_score: number | null;
        percentage: number | null;
        correct_count: number | null;
        topic_breakdown: { topic_id: number; name: string; correct: number; total: number; marks: number; max_marks: number }[] | null;
    };
    review: { questions: ReviewQuestion[]; contexts: (QuizContext & { id: number })[] } | null;
}

/** A learner's result: the score when the school shows it, and corrections once results are released. */
export default function ExamResult({ exam, attempt, review }: Props) {
    const passed = attempt.percentage !== null && exam.pass_mark !== null ? attempt.percentage >= exam.pass_mark : null;
    const contexts = new Map((review?.contexts ?? []).map((c) => [c.id, c]));
    const answers: ResultAnswer[] = (review?.questions ?? []).map((q) => ({
        id: String(q.id),
        question_id: q.id,
        question_text: q.question_text,
        image_url: q.image_url,
        explanation: q.explanation ?? '',
        selected_option_id: q.selected_option_id,
        is_correct: q.selected_option_id !== null && q.selected_option_id === q.correct_option_id,
        marks_awarded: q.selected_option_id === q.correct_option_id ? q.marks : 0,
        options: q.options.map((o) => ({ ...o, is_correct: o.id === q.correct_option_id })),
        context: q.context_id ? contexts.get(q.context_id) ?? null : null,
    }));

    return (
        <AuthenticatedLayout header={<PageHeader icon={ClipboardCheck} title={exam.title} subtitle={exam.subject ?? 'School exam'} />}>
            <Head title={`${exam.title}: result`} />

            <div className="space-y-6 max-w-4xl">
                <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
                    <div className="flex flex-wrap items-center gap-3">
                        <AttemptStatusBadge status={attempt.status} />
                        {attempt.submitted_at && <span className="text-xs text-[var(--color-muted)]">Handed in {formatWhen(attempt.submitted_at)}</span>}
                    </div>

                    {attempt.percentage !== null ? (
                        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                            <p className="text-5xl font-extrabold tracking-tight text-[var(--color-primary)] tabular-nums">{Math.round(attempt.percentage)}%</p>
                            <p className="text-sm text-[var(--color-muted)] pb-1.5">
                                {attempt.score} of {attempt.max_score} marks
                                {passed !== null && (
                                    <span className={`ml-2 font-bold ${passed ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                        {passed ? 'Passed' : `Below the ${exam.pass_mark}% pass mark`}
                                    </span>
                                )}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-5 text-lg font-bold text-[var(--color-text)]">Your answers are in. Your teacher will release the results.</p>
                    )}
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        {attempt.correct_count !== null
                            ? `You got ${attempt.correct_count} of ${exam.question_count} questions right and answered ${attempt.answered_count}.`
                            : `You answered ${attempt.answered_count} of ${exam.question_count} questions.`}
                    </p>
                </section>

                {attempt.topic_breakdown && attempt.topic_breakdown.length > 0 && (
                    <section aria-labelledby="topics" className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-3">
                        <h2 id="topics" className="font-bold text-[var(--color-text)]">By topic</h2>
                        <ul className="space-y-2">
                            {attempt.topic_breakdown.map((t) => {
                                const pct = t.max_marks > 0 ? Math.round((t.marks / t.max_marks) * 100) : 0;
                                return (
                                    <li key={t.topic_id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                                        <span className="truncate">{t.name}</span>
                                        <span className="font-bold tabular-nums">{t.marks}/{t.max_marks} marks</span>
                                        <span className="col-span-2 h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                                            <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="text-xs text-[var(--color-muted)]">Questions you missed are now in your daily review.</p>
                    </section>
                )}

                {review ? (
                    <ResultQuestionBreakdown answers={answers} />
                ) : (
                    <p className="text-sm text-[var(--color-muted)]">Corrections show here once your teacher releases the results.</p>
                )}

                <Link href="/exams" className="inline-block text-sm font-bold text-[var(--color-primary)] hover:underline">
                    Back to exams
                </Link>
            </div>
        </AuthenticatedLayout>
    );
}
