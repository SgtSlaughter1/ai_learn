import {
    getUnsyncedAttempts,
    markAttemptSynced,
    getUnsyncedProgress,
    markProgressSynced,
    getUnsyncedGamification,
    markGamificationSynced,
} from './OfflineService';

let syncInProgress = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

function getCsrfToken(): string {
    // Laravel sets XSRF-TOKEN as a cookie (URL-encoded); use that instead of the meta tag
    // (the meta tag is not present in this app's Blade template).
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

// ── Core sync functions ──

async function syncQuizAttempts(): Promise<number> {
    const attempts = await getUnsyncedAttempts();
    let synced = 0;

    for (const attempt of attempts) {
        try {
            const res = await fetch(`/api/v1/quizzes/attempts/${attempt.id}/sync`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({
                    quiz_id: attempt.quiz_id,
                    answers: attempt.answers.map(a => ({
                        question_id: a.question_id,
                        selected_option_id: a.selected_option_id,
                        is_correct: a.is_correct,
                        marks_awarded: a.marks_awarded,
                    })),
                    duration_seconds: attempt.duration_seconds,
                }),
            });

            if (res.ok) {
                await markAttemptSynced(attempt.id);
                synced++;
                console.log(`[SyncService] Successfully synced offline attempt ${attempt.id} to server`);
            } else {
                console.warn(`[SyncService] Failed syncing attempt ${attempt.id}: HTTP ${res.status}`);
            }
        } catch (err) {
            console.warn(`[SyncService] Network error syncing attempt ${attempt.id}:`, err);
            // Will retry on next sync cycle
        }
    }

    return synced;
}

async function syncProgress(): Promise<number> {
    const progressItems = await getUnsyncedProgress();
    let synced = 0;

    for (const p of progressItems) {
        try {
            const res = await fetch('/api/v1/progress/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({
                    topic_id: p.topic_id,
                    questions_attempted: p.questions_attempted,
                    questions_correct: p.questions_correct,
                    mastery_score: p.mastery_score,
                    ability_score: p.ability_score,
                }),
            });

            if (res.ok && p.id) {
                await markProgressSynced(p.id);
                synced++;
            }
        } catch {
            // Will retry on next sync cycle
        }
    }

    return synced;
}

async function syncGamification(): Promise<number> {
    const gamificationItems = await getUnsyncedGamification();
    let synced = 0;

    for (const g of gamificationItems) {
        try {
            const res = await fetch('/api/v1/gamification/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({
                    total_xp: g.total_xp,
                    level: g.level,
                    tier: g.tier,
                    current_streak: g.current_streak,
                    longest_streak: g.longest_streak,
                }),
            });

            if (res.ok && g.id) {
                await markGamificationSynced(g.id);
                synced++;
            }
        } catch {
            // Will retry on next sync cycle
        }
    }

    return synced;
}

import { db } from '../db/database';
import { getAdminAuthHeaders, notifyAdminDataChanged } from './AdminOfflineService';

async function cleanUpTempRecord(tableObj: any, recordId: string) {
    if (!tableObj || !recordId) return;
    try {
        // 1. Delete by exact string record_id
        await tableObj.delete(recordId);

        // 2. Extract numeric timestamp (e.g., "temp_q_1760518385123" -> 1760518385123)
        const match = recordId.match(/(\d{10,})/);
        if (match) {
            const num = Number(match[1]);
            if (!isNaN(num)) {
                await tableObj.delete(num);
            }
            // 3. Delete "temp_${timestamp}" (used by teacher/admin/learner forms)
            await tableObj.delete(`temp_${match[1]}`);
        }

        // 4. Clean up any lingering optimistic records flagged _pendingSync
        const pendingItems = await tableObj.filter((r: any) => Boolean(r._pendingSync)).toArray();
        for (const item of pendingItems) {
            if (
                item.id === recordId ||
                String(item.id).includes(match ? match[1] : recordId) ||
                (item.record_id && item.record_id === recordId)
            ) {
                await tableObj.delete(item.id);
            }
        }
    } catch (e) {
        console.warn('[SyncService] Cleanup temp record error:', e);
    }
}

