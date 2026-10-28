import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { ClipboardCheck, Plus } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import Pagination from '@/components/common/Pagination';
import ExamBuilderModal from '@/components/exams/ExamBuilderModal';
import { ExamStatusBadge } from '@/components/exams/ExamStatusBadge';
import { formatWhen } from '@/components/exams/examText';
import type { BuilderOptions, StaffExamSummary } from '@/types/exams';

interface Props {
    exams: { data: StaffExamSummary[]; current_page: number; per_page: number; total: number };
    canCreate: boolean;
    cbtEnabled: boolean;
    options: BuilderOptions | null;
}

/** Staff list of school exams: set new ones, open one to run the room or see results. */
export default function SchoolExamsIndex({ exams, canCreate, cbtEnabled, options }: Props) {
    const [builderOpen, setBuilderOpen] = useState(false);

    const header = (
        <div className="flex items-center justify-between gap-3">
            <PageHeader icon={ClipboardCheck} title="School Exams" subtitle="Set CBT exams, run the exam room and release results." />
            {canCreate && options && (
                <button
                    type="button"
                    onClick={() => setBuilderOpen(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] cursor-pointer"
                >
                    <Plus className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">New exam</span>
                </button>
            )}
        </div>
    );

    return (
        <AuthenticatedLayout header={header}>
            <Head title="School Exams" />

            {!cbtEnabled && (
                <p className="mb-4 rounded-xl bg-[var(--color-accent-10)] p-3 text-sm font-semibold">
                    School CBT is switched off for your school. A school admin can switch it on from the admin overview.
                </p>
            )}

            {exams.data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center space-y-3">
                    <ClipboardCheck className="w-8 h-8 mx-auto text-[var(--color-muted)]" aria-hidden />
                    <p className="text-sm text-[var(--color-muted)]">No exams yet. Set one from your question bank for any class you teach.</p>
                    {canCreate && options && (
                        <button type="button" onClick={() => setBuilderOpen(true)} className="text-sm font-bold text-[var(--color-primary)] hover:underline cursor-pointer">
                            Set your first exam
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <ul className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                        {exams.data.map((exam) => (
                            <li key={exam.id}>
                                <Link href={`/school-exams/${exam.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-[var(--color-text)] truncate">{exam.title}</h2>
                                            <ExamStatusBadge status={exam.status} />
                                        </div>
                                        <p className="text-xs text-[var(--color-muted)] truncate">
                                            {[exam.subject, exam.classes.join(', ')].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-muted)] sm:text-right">
                                        <div><dt className="sr-only">Opens</dt><dd>{formatWhen(exam.opens_at)}</dd></div>
                                        <div><dt className="sr-only">Questions</dt><dd>{exam.question_count} Qs · {exam.duration_minutes} min</dd></div>
                                        <div><dt className="sr-only">Submitted</dt><dd className="font-semibold text-[var(--color-text)]">{exam.submitted_count ?? 0} submitted</dd></div>
                                    </dl>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <Pagination
                        currentPage={exams.current_page}
                        totalItems={exams.total}
                        itemsPerPage={exams.per_page}
                        itemLabel="exams"
                        onPageChange={(page) => router.get('/school-exams', { page }, { preserveScroll: true })}
                    />
                </div>
            )}

            {options && (
                <ExamBuilderModal
                    open={builderOpen}
                    examId={null}
                    options={options}
                    onClose={() => setBuilderOpen(false)}
                    onSaved={(id) => {
                        setBuilderOpen(false);
                        router.visit(`/school-exams/${id}`);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}
