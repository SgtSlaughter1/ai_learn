import { db } from '../db/database';
import type {
    Learner,
    SchoolItem,
    ClassItem,
    SubjectItem,
    TopicItem,
    QuestionItem,
    SchoolAdminItem,
} from '../types/admin';

export const ADMIN_DATA_CHANGED_EVENT = 'app:admin-data-changed';

export function notifyAdminDataChanged(detail?: { table: string; action: string }) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ADMIN_DATA_CHANGED_EVENT, { detail }));
    }
}

function getCsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function getAdminAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    const xsrf = getCsrfToken();
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    }
    return headers;
}

// ── Cache Sync Helpers ──

export async function cacheAdminLearners(learners: Learner[]): Promise<void> {
    try {
        await db.adminLearners.clear();
        await db.adminLearners.bulkPut(learners);
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching learners:', e);
    }
}

export async function getCachedAdminLearners(): Promise<Learner[]> {
    try {
        return await db.adminLearners.toArray();
    } catch {
        return [];
    }
}

export async function cacheAdminSchools(schools: SchoolItem[]): Promise<void> {
    try {
        await db.adminSchools.clear();
        await db.adminSchools.bulkPut(schools);
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching schools:', e);
    }
}

export async function getCachedAdminSchools(): Promise<SchoolItem[]> {
    try {
        return await db.adminSchools.toArray();
    } catch {
        return [];
    }
}

export async function cacheAdminClasses(classes: ClassItem[]): Promise<void> {
    try {
        await db.adminClasses.clear();
        await db.adminClasses.bulkPut(classes);
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching classes:', e);
    }
}

export async function getCachedAdminClasses(): Promise<ClassItem[]> {
    try {
        return await db.adminClasses.toArray();
    } catch {
        return [];
    }
}

export async function cacheAdminQuestions(questions: QuestionItem[]): Promise<void> {
    try {
        await db.adminQuestions.clear();
        await db.adminQuestions.bulkPut(questions);
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching questions:', e);
    }
}

export async function getCachedAdminQuestions(): Promise<QuestionItem[]> {
    try {
        return await db.adminQuestions.toArray();
    } catch {
        return [];
    }
}

export async function cacheAdminSubjects(subjects: SubjectItem[]): Promise<void> {
    try {
        await db.subjects.clear();
        await db.subjects.bulkPut(subjects.map(s => ({
            id: s.id,
            school_id: s.school_id,
            school_name: s.school?.name,
            name: s.name,
            slug: s.slug,
            description: s.description,
            status: s.status,
            sort_order: s.sort_order,
            cached_at: new Date().toISOString(),
        })));
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching subjects:', e);
    }
}

export async function getCachedAdminSubjects(): Promise<SubjectItem[]> {
    try {
        const cached = await db.subjects.toArray();
        return cached.map(c => ({
            id: c.id,
            school_id: c.school_id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            status: c.status,
            sort_order: c.sort_order,
            school: c.school_name ? { id: c.school_id || 0, name: c.school_name } : undefined,
        }));
    } catch {
        return [];
    }
}

export async function cacheAdminTopics(topics: TopicItem[]): Promise<void> {
    try {
        await db.topics.clear();
        await db.topics.bulkPut(topics.map(t => ({
            id: t.id,
            subject_id: t.subject_id,
            name: t.name,
            slug: t.slug,
            level: t.level,
            description: t.description,
            status: t.status,
            sort_order: t.sort_order,
            cached_at: new Date().toISOString(),
        })));
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching topics:', e);
    }
}

export async function getCachedAdminTopics(subjectId?: number): Promise<TopicItem[]> {
    try {
        const cached = subjectId ? await db.topics.where('subject_id').equals(subjectId).toArray() : await db.topics.toArray();
        return cached.map(t => ({
            id: t.id,
            subject_id: t.subject_id,
            name: t.name,
            slug: t.slug,
            level: t.level,
            description: t.description,
            status: t.status,
            sort_order: t.sort_order,
        }));
    } catch {
        return [];
    }
}

export async function cacheAdminSchoolAdmins(admins: SchoolAdminItem[]): Promise<void> {
    try {
        await db.adminSchoolAdmins.clear();
        await db.adminSchoolAdmins.bulkPut(admins);
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching school admins:', e);
    }
}

export async function getCachedAdminSchoolAdmins(): Promise<SchoolAdminItem[]> {
    try {
        return await db.adminSchoolAdmins.toArray();
    } catch {
        return [];
    }
}

// ── Generic Offline-First Action Handler ──

export interface AdminActionResult<T = any> {
    success: boolean;
    synced: boolean;
    offline?: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export async function executeAdminAction<T = any>(options: {
    table: 'adminLearners' | 'adminSchools' | 'adminClasses' | 'adminQuestions' | 'adminSchoolAdmins' | 'subjects' | 'topics';
    action: 'insert' | 'update' | 'delete';
    recordId: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload?: any;
    optimisticRecord?: any;
}): Promise<AdminActionResult<T>> {
    const { table, action, recordId, endpoint, method, payload, optimisticRecord } = options;

    // 1. Try Online Request First if browser is online
    if (navigator.onLine) {
        try {
            const res = await fetch(endpoint, {
                method,
                headers: getAdminAuthHeaders(),
                credentials: 'same-origin',
                body: payload ? JSON.stringify(payload) : undefined,
            });

            if (res.ok) {
                const data = await res.json();
                try {
                    const tableObj = (db as any)[table];
                    if (tableObj) {
                        if (action === 'delete') {
                            await tableObj.delete(recordId.startsWith('temp_') ? recordId : isNaN(Number(recordId)) ? recordId : Number(recordId));
                        } else if (data.learner || data.subject || data.question || data.class || data.school || data.admin) {
                            const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin;
                            await tableObj.put(saved);
                        } else if (optimisticRecord) {
                            await tableObj.put({ ...optimisticRecord, _pendingSync: false });
                        }
                    }
                } catch (e) {
                    console.warn('[AdminOfflineService] Cache update error:', e);
                }

                notifyAdminDataChanged({ table, action });
                return {
                    success: true,
                    synced: true,
                    data,
                    message: data.message || 'Action completed successfully',
                };
            } else {
                if (res.status >= 400 && res.status < 500) {
                    const errorData = await res.json().catch(() => ({}));
                    return {
                        success: false,
                        synced: false,
                        error: errorData.message || errorData.error || `Server responded with status ${res.status}`,
                    };
                }
            }
        } catch (netErr) {
            console.warn('[AdminOfflineService] Online request failed with network error, queuing offline:', netErr);
        }
    }

    // 2. Offline Fallback / Queue
    try {
        const tableObj = (db as any)[table];
        if (tableObj) {
            if (action === 'delete') {
                const key = isNaN(Number(recordId)) ? recordId : Number(recordId);
                await tableObj.delete(key);
            } else if (optimisticRecord) {
                await tableObj.put({ ...optimisticRecord, _pendingSync: true });
            }
        }

        await db.syncQueue.add({
            table_name: table,
            action,
            record_id: String(recordId),
            endpoint,
            method,
            payload: JSON.stringify(payload || {}),
            created_at: new Date().toISOString(),
            synced: false,
            retries: 0,
        });

        notifyAdminDataChanged({ table, action });

        return {
            success: true,
            synced: false,
            offline: true,
            data: optimisticRecord,
            message: 'Saved offline. Changes will automatically sync when connection is restored.',
        };
    } catch (dbErr) {
        console.error('[AdminOfflineService] Local database error:', dbErr);
        return {
            success: false,
            synced: false,
            error: 'Failed to save record to local offline storage.',
        };
    }
}
