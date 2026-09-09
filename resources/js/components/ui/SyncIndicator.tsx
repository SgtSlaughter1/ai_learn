import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function SyncIndicator({ className = '' }: { className?: string }) {
    const { isOnline, pendingSync, isSyncing, triggerSync } = useNetworkStatus();

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Online/Offline dot */}
            <div className="flex items-center gap-1.5">
                <div
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                        isOnline
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                            : 'bg-rose-400 shadow-sm shadow-rose-400/50'
                    }`}
                />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-inherit opacity-90">
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            </div>

            {/* Pending sync badge */}
            {pendingSync > 0 && (
                <button
                    onClick={triggerSync}
                    disabled={!isOnline || isSyncing}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 transition-all disabled:opacity-50 cursor-pointer"
                    title={`${pendingSync} items waiting to sync`}
                >
                    {isSyncing ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    <span className="text-[10px] font-bold">
                        {pendingSync} pending
                    </span>
                </button>
            )}

            {/* All synced checkmark */}
            {pendingSync === 0 && isOnline && !isSyncing && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] font-extrabold">Synced</span>
                </div>
            )}
        </div>
    );
}
