import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Calculator, ChevronLeft, ChevronRight, ClipboardCheck, Clock, KeyRound } from 'lucide-react';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { QuestionPalette } from '@/components/quiz/QuestionPalette';
import { PassagePanel } from '@/components/quiz/PassagePanel';
import { CbtCalculator } from '@/components/common/CbtCalculator';
import { confirmAction } from '@/components/common/ConfirmModal';
import { JSON_HEADERS, errorMessage, formatClock } from '@/components/exams/examText';
import type { AnswerSheet, LearnerExamHeader } from '@/types/exams';

/** How long after the last pick the answers are saved, and the longest gap between saves. */
const SAVE_DELAY_MS = 1500;
const SAVE_EVERY_MS = 20000;

/**
 * Sitting a school exam. No app navigation, tutor or chat while writing. The countdown runs on
 * the device's elapsed-time counter (performance.now), so changing the phone's clock doesn't
 * change it; the server keeps the real deadline and refuses late answers anyway.
 */
export default function ExamTake({ exam }: { exam: LearnerExamHeader }) {
    const [phase, setPhase] = useState<'loading' | 'intro' | 'writing'>('loading');
    const [sheet, setSheet] = useState<AnswerSheet | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const showSheet = useCallback(async (res: Response) => {
        const data = await res.json();
        if (res.status === 409 || data.redirect) {
            router.visit(data.redirect ?? `/exams/${exam.id}/result`);
            return;
        }
        setSheet(data);
        setPhase('writing');
    }, [exam.id]);

    // Already started (a reload, or a phone that died)? Carry on without the code.
    useEffect(() => {
        fetch(`/api/v1/exams/${exam.id}/attempt`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((res) => (res.ok || res.status === 409 ? showSheet(res) : setPhase('intro')))
            .catch(() => {
                setPhase('intro');
                setError('You are offline. Connect to start the exam.');
            });
    }, [exam.id, showSheet]);

    const start = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/v1/exams/${exam.id}/start`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: JSON_HEADERS,
                body: JSON.stringify({ access_code: code }),
            });
            if (res.ok || res.status === 409) await showSheet(res);
            else setError(await errorMessage(res, 'Could not start the exam.'));
        } catch {
            setError('You are offline. Connect to start the exam.');
        } finally {
            setBusy(false);
        }
    };

    if (phase === 'writing' && sheet) return <ExamPaper exam={exam} sheet={sheet} />;

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex items-center justify-center px-4 py-10">
            <Head title={exam.title} />
            <main className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <ClipboardCheck className="w-5 h-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-xl font-extrabold truncate">{exam.title}</h1>
                        <p className="text-sm text-[var(--color-muted)]">{exam.subject ?? 'School exam'}</p>
                    </div>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-center">
                    {[
                        ['Time', `${exam.duration_minutes} min`],
                        ['Questions', exam.question_count],
                        ['Marks', exam.total_marks],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-[var(--color-surface-hover)] p-3">
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
                            <dd className="text-lg font-extrabold">{value}</dd>
                        </div>
                    ))}
                </dl>

                {exam.instructions && <p className="text-sm leading-relaxed whitespace-pre-line text-[var(--color-text)]">{exam.instructions}</p>}

                <ul className="text-sm text-[var(--color-muted)] space-y-1 list-disc pl-5">
                    <li>Your answers save as you go. If the page closes, open it again to carry on.</li>
                    <li>The timer keeps running. When it reaches zero your answers are submitted.</li>
                    <li>Leaving the exam screen is recorded for your teacher.</li>
                </ul>

                {phase === 'loading' ? (
                    <p className="text-sm text-[var(--color-muted)]">Checking…</p>
                ) : !exam.is_open ? (
                    <p className="rounded-xl bg-[var(--color-surface-hover)] p-4 text-sm font-semibold">
                        This exam is not open right now.
                    </p>
                ) : (
                    <form onSubmit={start} className="space-y-3">
                        <label htmlFor="access-code" className="block text-sm font-bold">Start code from your invigilator</label>
                        <div className="relative">
                            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
                            <input
                                id="access-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                maxLength={8}
                                required
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-mono text-lg font-bold tracking-[0.3em] outline-none focus:border-[var(--color-primary)]"
                                placeholder="ABC123"
                            />
                        </div>
                        {error && <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">{error}</p>}
                        <button
                            type="submit"
                            disabled={busy || code.trim().length < 4}
                            className="w-full min-h-[48px] rounded-xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {busy ? 'Starting…' : 'Start exam'}
                        </button>
                    </form>
                )}

                <Link href="/exams" className="block text-center text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]">
                    Back to exams
                </Link>
            </main>
        </div>
    );
}

function ExamPaper({ exam, sheet }: { exam: LearnerExamHeader; sheet: AnswerSheet }) {
    const { questions, contexts } = sheet;
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>(sheet.answers ?? {});
    const [secondsLeft, setSecondsLeft] = useState(sheet.seconds_left);
    const [showCalculator, setShowCalculator] = useState(false);
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');

    const deadline = useRef(performance.now() + sheet.seconds_left * 1000);
    const leftScreen = useRef(sheet.left_screen_count ?? 0);
    const answersRef = useRef(answers);
    const dirty = useRef(false);
    const finishing = useRef(false);
    answersRef.current = answers;

    const contextById = useMemo(() => new Map(contexts.map((c) => [c.id, c])), [contexts]);
    const groups = useMemo(() => {
        const out: { start: number; end: number; label: string }[] = [];
        questions.forEach((q, i) => {
            if (!q.context_id) return;
            const last = out[out.length - 1];
            if (last && questions[last.end].context_id === q.context_id && last.end === i - 1) last.end = i;
            else out.push({ start: i, end: i, label: contextById.get(q.context_id)?.title || 'Passage' });
        });
        return out;
    }, [questions, contextById]);

    const finish = useCallback(async (timeUp: boolean) => {
        if (finishing.current) return;
        finishing.current = true;
        try {
            const res = await fetch(`/api/v1/exams/${exam.id}/submit`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: JSON_HEADERS,
                body: JSON.stringify({ answers: answersRef.current, left_screen_count: leftScreen.current }),
            });
            const data = await res.json().catch(() => null);
            router.visit(data?.redirect ?? `/exams/${exam.id}/result`);
        } catch {
            // Offline: answers up to the last save are already on the server, and it closes the attempt at the deadline.
            finishing.current = false;
            setSaveState('offline');
            if (timeUp) router.visit(`/exams/${exam.id}/result`);
        }
    }, [exam.id]);

    const save = useCallback(async () => {
        if (finishing.current) return;
        dirty.current = false;
        setSaveState('saving');
        try {
            const res = await fetch(`/api/v1/exams/${exam.id}/answers`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: JSON_HEADERS,
                body: JSON.stringify({ answers: answersRef.current, left_screen_count: leftScreen.current }),
            });
            if (res.status === 409) {
                finishing.current = true;
                router.visit(`/exams/${exam.id}/result`);
                return;
            }
            const data = await res.json();
            // The server's clock wins if the invigilator added time (or this tab fell behind).
            if (typeof data.seconds_left === 'number') deadline.current = performance.now() + data.seconds_left * 1000;
            setSaveState('saved');
        } catch {
            dirty.current = true;
            setSaveState('offline');
        }
    }, [exam.id]);

    // Countdown; at zero, hand in.
    useEffect(() => {
        const tick = window.setInterval(() => {
            const left = Math.max(0, Math.round((deadline.current - performance.now()) / 1000));
            setSecondsLeft(left);
            if (left === 0) void finish(true);
        }, 1000);
        return () => window.clearInterval(tick);
    }, [finish]);

    // Save soon after a change, and regularly anyway (it also picks up added time).
    useEffect(() => {
        if (!dirty.current) return;
        const t = window.setTimeout(() => void save(), SAVE_DELAY_MS);
        return () => window.clearTimeout(t);
    }, [answers, save]);
    useEffect(() => {
        const t = window.setInterval(() => void save(), SAVE_EVERY_MS);
        return () => window.clearInterval(t);
    }, [save]);

    // Leaving the exam screen is counted for the teacher; it never blocks the learner.
    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === 'hidden') {
                leftScreen.current += 1;
                dirty.current = true;
            }
        };
        const onUnload = (e: BeforeUnloadEvent) => {
            if (!finishing.current) e.preventDefault();
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('beforeunload', onUnload);
        };
    }, []);

    const pick = (optionId: number) => {
        dirty.current = true;
        setAnswers((prev) => ({ ...prev, [String(questions[index].id)]: optionId }));
    };

    const requestSubmit = async () => {
        const left = questions.length - Object.keys(answers).length;
        const ok = await confirmAction({
            title: 'Submit your exam?',
            message: left > 0 ? `You have ${left} unanswered question${left === 1 ? '' : 's'}. You can't change answers after submitting.` : "You can't change answers after submitting.",
            confirmLabel: 'Submit',
            cancelLabel: 'Keep writing',
            tone: left > 0 ? 'warning' : 'primary',
        });
        if (ok) void finish(false);
    };

    const question = questions[index];
    const context = question?.context_id ? contextById.get(question.context_id) : undefined;
    const group = groups.find((g) => index >= g.start && index <= g.end);
    const answeredIndices = new Set(questions.map((q, i) => (answers[String(q.id)] !== undefined ? i : -1)).filter((i) => i >= 0));
    const critical = secondsLeft < 300;

    return (
        <div className="fixed inset-0 flex flex-col bg-[var(--color-background)] text-[var(--color-text)]">
            <Head title={exam.title} />
            <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{exam.title}</p>
                    <p className="text-[11px] text-[var(--color-muted)]" aria-live="polite">
                        {saveState === 'saving' ? 'Saving…' : saveState === 'offline' ? 'Offline: answers will save when you reconnect' : 'All answers saved'}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div
                        role="timer"
                        aria-label={`Time left ${formatClock(secondsLeft)}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm tabular-nums ${
                            critical ? 'bg-[var(--color-error-10)] border-[var(--color-error)] text-[var(--color-error)]' : 'border-[var(--color-border)]'
                        }`}
                    >
                        <Clock className="w-4 h-4" aria-hidden />
                        {formatClock(secondsLeft)}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCalculator((v) => !v)}
                        aria-pressed={showCalculator}
                        aria-label="Calculator"
                        className={`p-2 rounded-xl border cursor-pointer ${showCalculator ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}
                    >
                        <Calculator className="w-4 h-4" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => void requestSubmit()}
                        className="px-3 sm:px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] cursor-pointer whitespace-nowrap"
                    >
                        Submit
                    </button>
                </div>
            </header>

            <div className="relative flex-1 overflow-y-auto">
                {showCalculator && <CbtCalculator onClose={() => setShowCalculator(false)} className="fixed top-16 right-4" />}
                <div className={`mx-auto w-full px-3 sm:px-6 py-5 space-y-4 ${context ? 'max-w-6xl lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0' : 'max-w-3xl'}`}>
                    {context && (
                        <PassagePanel
                            key={question.context_id}
                            context={context}
                            label={group ? `Questions ${group.start + 1}–${group.end + 1}` : `Question ${index + 1}`}
                        />
                    )}
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-[var(--color-muted)]">
                            Question {index + 1} of {questions.length} · {question.marks} mark{question.marks === 1 ? '' : 's'}
                        </p>
                        <QuestionCard
                            question={question}
                            selectedOptionId={answers[String(question.id)] ?? null}
                            onSelectOption={pick}
                        />
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                                disabled={index === 0}
                                className="inline-flex items-center gap-1 min-h-[44px] px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-bold disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" aria-hidden /> Previous
                            </button>
                            {index < questions.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                                    className="inline-flex items-center gap-1 min-h-[44px] px-4 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold cursor-pointer"
                                >
                                    Next <ChevronRight className="w-4 h-4" aria-hidden />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void requestSubmit()}
                                    className="min-h-[44px] px-4 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold cursor-pointer"
                                >
                                    Finish and submit
                                </button>
                            )}
                        </div>
                        <QuestionPalette
                            totalQuestions={questions.length}
                            currentIndex={index}
                            answeredIndices={answeredIndices}
                            onSelectIndex={setIndex}
                            groups={groups}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
