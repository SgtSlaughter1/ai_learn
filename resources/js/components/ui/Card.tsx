import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

export function Card({
    children,
    className = '',
    onClick,
    hoverable = false,
}: CardProps) {
    const hoverClasses = hoverable
        ? 'hover:border-[var(--color-primary)] transition-all cursor-pointer'
        : '';

    return (
        <div
            onClick={onClick}
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm ${hoverClasses} ${className}`}
        >
            {children}
        </div>
    );
}
