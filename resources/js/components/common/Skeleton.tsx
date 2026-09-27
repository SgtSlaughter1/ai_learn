import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rounded' | 'rectangular';
    width?: string | number;
    height?: string | number;
    animate?: 'pulse' | 'wave' | 'none';
    className?: string;
}

/**
 * Base Skeleton component with theme-aware styling and optional wave animation.
 */
export function Skeleton({
    variant = 'rounded',
    width,
    height,
    animate = 'pulse',
    className = '',
    style,
    ...props
}: SkeletonProps) {
    const variantStyles = {
        text: 'rounded-md h-4 w-full',
        circular: 'rounded-full shrink-0',
        rounded: 'rounded-xl',
        rectangular: 'rounded-none',
    }[variant];

    const animationStyle = {
        pulse: 'animate-pulse bg-[var(--color-primary-10)]/70 dark:bg-[var(--color-primary-5)]/60',
        wave: 'relative overflow-hidden bg-[var(--color-primary-10)]/60 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent',
        none: 'bg-[var(--color-primary-10)]/60',
    }[animate];

    const customStyles: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
    };

    return (
        <div
            aria-hidden="true"
            className={`${variantStyles} ${animationStyle} ${className}`}
            style={customStyles}
            {...props}
        />
    );
}

/**
 * Multi-line text skeleton with natural paragraph rhythm.
 */
export function SkeletonText({
    lines = 3,
    gap = 'gap-2.5',
    className = '',
}: {
    lines?: number;
    gap?: string;
    className?: string;
}) {
    return (
        <div className={`flex flex-col ${gap} ${className}`}>
            {Array.from({ length: lines }).map((_, idx) => {
                const widthClass =
                    idx === lines - 1 && lines > 1
                        ? 'w-3/5'
                        : idx % 2 === 1
                        ? 'w-5/6'
                        : 'w-full';
                return (
                    <Skeleton
                        key={idx}
                        variant="text"
                        className={`h-3.5 ${widthClass}`}
                    />
                );
            })}
        </div>
    );
}

/**
 * Circular Avatar skeleton.
 */
export function SkeletonAvatar({
    size = 'w-10 h-10',
    className = '',
}: {
    size?: string;
    className?: string;
}) {
    return <Skeleton variant="circular" className={`${size} ${className}`} />;
}

/**
 * Pill/Badge skeleton.
 */
export function SkeletonBadge({
    width = 'w-16',
    height = 'h-5',
    className = '',
}: {
    width?: string;
    height?: string;
    className?: string;
}) {
    return (
        <Skeleton
            variant="rounded"
            className={`${width} ${height} rounded-full ${className}`}
        />
    );
}

/**
 * Stat / KPI Card skeleton.
 */
export function SkeletonStatCard({
    className = '',
}: {
    className?: string;
}) {
    return (
        <div
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between ${className}`}
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <Skeleton variant="rounded" className="h-8 w-24 rounded-lg" />
                <Skeleton variant="rounded" className="w-9 h-9 rounded-xl shrink-0" />
            </div>
            <Skeleton variant="text" className="h-3.5 w-32 mt-1" />
        </div>
    );
}

/**
 * Grid of Stat KPI cards.
 */
export function SkeletonStatGrid({
    count = 4,
    cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    className = '',
}: {
    count?: number;
    cols?: string;
    className?: string;
}) {
    return (
        <div className={`grid ${cols} gap-4 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonStatCard key={i} />
            ))}
        </div>
    );
}

/**
 * Table skeleton with realistic rows mimicking avatar, badges, and action buttons.
 */
