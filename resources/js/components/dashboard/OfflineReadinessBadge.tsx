import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, WifiOff, CloudDownload, Info } from 'lucide-react';
import { useOfflinePreloadStatus } from '@/hooks/useOfflinePreloadStatus';

interface OfflineReadinessBadgeProps {
    isOnline: boolean;
    className?: string;
    compact?: boolean;
}

export function OfflineReadinessBadge({ isOnline, className = '', compact = false }: OfflineReadinessBadgeProps) {
    const {
        isPreloading,
        isComplete,
        totalSubjects,
        completedSubjects,
        percent,
        cachedSubjectsCount,
    } = useOfflinePreloadStatus();

    const [showInfo, setShowInfo] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover on outside click
    useEffect(() => {
        if (!showInfo) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowInfo(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showInfo]);

    // 1. Offline Mode State
    if (!isOnline) {
        return (
            <div ref={popoverRef} className={`relative inline-flex items-center ${className}`}>
                <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 select-none shadow-2xs transition-all cursor-pointer hover:bg-amber-500/15 ${
                        compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
                    }`}
                    title="Click for offline status details"
                    aria-label="Offline Mode"
                >
                    <WifiOff className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-500 shrink-0`} />
                    <span>Offline</span>
                    {!compact && (
                        <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-normal">
                            • {cachedSubjectsCount > 0 ? `${cachedSubjectsCount} subjects saved` : 'Saved data active'}
                        </span>
                    )}
                </button>

                {showInfo && (
                    <div
                        className="absolute top-full right-0 mt-2 z-50 w-64 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl text-[11px] space-y-1.5 animate-in fade-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                            <span>Operating Offline</span>
                        </div>
                        <p className="text-[var(--color-muted)] leading-relaxed">
                            {cachedSubjectsCount > 0
                                ? `You have ${cachedSubjectsCount} subjects and quizzes cached in local device storage. Practice attempts will sync automatically when reconnected.`
                                : 'You are currently disconnected. Previously viewed subjects and quizzes remain available offline.'}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // 2. Active Background Preloading State
    if (isPreloading) {
        return (
            <div className={`relative inline-flex items-center ${className}`}>
                <div
                    className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-sky-500/10 border border-sky-500/25 text-sky-700 dark:text-sky-300 shadow-2xs select-none transition-all ${
                        compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs gap-2'
                    }`}
                    title={`Downloading offline curriculum (${percent}%)`}
                >
                    {/* Pulsing Signal Beacon */}
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                    </span>

                    <span className="flex items-center gap-1">
                        <CloudDownload className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-sky-500 shrink-0`} />
                        <span>{compact ? 'Caching' : 'Preparing pack'}</span>
                        {totalSubjects > 0 && (
                            <span className="tabular-nums font-bold text-[10px]">
                                ({completedSubjects}/{totalSubjects})
                            </span>
                        )}
                    </span>

                    {!compact && (
                        <span className="text-[10px] text-sky-600/80 dark:text-sky-300/80 font-normal">
                            • Keep data on
                        </span>
                    )}

                    {/* Compact progress track */}
                    <div className={`${compact ? 'w-8 h-1' : 'w-12 h-1.5'} bg-sky-200 dark:bg-sky-950/60 rounded-full overflow-hidden shrink-0 ml-0.5 border border-sky-500/20`}>
                        <div
                            className="bg-sky-500 h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // 3. Fully Offline-Ready State
    if (isComplete || cachedSubjectsCount > 0) {
        return (
            <div ref={popoverRef} className={`relative inline-flex items-center ${className}`}>
                <button
                    type="button"
                    onClick={() => setShowInfo(!showInfo)}
                    className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 shadow-2xs select-none transition-all cursor-pointer hover:bg-emerald-500/15 ${
                        compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
                    }`}
                    title="All curriculum and quizzes are stored offline - click for details"
                    aria-label="Offline Ready"
                >
                    <CheckCircle2 className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-500 shrink-0`} />
                    <span>{compact ? 'Offline Ready' : 'Offline Ready'}</span>
                    {!compact && (
                        <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-normal">
                            • Safe to disconnect
                        </span>
                    )}
                </button>

                {showInfo && (
                    <div
                        className="absolute top-full right-0 mt-2 z-50 w-64 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl text-[11px] space-y-1.5 animate-in fade-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Full Offline Storage Ready</span>
                        </div>
                        <p className="text-[var(--color-muted)] leading-relaxed">
                            {cachedSubjectsCount} subjects, quizzes, and revision cards are saved locally on your device. You can turn off your internet connection anytime to study offline with 0 mobile data.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Default neutral state
    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] shadow-2xs ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'} ${className}`}>
            <Info className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-[var(--color-muted)]`} />
            <span>{compact ? 'Checking...' : 'Checking cache...'}</span>
        </div>
    );
}
