import { clearUserOfflineData, getPendingSyncCount } from './OfflineService';
import { getSyncUser, setSyncUser } from './SyncQueue';
import { markPendingLogout, postLogout, syncAll } from './SyncService';

const FINAL_SYNC_TIMEOUT_MS = 8000;

/**
 * Sign out without losing work or leaving it for the next person on this device:
 * sync first, warn about anything still unsynced (it is kept and syncs at the next
 * sign-in), clear this user's synced data, then end the session. Offline, the server
 * sign-out is completed automatically once the device reconnects.
 */
export interface SignOutOptions {
    /** Called with true while the final sync runs and false when it ends. */
    onSyncing?: (syncing: boolean) => void;
    /** Ask whether to sign out with unsynced work left; defaults to window.confirm. */
    confirmUnsynced?: (pending: number) => Promise<boolean>;
}

export async function signOutSafely(options: SignOutOptions = {}): Promise<void> {
    const userId = getSyncUser();

    if (navigator.onLine) {
        options.onSyncing?.(true);
        try {
            await Promise.race([
                syncAll(),
                new Promise((resolve) => setTimeout(resolve, FINAL_SYNC_TIMEOUT_MS)),
            ]);
        } finally {
            options.onSyncing?.(false);
        }
    }

    const pending = await getPendingSyncCount(userId).catch(() => 0);
    if (pending > 0) {
        const confirmUnsynced = options.confirmUnsynced ?? (async (count: number) => {
            const noun = count === 1 ? 'change has' : 'changes have';
            return window.confirm(
                `${count} ${noun} not synced yet. They will stay on this device and sync the next time you sign in.\n\nSign out now?`
            );
        });
        if (!(await confirmUnsynced(pending))) return;
    }

    await clearUserOfflineData(userId).catch((e) => console.warn('[SignOut] Could not clear offline data:', e));
    setSyncUser(null);

    const signedOut = navigator.onLine && (await postLogout());
    if (!signedOut) {
        markPendingLogout(userId);
    }
    window.location.href = '/login';
}
