import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, WifiOff, X } from 'lucide-react';
import { CONNECTIVITY_EVENT, isServerReachable } from '@/services/Connectivity';
import { SYNC_COMPLETED_EVENT } from '@/services/SyncService';

export const OFFLINE_ACTION_BLOCKED_EVENT = 'app:offline-action-blocked';

// Pages opened offline each start the app afresh: remember that the "you're offline"
// notice was already shown for this offline period, so it isn't repeated on every page.
const OFFLINE_NOTICE_KEY = 'acedrill:offline-notice-shown';
const offlineNoticeShown = () => { try { return sessionStorage.getItem(OFFLINE_NOTICE_KEY) === '1'; } catch { return false; } };
const setOfflineNoticeShown = (shown: boolean) => {
    try { shown ? sessionStorage.setItem(OFFLINE_NOTICE_KEY, '1') : sessionStorage.removeItem(OFFLINE_NOTICE_KEY); } catch { /* ignore */ }
};

interface Notice {
    id: number;
    tone: 'offline' | 'success';
    text: string;
}

/**
 * Short, non-blocking messages about connectivity, rendered once for the whole app:
 * going offline, an action that needs a connection, and offline work finishing its sync.
 */
export function GlobalNotices() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const nextId = useRef(1);
    const wasOffline = useRef(!isServerReachable() || offlineNoticeShown());

    const show = (tone: Notice['tone'], text: string) => {
        const id = nextId.current++;
        setNotices((list) => [...list.filter((n) => n.text !== text), { id, tone, text }]);
        window.setTimeout(() => setNotices((list) => list.filter((n) => n.id !== id)), 6000);
    };

    useEffect(() => {
        const onConnectivity = () => {
            if (!isServerReachable() && !wasOffline.current) {
                wasOffline.current = true;
                setOfflineNoticeShown(true);
                show('offline', "You're offline. Keep going — your work is saved on this device and will sync automatically.");
            }
        };
        const onBlocked = () => show('offline', 'This needs an internet connection. Please try again when you are back online.');
        const onSynced = (event: Event) => {
            const synced = (event as CustomEvent).detail?.synced ?? 0;
            if (wasOffline.current && isServerReachable()) {
                wasOffline.current = false;
                setOfflineNoticeShown(false);
                show('success', synced > 0
                    ? `Back online — ${synced} ${synced === 1 ? 'change' : 'changes'} from offline synced.`
                    : 'Back online.');
            }
        };

        window.addEventListener('offline', onConnectivity);
        window.addEventListener(CONNECTIVITY_EVENT, onConnectivity);
        window.addEventListener(OFFLINE_ACTION_BLOCKED_EVENT, onBlocked);
        window.addEventListener(SYNC_COMPLETED_EVENT, onSynced);
        return () => {
            window.removeEventListener('offline', onConnectivity);
            window.removeEventListener(CONNECTIVITY_EVENT, onConnectivity);
            window.removeEventListener(OFFLINE_ACTION_BLOCKED_EVENT, onBlocked);
            window.removeEventListener(SYNC_COMPLETED_EVENT, onSynced);
        };
    }, []);

    if (notices.length === 0) return null;

    return (
        <div className="fixed inset-x-0 bottom-24 md:bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
            {notices.map((n) => (
                <div
                    key={n.id}
                    role="status"
                    className="pointer-events-auto flex items-start gap-2.5 max-w-md w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-text)] shadow-xl"
                >
                    {n.tone === 'offline'
                        ? <WifiOff className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
                        : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />}
                    <p className="flex-1 leading-relaxed">{n.text}</p>
                    <button
                        type="button"
                        onClick={() => setNotices((list) => list.filter((x) => x.id !== n.id))}
                        className="text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                        aria-label="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
