interface ProgressBarProps {
    percent: number;
    height?: string;
    barColor?: string;
    showLabel?: boolean;
    label?: string;
    className?: string;
}

export function ProgressBar({
    percent,
    height = 'h-2.5',
    barColor = 'bg-[var(--color-primary)]',
    showLabel = false,
    label = 'Progress',
    className = '',
}: ProgressBarProps) {
    const clampedPercent = Math.min(100, Math.max(0, percent));

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className={`w-full bg-[var(--color-surface)] border border-[var(--color-border)] ${height} rounded-full overflow-hidden`}>
                <div
                    className={`${barColor} h-full transition-all duration-300 rounded-full`}
                    style={{ width: `${clampedPercent}%` }}
                />
            </div>
            {showLabel && (
                <div className="flex justify-between text-xs text-[var(--color-muted)] font-bold">
                    <span>{label}</span>
                    <span>{Math.round(clampedPercent)}%</span>
                </div>
            )}
        </div>
    );
}
