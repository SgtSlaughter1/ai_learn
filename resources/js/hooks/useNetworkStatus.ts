import { useState, useEffect, useCallback } from 'react';
import { getPendingSyncCount } from '../services/OfflineService';
import { syncAll } from '../services/SyncService';

export interface NetworkStatus {
    isOnline: boolean;
    pendingSync: number;
    isSyncing: boolean;
    lastSyncTime: string | null;
    triggerSync: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [pendingSync, setPendingSync] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await getPendingSyncCount();
            setPendingSync(count);
        } catch {
            // ignore
        }
    }, []);

    const triggerSync = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;
        setIsSyncing(true);
        try {
            await syncAll();
            setLastSyncTime(new Date().toISOString());
            await refreshPendingCount();
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, refreshPendingCount]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // SyncService's handleOnlineSync handles automatic reconnection with randomized jitter.
            // When complete, the app:sync-completed event updates pendingSync.
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        const handleSyncCompleted = () => {
            refreshPendingCount();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('app:sync-completed', handleSyncCompleted);

        // Initial pending count
        refreshPendingCount();

        // Periodic pending count refresh
        const interval = setInterval(refreshPendingCount, 10000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('app:sync-completed', handleSyncCompleted);
            clearInterval(interval);
        };
    }, [refreshPendingCount, triggerSync]);

    return { isOnline, pendingSync, isSyncing, lastSyncTime, triggerSync };
}
