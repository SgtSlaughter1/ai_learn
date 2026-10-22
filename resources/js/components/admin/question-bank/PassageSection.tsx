import { useEffect, useRef, useState } from 'react';
import { BookOpen, ImagePlus, Link2, Lock, Pencil, X } from 'lucide-react';
import type { QuestionContextItem, QuestionContextType } from '@/types/admin';
import { getAdminAuthHeaders, getCachedAdminQuestions } from '@/services/AdminOfflineService';
import { PassageView, CONTEXT_TYPE_LABELS } from '@/components/quiz/PassageView';
import QuestionImageUploader from './QuestionImageUploader';

const DEFAULT_INSTRUCTIONS: Record<QuestionContextType, string> = {
    passage: 'Read the passage carefully and answer the questions that follow.',
    poem: 'Read the poem below and answer the questions that follow.',
    diagram: 'Study the diagram and answer the questions that follow.',
    table: 'Study the table and answer the questions that follow.',
};

const TYPES: { value: QuestionContextType; label: string; hint: string }[] = [
    { value: 'passage', label: 'Passage', hint: 'Comprehension or summary' },
    { value: 'poem', label: 'Poem or extract', hint: 'Line breaks are kept' },
    { value: 'diagram', label: 'Diagram', hint: 'Picture, map or apparatus' },
    { value: 'table', label: 'Table', hint: 'Accounts, data, results' },
];

const TABLE_TEMPLATE = '\n| Heading 1 | Heading 2 | Heading 3 |\n|---|---|---|\n| | | |\n| | | |\n';

export function newContext(type: QuestionContextType = 'passage'): QuestionContextItem {
    return {
        client_id: crypto.randomUUID(),
        type,
        title: '',
        instructions: DEFAULT_INSTRUCTIONS[type],
        body: '',
        image_url: null,
        show_line_numbers: type === 'poem',
    };
}

interface PassageSectionProps {
    value: QuestionContextItem | null;
    onChange: (context: QuestionContextItem | null) => void;
    topicId: string;
    /** After "Save & add next": the passage is kept and shown read-only. */
    locked: boolean;
    onUnlock: () => void;
    /** The number this question will have on the passage. */
    questionNumber?: number;
    showToast?: (text: string, type?: 'success' | 'error') => void;
}

/**
 * "This question is about a passage" in the question form: write a new passage (poem,
 * diagram, table) or pick one already in this topic. Every question saved with it lands on
 * the same passage, so the teacher writes the passage once.
 */
