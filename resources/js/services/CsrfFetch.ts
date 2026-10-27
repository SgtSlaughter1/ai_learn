/**
 * Laravel checks every write for a CSRF token. Modern browsers pass that check with the
 * Sec-Fetch-Site header alone, but older ones (Safari before 16.4, old Android WebViews)
 * don't send it and fall back to the token. axios adds it by itself; plain fetch() does not,
 * so this adds the XSRF-TOKEN cookie's value to same-origin writes that don't carry a token.
 */

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let installed = false;

/** The XSRF-TOKEN cookie Laravel sets, decoded (the cookie value is URL-encoded). */
export function xsrfToken(): string {
    const match = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function installCsrfFetch(): void {
    if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    installed = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = input instanceof Request ? input : null;
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
        if (!WRITE_METHODS.has(method)) return originalFetch(input, init);

        const url = new URL(request ? request.url : input.toString(), window.location.href);
        const token = xsrfToken();
        if (url.origin !== window.location.origin || token === '') return originalFetch(input, init);

        const headers = new Headers(init?.headers ?? request?.headers);
        if (headers.has('X-XSRF-TOKEN') || headers.has('X-CSRF-TOKEN')) return originalFetch(input, init);
        headers.set('X-XSRF-TOKEN', token);

        return originalFetch(input, { ...init, headers });
    };
}
