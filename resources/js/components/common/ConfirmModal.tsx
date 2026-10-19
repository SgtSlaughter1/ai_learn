import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

/**
 * One confirmation dialog for the whole app (mounted once as <ConfirmHost />), used for
 * deletes, submits, creates and account actions. Call it from anywhere, including plain
 * services:
 *
 *     if (!(await confirmAction({ title: 'Delete class?', message: '…', tone: 'danger' }))) return;
 *     const password = await confirmWithInput({ …, input: { label: 'Password', type: 'password' } });
 */

export type ConfirmTone = 'danger' | 'warning' | 'primary';

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
}

export interface ConfirmInputOptions extends ConfirmOptions {
    input: { label: string; type?: 'text' | 'password'; placeholder?: string; autoComplete?: string };
}

interface Request {
    options: ConfirmOptions & { input?: ConfirmInputOptions['input'] };
    resolve: (value: string | null) => void;
}

let showDialog: ((request: Request) => void) | null = null;

function ask(options: Request['options']): Promise<string | null> {
    return new Promise((resolve) => {
        if (showDialog) {
            showDialog({ options, resolve });
            return;
        }
        // No host mounted (e.g. tests): fall back to the browser's own dialogs.
        if (options.input) {
            resolve(typeof window !== 'undefined' ? window.prompt(`${options.title}\n\n${options.message ?? ''}`) : null);
        } else {
            resolve(typeof window !== 'undefined' && window.confirm(`${options.title}\n\n${options.message ?? ''}`) ? '' : null);
        }
    });
}

/** Resolves true when the user confirms. */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
    return (await ask(options)) !== null;
}

/** Resolves with the entered value when confirmed, or null when cancelled. */
export function confirmWithInput(options: ConfirmInputOptions): Promise<string | null> {
    return ask(options);
}

const TONES: Record<ConfirmTone, { icon: typeof AlertTriangle; iconClass: string; button: string }> = {
    danger: { icon: AlertTriangle, iconClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20', button: 'bg-rose-600 hover:bg-rose-700 text-white' },
    warning: { icon: AlertTriangle, iconClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20', button: 'bg-amber-600 hover:bg-amber-700 text-white' },
    primary: { icon: HelpCircle, iconClass: 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary-20)]', button: 'bg-[var(--color-primary)] hover:opacity-90 text-white' },
};

export function ConfirmHost() {
    const [request, setRequest] = useState<Request | null>(null);
    const [value, setValue] = useState('');
    const cancelRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        showDialog = (next) => {
            setValue('');
            setRequest((current) => {
                current?.resolve(null); // a newer question replaces an unanswered one
                return next;
            });
        };
        return () => {
            showDialog = null;
        };
    }, []);

    const close = (result: string | null) => {
        request?.resolve(result);
        setRequest(null);
    };

    useEffect(() => {
        if (!request) return;
        (request.options.input ? inputRef.current : cancelRef.current)?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    if (!request || typeof document === 'undefined') return null;

    const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', input } = request.options;
    const style = TONES[tone];
    const Icon = tone === 'primary' && confirmLabel.toLowerCase().includes('submit') ? CheckCircle2 : style.icon;
    const canConfirm = !input || value.trim().length > 0;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onMouseDown={() => close(null)}>
            <form
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby={message ? 'confirm-modal-message' : undefined}
                onMouseDown={(e) => e.stopPropagation()}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (canConfirm) close(input ? value : '');
                }}
                className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl space-y-5 animate-fade-in"
            >
                <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${style.iconClass}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                        <h3 id="confirm-modal-title" className="text-base font-bold text-[var(--color-text)]">{title}</h3>
                        {message && (
                            <p id="confirm-modal-message" className="text-xs text-[var(--color-muted)] leading-relaxed whitespace-pre-line">{message}</p>
                        )}
                    </div>
                </div>

                {input && (
                    <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--color-text)]">{input.label}</span>
                        <input
                            ref={inputRef}
                            type={input.type ?? 'text'}
                            value={value}
                            placeholder={input.placeholder}
                            autoComplete={input.autoComplete}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                        />
                    </label>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => close(null)}
                        className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="submit"
                        disabled={!canConfirm}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${style.button}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
