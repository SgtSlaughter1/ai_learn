import { db, type LocalQuizAttempt, type SyncQueueItem } from '../db/database';
import { notifyAdminDataChanged } from './AdminOfflineService';
import {
    belongsTo,
    discardFailedQueueItem,
    getFailedQueueItems,
    getSyncUser,
    notifyQueueChanged,
    retryFailedQueueItem,
} from './SyncQueue';
import { syncAll } from './SyncService';

/**
 * Changes the server rejected, in plain language, for the "needs attention" panel.
 * Nothing here is ever deleted automatically: the user retries (e.g. after fixing the
 * conflicting record) or discards each one.
 */
export interface AttentionItem {
    key: string;
    kind: 'queue' | 'attempt';
    id: number | string;
    title: string;
    detail: string | null;
    /** A learner's own activity (quiz, flashcards…) rather than an admin/teacher record edit. */
    activity: boolean;
    error: string;
    created_at: string;
}

const RECORD_LABELS: Record<string, string> = {
    adminLearners: 'Learner',
    adminSchools: 'School',
    adminClasses: 'Class',
    adminQuestions: 'Question',
    adminSchoolAdmins: 'School admin',
    adminTeachers: 'Teacher',
    subjects: 'Subject',
    topics: 'Topic',
    classMemberships: 'Class enrolment',
    flashcardSessions: 'Flashcard session',
    revisionReviews: 'Revision answer',
    revisionSessions: 'Revision session',
    pastQuestionSimulations: 'Exam simulation',
};

const LEARNER_ACTIVITY_TABLES = ['flashcardSessions', 'revisionReviews', 'revisionSessions', 'pastQuestionSimulations'];

const ACTION_LABELS: Record<SyncQueueItem['action'], string> = {
    insert: 'New',
    update: 'Edit to',
    delete: 'Removal of',
};

function describeQueueItem(item: SyncQueueItem): Pick<AttentionItem, 'title' | 'detail'> {
    const label = RECORD_LABELS[item.table_name] ?? 'Change';
    const learnerAction = LEARNER_ACTIVITY_TABLES.includes(item.table_name);
    const title = learnerAction ? label : `${ACTION_LABELS[item.action]} ${label.toLowerCase()}`;

    let detail: string | null = null;
    try {
        const p = JSON.parse(item.payload || '{}');
        detail = p.name || p.title || p.email || p.question_text || p.exam_code?.toUpperCase() || null;
        if (typeof detail === 'string' && detail.length > 80) detail = `${detail.slice(0, 77)}…`;
    } catch {
        // ignore
    }
    return { title: title.charAt(0).toUpperCase() + title.slice(1), detail };
}

async function getFailedAttempts(): Promise<LocalQuizAttempt[]> {
    const userId = getSyncUser();
    const failed = await db.quizAttempts.filter((a) => a.sync_status === 'failed').toArray();
    return userId ? failed.filter((a) => belongsTo(a.user_id, userId)) : failed;
}

export async function getAttentionItems(): Promise<AttentionItem[]> {
    const [queueItems, attempts] = await Promise.all([getFailedQueueItems(), getFailedAttempts()]);

    const fromQueue = queueItems.map((item): AttentionItem => ({
        key: `queue-${item.id}`,
        kind: 'queue',
        id: item.id!,
        activity: LEARNER_ACTIVITY_TABLES.includes(item.table_name),
        ...describeQueueItem(item),
        error: item.error || 'The server could not accept this change.',
        created_at: item.created_at,
    }));
    const fromAttempts = attempts.map((a): AttentionItem => ({
        key: `attempt-${a.id}`,
        kind: 'attempt',
        id: a.id,
        activity: true,
        title: 'Quiz attempt',
        detail: a.quiz_title ?? null,
        error: a.sync_error || 'The server could not accept this attempt.',
        created_at: a.completed_at ?? a.started_at,
    }));

    return [...fromQueue, ...fromAttempts].sort((x, y) => x.created_at.localeCompare(y.created_at));
}

export async function retryAttentionItem(item: AttentionItem): Promise<void> {
    if (item.kind === 'queue') {
        await retryFailedQueueItem(Number(item.id));
    } else {
        await db.quizAttempts.update(String(item.id), { sync_status: undefined, sync_error: null, sync_attempts: 0, next_sync_at: null });
        notifyQueueChanged();
    }
    if (navigator.onLine) void syncAll();
}

/** Drop a rejected change for good, and undo its effect on this device's saved copy. */
export async function discardAttentionItem(item: AttentionItem): Promise<void> {
    if (item.kind === 'queue') {
        const queued = await db.syncQueue.get(Number(item.id));
        // A record created offline that the server refused: remove the placeholder copy too.
        if (queued?.action === 'insert' && queued.record_id.startsWith('temp_')) {
            const table = (db as any)[queued.table_name];
            await table?.delete(queued.record_id).catch(() => {});
        }
        await discardFailedQueueItem(Number(item.id));
        notifyAdminDataChanged();
    } else {
        await db.quizAttempts.delete(String(item.id));
        notifyQueueChanged();
    }
}
