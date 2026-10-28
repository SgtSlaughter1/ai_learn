import { useState } from 'react';

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'];

/** The basic calculator CBT centres allow, floating over the exam screen. */
export function CbtCalculator({ onClose, className = 'absolute top-4 right-4 md:right-84' }: { onClose: () => void; className?: string }) {
    const [display, setDisplay] = useState('0');

    const press = (key: string) => {
        if (key === 'C') {
            setDisplay('0');
        } else if (key === '=') {
            try {
                const sanitized = display.replace(/[^0-9+\-*/.]/g, '');
                const result = Function(`'use strict'; return (${sanitized})`)();
                setDisplay(String(result));
            } catch {
                setDisplay('Error');
            }
        } else {
            setDisplay((prev) => (prev === '0' || prev === 'Error' ? key : prev + key));
        }
    };

    return (
        <div className={`${className} z-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 shadow-2xl w-64 animate-scale-in`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border)]">
                <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">CBT Calculator</span>
                <button type="button" onClick={onClose} aria-label="Close calculator" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer">
                    ✕
                </button>
            </div>
            <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-2.5 text-right font-mono text-xl font-bold truncate mb-3 text-[var(--color-text)]">
                {display}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
                {KEYS.map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => press(key)}
                        className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            key === 'C'
                                ? 'col-span-4 bg-[var(--color-error)] text-white mt-1 hover:opacity-90'
                                : key === '='
                                ? 'bg-[var(--color-success)] text-white hover:opacity-90'
                                : 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/60 text-[var(--color-text)]'
                        }`}
                    >
                        {key}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default CbtCalculator;