export default function PassageSection({ value, onChange, topicId, locked, onUnlock, questionNumber, showToast }: PassageSectionProps) {
    const [mode, setMode] = useState<'new' | 'link'>('new');
    const [existing, setExisting] = useState<QuestionContextItem[] | null>(null);
    const [loadingExisting, setLoadingExisting] = useState(false);
    // The passage picture stays a small link until asked for, so the form never shows two
    // big drop areas (this one and the question's own) at once. A diagram always needs it.
    const [addingPicture, setAddingPicture] = useState(false);
    const bodyRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (mode !== 'link' || !topicId) return;
        let cancelled = false;
        setLoadingExisting(true);
        (async () => {
            let list: QuestionContextItem[] = [];
            try {
                const res = await fetch(`/api/v1/admin/question-contexts?topic_id=${encodeURIComponent(topicId)}`, {
                    headers: getAdminAuthHeaders(),
                    credentials: 'same-origin',
                });
                if (!res.ok) throw new Error(String(res.status));
                list = (await res.json()).contexts ?? [];
            } catch {
                // Offline: the passages of this topic's questions already on this device.
                const cached = await getCachedAdminQuestions();
                const seen = new Map<string, QuestionContextItem>();
                cached.filter((q) => String(q.topic_id) === String(topicId) && q.context)
                    .forEach((q) => { if (q.context && !seen.has(q.context.client_id)) seen.set(q.context.client_id, q.context); });
                list = [...seen.values()];
            }
            if (!cancelled) {
                setExisting(list);
                setLoadingExisting(false);
            }
        })();
        return () => { cancelled = true; };
    }, [mode, topicId]);

    const update = (patch: Partial<QuestionContextItem>) => value && onChange({ ...value, ...patch });

    const wrapBody = (before: string, after = before, placeholder = 'word') => {
        if (!value) return;
        const el = bodyRef.current;
        const text = value.body ?? '';
        const start = el?.selectionStart ?? text.length;
        const end = el?.selectionEnd ?? text.length;
        const selected = text.slice(start, end) || placeholder;
        const next = text.slice(0, start) + before + selected + after + text.slice(end);
        update({ body: next });
        setTimeout(() => {
            el?.focus();
            el?.setSelectionRange(start + before.length, start + before.length + selected.length);
        }, 0);
    };

    if (!value) {
        return (
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-background)] cursor-pointer hover:border-[var(--color-primary)]/50">
                <input
                    type="checkbox"
                    checked={false}
                    onChange={() => onChange(newContext())}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-primary)] cursor-pointer"
                />
                <span className="space-y-0.5">
                    <span className="block text-xs font-bold text-[var(--color-text)]">This question is about a passage, poem, diagram or table</span>
                    <span className="block text-[11px] text-[var(--color-muted)]">Write it once; every question you add after it shares it, and learners see it beside each one.</span>
                </span>
            </label>
        );
    }

    if (locked) {
        return (
            <div className="p-3 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-5)] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <Lock className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                    <span className="text-xs font-extrabold text-[var(--color-text)] flex-1 min-w-0 truncate">
                        {value.title || CONTEXT_TYPE_LABELS[value.type]}
                    </span>
                    {questionNumber && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white">
                            Question {questionNumber} for this {CONTEXT_TYPE_LABELS[value.type].toLowerCase()}
                        </span>
                    )}
                </div>
                <div className="flex gap-3 items-start">
                    {value.image_url && (
                        <img src={value.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[var(--color-border)] shrink-0" />
                    )}
                    <p className="text-[11px] text-[var(--color-muted)] line-clamp-2">{value.body || 'Picture only'}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={onUnlock} className="min-h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit passage
                    </button>
                    <button type="button" onClick={() => onChange(null)} className="min-h-9 px-3 rounded-xl text-[11px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer">
                        Stop adding to this passage
                    </button>
                </div>
            </div>
        );
    }

    const toolButton = 'min-h-8 min-w-8 px-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-bold hover:border-[var(--color-primary)]/50 cursor-pointer';

    return (
        <div className="p-3.5 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Shared passage
                </span>
                <button type="button" onClick={() => onChange(null)} aria-label="Remove the passage from this question" className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] gap-1" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}
                    className={`flex-1 min-h-8 rounded-lg text-[11px] font-bold cursor-pointer ${mode === 'new' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)]'}`}>
                    Write or paste a passage
                </button>
                <button type="button" role="tab" aria-selected={mode === 'link'} onClick={() => setMode('link')}
                    className={`flex-1 min-h-8 rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 ${mode === 'link' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-muted)]'}`}>
                    <Link2 className="w-3.5 h-3.5" aria-hidden="true" /> Use an existing one
                </button>
            </div>

            {mode === 'link' ? (
                <div className="space-y-2">
                    {!topicId && <p className="text-[11px] text-[var(--color-muted)]">Choose the topic first; passages are kept per topic.</p>}
                    {topicId && loadingExisting && <p className="text-[11px] text-[var(--color-muted)]">Loading passages…</p>}
                    {topicId && !loadingExisting && existing?.length === 0 && (
                        <p className="text-[11px] text-[var(--color-muted)]">No passages in this topic yet. Write one instead.</p>
                    )}
                    {existing?.map((ctx) => (
                        <button key={ctx.client_id} type="button"
                            onClick={() => { onChange({ ...ctx }); setMode('new'); showToast?.('Passage linked. Write the question below.', 'success'); }}
                            className={`w-full text-left p-2.5 rounded-xl border cursor-pointer ${value.client_id === ctx.client_id ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'}`}>
                            <span className="block text-xs font-bold text-[var(--color-text)]">{ctx.title || CONTEXT_TYPE_LABELS[ctx.type]}</span>
                            <span className="block text-[11px] text-[var(--color-muted)] line-clamp-1">
                                {CONTEXT_TYPE_LABELS[ctx.type]}{typeof ctx.questions_count === 'number' ? ` · ${ctx.questions_count} question${ctx.questions_count === 1 ? '' : 's'}` : ''} · {ctx.body?.slice(0, 80) || 'Picture only'}
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {TYPES.map((t) => (
                            <button key={t.value} type="button"
                                onClick={() => update({
                                    type: t.value,
                                    show_line_numbers: t.value === 'poem' ? true : value.show_line_numbers,
                                    instructions: !value.instructions || Object.values(DEFAULT_INSTRUCTIONS).includes(value.instructions) ? DEFAULT_INSTRUCTIONS[t.value] : value.instructions,
                                })}
                                className={`p-2 rounded-xl border text-left cursor-pointer ${value.type === t.value ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
                                <span className="block text-[11px] font-bold text-[var(--color-text)]">{t.label}</span>
                                <span className="block text-[10px] text-[var(--color-muted)]">{t.hint}</span>
                            </button>
                        ))}
                    </div>

                    <label className="block space-y-1">
                        <span className="block text-[11px] font-bold text-[var(--color-text)]">Title (optional)</span>
                        <input type="text" value={value.title ?? ''} onChange={(e) => update({ title: e.target.value })}
                            placeholder="e.g. The Market at Dawn"
                            className="w-full h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm sm:text-xs outline-none focus:border-[var(--color-primary)]" />
                    </label>
                    <label className="block space-y-1">
                        <span className="block text-[11px] font-bold text-[var(--color-text)]">Instruction learners see</span>
                        <input type="text" value={value.instructions ?? ''} onChange={(e) => update({ instructions: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm sm:text-xs outline-none focus:border-[var(--color-primary)]" />
                    </label>

                    <div className="space-y-1">
                        <span className="block text-[11px] font-bold text-[var(--color-text)]">
                            {value.type === 'diagram' ? 'Caption or notes (optional)' : value.type === 'table' ? 'Table' : 'Text'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-t-xl border border-b-0 border-[var(--color-border)] bg-[var(--color-surface)]">
                            <button type="button" className={`${toolButton} underline`} onClick={() => wrapBody('__')} title="Underline the selected word (__word__)">U</button>
                            <button type="button" className={`${toolButton} font-extrabold`} onClick={() => wrapBody('**')} title="Bold (**word**)">B</button>
                            <button type="button" className={`${toolButton} italic`} onClick={() => wrapBody('*')} title="Italic (*word*)">I</button>
                            <button type="button" className={toolButton} onClick={() => wrapBody('', '', '_____')} title="A blank to fill in">Blank ____</button>
                            <button type="button" className={toolButton} onClick={() => update({ body: (value.body ?? '') + TABLE_TEMPLATE })} title="Insert a table">Table</button>
                            <label className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-text)] cursor-pointer">
                                <input type="checkbox" checked={value.show_line_numbers} onChange={(e) => update({ show_line_numbers: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
                                Number the lines
                            </label>
                        </div>
                        <textarea
                            ref={bodyRef}
                            rows={value.type === 'diagram' ? 3 : 8}
                            value={value.body ?? ''}
                            onChange={(e) => update({ body: e.target.value })}
                            onPaste={(e) => {
                                // Tidy text pasted from Word or WhatsApp: curly quotes, non-breaking spaces, stray spaces at line ends.
                                const raw = e.clipboardData.getData('text/plain');
                                const clean = raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n');
                                if (clean !== raw) {
                                    e.preventDefault();
                                    const el = e.currentTarget;
                                    const text = value.body ?? '';
                                    update({ body: text.slice(0, el.selectionStart) + clean + text.slice(el.selectionEnd) });
                                    showToast?.('Tidied the pasted text (quotes and spacing).', 'success');
                                }
                            }}
                            placeholder={value.type === 'poem' ? 'Type or paste the poem. Each line stays on its own line.' : value.type === 'table' ? 'Press Table above, then fill in the cells.' : 'Type or paste the passage. Leave a blank line between paragraphs.'}
                            className="w-full px-3 py-2.5 rounded-b-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm leading-relaxed outline-none focus:border-[var(--color-primary)]"
                        />
                        <p className="text-[10px] text-[var(--color-muted)]">
                            Select a word and press <span className="underline font-bold">U</span> to underline it, for questions like “the word nearest in meaning to the underlined word”.
                        </p>
                    </div>

                    {value.image_url || addingPicture || value.type === 'diagram' ? (
                        <div className="pt-3 border-t border-[var(--color-border)]">
                            <QuestionImageUploader
                                flat
                                imageUrl={value.image_url}
                                onChange={(url) => update({ image_url: url })}
                                onHide={value.type === 'diagram' ? undefined : () => setAddingPicture(false)}
                                showToast={showToast}
                                label={value.type === 'diagram' ? 'Diagram *' : 'Passage picture'}
                                description="Shown with every question on this passage."
                            />
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-x-2">
                            <button
                                type="button"
                                onClick={() => setAddingPicture(true)}
                                aria-describedby={`${value.client_id}-picture-hint`}
                                className="min-h-9 inline-flex items-center gap-2 text-xs font-bold text-[var(--color-primary)] hover:underline underline-offset-4 cursor-pointer"
                            >
                                <ImagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                                Add a picture to the passage
                            </button>
                            <span id={`${value.client_id}-picture-hint`} className="text-[11px] text-[var(--color-muted)]">
                                Shown with every question on it.
                            </span>
                        </div>
                    )}

                    {(value.body || value.image_url) && (
                        <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" open>
                            <summary className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] cursor-pointer">As learners see it</summary>
                            <div className="pt-2">
                                <PassageView context={value} compact />
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