export function SkeletonTable({
    rows = 5,
    columns = 5,
    hasHeader = false,
    className = '',
}: {
    rows?: number;
    columns?: number;
    hasHeader?: boolean;
    className?: string;
}) {
    return (
        <div
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xs ${className}`}
        >
            {hasHeader && (
                <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-1/3">
                        <Skeleton variant="rounded" className="h-8 w-full max-w-xs rounded-xl" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton variant="rounded" className="h-8 w-24 rounded-xl" />
                        <Skeleton variant="rounded" className="h-8 w-28 rounded-xl" />
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {Array.from({ length: rows }).map((_, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[var(--color-primary-5)]/10 transition-colors">
                                {/* First Column: Avatar + Two Text Lines */}
                                <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                                        <div className="space-y-1.5 flex-1">
                                            <Skeleton variant="text" className="h-3.5 w-32" />
                                            <Skeleton variant="text" className="h-2.5 w-24" />
                                        </div>
                                    </div>
                                </td>

                                {/* Middle Columns: Variable Badges / Text */}
                                {Array.from({ length: Math.max(1, columns - 2) }).map((_, cIdx) => (
                                    <td key={cIdx} className="py-3.5 px-4">
                                        {cIdx % 2 === 0 ? (
                                            <Skeleton variant="rounded" className="h-6 w-20 rounded-lg" />
                                        ) : (
                                            <div className="space-y-1">
                                                <Skeleton variant="text" className="h-3 w-28" />
                                                <Skeleton variant="text" className="h-2 w-16" />
                                            </div>
                                        )}
                                    </td>
                                ))}

                                {/* Actions Column */}
                                <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Skeleton variant="rounded" className="w-7 h-7 rounded-lg" />
                                        <Skeleton variant="rounded" className="w-7 h-7 rounded-lg" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Standard content card skeleton (e.g., School card, Class card, Subject card).
 */
export function SkeletonCard({
    className = '',
}: {
    className?: string;
}) {
    return (
        <div
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                    <Skeleton variant="rounded" className="w-11 h-11 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                        <Skeleton variant="text" className="h-4 w-3/4" />
                        <Skeleton variant="text" className="h-3 w-1/2" />
                    </div>
                </div>
                <Skeleton variant="rounded" className="w-6 h-6 rounded-lg shrink-0" />
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]/50">
                <div className="flex justify-between items-center">
                    <Skeleton variant="text" className="h-3 w-16" />
                    <Skeleton variant="text" className="h-3 w-20" />
                </div>
                <Skeleton variant="rounded" className="h-2 w-full rounded-full" />
            </div>

            <div className="flex items-center justify-between pt-2">
                <Skeleton variant="rounded" className="h-5 w-20 rounded-full" />
                <Skeleton variant="rounded" className="h-8 w-24 rounded-xl" />
            </div>
        </div>
    );
}

/**
 * Grid of cards skeleton.
 */
export function SkeletonCardGrid({
    count = 6,
    cols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    className = '',
}: {
    count?: number;
    cols?: string;
    className?: string;
}) {
    return (
        <div className={`grid ${cols} gap-4 sm:gap-6 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

/**
 * Leaderboard ranking list skeleton.
 */
export function SkeletonLeaderboard({
    count = 3,
    className = '',
}: {
    count?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-3 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-primary-5)]/30 border border-[var(--color-border)]/30"
                >
                    <Skeleton variant="rounded" className="w-8 h-6 rounded-md shrink-0" />
                    <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                        <Skeleton variant="text" className="h-3.5 w-32" />
                        <Skeleton variant="text" className="h-2.5 w-24" />
                    </div>
                    <Skeleton variant="rounded" className="h-6 w-16 rounded-lg shrink-0" />
                </div>
            ))}
        </div>
    );
}

/**
 * Distribution progress bars skeleton.
 */
export function SkeletonDistribution({
    count = 4,
    className = '',
}: {
    count?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-3.5 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Skeleton variant="text" className="h-3 w-20" />
                        <Skeleton variant="text" className="h-3 w-12" />
                    </div>
                    <Skeleton variant="rounded" className="h-2 w-full rounded-full" />
                </div>
            ))}
        </div>
    );
}

export default Skeleton;
