import { BRAND_GOLD, HORIZONTAL, SYMBOL, SYMBOL_SMALL } from './brandArtwork';

/**
 * The AceDrill logo (brandguidelines.md): an A whose crossbar is a shaded gold answer oval,
 * with "AceDrill" in Lexend. Drawn inline, so it needs no download and works offline.
 *
 * Colour: the A and the name use --color-brand-mark (Ace Green in light mode, white in dark
 * mode); `tone="reversed"` makes them white for green or dark backgrounds. The oval is always gold.
 */
interface BrandLogoProps {
    /** `horizontal` = symbol + name (default); `symbol` = the mark alone. */
    variant?: 'horizontal' | 'symbol';
    tone?: 'auto' | 'reversed';
    /** Use the small-size drawing (for marks under 32 px tall). */
    small?: boolean;
    className?: string;
    /** Accessible name; pass '' when visible text next to it already names the brand. */
    title?: string;
}

export function BrandLogo({ variant = 'horizontal', tone = 'auto', small = false, className, title = 'AceDrill' }: BrandLogoProps) {
    const ink = tone === 'reversed' ? '#FFFFFF' : 'var(--color-brand-mark)';
    const symbol = small ? SYMBOL_SMALL : SYMBOL;
    const width = variant === 'symbol' ? 256 : HORIZONTAL.width;
    const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

    return (
        <svg viewBox={`0 0 ${width} 256`} className={className} {...label} focusable="false">
            <path fill={ink} d={symbol.a} />
            <path fill={BRAND_GOLD} d={symbol.oval} />
            {variant === 'horizontal' && <path fill={ink} transform={HORIZONTAL.wordmarkTransform} d={HORIZONTAL.wordmark} />}
        </svg>
    );
}

export default BrandLogo;
