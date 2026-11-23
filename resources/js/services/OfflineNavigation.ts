import { router } from '@inertiajs/react';
import { db, type PageSnapshot } from '../db/database';

/**
 * Offline page rendering.
 *
 * The server only sends a page its route parameter and the signed-in user for almost every
 * page; the page then loads its own data from the API or the local database. So when the
 * server can't be reached, the device can render any page itself: the component and props
 * come from the route table below, merged with the last server data saved for that URL
 * (a "snapshot") when the page has any.
 */

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: string;
    has_school_access?: boolean;
    recess_enabled?: boolean;
}

type Props = Record<string, unknown>;

interface OfflineRoute {
    pattern: RegExp;
    component: string;
    /** Needs a signed-in user (mirrors the server's auth middleware). */
    auth: boolean;
    /** Props the server would derive from the URL. */
    params?: (match: RegExpMatchArray, url: URL) => Props;
    /** Defaults for props the server normally sends, used when there is no snapshot. */
    defaults?: Props;
    /** Adjust snapshot props for this exact URL (e.g. a different ?class_id). */
    transform?: (props: Props, url: URL) => Props;
    /**
     * Only open offline from saved server data. For pages whose content all comes from the
     * server: without it they would show an empty list or a missing exam as if it were true.
     */
    snapshotOnly?: boolean;
}

const OFFLINE_ROUTES: OfflineRoute[] = [
    { pattern: /^\/$/, component: 'Welcome', auth: false, defaults: { subjects: [], stats: {} } },
    { pattern: /^\/login$/, component: 'auth/Login', auth: false },
    { pattern: /^\/(register|signup)$/, component: 'auth/Register', auth: false },
    { pattern: /^\/forgot-password$/, component: 'auth/ForgotPassword', auth: false, defaults: { status: null } },
    { pattern: /^\/past-questions$/, component: 'ExamPrep/PastQuestionsIndex', auth: false },
    { pattern: /^\/dashboard$/, component: 'Dashboard', auth: true },
    { pattern: /^\/learner\/dashboard$/, component: 'learner/Dashboard', auth: true },
    { pattern: /^\/(admin|super-admin|school-admin)\/dashboard$/, component: 'admin/Dashboard', auth: true },
    {
        pattern: /^\/teacher\/dashboard$/,
        component: 'teacher/Dashboard',
        auth: true,
        defaults: { school: null, classes: [], selectedClass: null },
        transform: (props, url) => {
            const requested = Number(url.searchParams.get('class_id'));
            const classes = Array.isArray(props.classes) ? (props.classes as Array<{ id: number }>) : [];
            if (requested && classes.some((c) => c.id === requested)) {
                return { ...props, selectedClass: requested };
            }
            return props;
        },
    },
    { pattern: /^\/subjects$/, component: 'Subjects/Index', auth: true },
    { pattern: /^\/general-knowledge$/, component: 'GeneralKnowledge/Index', auth: true },
    { pattern: /^\/subjects\/([^/]+)$/, component: 'Subjects/Show', auth: true, params: (m) => ({ slug: decodeURIComponent(m[1]) }) },
    // Must come before /quizzes/{id}
    { pattern: /^\/quizzes\/attempts\/([^/]+)$/, component: 'quizzes/Result', auth: true, params: (m) => ({ attemptId: m[1] }) },
    { pattern: /^\/quizzes\/(\d+)$/, component: 'quizzes/Show', auth: true, params: (m) => ({ quizId: Number(m[1]) }) },
    { pattern: /^\/flashcards$/, component: 'Flashcards/Index', auth: true },
    { pattern: /^\/recess$/, component: 'Recess/Index', auth: true },
    // School exams. Sitting an exam (/exams/{id}/take) stays online: it needs the start code
    // and the server's timer.
    { pattern: /^\/exams$/, component: 'Exams/Index', auth: true, snapshotOnly: true },
    { pattern: /^\/exams\/(\d+)\/result$/, component: 'Exams/Result', auth: true, snapshotOnly: true },
    { pattern: /^\/school-exams$/, component: 'SchoolExams/Index', auth: true, snapshotOnly: true },
    { pattern: /^\/school-exams\/(\d+)$/, component: 'SchoolExams/Show', auth: true, snapshotOnly: true },
    { pattern: /^\/profile$/, component: 'Profile', auth: true, defaults: { profile: { school_name: null, member_since: null } } },
];

/** Paths each role should be able to open offline straight after signing in. */
export function homePathsForRole(role: string | undefined): string[] {
    switch (role) {
        case 'platform_admin':
        case 'school_admin':
            return ['/admin/dashboard', '/profile', '/school-exams'];
        case 'teacher':
            return ['/teacher/dashboard', '/profile', '/school-exams'];
        default:
            return ['/dashboard', '/subjects', '/general-knowledge', '/flashcards', '/recess', '/past-questions', '/exams', '/profile'];
    }
}

