import { LogIn } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Shown when the server says the session has ended while work is still waiting to sync.
 * Nothing is lost: the work stays on this device and syncs after the same user signs in.
 */
export function SessionExpiredBanner() {
    const { authRequired, pendingSync } = useNetworkStatus();
    if (!authRequired) return null;

    return (
        <div role="alert" className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs">
            <p className="flex-1 text-[var(--color-text)] leading-relaxed">
                <span className="font-bold">Your session has ended.</span>{' '}
                {pendingSync > 0
                    ? `${pendingSync} ${pendingSync === 1 ? 'change is' : 'changes are'} safe on this device and will sync as soon as you sign in again.`
                    : 'Sign in again to keep your work syncing.'}
            </p>
            <a
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3 py-1.5 font-bold text-white hover:opacity-90 shrink-0"
            >
                <LogIn className="w-3.5 h-3.5" /> Sign in again
            </a>
        </div>
    );
}
