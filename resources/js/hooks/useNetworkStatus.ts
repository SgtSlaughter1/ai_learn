import { useState, useEffect, useCallback } from 'react';
import { getFailedSyncCount, getPendingSyncCount } from '../services/OfflineService';
import {
    isSyncAuthRequired,
    syncAll,
    SYNC_AUTH_REQUIRED_EVENT,
    SYNC_COMPLETED_EVENT,
    SYNC_STARTED_EVENT,
} from '../services/SyncService';
import { CONNECTIVITY_EVENT, isServerReachable } from '../services/Connectivity';

export interface NetworkStatus {
    /** The server can actually be reached (not just "the browser has a network"). */
    isOnline: boolean;
    pendingSync: number;
    /** Changes the server rejected; kept on the device until the user retries or discards them. */
    failedSync: number;
    /** The session expired: syncing is paused until the user signs in again. */
    authRequired: boolean;
    isSyncing: boolean;
    lastSyncTime: string | null;
    triggerSync: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState<boolean>(isServerReachable());
    const [pendingSync, setPendingSync] = useState<number>(0);
    const [failedSync, setFailedSync] = useState<number>(0);
    const [authRequired, setAuthRequired] = useState<boolean>(isSyncAuthRequired());
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const [count, failed] = await Promise.all([getPendingSyncCount(), getFailedSyncCount()]);
            setPendingSync(count);
            setFailedSync(failed);
        } catch {
            // ignore
        }
    }, []);

    const triggerSync = useCallback(async () => {
        if (!navigator.onLine) return;
        await syncAll();
        await refresh();
    }, [refresh]);

    useEffect(() => {
        const updateOnline = () => setIsOnline(isServerReachable());
        const handleSyncStarted = () => setIsSyncing(true);
        const handleSyncCompleted = () => {
            setIsSyncing(false);
            setLastSyncTime(new Date().toISOString());
            refresh();
        };
        const handleAuthRequired = (event: Event) => {
            setAuthRequired(Boolean((event as CustomEvent).detail?.authRequired));
        };

        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        window.addEventListener(CONNECTIVITY_EVENT, updateOnline);
        window.addEventListener(SYNC_STARTED_EVENT, handleSyncStarted);
        window.addEventListener(SYNC_COMPLETED_EVENT, handleSyncCompleted);
        window.addEventListener(SYNC_AUTH_REQUIRED_EVENT, handleAuthRequired);
        // Local changes (queued saves, retries, discards) update the counts straight away.
        window.addEventListener('app:admin-data-changed', refresh);
        window.addEventListener('app:sync-queue-changed', refresh);

        refresh();
        const interval = setInterval(refresh, 10000);

        return () => {
            window.removeEventListener('online', updateOnline);
            window.removeEventListener('offline', updateOnline);
            window.removeEventListener(CONNECTIVITY_EVENT, updateOnline);
            window.removeEventListener(SYNC_STARTED_EVENT, handleSyncStarted);
            window.removeEventListener(SYNC_COMPLETED_EVENT, handleSyncCompleted);
            window.removeEventListener(SYNC_AUTH_REQUIRED_EVENT, handleAuthRequired);
            window.removeEventListener('app:admin-data-changed', refresh);
            window.removeEventListener('app:sync-queue-changed', refresh);
            clearInterval(interval);
        };
    }, [refresh]);

    return { isOnline, pendingSync, failedSync, authRequired, isSyncing, lastSyncTime, triggerSync, refresh };
}
