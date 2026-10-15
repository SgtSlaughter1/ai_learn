/**
 * Whether the server can actually be reached, which navigator.onLine can't tell: on weak
 * networks, captive portals, or when the school server is down, the browser still says
 * "online". Updated by the sync engine's session check and by page visits.
 */

export const CONNECTIVITY_EVENT = 'app:connectivity';

let serverReachable = typeof navigator === 'undefined' ? true : navigator.onLine;

export function isServerReachable(): boolean {
    return serverReachable && (typeof navigator === 'undefined' || navigator.onLine);
}

export function reportServerReachable(reachable: boolean): void {
    if (serverReachable === reachable) return;
    serverReachable = reachable;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CONNECTIVITY_EVENT, { detail: { reachable } }));
    }
}
