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
export async function signOutSafely(): Promise<void> {
    const userId = getSyncUser();

    if (navigator.onLine) {
        await Promise.race([
            syncAll(),
            new Promise((resolve) => setTimeout(resolve, FINAL_SYNC_TIMEOUT_MS)),
        ]);
    }

    const pending = await getPendingSyncCount(userId).catch(() => 0);
    if (pending > 0) {
        const noun = pending === 1 ? 'change has' : 'changes have';
        const proceed = window.confirm(
            `${pending} ${noun} not synced yet. They will stay on this device and sync the next time you sign in.\n\nSign out now?`
        );
        if (!proceed) return;
    }

    await clearUserOfflineData(userId).catch((e) => console.warn('[SignOut] Could not clear offline data:', e));
    setSyncUser(null);

    const signedOut = navigator.onLine && (await postLogout());
    if (!signedOut) {
        markPendingLogout(userId);
    }
    window.location.href = '/login';
}
