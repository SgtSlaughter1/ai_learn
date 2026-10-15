import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, LogIn, RefreshCw, RotateCcw, Trash2, WifiOff, X } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
    discardAttentionItem,
    getAttentionItems,
    retryAttentionItem,
    type AttentionItem,
} from '@/services/SyncAttention';

type Tone = 'danger' | 'warning' | 'info' | 'success';

const TONES: Record<Tone, string> = {
    danger: 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15',
    warning: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15',
    info: 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15',
    success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function timeAgo(iso: string | null): string | null {
    if (!iso) return null;
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * One place that says whether the user's work is safe: offline, waiting, syncing,
 * needing attention, or needing a sign-in. Opens a panel to act on it.
 * When everything is fine it shows `fallback` (e.g. the learner's offline-readiness badge).
 */
export function SyncStatus({ compact = false, fallback = null }: { compact?: boolean; fallback?: ReactNode }) {
    const { isOnline, pendingSync, failedSync, authRequired, isSyncing, lastSyncTime, triggerSync, refresh } = useNetworkStatus();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AttentionItem[]>([]);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const loadItems = useCallback(async () => {
        setItems(await getAttentionItems().catch(() => []));
    }, []);

    useEffect(() => {
        if (open) void loadItems();
    }, [open, failedSync, loadItems]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    let tone: Tone;
    let icon: ReactNode;
    let label: string;
    if (authRequired) {
        tone = 'danger';
        icon = <LogIn className="w-3.5 h-3.5 shrink-0" />;
        label = 'Sign in to sync';
    } else if (failedSync > 0) {
        tone = 'danger';
        icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
        label = compact ? `${failedSync} to review` : `${plural(failedSync, 'change needs', 'changes need')} attention`;
    } else if (!isOnline) {
        tone = 'warning';
        icon = <WifiOff className="w-3.5 h-3.5 shrink-0" />;
        label = pendingSync > 0 && !compact ? `Offline · ${pendingSync} saved on device` : 'Offline';
    } else if (pendingSync > 0) {
        tone = 'info';
        icon = isSyncing ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 shrink-0" />;
        label = isSyncing ? 'Syncing…' : compact ? `${pendingSync} waiting` : `${pendingSync} waiting to sync`;
    } else {
        return <>{fallback}</>;
    }

    const act = async (item: AttentionItem, action: 'retry' | 'discard') => {
        if (action === 'discard' && !window.confirm(`Discard "${item.title}${item.detail ? `: ${item.detail}` : ''}"? This change will be lost.`)) {
            return;
        }
        setBusyKey(item.key);
        try {
            if (action === 'retry') await retryAttentionItem(item);
            else await discardAttentionItem(item);
            await Promise.all([loadItems(), refresh()]);
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div ref={ref} className="relative inline-flex">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border font-semibold shadow-2xs transition-colors cursor-pointer ${TONES[tone]} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`}
                aria-expanded={open}
                aria-label={`Sync status: ${label}`}
            >
                {icon}
                <span className="whitespace-nowrap">{label}</span>
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Sync status"
                    className="absolute top-full right-0 mt-2 z-50 w-[min(22rem,calc(100vw-2rem))] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl text-xs overflow-hidden"
                >
                    <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)]">
                        <div className="space-y-1">
                            <p className="font-bold text-sm text-[var(--color-text)]">
                                {authRequired ? 'Sign in to keep syncing' : !isOnline ? "You're offline" : pendingSync > 0 ? 'Saving your work' : 'Everything else is synced'}
                            </p>
                            <p className="text-[var(--color-muted)] leading-relaxed">
                                {authRequired
                                    ? `Your session has ended. ${pendingSync > 0 ? `${plural(pendingSync, 'change is', 'changes are')} safe on this device and will` : 'Your work will'} sync after you sign in again.`
                                    : !isOnline
                                        ? pendingSync > 0
                                            ? `${plural(pendingSync, 'change is', 'changes are')} saved on this device and will sync automatically when the connection returns.`
                                            : 'Keep working: anything you do is saved on this device and syncs automatically when the connection returns.'
                                        : pendingSync > 0
                                            ? `${plural(pendingSync, 'change is', 'changes are')} being sent to the server.`
                                            : lastSyncTime ? `Last synced ${timeAgo(lastSyncTime)}.` : 'Your changes are on the server.'}
                            </p>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer" aria-label="Close">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                        {authRequired ? (
                            <a href="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3 py-1.5 font-bold text-white hover:opacity-90">
                                <LogIn className="w-3.5 h-3.5" /> Sign in again
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void triggerSync()}
                                disabled={!isOnline || isSyncing}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-1.5 font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                {isSyncing ? 'Syncing…' : 'Sync now'}
                            </button>
                        )}
                    </div>

                    {failedSync > 0 && (
                        <div className="max-h-72 overflow-y-auto">
                            <p className="px-4 pt-3 pb-1 font-bold text-[var(--color-text)] flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                Couldn't be saved on the server
                            </p>
                            <p className="px-4 pb-2 text-[var(--color-muted)] leading-relaxed">
                                {items.every((i) => i.activity)
                                    ? "The server couldn't add this to your record, usually because the content changed while you were offline. Retry if you think it was a temporary problem, or discard it."
                                    : 'Fix the problem (for example, a name or email already in use) and retry, or discard the change.'}
                            </p>
                            <ul className="divide-y divide-[var(--color-border)]">
                                {items.map((item) => (
                                    <li key={item.key} className="px-4 py-3 space-y-1.5">
                                        <p className="font-semibold text-[var(--color-text)]">
                                            {item.title}
                                            {item.detail && <span className="font-normal text-[var(--color-muted)]">: {item.detail}</span>}
                                        </p>
                                        <p className="text-rose-600 dark:text-rose-400">{item.error}</p>
                                        <div className="flex gap-2 pt-0.5">
                                            <button
                                                type="button"
                                                disabled={busyKey === item.key}
                                                onClick={() => void act(item, 'retry')}
                                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 font-semibold hover:bg-[var(--color-surface-hover)] disabled:opacity-50 cursor-pointer"
                                            >
                                                <RotateCcw className="w-3 h-3" /> Retry
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyKey === item.key}
                                                onClick={() => void act(item, 'discard')}
                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-1 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer"
                                            >
                                                <Trash2 className="w-3 h-3" /> Discard
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {failedSync === 0 && !authRequired && isOnline && pendingSync === 0 && (
                        <p className="px-4 py-3 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All changes are synced
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
