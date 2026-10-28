import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Search, Shuffle, Trash2, X } from 'lucide-react';
import { useDismiss } from '@/hooks/useDismiss';
import { RichText } from '@/components/common/RichText';
import { JSON_HEADERS, errorMessage, toLocalInput } from './examText';
import type { BankQuestion, BuilderOptions, ExamForm } from '@/types/exams';

interface Props {
    open: boolean;
    /** The exam to edit, or null for a new one. */
    examId: number | null;
    /** Learners have started: only the title, instructions, closing time and score setting can change. */
    locked?: boolean;
    options: BuilderOptions;
    onClose: () => void;
    onSaved: (id: number, message: string) => void;
}

type PickedQuestion = ExamForm['questions'][number];

const inputClass = 'w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-60';
const labelClass = 'block text-xs font-bold text-[var(--color-text)] mb-1';
const pagerClass = 'px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-bold disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-[var(--color-surface-hover)]';

function blankForm(): ExamForm {
    const opens = new Date();
    opens.setMinutes(0, 0, 0);
    opens.setHours(opens.getHours() + 1);
    const closes = new Date(opens.getTime() + 2 * 3600 * 1000);
    return {
        subject_id: null,
        title: '',
        instructions: 'Answer all questions. Each question has one correct answer.',
        duration_minutes: 40,
        opens_at: toLocalInput(opens),
        closes_at: toLocalInput(closes),
        pass_mark: 50,
        shuffle_questions: true,
        shuffle_options: true,
        show_score_immediately: false,
        class_ids: [],
        questions: [],
    };
}

/**
 * Create or edit a school exam. Settings on the left; on the right, the question bank and the
 * questions picked so far share one panel (two tabs), and the footer sums up the paper.
 */
