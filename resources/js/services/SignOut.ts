import { clearUserOfflineData, getPendingSyncCount } from './OfflineService';
import { getSyncUser, setSyncUser } from './SyncQueue';
import { markPendingLogout, postLogout, syncAll } from './SyncService';
import { getAdminAuthHeaders } from './AdminOfflineService';
import { confirmAction } from '@/components/common/ConfirmModal';

const FINAL_SYNC_TIMEOUT_MS = 8000;

export interface SignOutOptions {
    /** Called with true while the final sync runs and false when it ends. */
    onSyncing?: (syncing: boolean) => void;
    /** Ask whether to sign out with unsynced work left; defaults to the confirm modal. */
    confirmUnsynced?: (pending: number) => Promise<boolean>;
}

async function finalSync(options: SignOutOptions): Promise<void> {
    if (!navigator.onLine) return;
    options.onSyncing?.(true);
    try {
        await Promise.race([syncAll(), new Promise((resolve) => setTimeout(resolve, FINAL_SYNC_TIMEOUT_MS))]);
    } finally {
        options.onSyncing?.(false);
    }
}

/** Remove this user's data from the device and go to the sign-in page. */
async function leaveDevice(userId: string | null): Promise<void> {
    await clearUserOfflineData(userId).catch((e) => console.warn('[SignOut] Could not clear offline data:', e));
    setSyncUser(null);
}

/**
 * Sign out without losing work or leaving it for the next person on this device:
 * sync first, warn about anything still unsynced (it is kept and syncs at the next
 * sign-in), clear this user's synced data, then end the session. Offline, the server
 * sign-out is completed automatically once the device reconnects.
 */
export async function signOutSafely(options: SignOutOptions = {}): Promise<void> {
    const userId = getSyncUser();
    await finalSync(options);

    const pending = await getPendingSyncCount(userId).catch(() => 0);
    if (pending > 0) {
        const confirmUnsynced = options.confirmUnsynced ?? ((count: number) => confirmAction({
            title: 'Some work is not synced yet',
            message: `${count} ${count === 1 ? 'change has' : 'changes have'} not reached the server. ${count === 1 ? 'It stays' : 'They stay'} on this device and sync the next time you sign in here.`,
            confirmLabel: 'Sign out anyway',
            cancelLabel: 'Stay signed in',
            tone: 'warning',
        }));
        if (!(await confirmUnsynced(pending))) return;
    }

    await leaveDevice(userId);

    const signedOut = navigator.onLine && (await postLogout());
    if (!signedOut) {
        markPendingLogout(userId);
    }
    window.location.href = '/login';
}

/**
 * Deactivate or delete the signed-in user's own account (profile page Danger Zone).
 * Waiting work is synced first; the server checks the password and signs the user out.
 * Returns an error message when it didn't happen.
 */
export async function removeOwnAccount(
    action: 'deactivate' | 'delete',
    password: string,
    options: SignOutOptions = {},
): Promise<string | null> {
    if (!navigator.onLine) return 'You need to be online to do this.';
    const userId = getSyncUser();
    await finalSync(options);

    let res: Response;
    try {
        res = await fetch(action === 'delete' ? '/api/v1/account' : '/api/v1/account/deactivate', {
            method: action === 'delete' ? 'DELETE' : 'POST',
            credentials: 'same-origin',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ password }),
        });
    } catch {
        return 'Could not reach the server. Please try again.';
    }

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        return data?.errors?.password?.[0] ?? data?.message ?? 'Something went wrong. Please try again.';
    }

    await leaveDevice(userId);
    window.location.href = '/login';
    return null;
}
