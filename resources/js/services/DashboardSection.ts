import type React from 'react';

/**
 * The admin and teacher dashboards keep their sections in `?tab=`. The sidebar switches
 * section in place (no page visit, so the loaded lists stay), and the dashboards listen
 * for the `urlchange` event this sends.
 */
export const SECTION_CHANGE_EVENT = 'urlchange';

export function sectionHref(base: string, key: string): string {
    return key === 'overview' ? base : `${base}?tab=${key}`;
}

export function currentSection(search?: string): string {
    const raw = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    return new URLSearchParams(raw).get('tab') ?? 'overview';
}

/** Click handler for a sidebar link: switch in place when the dashboard is already open. */
export function openSection(event: React.MouseEvent, base: string, key: string) {
    if (typeof window === 'undefined' || window.location.pathname !== base) return;
    event.preventDefault();
    if (currentSection() !== key) {
        // Keep the rest of the query (the teacher's chosen class, for one).
        const url = new URL(window.location.href);
        if (key === 'overview') url.searchParams.delete('tab');
        else url.searchParams.set('tab', key);
        window.history.replaceState(window.history.state, '', url.pathname + url.search);
    }
    window.dispatchEvent(new Event(SECTION_CHANGE_EVENT));
    window.scrollTo({ top: 0 });
}
