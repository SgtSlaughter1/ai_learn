import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Bell, BellRing, CheckCheck, Flag, GraduationCap, BadgeCheck, Loader2 } from 'lucide-react';
import { NOTIFICATIONS_CHANGED_EVENT, type NotificationSummary, type PopUpPermission } from '@/services/Notifications';
import { SECTION_CHANGE_EVENT } from '@/services/DashboardSection';

interface Item {
    id: string;
    kind: string | null;
    title: string;
    body: string;
    url: string;
    read: boolean;
    at: string | null;
}

interface Props {
    summary: NotificationSummary | null;
    onSummary: (summary: NotificationSummary) => void;
    permission: PopUpPermission;
    onEnablePopUps: () => void;
    isLearner: boolean;
}

const ICONS: Record<string, typeof Bell> = {
    explanation_reported: Flag,
    explanation_reviewed: BadgeCheck,
    practice_assigned: GraduationCap,
};

function ago(iso: string | null): string {
    if (!iso) return '';
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Opens a notification's page: in place when it is a section of the dashboard already open. */
function go(url: string) {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) return;
    if (target.pathname === window.location.pathname) {
        window.history.replaceState(window.history.state, '', target.pathname + target.search + target.hash);
        window.dispatchEvent(new Event(SECTION_CHANGE_EVENT));
        if (target.hash) document.querySelector(target.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0 });
        return;
    }
    router.visit(target.pathname + target.search + target.hash);
}

/** The bell in the header: what's new for this person, and a switch for browser pop-ups. */
export default function NotificationBell({ summary, onSummary, permission, onEnablePopUps, isLearner }: Props) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Item[] | null>(null);
    const [failed, setFailed] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const unread = summary?.unread ?? 0;

    useEffect(() => {
        if (!open) return;
        const outside = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
        const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    const load = async () => {
        setFailed(false);
        try {
            const res = await fetch('/api/v1/notifications', { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setItems(data.data);
            onSummary({ unread: data.unread, reviews: data.reviews, latest: data.latest });
        } catch {
            setFailed(true);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) void load();
    };

    const markRead = async (ids?: string[]) => {
        setItems((list) => list?.map((i) => (!ids || ids.includes(i.id) ? { ...i, read: true } : i)) ?? null);
        try {
            const res = await fetch('/api/v1/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(ids ? { ids } : {}),
            });
            if (res.ok) onSummary(await res.json());
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        } catch {
            // Offline: it stays unread on the server and is marked next time.
        }
    };

    const openItem = (item: Item) => {
        if (!item.read) void markRead([item.id]);
        setOpen(false);
        go(item.url);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                className="relative w-10 h-10 inline-flex items-center justify-center rounded-xl text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
            >
                <Bell className="w-5 h-5" aria-hidden />
                {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-[var(--color-error)] text-[9px] font-extrabold leading-none text-white ring-2 ring-[var(--color-surface)]">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Notifications"
                    className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[min(32rem,75vh)] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 overflow-hidden"
                >
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                        <h2 className="text-sm font-bold text-[var(--color-text)]">Notifications</h2>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={() => markRead()}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                            >
                                <CheckCheck className="w-3.5 h-3.5" aria-hidden />
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {items === null && !failed && (
                            <p className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--color-muted)]">
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                                Loading…
                            </p>
                        )}
                        {failed && <p className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">Couldn’t load notifications. They need a connection.</p>}
                        {items?.length === 0 && (
                            <p className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                                {isLearner ? 'Nothing yet. Practice your teacher sends you will show up here.' : 'Nothing yet. Reports from learners and reviews will show up here.'}
                            </p>
                        )}
                        {items && items.length > 0 && (
                            <ul className="divide-y divide-[var(--color-border)]">
                                {items.map((item) => {
                                    const Icon = ICONS[item.kind ?? ''] ?? Bell;
                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => openItem(item)}
                                                className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] cursor-pointer ${item.read ? '' : 'bg-[var(--color-primary-5)]'}`}
                                            >
                                                <span className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-muted)]">
                                                    <Icon className="w-4 h-4" aria-hidden />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex items-start gap-2">
                                                        <span className={`flex-1 text-xs text-[var(--color-text)] ${item.read ? 'font-semibold' : 'font-bold'}`}>{item.title}</span>
                                                        {!item.read && <span className="mt-1 w-2 h-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-label="Unread" />}
                                                    </span>
                                                    <span className="block mt-0.5 text-xs text-[var(--color-muted)] line-clamp-2">{item.body}</span>
                                                    <span className="block mt-1 text-[10px] text-[var(--color-muted)]">{ago(item.at)}</span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {permission !== 'granted' && permission !== 'unsupported' && (
                        <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-background)]/60">
                            {permission === 'default' ? (
                                <>
                                    <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                                        {isLearner
                                            ? 'Get a pop-up when your teacher sends you practice. Pop-ups never show your name or scores.'
                                            : 'Get a pop-up when learners report an AI explanation, even while you work in another tab.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onEnablePopUps}
                                        className="mt-2 min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                                    >
                                        <BellRing className="w-3.5 h-3.5" aria-hidden />
                                        Turn on pop-ups
                                    </button>
                                </>
                            ) : (
                                <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                                    Pop-ups are blocked for this site. You can allow them in your browser’s site settings.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
