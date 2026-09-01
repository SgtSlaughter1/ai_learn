interface LevelFilterTabsProps {
    levels: string[];
    selectedLevel: string;
    onSelectLevel: (level: string) => void;
}

export function LevelFilterTabs({
    levels,
    selectedLevel,
    onSelectLevel,
}: LevelFilterTabsProps) {
    if (levels.length <= 2) return null;

    return (
        <div className="flex space-x-1.5 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl max-w-md animate-fade-in">
            {levels.map((lvl) => (
                <button
                    key={lvl}
                    type="button"
                    onClick={() => onSelectLevel(lvl)}
                    className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all focus:outline-none min-h-[40px] cursor-pointer ${
                        selectedLevel === lvl
                            ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/10'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)]/40'
                    }`}
                >
                    {lvl === 'all' ? 'All Levels' : lvl}
                </button>
            ))}
        </div>
    );
}
