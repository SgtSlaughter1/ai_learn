import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// How long to wait before re-showing the banner after dismissal (24 hours)
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'pwa_prompt_dismissed_at';

function isDismissedRecently(): boolean {
    try {
        const ts = localStorage.getItem(STORAGE_KEY);
        if (!ts) return false;
        return Date.now() - parseInt(ts, 10) < DISMISS_COOLDOWN_MS;
    } catch {
        return false;
    }
}

function markDismissed() {
    try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
}

function clearDismissed() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {}
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // 1. Check if already running in standalone (installed) mode
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        setIsStandalone(standalone);
        if (standalone) return;

        // 2. Check localStorage dismissal (cleared when user clears site data)
        setIsDismissed(isDismissedRecently());

        // 3. Detect iOS Safari
        const ua = window.navigator.userAgent.toLowerCase();
        const isApple = /iphone|ipad|ipod/.test(ua);
        const isSafari = /safari/.test(ua) && !/crios|fxios|chrome/.test(ua);
        setIsIOS(isApple && isSafari);

        // 4. Listen for Chrome/Android/Edge install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const handleAppInstalled = () => {
            setIsStandalone(true);
            setDeferredPrompt(null);
            clearDismissed();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Small delay so the page is settled before showing the banner
        const timer = setTimeout(() => setReady(true), 2500);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            clearTimeout(timer);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsStandalone(true);
            clearDismissed();
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        markDismissed();
    };

    // Don't render until page is settled
    if (!ready) return null;
    // Already installed
    if (isStandalone) return null;
    // Dismissed recently
    if (isDismissed) return null;
    // Nothing to show, no install trigger and not iOS
    if (!deferredPrompt && !isIOS) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom duration-300">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <img
                        src="/images/icon-192x192.png"
                        alt="App Icon"
                        className="w-12 h-12 rounded-xl object-contain border border-[var(--color-border)] shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-[var(--color-text)]">
                                Install PassPoint
                            </h4>
                            <button
                                onClick={handleDismiss}
                                className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 -mr-1 rounded-lg"
                                aria-label="Close"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">
                            Install on your home screen for full offline study and instant access anytime.
                        </p>
                    </div>
                </div>

                {deferredPrompt ? (
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={handleInstallClick}
                            className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Add to Home Screen
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] py-2.5 px-3 rounded-xl transition-colors font-medium"
                        >
                            Not now
                        </button>
                    </div>
                ) : isIOS ? (
                    <div className="bg-[var(--color-primary-5)] border border-[var(--color-primary-10)] rounded-xl p-2.5 text-xs text-[var(--color-text)] flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 002 2z" />
                        </svg>
                        <span>
                            Tap{' '}
                            <strong className="text-[var(--color-primary)] font-semibold">Share</strong>
                            {' '}(
                            <svg className="w-3.5 h-3.5 inline mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            ) then{' '}
                            <strong className="text-[var(--color-primary)] font-semibold">Add to Home Screen</strong>
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