export default function ExamBuilderModal({ open, examId, locked = false, options, onClose, onSaved }: Props) {
    const { backdrop, panel, markSaved } = useDismiss(open, onClose);
    const [form, setForm] = useState<ExamForm>(blankForm);
    const [view, setView] = useState<'bank' | 'picked'>('bank');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setView(examId ? 'picked' : 'bank');
        if (!examId) {
            setForm(blankForm());
            return;
        }
        setLoading(true);
        fetch(`/api/v1/school-exams/${examId}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((res) => res.json())
            .then(({ exam }) =>
                setForm({
                    ...exam,
                    instructions: exam.instructions ?? '',
                    opens_at: toLocalInput(exam.opens_at),
                    closes_at: toLocalInput(exam.closes_at),
                })
            )
            .catch(() => setError('Could not load the exam. Check your connection.'))
            .finally(() => setLoading(false));
    }, [open, examId]);

    if (!open) return null;

    const set = <K extends keyof ExamForm>(key: K, value: ExamForm[K]) => setForm((f) => ({ ...f, [key]: value }));
    const subjects = options.subjects.filter((s) => form.class_ids.length === 0 || (s.class_id !== null && form.class_ids.includes(s.class_id)));
    const totalMarks = form.questions.reduce((sum, q) => sum + q.marks, 0);
    const classNames = options.classes.filter((c) => form.class_ids.includes(c.id)).map((c) => c.name);

    const addQuestions = (items: BankQuestion[]) =>
        setForm((f) => {
            const have = new Set(f.questions.map((q) => q.id));
            return { ...f, questions: [...f.questions, ...items.filter((q) => !have.has(q.id)).map((q) => ({ ...q, marks: q.marks || 1 }))] };
        });
    const move = (index: number, by: number) =>
        setForm((f) => {
            const next = [...f.questions];
            const [item] = next.splice(index, 1);
            next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
            return { ...f, questions: next };
        });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(examId ? `/api/v1/school-exams/${examId}` : '/api/v1/school-exams', {
                method: examId ? 'PATCH' : 'POST',
                credentials: 'same-origin',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    ...form,
                    opens_at: new Date(form.opens_at).toISOString(),
                    closes_at: new Date(form.closes_at).toISOString(),
                    questions: form.questions.map((q) => ({ id: q.id, marks: q.marks })),
                }),
            });
            if (!res.ok) {
                setError(await errorMessage(res, 'Could not save the exam.'));
                return;
            }
            const data = await res.json();
            markSaved();
            onSaved(data.id ?? examId, data.message ?? 'Exam saved.');
        } catch {
            setError('You are offline. Exams are saved online.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div {...panel} role="dialog" aria-modal="true" aria-labelledby="exam-builder-title" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--color-border)]">
                    <h2 id="exam-builder-title" className="text-lg sm:text-xl font-bold">{examId ? 'Edit exam' : 'New exam'}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <p className="p-6 text-sm text-[var(--color-muted)]">Loading…</p>
                ) : (
                    <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
                        {/* Phones: one scroll for everything. Wide screens: each column scrolls on its own. */}
                        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:divide-x divide-[var(--color-border)]">
                            <fieldset className="space-y-5 px-4 sm:px-6 py-5 lg:overflow-y-auto" disabled={saving}>
                                {locked && (
                                    <p className="rounded-xl bg-[var(--color-accent-10)] text-[var(--color-text)] p-3 text-xs font-semibold">
                                        Learners have started, so the questions, classes and timing are fixed.
                                    </p>
                                )}
                                <div>
                                    <label htmlFor="exam-title" className={labelClass}>Title *</label>
                                    <input id="exam-title" required maxLength={150} value={form.title} onChange={(e) => set('title', e.target.value)} className={inputClass} placeholder="e.g. SS2 Mathematics – First CA" />
                                </div>

                                <div>
                                    <span id="exam-classes" className={labelClass}>Classes sitting it *</span>
                                    {options.classes.length === 0 ? (
                                        <p className="text-xs text-[var(--color-muted)]">You have no classes to set exams for.</p>
                                    ) : (
                                        <div role="group" aria-labelledby="exam-classes" className="flex flex-wrap gap-2">
                                            {options.classes.map((c) => {
                                                const on = form.class_ids.includes(c.id);
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        aria-pressed={on}
                                                        disabled={locked}
                                                        onClick={() => set('class_ids', on ? form.class_ids.filter((id) => id !== c.id) : [...form.class_ids, c.id])}
                                                        className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:cursor-default ${
                                                            on
                                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                                : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
                                                        } ${locked && !on ? 'opacity-50' : ''}`}
                                                    >
                                                        {on && <Check className="w-3.5 h-3.5" aria-hidden />}
                                                        {c.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="exam-subject" className={labelClass}>Subject</label>
                                    <select id="exam-subject" value={form.subject_id ?? ''} disabled={locked} onChange={(e) => set('subject_id', e.target.value ? Number(e.target.value) : null)} className={inputClass}>
                                        <option value="">Not set</option>
                                        {subjects.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="exam-opens" className={labelClass}>Opens *</label>
                                        <input id="exam-opens" type="datetime-local" required disabled={locked} value={form.opens_at} onChange={(e) => set('opens_at', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label htmlFor="exam-closes" className={labelClass}>Closes *</label>
                                        <input id="exam-closes" type="datetime-local" required value={form.closes_at} onChange={(e) => set('closes_at', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="exam-duration" className={labelClass}>Time allowed (min) *</label>
                                            <input id="exam-duration" type="number" min={5} max={300} required disabled={locked} value={form.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))} className={inputClass} />
                                        </div>
                                        <div>
                                            <label htmlFor="exam-pass" className={labelClass}>Pass mark (%)</label>
                                            <input id="exam-pass" type="number" min={0} max={100} disabled={locked} value={form.pass_mark ?? ''} onChange={(e) => set('pass_mark', e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {([
                                        ['shuffle_questions', 'Shuffle question order', null, locked],
                                        ['shuffle_options', 'Shuffle answer options', null, locked],
                                        ['show_score_immediately', 'Show score on submit', 'Corrections still wait until you release results.', false],
                                    ] as const).map(([key, label, hint, disabled]) => (
                                        <label key={key} className={`flex items-start gap-2.5 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
                                            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]" disabled={disabled} checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                                            <span>
                                                {label}
                                                {hint && <span className="block text-xs text-[var(--color-muted)]">{hint}</span>}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <div>
                                    <label htmlFor="exam-instructions" className={labelClass}>Instructions</label>
                                    <textarea id="exam-instructions" rows={3} maxLength={2000} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} className={inputClass} />
                                </div>
                            </fieldset>

                            <section aria-label="Questions" className="flex flex-col min-h-0 px-4 sm:px-6 py-5 border-t lg:border-t-0 border-[var(--color-border)]">
                                <div role="tablist" aria-label="Questions" className="inline-flex self-start rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1 mb-4">
                                    {(['bank', 'picked'] as const)
                                        .filter((key) => !locked || key === 'picked')
                                        .map((key) => (
                                            <button
                                                key={key}
                                                type="button"
                                                role="tab"
                                                aria-selected={view === key}
                                                onClick={() => setView(key)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${view === key ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                                            >
                                                {key === 'bank' ? 'Question bank' : `Selected (${form.questions.length})`}
                                            </button>
                                        ))}
                                </div>

                                {view === 'bank' && !locked ? (
                                    <QuestionBankPicker examSubjectId={form.subject_id} subjects={subjects} chosen={form.questions} onAdd={addQuestions} />
                                ) : form.questions.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center space-y-2">
                                        <p className="text-sm text-[var(--color-muted)]">No questions yet.</p>
                                        <button type="button" onClick={() => setView('bank')} className="text-sm font-bold text-[var(--color-primary)] hover:underline cursor-pointer">Pick from the question bank</button>
                                    </div>
                                ) : (
                                    <ol className="flex-1 min-h-0 lg:overflow-y-auto divide-y divide-[var(--color-border)] -mx-2">
                                        {form.questions.map((q, i) => (
                                            <PickedRow
                                                key={q.id}
                                                question={q}
                                                index={i}
                                                last={i === form.questions.length - 1}
                                                locked={locked}
                                                onMarks={(marks) => set('questions', form.questions.map((x) => (x.id === q.id ? { ...x, marks } : x)))}
                                                onMove={(by) => move(i, by)}
                                                onRemove={() => set('questions', form.questions.filter((x) => x.id !== q.id))}
                                            />
                                        ))}
                                    </ol>
                                )}
                            </section>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t border-[var(--color-border)]">
                            <p className="mr-auto text-sm text-[var(--color-muted)] tabular-nums" aria-live="polite">
                                {error ? (
                                    <span role="alert" className="font-semibold text-[var(--color-error)]">{error}</span>
                                ) : (
                                    <>
                                        <span className="font-bold text-[var(--color-text)]">{form.questions.length} questions</span>
                                        {` · ${totalMarks} marks · ${form.duration_minutes} min`}
                                        {classNames.length > 0 && ` · ${classNames.join(', ')}`}
                                    </>
                                )}
                            </p>
                            <div className="ml-auto flex gap-3">
                                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-surface-hover)] cursor-pointer">Cancel</button>
                                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 cursor-pointer">
                                    {saving ? 'Saving…' : examId ? 'Save changes' : 'Save as draft'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

function PickedRow({ question: q, index, last, locked, onMarks, onMove, onRemove }: {
    question: PickedQuestion;
    index: number;
    last: boolean;
    locked: boolean;
    onMarks: (marks: number) => void;
    onMove: (by: number) => void;
    onRemove: () => void;
}) {
    const iconButton = 'p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer';
    return (
        <li className="flex items-center gap-3 px-2 py-3">
            <span className="w-6 shrink-0 text-xs font-bold text-[var(--color-muted)] tabular-nums text-right">{index + 1}</span>
            <div className="flex-1 min-w-0">
                <div className="text-sm line-clamp-2"><RichText text={q.question_text} inline /></div>
                <p className="text-xs text-[var(--color-muted)] truncate">{[q.topic_name, q.difficulty].filter(Boolean).join(' · ')}</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] shrink-0">
                <input type="number" min={1} max={20} disabled={locked} value={q.marks} onChange={(e) => onMarks(Math.max(1, Number(e.target.value)))} className="w-12 px-1.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm text-center text-[var(--color-text)]" />
                <span>marks</span>
            </label>
            {!locked && (
                <span className="flex items-center shrink-0">
                    <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up" className={iconButton}><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onMove(1)} disabled={last} aria-label="Move down" className={iconButton}><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" onClick={onRemove} aria-label="Remove" className={`${iconButton} hover:text-[var(--color-error)]`}><Trash2 className="w-4 h-4" /></button>
                </span>
            )}
        </li>
    );
}

/**
 * Search the school's question bank and add questions, one at a time or as a random draw from
 * the current filter. It starts on the exam's subject and follows it when that changes.
 */
function QuestionBankPicker({ examSubjectId, subjects, chosen, onAdd }: {
    examSubjectId: number | null;
    subjects: BuilderOptions['subjects'];
    chosen: PickedQuestion[];
    onAdd: (items: BankQuestion[]) => void;
}) {
    const [subjectId, setSubjectId] = useState(examSubjectId ? String(examSubjectId) : '');
    const [difficulty, setDifficulty] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [drawCount, setDrawCount] = useState(10);
    const [drawing, setDrawing] = useState(false);
    const [drawNote, setDrawNote] = useState<string | null>(null);
    const [result, setResult] = useState<{ data: BankQuestion[]; meta: { current_page: number; last_page: number; total: number } } | null>(null);
    const [loading, setLoading] = useState(false);
    const chosenIds = new Set(chosen.map((q) => q.id));

    useEffect(() => {
        setSubjectId(examSubjectId ? String(examSubjectId) : '');
        setPage(1);
    }, [examSubjectId]);

    const filters = () => {
        const params = new URLSearchParams();
        if (subjectId) params.set('subject_id', subjectId);
        if (difficulty) params.set('difficulty', difficulty);
        if (search.trim()) params.set('search', search.trim());
        return params;
    };

    useEffect(() => {
        const params = filters();
        params.set('page', String(page));
        params.set('per_page', '20');
        const controller = new AbortController();
        const t = window.setTimeout(() => {
            setLoading(true);
            fetch(`/api/v1/school-exams/question-bank?${params}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal: controller.signal })
                .then((res) => res.json())
                .then(setResult)
                .catch(() => {})
                .finally(() => setLoading(false));
        }, 250);
        return () => {
            window.clearTimeout(t);
            controller.abort();
        };
    }, [subjectId, difficulty, search, page]);

    const draw = async () => {
        const params = filters();
        params.set('random', String(drawCount));
        params.set('exclude', [...chosenIds].join(','));
        setDrawing(true);
        setDrawNote(null);
        try {
            const res = await fetch(`/api/v1/school-exams/question-bank?${params}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            const { data } = (await res.json()) as { data: BankQuestion[] };
            onAdd(data);
            setDrawNote(data.length === 0 ? 'No more questions match this filter.' : data.length < drawCount ? `Added ${data.length}: that's all that match.` : `Added ${data.length} questions.`);
        } catch {
            setDrawNote('Could not draw questions. Check your connection.');
        } finally {
            setDrawing(false);
        }
    };

    const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        setPage(1);
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
                    <input aria-label="Search questions" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search the question bank" className={`${inputClass} pl-9`} />
                </div>
                <select aria-label="Subject" value={subjectId} onChange={(e) => resetPage(setSubjectId)(e.target.value)} className={inputClass}>
                    <option value="">All subjects</option>
                    {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <select aria-label="Difficulty" value={difficulty} onChange={(e) => resetPage(setDifficulty)(e.target.value)} className={inputClass}>
                    <option value="">Any difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[var(--color-background)] px-3 py-2.5">
                <span className="text-sm text-[var(--color-muted)] tabular-nums mr-auto">{loading ? 'Loading…' : `${result?.meta.total ?? 0} questions match`}</span>
                <label htmlFor="draw-count" className="sr-only">How many to draw</label>
                <input id="draw-count" type="number" min={1} max={50} value={drawCount} onChange={(e) => setDrawCount(Math.max(1, Math.min(50, Number(e.target.value))))} className="w-14 px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-center" />
                <button type="button" onClick={() => void draw()} disabled={drawing || !result?.meta.total} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 cursor-pointer">
                    <Shuffle className="w-4 h-4" aria-hidden /> {drawing ? 'Drawing…' : 'Add random'}
                </button>
                {drawNote && <p role="status" className="basis-full text-xs text-[var(--color-muted)]">{drawNote}</p>}
            </div>

            <ul className="flex-1 min-h-0 lg:overflow-y-auto divide-y divide-[var(--color-border)] -mx-2">
                {(result?.data ?? []).map((q) => {
                    const added = chosenIds.has(q.id);
                    return (
                        <li key={q.id} className="flex items-center gap-3 px-2 py-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm line-clamp-2"><RichText text={q.question_text} inline /></div>
                                <p className="text-xs text-[var(--color-muted)] truncate">{[q.topic_name, q.difficulty].filter(Boolean).join(' · ')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onAdd([q])}
                                disabled={added}
                                className={`shrink-0 inline-flex items-center gap-1 min-h-[34px] px-3 rounded-lg border text-xs font-bold cursor-pointer disabled:cursor-default ${
                                    added ? 'border-transparent text-[var(--color-success)]' : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                                }`}
                            >
                                {added ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Plus className="w-3.5 h-3.5" aria-hidden />}
                                {added ? 'Added' : 'Add'}
                            </button>
                        </li>
                    );
                })}
                {result && result.data.length === 0 && <li className="px-2 py-8 text-center text-sm text-[var(--color-muted)]">No questions match. Try another subject or clear the search.</li>}
            </ul>

            {result && result.meta.last_page > 1 && (
                <div className="flex items-center justify-between pt-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={pagerClass}>Previous</button>
                    <span className="text-xs text-[var(--color-muted)] tabular-nums">Page {result.meta.current_page} of {result.meta.last_page}</span>
                    <button type="button" disabled={page >= result.meta.last_page} onClick={() => setPage((p) => p + 1)} className={pagerClass}>Next</button>
                </div>
            )}
        </div>
    );
}
