import { useCallback, useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Download, Pencil } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { confirmAction } from '@/components/common/ConfirmModal';
import ExamBuilderModal from '@/components/exams/ExamBuilderModal';
import { AttemptStatusBadge, ExamStatusBadge } from '@/components/exams/ExamStatusBadge';
import { JSON_HEADERS, errorMessage, formatClock, formatWhen } from '@/components/exams/examText';
import type { BuilderOptions, ExamResults, RoomLearner, StaffExamDetail } from '@/types/exams';

/** How often the exam room refreshes while the exam is open. */
const ROOM_POLL_MS = 10000;

interface Props {
    exam: StaffExamDetail;
    options: BuilderOptions;
}

/** One school exam for staff: the start code, the live exam room, and results. */
export default function SchoolExamShow({ exam, options }: Props) {
    const [tab, setTab] = useState<'room' | 'results'>(exam.status === 'ended' ? 'results' : 'room');
    const [builderOpen, setBuilderOpen] = useState(false);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const notify = (text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 4000);
    };

    /** POST an exam action, then reload the page props. */
    const act = async (path: string, body?: object) => {
        try {
            const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: JSON_HEADERS, body: body ? JSON.stringify(body) : undefined });
            if (!res.ok) return notify(await errorMessage(res, 'That did not work.'), 'error');
            const data = await res.json();
            notify(data.message ?? 'Done.');
            router.reload({ only: ['exam'] });
            return data;
        } catch {
            notify('You are offline. Connect and try again.', 'error');
        }
    };

    const publish = async () => {
        if (await confirmAction({ title: 'Publish this exam?', message: 'Learners in the chosen classes will see it. The questions can still change until someone starts.', confirmLabel: 'Publish', tone: 'primary' })) {
            await act(`/api/v1/school-exams/${exam.id}/publish`);
        }
    };
    const close = async () => {
        if (await confirmAction({ title: 'End the exam now?', message: 'Anyone still writing is submitted with the answers they have so far.', confirmLabel: 'End exam', tone: 'danger' })) {
            await act(`/api/v1/school-exams/${exam.id}/close`);
        }
    };
    const release = async () => {
        if (await confirmAction({ title: 'Release results?', message: 'Learners will see their scores and the correct answers, and missed questions go into their daily review.', confirmLabel: 'Release', tone: 'primary' })) {
            await act(`/api/v1/school-exams/${exam.id}/release`);
        }
    };
    const remove = async () => {
        if (!(await confirmAction({ title: 'Delete this exam?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
        const res = await fetch(`/api/v1/school-exams/${exam.id}`, { method: 'DELETE', credentials: 'same-origin', headers: JSON_HEADERS }).catch(() => null);
        if (res?.ok) router.visit('/school-exams');
        else notify(res ? await errorMessage(res, 'Could not delete.') : 'You are offline.', 'error');
    };

    const header = <PageHeader icon={ClipboardCheck} title={exam.title} subtitle={[exam.subject, exam.classes.join(', ')].filter(Boolean).join(' · ')} />;
    const buttonClass = 'inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-sm font-bold cursor-pointer';

    return (
        <AuthenticatedLayout header={header}>
            <Head title={exam.title} />

            {toast && (
                <div role="status" className={`fixed top-20 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.type === 'error' ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]'}`}>
                    {toast.text}
                </div>
            )}

            <div className="space-y-6">
                <Link href="/school-exams" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]">
                    <ArrowLeft className="w-4 h-4" aria-hidden /> All exams
                </Link>

                <section className="grid gap-4 lg:grid-cols-[1fr_auto] rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                    <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <ExamStatusBadge status={exam.status} />
                            {exam.results_released && <span className="text-xs font-semibold text-[var(--color-success)]">Results released</span>}
                        </div>
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <Fact label="Opens" value={formatWhen(exam.opens_at)} />
                            <Fact label="Closes" value={formatWhen(exam.closes_at)} />
                            <Fact label="Time allowed" value={`${exam.duration_minutes} min`} />
                            <Fact label="Questions" value={`${exam.question_count} (${exam.total_marks} marks)`} />
                        </dl>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {exam.status !== 'ended' && (
                                <button type="button" onClick={() => setBuilderOpen(true)} className={`${buttonClass} border border-[var(--color-border)]`}>
                                    <Pencil className="w-4 h-4" aria-hidden /> Edit
                                </button>
                            )}
                            {exam.status === 'draft' && (
                                <button type="button" onClick={() => void publish()} className={`${buttonClass} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]`}>Publish</button>
                            )}
                            {exam.status === 'open' && (
                                <button type="button" onClick={() => void close()} className={`${buttonClass} border border-[var(--color-error)] text-[var(--color-error)]`}>End exam now</button>
                            )}
                            {exam.status === 'ended' && !exam.results_released && (
                                <button type="button" onClick={() => void release()} className={`${buttonClass} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]`}>Release results</button>
                            )}
                            {!exam.has_attempts && (
                                <button type="button" onClick={() => void remove()} className={`${buttonClass} text-[var(--color-error)]`}>Delete</button>
                            )}
                        </div>
                    </div>

                    {exam.access_code && exam.status !== 'ended' && (
                        <div className="rounded-2xl bg-[var(--color-primary)] text-white px-6 py-5 text-center self-start">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Start code</p>
                            <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.25em]">{exam.access_code}</p>
                            <p className="mt-1 text-xs text-white/70">Read it out in the exam room</p>
                        </div>
                    )}
                </section>

                {exam.status !== 'draft' && (
                    <>
                        <div role="tablist" aria-label="Exam views" className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                            {(['room', 'results'] as const).map((key) => (
                                <button
                                    key={key}
                                    role="tab"
                                    type="button"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer ${tab === key ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)]'}`}
                                >
                                    {key === 'room' ? 'Exam room' : 'Results'}
                                </button>
                            ))}
                        </div>
                        {tab === 'room' ? <ExamRoom exam={exam} act={act} /> : <Results exam={exam} />}
                    </>
                )}
            </div>

            <ExamBuilderModal
                open={builderOpen}
                examId={exam.id}
                locked={exam.has_attempts}
                options={options}
                onClose={() => setBuilderOpen(false)}
                onSaved={(_, message) => {
                    setBuilderOpen(false);
                    notify(message);
                    router.reload({ only: ['exam'] });
                }}
            />
        </AuthenticatedLayout>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
            <dd className="font-semibold truncate">{value}</dd>
        </div>
    );
}

