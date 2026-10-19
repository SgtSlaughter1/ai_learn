import { db } from '../db/database';
import { classifyResponse, describeError, enqueue, hasPendingQueueItems } from './SyncQueue';
import { syncAll } from './SyncService';
import { rememberResponse, type PreloadStep } from './OfflineService';
import type {
    Learner,
    SchoolItem,
    ClassItem,
    SubjectItem,
    TopicItem,
    QuestionItem,
    SchoolAdminItem,
    TeacherItem,
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
        'X-Requested-With': 'XMLHttpRequest',
    };
    const xsrf = getCsrfToken();
    if (xsrf) {
        headers['X-XSRF-TOKEN'] = xsrf;
    }
    return headers;
}

// ── Cache Sync Helpers ──

/** Whether an optimistic record still has a queued change (matched by id or by the temp id it was queued under). */
function isQueued(record: any, queuedIds: Set<string>): boolean {
    return queuedIds.has(String(record.id)) || (Boolean(record._tempId) && queuedIds.has(record._tempId));
}

export async function getPendingSyncRecordIds(tableName: string): Promise<Set<string>> {
    try {
        const queued = await db.syncQueue
            .where('table_name')
            .equals(tableName)
            .filter(q => !q.synced && q.action !== 'delete')
            .toArray();
        const ids = new Set<string>();
        for (const q of queued) {
            ids.add(String(q.record_id));
            const match = q.record_id.match(/(\d{10,})/);
            if (match) {
                ids.add(match[1]);
                ids.add(`temp_${match[1]}`);
            }
        }
        return ids;
    } catch {
        return new Set();
    }
}

