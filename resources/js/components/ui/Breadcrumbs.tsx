import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
    if (items.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-xs font-semibold ${className}`}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div key={index} className="flex items-center space-x-2">
                        {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />}
                        {isLast || !item.href ? (
                            <span className="text-[var(--color-text)] truncate max-w-[200px]">
                                {item.label}
                            </span>
                        ) : (
                            <Link
                                href={item.href}
                                className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors truncate max-w-[200px]"
                            >
                                {item.label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