/** Who is writing, how far they are and their time left; refreshed while the exam is open. */
function ExamRoom({ exam, act }: { exam: StaffExamDetail; act: (path: string, body?: object) => Promise<unknown> }) {
    const [room, setRoom] = useState<{ learners: RoomLearner[]; serverOffset: number } | null>(null);
    const [, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/v1/school-exams/${exam.id}/monitor`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            // Times left are counted against the server's clock, not this device's.
            setRoom({ learners: data.learners, serverOffset: new Date(data.server_time).getTime() - Date.now() });
        } catch {
            /* offline: keep the last view */
        }
    }, [exam.id]);

    useEffect(() => {
        void load();
        if (exam.status !== 'open') return;
        const poll = window.setInterval(() => void load(), ROOM_POLL_MS);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [load, exam.status]);

    if (!room) return <p className="text-sm text-[var(--color-muted)]">Loading the exam room…</p>;

    const counts = {
        notStarted: room.learners.filter((l) => !l.status).length,
        writing: room.learners.filter((l) => l.status === 'in_progress').length,
        done: room.learners.filter((l) => l.status && l.status !== 'in_progress').length,
    };
    const extend = async (l: RoomLearner) => {
        await act(`/api/v1/school-exam-attempts/${l.attempt_id}/extend`, { minutes: 10 });
        void load();
    };
    const end = async (l: RoomLearner) => {
        if (await confirmAction({ title: `End ${l.name}'s exam?`, message: 'Their answers so far are submitted.', confirmLabel: 'End', tone: 'danger' })) {
            await act(`/api/v1/school-exam-attempts/${l.attempt_id}/end`);
            void load();
        }
    };

    return (
        <section aria-label="Exam room" className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
                <Count label="Not started" value={counts.notStarted} />
                <Count label="Writing" value={counts.writing} />
                <Count label="Handed in" value={counts.done} />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                        <tr className="border-b border-[var(--color-border)]">
                            <th className="px-4 py-3 font-bold">Learner</th>
                            <th className="px-4 py-3 font-bold">Status</th>
                            <th className="px-4 py-3 font-bold">Answered</th>
                            <th className="px-4 py-3 font-bold">Time left</th>
                            <th className="px-4 py-3 font-bold">Left screen</th>
                            <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {room.learners.map((l) => {
                            const left = l.deadline_at ? (new Date(l.deadline_at).getTime() - (Date.now() + room.serverOffset)) / 1000 : null;
                            return (
                                <tr key={l.user_id}>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold">{l.name}</p>
                                        <p className="text-xs text-[var(--color-muted)]">{l.class_name}</p>
                                    </td>
                                    <td className="px-4 py-3"><AttemptStatusBadge status={l.status} /></td>
                                    <td className="px-4 py-3 tabular-nums">{l.status ? `${l.answered_count}/${exam.question_count}` : '–'}</td>
                                    <td className="px-4 py-3 tabular-nums">
                                        {l.status === 'in_progress' && left !== null ? formatClock(left) : '–'}
                                        {l.extra_minutes ? <span className="ml-1 text-xs text-[var(--color-muted)]">(+{l.extra_minutes})</span> : null}
                                    </td>
                                    <td className="px-4 py-3">
                                        {l.left_screen_count ? (
                                            <span className="inline-flex items-center gap-1 text-[var(--color-accent)] font-bold">
                                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> {l.left_screen_count}×
                                            </span>
                                        ) : (
                                            '–'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        {l.status === 'in_progress' && (
                                            <>
                                                <button type="button" onClick={() => void extend(l)} className="px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-bold cursor-pointer">+10 min</button>
                                                <button type="button" onClick={() => void end(l)} className="ml-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--color-error)] cursor-pointer">End</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {room.learners.length === 0 && <p className="p-6 text-sm text-[var(--color-muted)]">No learners are in the chosen classes.</p>}
            </div>
        </section>
    );
}

function Count({ label, value }: { label: string; value: number }) {
    return (
        <span className="inline-flex items-baseline gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
            <span className="font-extrabold tabular-nums">{value}</span>
            <span className="text-xs text-[var(--color-muted)]">{label}</span>
        </span>
    );
}

/** Class results: summary, hardest topics first, and every learner's score. */
function Results({ exam }: { exam: StaffExamDetail }) {
    const [results, setResults] = useState<ExamResults | null>(null);

    useEffect(() => {
        fetch(`/api/v1/school-exams/${exam.id}/results`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((res) => res.json())
            .then(setResults)
            .catch(() => {});
    }, [exam.id, exam.results_released, exam.status]);

    if (!results) return <p className="text-sm text-[var(--color-muted)]">Loading results…</p>;
    const { summary } = results;

    return (
        <section aria-label="Results" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <dl className="flex flex-wrap gap-2 text-sm">
                    <Count label={`of ${summary.expected} sat it`} value={summary.sat} />
                    {summary.average !== null && <Count label="average %" value={Math.round(summary.average)} />}
                    {summary.passed !== null && <Count label={`passed (${results.pass_mark}%)`} value={summary.passed} />}
                </dl>
                <a href={`/school-exams/${exam.id}/results.csv`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:underline">
                    <Download className="w-4 h-4" aria-hidden /> Download CSV
                </a>
            </div>

            {results.topics.length > 0 && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                    <h3 className="font-bold">Topics, hardest first</h3>
                    <ul className="space-y-2">
                        {results.topics.map((t) => (
                            <li key={t.topic_id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                                <span className="truncate">{t.name}</span>
                                <span className="font-bold tabular-nums">{t.accuracy}%</span>
                                <span className="col-span-2 h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                                    <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${t.accuracy}%` }} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                        <tr className="border-b border-[var(--color-border)]">
                            <th className="px-4 py-3 font-bold">Learner</th>
                            <th className="px-4 py-3 font-bold">Status</th>
                            <th className="px-4 py-3 font-bold text-right">Score</th>
                            <th className="px-4 py-3 font-bold text-right">%</th>
                            <th className="px-4 py-3 font-bold">Left screen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {results.learners.map((l) => (
                            <tr key={l.user_id}>
                                <td className="px-4 py-3">
                                    <p className="font-semibold">{l.name}</p>
                                    <p className="text-xs text-[var(--color-muted)]">{l.class_name}</p>
                                </td>
                                <td className="px-4 py-3"><AttemptStatusBadge status={l.status} /></td>
                                <td className="px-4 py-3 text-right tabular-nums">{l.score !== null ? `${l.score}/${l.max_score}` : '–'}</td>
                                <td className={`px-4 py-3 text-right font-bold tabular-nums ${results.pass_mark !== null && l.percentage !== null && l.percentage < results.pass_mark ? 'text-[var(--color-error)]' : ''}`}>
                                    {l.percentage !== null ? Math.round(l.percentage) : '–'}
                                </td>
                                <td className="px-4 py-3">{l.left_screen_count ? `${l.left_screen_count}×` : '–'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