export async function cacheAdminLearners(serverLearners: Learner[]): Promise<Learner[]> {
    try {
        const existing = await db.adminLearners.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminLearners');
        const pendingSyncItems = existing.filter(l => Boolean((l as any)._pendingSync) && isQueued(l, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminLearners')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        // Remove any items that were deleted offline
        const filteredServerItems = serverLearners.filter(l => !deletedIds.has(String(l.id)));

        await db.adminLearners.clear();
        if (filteredServerItems.length > 0) {
            await db.adminLearners.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminLearners.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching learners:', e);
        return serverLearners;
    }
}

export async function getCachedAdminLearners(): Promise<Learner[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminLearners')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminLearners');

        const learners = await db.adminLearners.toArray();
        return learners.filter(l => {
            if (deletedIds.has(String(l.id))) return false;
            if ((l as any)._pendingSync && !isQueued(l, validPendingIds)) return false;
            return true;
        });
    } catch {
        return [];
    }
}

export async function cacheAdminSchools(serverSchools: SchoolItem[]): Promise<SchoolItem[]> {
    try {
        const existing = await db.adminSchools.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminSchools');
        const pendingSyncItems = existing.filter(s => Boolean((s as any)._pendingSync) && isQueued(s, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminSchools')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverSchools.filter(s => !deletedIds.has(String(s.id)));

        await db.adminSchools.clear();
        if (filteredServerItems.length > 0) {
            await db.adminSchools.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminSchools.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching schools:', e);
        return serverSchools;
    }
}

export async function getCachedAdminSchools(): Promise<SchoolItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminSchools')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminSchools');

        const schools = await db.adminSchools.toArray();
        return schools.filter(s => {
            if (deletedIds.has(String(s.id))) return false;
            if ((s as any)._pendingSync && !isQueued(s, validPendingIds)) return false;
            return true;
        });
    } catch {
        return [];
    }
}

export async function cacheAdminClasses(serverClasses: ClassItem[]): Promise<ClassItem[]> {
    try {
        const existing = await db.adminClasses.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminClasses');
        const pendingSyncItems = existing.filter(c => Boolean((c as any)._pendingSync) && isQueued(c, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminClasses')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverClasses.filter(c => !deletedIds.has(String(c.id)));

        await db.adminClasses.clear();
        if (filteredServerItems.length > 0) {
            await db.adminClasses.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminClasses.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching classes:', e);
        return serverClasses;
    }
}

export async function getCachedAdminClasses(): Promise<ClassItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminClasses')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminClasses');

        const classes = await db.adminClasses.toArray();
        return classes.filter(c => {
            if (deletedIds.has(String(c.id))) return false;
            if ((c as any)._pendingSync && !isQueued(c, validPendingIds)) return false;
            return true;
        });
    } catch {
        return [];
    }
}

export async function cacheAdminQuestions(serverQuestions: QuestionItem[]): Promise<QuestionItem[]> {
    try {
        const existing = await db.adminQuestions.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminQuestions');
        const pendingSyncItems = existing.filter(q => Boolean((q as any)._pendingSync) && isQueued(q, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminQuestions')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverQuestions.filter(s => !deletedIds.has(String(s.id)));

        await db.adminQuestions.clear();
        if (filteredServerItems.length > 0) {
            await db.adminQuestions.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminQuestions.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching questions:', e);
        return serverQuestions;
    }
}

export async function getCachedAdminQuestions(): Promise<QuestionItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminQuestions')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminQuestions');

        const questions = await db.adminQuestions.toArray();
        return questions.filter(q => {
            if (deletedIds.has(String(q.id))) return false;
            if ((q as any)._pendingSync && !isQueued(q, validPendingIds)) return false;
            return true;
        });
    } catch {
        return [];
    }
}

/** Class assignment of a subject; the teacher views filter subjects, topics and questions by it. */
function subjectClassFields(s: any): Pick<SubjectItem, 'class_id' | 'class_name' | 'class_grade_level' | 'school_class' | 'topics_count'> {
    return {
        class_id: s.class_id ?? null,
        class_name: s.class_name ?? s.school_class?.name ?? null,
        class_grade_level: s.class_grade_level ?? s.school_class?.grade_level ?? null,
        school_class: s.school_class ?? null,
        topics_count: s.topics_count,
    };
}

export async function cacheAdminSubjects(serverSubjects: SubjectItem[]): Promise<SubjectItem[]> {
    try {
        const existing = await db.subjects.toArray();
        const validPendingIds = await getPendingSyncRecordIds('subjects');
        const pendingSyncItems = existing.filter(s => Boolean((s as any)._pendingSync) && isQueued(s, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('subjects')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverSubjects.filter(s => !deletedIds.has(String(s.id)));

        await db.subjects.clear();
        if (filteredServerItems.length > 0) {
            await db.subjects.bulkPut(filteredServerItems.map(s => ({
                id: s.id,
                school_id: s.school_id,
                school_name: s.school?.name,
                ...subjectClassFields(s),
                name: s.name,
                slug: s.slug,
                description: s.description,
                status: s.status,
                sort_order: s.sort_order,
                cached_at: new Date().toISOString(),
                _pendingSync: false,
            })));
        }
        if (pendingSyncItems.length > 0) {
            await db.subjects.bulkPut(pendingSyncItems);
        }

        const mappedPending = pendingSyncItems.map(c => ({
            id: c.id,
            school_id: c.school_id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            status: c.status,
            sort_order: c.sort_order,
            school: c.school_name ? { id: c.school_id || 0, name: c.school_name } : undefined,
            _pendingSync: true,
        }));

        return [...mappedPending, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching subjects:', e);
        return serverSubjects;
    }
}

export async function getCachedAdminSubjects(): Promise<SubjectItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('subjects')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('subjects');

        const cached = await db.subjects.toArray();
        return cached
            .filter(c => {
                if (deletedIds.has(String(c.id))) return false;
                if ((c as any)._pendingSync && !isQueued(c, validPendingIds)) return false;
                return true;
            })
            .map(c => ({
                id: c.id,
                school_id: c.school_id,
                ...subjectClassFields(c),
                name: c.name,
                slug: c.slug,
                description: c.description,
                status: c.status,
                sort_order: c.sort_order,
                school: c.school_name ? { id: c.school_id || 0, name: c.school_name } : undefined,
                _pendingSync: (c as any)._pendingSync,
            }));
    } catch {
        return [];
    }
}

export async function cacheAdminTopics(serverTopics: TopicItem[]): Promise<TopicItem[]> {
    try {
        const existing = await db.topics.toArray();
        const validPendingIds = await getPendingSyncRecordIds('topics');
        const pendingSyncItems = existing.filter(t => Boolean((t as any)._pendingSync) && isQueued(t, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('topics')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverTopics.filter(t => !deletedIds.has(String(t.id)));

        await db.topics.clear();
        if (filteredServerItems.length > 0) {
            await db.topics.bulkPut(filteredServerItems.map(t => ({
                id: t.id,
                subject_id: t.subject_id,
                name: t.name,
                slug: t.slug,
                level: t.level,
                description: t.description,
                status: t.status,
                sort_order: t.sort_order,
                cached_at: new Date().toISOString(),
                _pendingSync: false,
            })));
        }
        if (pendingSyncItems.length > 0) {
            await db.topics.bulkPut(pendingSyncItems);
        }

        const mappedPending = pendingSyncItems.map(t => ({
            id: t.id,
            subject_id: t.subject_id,
            name: t.name,
            slug: t.slug,
            level: t.level,
            description: t.description,
            status: t.status,
            sort_order: t.sort_order,
            _pendingSync: true,
        }));

        return [...mappedPending, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching topics:', e);
        return serverTopics;
    }
}

export async function getCachedAdminTopics(subjectId?: number): Promise<TopicItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('topics')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('topics');

        const cached = subjectId
            ? await db.topics.where('subject_id').equals(subjectId).toArray()
            : await db.topics.toArray();

        return cached
            .filter(t => {
                if (deletedIds.has(String(t.id))) return false;
                if ((t as any)._pendingSync && !isQueued(t, validPendingIds)) return false;
                return true;
            })
            .map(t => ({
                id: t.id,
                subject_id: t.subject_id,
                name: t.name,
                slug: t.slug,
                level: t.level,
                description: t.description,
                status: t.status,
                sort_order: t.sort_order,
                _pendingSync: (t as any)._pendingSync,
            }));
    } catch {
        return [];
    }
}

export async function cacheAdminSchoolAdmins(serverAdmins: SchoolAdminItem[]): Promise<SchoolAdminItem[]> {
    try {
        const existing = await db.adminSchoolAdmins.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminSchoolAdmins');
        const pendingSyncItems = existing.filter(a => Boolean((a as any)._pendingSync) && isQueued(a, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminSchoolAdmins')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverAdmins.filter(a => !deletedIds.has(String(a.id)));

        await db.adminSchoolAdmins.clear();
        if (filteredServerItems.length > 0) {
            await db.adminSchoolAdmins.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminSchoolAdmins.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching school admins:', e);
        return serverAdmins;
    }
}

export async function getCachedAdminSchoolAdmins(): Promise<SchoolAdminItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminSchoolAdmins')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminSchoolAdmins');

        const admins = await db.adminSchoolAdmins.toArray();
        return admins.filter(a => {
            if (deletedIds.has(String(a.id))) return false;
            if ((a as any)._pendingSync && !isQueued(a, validPendingIds)) return false;
            return true;
        });
    } catch {
        return [];
    }
}

export async function cacheAdminTeachers(serverTeachers: TeacherItem[]): Promise<TeacherItem[]> {
    try {
        const existing = await db.adminTeachers.toArray();
        const validPendingIds = await getPendingSyncRecordIds('adminTeachers');
        const pendingSyncItems = existing.filter(t => Boolean((t as any)._pendingSync) && isQueued(t, validPendingIds));
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminTeachers')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));

        const filteredServerItems = serverTeachers.filter(t => !deletedIds.has(String(t.id)));

        await db.adminTeachers.clear();
        if (filteredServerItems.length > 0) {
            await db.adminTeachers.bulkPut(filteredServerItems);
        }
        if (pendingSyncItems.length > 0) {
            await db.adminTeachers.bulkPut(pendingSyncItems);
        }

        return [...pendingSyncItems, ...filteredServerItems];
    } catch (e) {
        console.warn('[AdminOfflineService] Failed caching teachers:', e);
        return serverTeachers;
    }
}

export async function getCachedAdminTeachers(): Promise<TeacherItem[]> {
    try {
        const pendingDeletions = await db.syncQueue
            .where('table_name')
            .equals('adminTeachers')
            .filter(q => q.action === 'delete' && !q.synced)
            .toArray();
        const deletedIds = new Set(pendingDeletions.map(d => String(d.record_id)));
        const validPendingIds = await getPendingSyncRecordIds('adminTeachers');

        const teachers = await db.adminTeachers.toArray();
        return teachers.filter(t => {
            if (deletedIds.has(String(t.id))) return false;
            if ((t as any)._pendingSync && !isQueued(t, validPendingIds)) return false;
            return true;
        });
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
    // 'classMemberships' has no local table: callers keep their own cached roster up to date.
    table: 'adminLearners' | 'adminSchools' | 'adminClasses' | 'adminQuestions' | 'adminSchoolAdmins' | 'adminTeachers' | 'subjects' | 'topics' | 'classMemberships';
    action: 'insert' | 'update' | 'delete';
    recordId: string;
    endpoint: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    payload?: any;
    optimisticRecord?: any;
}): Promise<AdminActionResult<T>> {
    const { table, action, method, payload, optimisticRecord } = options;
    let { recordId, endpoint } = options;
    const localKey = isNaN(Number(recordId)) ? recordId : Number(recordId);

    // A record created offline is shown under a local id but queued under its temp_ id.
    // Edits and deletes of it must use the queued id, so they merge into (or cancel) the
    // pending create instead of targeting an id the server has never seen.
    const localRecord = action !== 'insert'
        ? await (db as any)[table]?.get(localKey).catch(() => null)
        : null;
    const queuedTempId: string | undefined = localRecord?._tempId;
    if (queuedTempId && queuedTempId !== recordId) {
        endpoint = endpoint.split(`/${recordId}`).join(`/${queuedTempId}`);
        recordId = queuedTempId;
    }

    // One key per user action, reused by every retry, so the server applies it exactly once.
    const idempotencyKey = crypto.randomUUID();

    // Go straight to the server only when nothing is waiting ahead of this change and the
    // record already exists there; otherwise queue it behind earlier changes to keep order.
    const mustQueue = recordId.startsWith('temp_') || await hasPendingQueueItems();
    let requestMayHaveReachedServer = false;

    // 1. Try Online Request First if browser is online
    if (navigator.onLine && !mustQueue) {
        try {
            requestMayHaveReachedServer = true;
            const res = await fetch(endpoint, {
                method,
                headers: { ...getAdminAuthHeaders(), 'Idempotency-Key': idempotencyKey },
                credentials: 'include',
                body: payload ? JSON.stringify(payload) : undefined,
            });
            const data = await res.json().catch(() => ({}));
            const outcome = classifyResponse(res.status, method, data);

            if (outcome === 'ok') {
                try {
                    const tableObj = (db as any)[table];
                    if (tableObj) {
                        if (action === 'delete') {
                            await tableObj.delete(localKey);
                        } else {
                            const saved = data.learner || data.subject || data.question || data.class || data.school || data.admin || data.teacher || data.topic || data.data;
                            if (saved) {
                                await tableObj.put(saved);
                            } else if (optimisticRecord) {
                                await tableObj.put({ ...optimisticRecord, _pendingSync: false });
                            }
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
                    message: data.message || (action === 'delete' ? 'Deleted successfully' : 'Saved successfully'),
                };
            }

            if (outcome === 'permanent') {
                // Validation or permission problem: show it now, nothing to queue.
                return {
                    success: false,
                    synced: false,
                    error: describeError(res.status, data),
                };
            }
            // 'auth' or 'transient': keep the change and let the sync engine retry it.
        } catch (netErr) {
            console.warn('[AdminOfflineService] Online request failed with network error, queuing offline:', netErr);
        }
    }

    // 2. Offline Fallback / Queue
    try {
        const tableObj = (db as any)[table];
        if (tableObj) {
            if (action === 'delete') {
                await tableObj.delete(localKey);
            } else if (optimisticRecord) {
                const tempId = recordId.startsWith('temp_') ? recordId : undefined;
                await tableObj.put({ ...optimisticRecord, _pendingSync: true, ...(tempId ? { _tempId: tempId } : {}) });
            }
        }

        await enqueue({
            table_name: table,
            action,
            record_id: String(recordId),
            endpoint,
            method,
            payload: payload || {},
            idempotency_key: idempotencyKey,
            sent: requestMayHaveReachedServer,
        });

        notifyAdminDataChanged({ table, action });
        if (navigator.onLine) {
            void syncAll();
        }

        return {
            success: true,
            synced: false,
            offline: true,
            data: optimisticRecord,
            message: navigator.onLine
                ? 'Saved. Syncing with the server…'
                : 'Saved offline. Changes will automatically sync when connection is restored.',
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

// ── Offline download for admins and teachers ──

interface StaffAbilities {
    accessAdmin?: boolean;
    accessTeaching?: boolean;
    managePlatform?: boolean;
}

async function getJson(path: string): Promise<any> {
    const res = await fetch(path, { headers: getAdminAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json();
}

/** Fetch a list endpoint and store it with the same cache function its tab uses. */
function listStep(label: string, path: string, key: string, cache: (items: any[]) => Promise<unknown>): PreloadStep {
    return {
        label,
        run: async () => {
            const data = await getJson(path);
            await cache(data.data || data[key] || []);
        },
    };
}

/**
 * Everything a school admin, platform admin or teacher needs to keep working offline,
 * chosen from the abilities the server granted (auth.can).
 */
export function staffPreloadSteps(can: StaffAbilities, isTeacher: boolean): PreloadStep[] {
    const steps: PreloadStep[] = [];

    if (can.accessAdmin) {
        steps.push({
            label: 'Dashboard statistics',
            run: async () => {
                const data = await getJson('/api/v1/admin/stats');
                localStorage.setItem('cached_admin_stats', JSON.stringify(data.status === 'success' ? data.data : data));
            },
        });
        steps.push(listStep('Schools', '/api/v1/admin/schools', 'schools', cacheAdminSchools));
        if (can.managePlatform) {
            steps.push(listStep('School admins', '/api/v1/admin/school-admins', 'school_admins', cacheAdminSchoolAdmins));
        }
        steps.push(listStep('Teachers', '/api/v1/admin/teachers', 'teachers', cacheAdminTeachers));
        steps.push(listStep('Classes', '/api/v1/admin/classes', 'classes', cacheAdminClasses));
        steps.push(listStep('Learners', '/api/v1/admin/learners', 'learners', cacheAdminLearners));
    }

    if (isTeacher) {
        steps.push({
            label: 'Class statistics and rosters',
            run: async () => {
                const stats = await getJson('/api/v1/teacher/stats');
                localStorage.setItem('cached_teacher_stats_all', JSON.stringify(stats));
                const classes: Array<{ id: number }> = Array.isArray(stats.classes) ? stats.classes : Object.values(stats.classes ?? {});
                for (const cls of classes) {
                    const roster = await getJson(`/api/v1/teacher/classes/${cls.id}/learners`);
                    rememberResponse(`teacher_roster_${cls.id}`, roster);
                }
            },
        });
    }

    if (can.accessAdmin || can.accessTeaching) {
        steps.push({
            label: 'Subjects and topics',
            run: async () => {
                const data = await getJson('/api/v1/admin/subjects');
                const subjects = data.subjects || data.data || [];
                await cacheAdminSubjects(subjects);
                const topics = subjects.flatMap((s: any) => s.topics || []);
                if (topics.length) await cacheAdminTopics(topics);
            },
        });
        steps.push(listStep('Question bank', '/api/v1/admin/questions', 'questions', cacheAdminQuestions));
    }

    return steps;
}


/**
 * Activate or deactivate a user account or a whole school (works offline: queued like any
 * other admin change). Deactivated users, and every user of a deactivated school, cannot
 * sign in until reactivated. Nothing is deleted.
 */
export async function setAccountActive(
    kind: 'user' | 'school',
    table: 'adminLearners' | 'adminTeachers' | 'adminSchoolAdmins' | 'adminSchools',
    record: { id: string | number },
    isActive: boolean,
): Promise<AdminActionResult> {
    const resource = kind === 'school' ? 'schools' : 'users';
    return executeAdminAction({
        table,
        action: 'update',
        recordId: String(record.id),
        endpoint: `/api/v1/admin/${resource}/${record.id}/status`,
        method: 'PATCH',
        payload: { is_active: isActive },
        optimisticRecord: { ...record, is_active: isActive },
    });
}
