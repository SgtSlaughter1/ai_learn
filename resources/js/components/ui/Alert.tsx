import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
    children: ReactNode;
    variant?: 'info' | 'success' | 'warning' | 'error';
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function Alert({
    children,
    variant = 'info',
    icon,
    action,
    className = '',
}: AlertProps) {
    const variantStyles = {
        info: 'bg-[var(--color-primary)]/10 text-[var(--color-text)] border-[var(--color-primary)]/20',
        success: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        error: 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20',
    };

    const defaultIcons = {
        info: <Info className="w-5 h-5 shrink-0 text-[var(--color-primary)]" />,
        success: <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-success)]" />,
        warning: <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />,
        error: <AlertCircle className="w-5 h-5 shrink-0 text-[var(--color-error)]" />,
    };

    return (
        <div
            className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 ${variantStyles[variant]} ${className}`}
        >
            <div className="flex items-center space-x-3">
                {icon || defaultIcons[variant]}
                <div>{children}</div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