async function syncAdminQueue(): Promise<number> {
    try {
        const queueItems = await db.syncQueue.filter(item => !item.synced).toArray();
        let syncedCount = 0;

        for (const item of queueItems) {
            try {
                const res = await fetch(item.endpoint, {
                    method: item.method,
                    headers: getAdminAuthHeaders(),
                    credentials: 'include',
                    body: item.payload && item.payload !== '{}' ? item.payload : undefined,
                });

                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    try {
                        const tableObj = (db as any)[item.table_name];
                        if (tableObj) {
                            if (item.action === 'insert' && item.record_id.startsWith('temp_')) {
                                await cleanUpTempRecord(tableObj, item.record_id);
                                const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin || data.teacher || data.topic || data.data;
                                if (saved) {
                                    await tableObj.put({ ...saved, _pendingSync: false });
                                } else if (Array.isArray(data.questions)) {
                                    await tableObj.bulkPut(data.questions.map((q: any) => ({ ...q, _pendingSync: false })));
                                }
                            } else if (item.action === 'delete') {
                                const key = isNaN(Number(item.record_id)) ? item.record_id : Number(item.record_id);
                                await tableObj.delete(key);
                            } else if (item.action === 'update') {
                                const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin || data.teacher || data.topic || data.data;
                                if (saved) {
                                    await tableObj.put({ ...saved, _pendingSync: false });
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[SyncService] Local table sync update error:', e);
                    }

                    if (item.id) {
                        await db.syncQueue.delete(item.id);
                    }
                    syncedCount++;
                    console.log(`[SyncService] Successfully synced queued admin action ${item.action} on ${item.table_name}`);
                } else if ((res.status >= 400 && res.status < 500) || (item.retries && item.retries >= 3)) {
                    if (item.id) {
                        await db.syncQueue.delete(item.id);
                    }
                } else {
                    if (item.id) {
                        await db.syncQueue.update(item.id, { retries: (item.retries || 0) + 1 });
                    }
                }
            } catch (err) {
                console.warn(`[SyncService] Network error syncing admin queue item ${item.id}:`, err);
            }
        }

        if (syncedCount > 0) {
            notifyAdminDataChanged();
        }

        return syncedCount;
    } catch (e) {
        console.warn('[SyncService] Failed accessing sync queue:', e);
        return 0;
    }
}

// ── Main sync orchestrator ──

export async function syncAll(): Promise<{ synced: number; errors: number }> {
    if (syncInProgress) return { synced: 0, errors: 0 };
    if (!navigator.onLine) return { synced: 0, errors: 0 };

    syncInProgress = true;
    let totalSynced = 0;
    let totalErrors = 0;

    try {
        const [attemptSynced, progressSynced, gamificationSynced, adminSynced] = await Promise.all([
            syncQuizAttempts().catch(() => { totalErrors++; return 0; }),
            syncProgress().catch(() => { totalErrors++; return 0; }),
            syncGamification().catch(() => { totalErrors++; return 0; }),
            syncAdminQueue().catch(() => { totalErrors++; return 0; }),
        ]);

        totalSynced = attemptSynced + progressSynced + gamificationSynced + adminSynced;
    } finally {
        syncInProgress = false;
        // Unconditionally notify all listening pages that sync completed
        notifyAdminDataChanged();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:sync-completed', { detail: { synced: totalSynced, errors: totalErrors } }));
        }
    }

    return { synced: totalSynced, errors: totalErrors };
}

// ── Auto-sync on reconnect ──

export function startAutoSync(intervalMs: number = 30000): void {
    if (syncInterval) clearInterval(syncInterval);

    // Listen for online events
    window.addEventListener('online', handleOnlineSync);

    // Also try syncing periodically when online
    syncInterval = setInterval(() => {
        if (navigator.onLine) {
            syncAll();
        }
    }, intervalMs);
}

export function stopAutoSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    window.removeEventListener('online', handleOnlineSync);
}

let onlineSyncTimeout: ReturnType<typeof setTimeout> | null = null;

function handleOnlineSync(): void {
    if (onlineSyncTimeout) clearTimeout(onlineSyncTimeout);
    // Apply randomized jitter (500ms to 7500ms) to spread traffic across 500+ simultaneous reconnections
    const jitter = Math.floor(Math.random() * 7000) + 500;
    onlineSyncTimeout = setTimeout(() => {
        if (navigator.onLine && !syncInProgress) {
            syncAll();
        }
    }, jitter);
}

// ── Sync status type ──

export interface SyncStatus {
    isOnline: boolean;
    pendingSync: number;
    isSyncing: boolean;
    lastSyncTime: string | null;
}
