import { useState, useRef, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import { LogOut, ChevronDown, Sun, Moon, Shield, Sparkles, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getUnsyncedTotalCount, purgeUserCacheOnLogout } from '@/services/OfflineService';
import { syncAll } from '@/services/SyncService';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface UserProfileMenuProps {
    user?: User;
}

export default function UserProfileMenu({ user }: UserProfileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isDark, toggleTheme } = useTheme();
    const { isOnline, pendingSync, isSyncing, triggerSync } = useNetworkStatus();

    // Pre-logout guard states
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isSyncingBeforeLogout, setIsSyncingBeforeLogout] = useState(false);
    const [showUnsyncedModal, setShowUnsyncedModal] = useState(false);
    const [unsyncedDetails, setUnsyncedDetails] = useState<{
        total: number;
        attempts: number;
        progress: number;
        queue: number;
    }>({
        total: 0,
        attempts: 0,
        progress: 0,
        queue: 0,
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const roleName = user?.role === 'platform_admin'
        ? 'Platform Admin'
        : user?.role === 'school_admin'
        ? 'School Admin'
        : user?.role === 'teacher'
        ? 'Teacher'
        : 'Learner';

    const initials = user?.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'U';

    const handleLogoutInitiation = async () => {
        setIsOpen(false);

        try {
            const counts = await getUnsyncedTotalCount();
            if (counts.total === 0) {
                // Completely safe to log out immediately
                setIsLoggingOut(true);
                await purgeUserCacheOnLogout();
                router.post('/logout');
                return;
            }

            // Unsynced data exists!
            setUnsyncedDetails(counts);

            if (navigator.onLine) {
                // Online: Auto-sync before completing logout
                setIsSyncingBeforeLogout(true);
                try {
                    await syncAll();
                    const remaining = await getUnsyncedTotalCount();
                    if (remaining.total === 0) {
                        setIsSyncingBeforeLogout(false);
                        setIsLoggingOut(true);
                        await purgeUserCacheOnLogout();
                        router.post('/logout');
                        return;
                    }
                    // Some items failed to sync
                    setUnsyncedDetails(remaining);
                    setIsSyncingBeforeLogout(false);
                    setShowUnsyncedModal(true);
                } catch {
                    setIsSyncingBeforeLogout(false);
                    setShowUnsyncedModal(true);
                }
            } else {
                // Device is offline and has unsynced data: Prompt user with warning modal
                setShowUnsyncedModal(true);
            }
        } catch {
            await purgeUserCacheOnLogout();
            router.post('/logout');
        }
    };

    const handleForceLogout = async () => {
        setShowUnsyncedModal(false);
        setIsLoggingOut(true);
        await purgeUserCacheOnLogout();
        router.post('/logout');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Top Bar Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 shadow-xs cursor-pointer"
                aria-label="User profile menu"
                aria-expanded={isOpen}
            >
                <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {initials}
                    </div>
                    {/* Online status indicator dot on profile avatar */}
                    <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--color-surface)] transition-all ${
                            isOnline
                                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                                : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                        }`}
                        title={isOnline ? (pendingSync > 0 ? `Online (${pendingSync} pending sync)` : 'Online • Synced') : 'Offline Mode'}
                    />
                </div>
                <div className="hidden lg:flex flex-col text-left mr-0.5">
                    <span className="text-xs font-bold text-[var(--color-text)] truncate max-w-[110px]">
                        {user?.name || 'User'}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] font-semibold leading-tight">
                        {roleName}
                    </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Dropdown Modal */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fade-in divide-y divide-[var(--color-border)]/60">
                    {/* User Info Header */}
                    <div className="p-4 bg-[var(--color-primary-5)]">
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
                                    {initials}
                                </div>
                                <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[var(--color-surface)] ${
                                        isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-[var(--color-text)] truncate">
                                    {user?.name || 'User'}
                                </h3>
                                <p className="text-xs text-[var(--color-muted)] truncate">
                                    {user?.email || 'user@acedrill.local'}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/25">
                                        <Shield className="w-2.5 h-2.5" />
                                        {roleName}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Network / Sync Status Row */}
                        <div className="mt-3 pt-2.5 border-t border-[var(--color-border)]/50 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                <span className="text-[11px] font-bold text-[var(--color-text)]">
                                    {isOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            {pendingSync > 0 ? (
                                <button
                                    type="button"
                                    onClick={triggerSync}
                                    disabled={!isOnline || isSyncing}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-[10px] font-bold hover:bg-[var(--color-accent)]/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSyncing ? 'Syncing...' : `${pendingSync} pending sync`}
                                </button>
                            ) : isOnline ? (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    ✓ All Synced
                                </span>
                            ) : (
                                <span className="text-[10px] font-semibold text-[var(--color-muted)]">
                                    Saved on Device
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="p-2 space-y-1">
                        {/* Theme Toggle Button in Dropdown */}
                        <button
                            type="button"
                            onClick={() => {
                                toggleTheme();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5">
                                {isDark ? (
                                    <Sun className="w-4 h-4 text-amber-500" />
                                ) : (
                                    <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                )}
                                <span>Theme Appearance</span>
                            </div>
                            <span className="text-[11px] text-[var(--color-muted)] font-medium">
                                {isDark ? 'Dark Mode' : 'Light Mode'}
                            </span>
                        </button>

                        <Link
                            href="/dashboard"
                            onClick={() => setIsOpen(false)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                            <Sparkles className="w-4 h-4 text-[var(--color-primary-light)]" />
                            <span>Dashboard Home</span>
                        </Link>
                    </div>

                    {/* Logout Footer with Pre-Logout Guard */}
                    <div className="p-2">
                        <button
                            type="button"
                            onClick={handleLogoutInitiation}
                            disabled={isLoggingOut || isSyncingBeforeLogout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer text-left disabled:opacity-50"
                        >
                            {isLoggingOut || isSyncingBeforeLogout ? (
                                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-error)]" />
                            ) : (
                                <LogOut className="w-4 h-4 text-[var(--color-error)]" />
                            )}
                            <span>{isSyncingBeforeLogout ? 'Syncing...' : isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Syncing Before Logout Fullscreen Spinner Overlay */}
            {isSyncingBeforeLogout && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] flex items-center justify-center mx-auto mb-4">
                            <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                        </div>
                        <h3 className="text-base font-bold text-[var(--color-text)] mb-1">
                            Saving Your Offline Work
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
                            Uploading {unsyncedDetails.total} pending record{unsyncedDetails.total === 1 ? '' : 's'} to the school cloud before signing out...
                        </p>
                        <div className="w-full bg-[var(--color-background)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[var(--color-primary)] h-full w-2/3 animate-pulse rounded-full" />
                        </div>
                    </div>
                </div>
            )}

            {/* Unsynced Offline Warning Modal */}
            {showUnsyncedModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
                        <div className="flex items-center gap-3.5 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-[var(--color-text)]">
                                    Unsynced Offline Data Detected
                                </h3>
                                <p className="text-xs text-[var(--color-muted)]">
                                    Action required before signing out
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] mb-5 space-y-2.5">
                            <p className="text-xs font-semibold text-[var(--color-text)]">
                                You have <span className="text-amber-500 font-bold">{unsyncedDetails.total} unsynced item{unsyncedDetails.total === 1 ? '' : 's'}</span> saved on this device:
                            </p>
                            <ul className="text-xs text-[var(--color-muted)] list-disc list-inside space-y-1">
                                {unsyncedDetails.attempts > 0 && (
                                    <li><strong className="text-[var(--color-text)]">{unsyncedDetails.attempts}</strong> completed quiz attempt{unsyncedDetails.attempts === 1 ? '' : 's'} &amp; scores</li>
                                )}
                                {unsyncedDetails.progress > 0 && (
                                    <li><strong className="text-[var(--color-text)]">{unsyncedDetails.progress}</strong> topic mastery score{unsyncedDetails.progress === 1 ? '' : 's'}</li>
                                )}
                                {unsyncedDetails.queue > 0 && (
                                    <li><strong className="text-[var(--color-text)]">{unsyncedDetails.queue}</strong> curriculum or admin change{unsyncedDetails.queue === 1 ? '' : 's'}</li>
                                )}
                            </ul>
                            <p className="text-[11px] text-[var(--color-muted)] pt-2 border-t border-[var(--color-border)]/50 leading-relaxed">
                                ⚠️ If you sign out while offline on a shared computer, your local test answers cannot be verified by the school system and may be lost.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowUnsyncedModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                                Stay Signed In (Keep Data)
                            </button>
                            <button
                                type="button"
                                onClick={handleForceLogout}
                                className="px-4 py-2.5 rounded-xl bg-transparent hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
                            >
                                Discard &amp; Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
