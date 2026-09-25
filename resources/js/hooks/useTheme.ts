import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme') as Theme | null;
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                return saved;
            }
        }
        return 'system';
    });

    const [isDark, setIsDark] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved === 'dark') return true;
            if (saved === 'light') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    const applyTheme = useCallback((targetTheme: Theme) => {
        if (typeof document === 'undefined') return;

        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveDark = targetTheme === 'dark' || (targetTheme === 'system' && prefersDark);

        setIsDark(effectiveDark);

        if (effectiveDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        if (typeof window !== 'undefined') {
            if (newTheme === 'system') {
                localStorage.removeItem('theme');
            } else {
                localStorage.setItem('theme', newTheme);
            }
            window.dispatchEvent(new Event('theme-change'));
        }
        applyTheme(newTheme);
    }, [applyTheme]);

    const toggleTheme = useCallback(() => {
        setTheme(isDark ? 'light' : 'dark');
    }, [isDark, setTheme]);

    useEffect(() => {
        applyTheme(theme);

        const handleStorageOrCustom = () => {
            const currentSaved = (localStorage.getItem('theme') as Theme | null) || 'system';
            setThemeState(currentSaved);
            applyTheme(currentSaved);
        };

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMediaChange = () => {
            const currentSaved = localStorage.getItem('theme') as Theme | null;
            if (!currentSaved || currentSaved === 'system') {
                applyTheme('system');
            }
        };

        window.addEventListener('storage', handleStorageOrCustom);
        window.addEventListener('theme-change', handleStorageOrCustom);
        mediaQuery.addEventListener('change', handleMediaChange);

        return () => {
            window.removeEventListener('storage', handleStorageOrCustom);
            window.removeEventListener('theme-change', handleStorageOrCustom);
            mediaQuery.removeEventListener('change', handleMediaChange);
        };
    }, [theme, applyTheme]);

    return {
        theme,
        isDark,
        setTheme,
        toggleTheme,
    };
}
