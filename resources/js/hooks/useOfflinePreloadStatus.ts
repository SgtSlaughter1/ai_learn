import { useState, useEffect } from 'react';
import {
    subscribeOfflinePreload,
    getOfflinePreloadState,
    rememberedReadiness,
    OfflinePreloadProgress,
} from '@/services/OfflineService';

export function useOfflinePreloadStatus(): OfflinePreloadProgress {
    const [status, setStatus] = useState<OfflinePreloadProgress>(() => {
        const state = getOfflinePreloadState();
        // Data downloaded on an earlier visit counts as ready until this visit's refresh finishes.
        const remembered = rememberedReadiness();
        return remembered && !state.isPreloading && !state.savedSummary
            ? { ...state, isComplete: true, savedSummary: remembered.summary, savedDetail: remembered.detail }
            : state;
    });

    useEffect(() => subscribeOfflinePreload((next) => {
        setStatus((prev) => ({
            ...next,
            // Keep the remembered summary while a fresh download runs.
            savedSummary: next.savedSummary ?? prev.savedSummary,
            savedDetail: next.savedDetail ?? prev.savedDetail,
        }));
    }), []);

    return status;
}
