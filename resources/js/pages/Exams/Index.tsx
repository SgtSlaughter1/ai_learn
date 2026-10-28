import { Head, Link } from '@inertiajs/react';
import { ClipboardCheck, Clock, FileText } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { AttemptStatusBadge } from '@/components/exams/ExamStatusBadge';
import { formatWhen } from '@/components/exams/examText';
import type { LearnerExamItem } from '@/types/exams';

interface Props {
    exams: LearnerExamItem[];
    cbtEnabled: boolean;
}

/** A learner's school exams: what is open now, what is coming, and results. */
export default function ExamsIndex({ exams, cbtEnabled }: Props) {
    const now = Date.now();
    const current = exams.filter((e) => new Date(e.closes_at).getTime() >= now && !isFinished(e));
    const past = exams.filter((e) => !current.includes(e));

    return (
        <AuthenticatedLayout header={<PageHeader icon={ClipboardCheck} title="School Exams" subtitle="Tests your school sets, sat in the exam room." />}>
            <Head title="School Exams" />

            {!cbtEnabled ? (
                <EmptyState text="Your school hasn't switched on school exams." />
            ) : exams.length === 0 ? (
                <EmptyState text="No exams yet. When your teacher sets one for your class, it shows here." />
            ) : (
                <div className="space-y-8">
                    {current.length > 0 && (
                        <section aria-labelledby="exams-current" className="space-y-3">
                            <h2 id="exams-current" className="text-sm font-extrabold text-[var(--color-text)]">Open and upcoming</h2>
                            <ul className="grid gap-3 md:grid-cols-2">
                                {current.map((exam) => (
                                    <ExamRow key={exam.id} exam={exam} />
                                ))}
                            </ul>
                        </section>
                    )}
                    {past.length > 0 && (
                        <section aria-labelledby="exams-past" className="space-y-3">
                            <h2 id="exams-past" className="text-sm font-extrabold text-[var(--color-text)]">Finished</h2>
                            <ul className="grid gap-3 md:grid-cols-2">
                                {past.map((exam) => (
                                    <ExamRow key={exam.id} exam={exam} />
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </AuthenticatedLayout>
    );
}

function isFinished(exam: LearnerExamItem): boolean {
    return exam.attempt_status !== null && exam.attempt_status !== 'in_progress';
}

function ExamRow({ exam }: { exam: LearnerExamItem }) {
    const finished = isFinished(exam);
    const upcoming = !exam.is_open && new Date(exam.opens_at).getTime() > Date.now();
    const missed = !exam.is_open && !upcoming && exam.attempt_status === null;

    return (
        <li className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-bold text-[var(--color-text)] truncate">{exam.title}</h3>
                    <p className="text-xs text-[var(--color-muted)]">{exam.subject ?? 'General'}</p>
                </div>
                {exam.attempt_status && <AttemptStatusBadge status={exam.attempt_status} />}
            </div>

            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden />
                    <dt className="sr-only">Time allowed</dt>
                    <dd>{exam.duration_minutes} min</dd>
                </div>
                <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" aria-hidden />
                    <dt className="sr-only">Questions</dt>
                    <dd>{exam.question_count} questions</dd>
                </div>
                <div>
                    <dt className="sr-only">When</dt>
                    <dd>{upcoming ? `Opens ${formatWhen(exam.opens_at)}` : `Closes ${formatWhen(exam.closes_at)}`}</dd>
                </div>
            </dl>

            <div className="flex items-center justify-between gap-3">
                {finished ? (
                    <>
                        <span className="text-sm font-bold text-[var(--color-text)]">
                            {exam.percentage !== null ? `${Math.round(exam.percentage)}%` : 'Result not out yet'}
                        </span>
                        <Link href={`/exams/${exam.id}/result`} className="text-sm font-bold text-[var(--color-primary)] hover:underline">
                            {exam.results_released ? 'See corrections' : 'View'}
                        </Link>
                    </>
                ) : exam.is_open ? (
                    <Link
                        href={`/exams/${exam.id}/take`}
                        className="ml-auto inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
                    >
                        {exam.attempt_status === 'in_progress' ? 'Continue' : 'Start'}
                    </Link>
                ) : (
                    <span className="text-xs font-semibold text-[var(--color-muted)]">{missed ? 'Missed' : 'Not open yet'}</span>
                )}
            </div>
        </li>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
            <ClipboardCheck className="w-8 h-8 mx-auto text-[var(--color-muted)]" aria-hidden />
            <p className="mt-3 text-sm text-[var(--color-muted)]">{text}</p>
        </div>
    );
}
