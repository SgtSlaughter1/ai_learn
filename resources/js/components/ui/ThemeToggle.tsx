import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface ThemeToggleProps {
    className?: string;
    showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex items-center justify-center p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${className}`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            <div className="relative w-5 h-5 flex items-center justify-center">
                <Sun
                    className={`w-4 h-4 text-amber-500 absolute transition-all duration-300 transform ${
                        isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
                    }`}
                />
                <Moon
                    className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute transition-all duration-300 transform ${
                        isDark ? 'opacity-0 rotate-90 scale-50 pointer-events-none' : 'opacity-100 rotate-0 scale-100'
                    }`}
                />
            </div>
            {showLabel && (
                <span className="ml-2 text-xs font-semibold select-none">
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                </span>
            )}
        </button>
    );
}
