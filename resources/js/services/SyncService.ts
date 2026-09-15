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

async function syncAdminQueue(): Promise<number> {
    try {
        const queueItems = await db.syncQueue.filter(item => !item.synced).toArray();
        let syncedCount = 0;

        for (const item of queueItems) {
            try {
                const res = await fetch(item.endpoint, {
                    method: item.method,
                    headers: getAdminAuthHeaders(),
                    credentials: 'same-origin',
                    body: item.payload && item.payload !== '{}' ? item.payload : undefined,
                });

                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    try {
                        const tableObj = (db as any)[item.table_name];
                        if (tableObj) {
                            if (item.action === 'insert' && item.record_id.startsWith('temp_')) {
                                await tableObj.delete(item.record_id);
                                const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin;
                                if (saved) {
                                    await tableObj.put(saved);
                                }
                            } else if (item.action === 'delete') {
                                const key = isNaN(Number(item.record_id)) ? item.record_id : Number(item.record_id);
                                await tableObj.delete(key);
                            } else if (item.action === 'update') {
                                const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin;
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
                } else if (res.status === 404 || res.status === 422 || res.status === 400) {
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

function handleOnlineSync(): void {
    // Small delay to ensure connection is stable
    setTimeout(() => syncAll(), 2000);
}

// ── Sync status type ──

export interface SyncStatus {
    isOnline: boolean;
    pendingSync: number;
    isSyncing: boolean;
    lastSyncTime: string | null;
}