// ── Remembered user ──
// Kept in localStorage (not only IndexedDB) so it is available synchronously at boot.

const AUTH_USER_KEY = 'acedrill:auth-user';
const AUTH_CAN_KEY = 'acedrill:auth-can';

/** Remember the signed-in user and the abilities the server gave them (auth.can). */
export function rememberAuthUser(user: AuthUser, can?: Record<string, boolean> | null): void {
    try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        if (can) localStorage.setItem(AUTH_CAN_KEY, JSON.stringify(can));
    } catch {
        // ignore
    }
}

function getRememberedAbilities(): Record<string, boolean> | null {
    try {
        const raw = localStorage.getItem(AUTH_CAN_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getRememberedAuthUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
}

export function forgetAuthUser(): void {
    try {
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_CAN_KEY);
    } catch {
        // ignore
    }
}

// ── Snapshots ──

const MAX_SNAPSHOTS = 150;
const MAX_SNAPSHOT_BYTES = 500_000;
/** Marks props built on the device, so they are never saved back as a server snapshot. */
export const OFFLINE_PROP = '__offline';

interface InertiaPageLike {
    component: string;
    url: string;
    props: Props;
}

/** Save the server data of a page that was just loaded from the server. */
export async function saveSnapshot(page: InertiaPageLike | null | undefined): Promise<void> {
    if (!page?.component || !page.url || page.props?.[OFFLINE_PROP]) return;

    const { errors, flash, auth, ...props } = page.props ?? {};
    void errors; void flash;
    const user = (auth as { user?: AuthUser | null } | undefined)?.user ?? null;

    let size = 0;
    try {
        size = JSON.stringify(props).length;
    } catch {
        return;
    }
    if (size > MAX_SNAPSHOT_BYTES) return;

    const url = new URL(page.url, window.location.origin);
    const snapshot: PageSnapshot = {
        key: url.pathname + url.search,
        component: page.component,
        props,
        user_id: user?.id ? String(user.id) : null,
        saved_at: new Date().toISOString(),
    };

    try {
        await db.pageSnapshots.put(snapshot);
        const count = await db.pageSnapshots.count();
        if (count > MAX_SNAPSHOTS) {
            const oldest = await db.pageSnapshots.orderBy('saved_at').limit(count - MAX_SNAPSHOTS).primaryKeys();
            await db.pageSnapshots.bulkDelete(oldest);
        }
    } catch (e) {
        console.warn('[OfflineNavigation] Could not save page snapshot:', e);
    }
}

async function findSnapshot(url: URL, userId: string | null): Promise<PageSnapshot | undefined> {
    const usable = (s?: PageSnapshot) => s && (!s.user_id || s.user_id === userId) ? s : undefined;
    try {
        return usable(await db.pageSnapshots.get(url.pathname + url.search))
            ?? usable(await db.pageSnapshots.get(url.pathname));
    } catch {
        return undefined;
    }
}

export async function clearSnapshots(): Promise<void> {
    await db.pageSnapshots.clear();
}

// ── Rendering ──

export function matchOfflineRoute(pathname: string): { route: OfflineRoute; match: RegExpMatchArray } | null {
    for (const route of OFFLINE_ROUTES) {
        const match = pathname.match(route.pattern);
        if (match) return { route, match };
    }
    return null;
}

export interface OfflinePage {
    component: string;
    url: string;
    props: Props;
}

/**
 * Build a page on the device without the server. Returns null when the URL is not an
 * app page, or needs a signed-in user and nobody has signed in on this device.
 */
export async function buildOfflinePage(href: string): Promise<OfflinePage | null> {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;

    const found = matchOfflineRoute(url.pathname);
    if (!found) return null;
    const { route, match } = found;

    const user = getRememberedAuthUser();
    if (route.auth && !user) return null;

    const snapshot = await findSnapshot(url, user?.id ?? null);
    if (route.snapshotOnly && !snapshot) return null;

    let props: Props = {
        ...(route.defaults ?? {}),
        ...(snapshot?.props ?? {}),
        ...(route.params?.(match, url) ?? {}),
    };
    if (route.transform) props = route.transform(props, url);

    return {
        component: snapshot?.component ?? route.component,
        url: url.pathname + url.search,
        props: { ...props, auth: { user, can: user ? getRememberedAbilities() : null }, errors: {}, [OFFLINE_PROP]: true },
    };
}

/** Navigate to a page rendered on the device. Returns false when it can't be built. */
export async function renderOfflinePage(href: string, options: { replace?: boolean } = {}): Promise<boolean> {
    const page = await buildOfflinePage(href);
    if (!page) return false;

    const visit = { ...page, preserveScroll: false, preserveState: false };
    if (options.replace) router.replace(visit);
    else router.push(visit);
    return true;
}
