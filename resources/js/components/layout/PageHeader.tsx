import type { LucideIcon } from 'lucide-react';

interface Props {
    icon: LucideIcon;
    title: string;
    subtitle?: string | null;
}

/** The title shown in the top bar of every signed-in page: icon tile, title, one-line description. */
export default function PageHeader({ icon: Icon, title, subtitle }: Props) {
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 lg:w-11 lg:h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-5)] text-[var(--color-primary)] flex items-center justify-center">
                <Icon className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
                <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight text-[var(--color-text)] truncate">{title}</h1>
                {subtitle && <p className="text-xs lg:text-sm text-[var(--color-muted)] truncate">{subtitle}</p>}
            </div>
        </div>
    );
}
