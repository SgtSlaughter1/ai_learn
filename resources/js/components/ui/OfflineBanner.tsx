import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
    message?: string;
    variant?: 'pill' | 'banner';
    className?: string;
}

export function OfflineBanner({
    message = 'Offline — showing cached data',
    variant = 'pill',
    className = '',
}: OfflineBannerProps) {
    if (variant === 'banner') {
        return (
            <div
                className={`bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl px-4 py-3 flex items-center gap-3 ${className}`}
            >
                <WifiOff className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
                <span className="text-sm font-semibold text-[var(--color-accent)]">{message}</span>
            </div>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2.5 py-1 rounded-full border border-[var(--color-accent)]/20 ${className}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <WifiOff className="w-3 h-3 text-[var(--color-accent)]" />
            {message}
        </span>
    );
}
