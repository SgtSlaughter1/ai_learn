import { useState, useEffect } from 'react';
import {
    subscribeOfflinePreload,
    getOfflinePreloadState,
    OfflinePreloadProgress,
} from '@/services/OfflineService';
import { db } from '@/db/database';

export function useOfflinePreloadStatus(): OfflinePreloadProgress {
    const [status, setStatus] = useState<OfflinePreloadProgress>(() => getOfflinePreloadState());

    useEffect(() => {
        // Hydrate cached count from local Dexie database if not already preloading
        db.subjects.count()
            .then((count) => {
                if (count > 0) {
                    setStatus((prev) => ({
                        ...prev,
                        cachedSubjectsCount: count,
                        isComplete: prev.isComplete || (!prev.isPreloading && count > 0),
                    }));
                }
            })
            .catch(() => {});

        const unsubscribe = subscribeOfflinePreload((newStatus) => {
            setStatus(newStatus);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return status;
}
