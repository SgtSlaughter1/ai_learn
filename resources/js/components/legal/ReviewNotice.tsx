import { Info } from 'lucide-react';

/** Says plainly that the Terms and Privacy Policy are still being reviewed and may change. */
export default function ReviewNotice({ className = '' }: { className?: string }) {
    return (
        <div role="note" className={`flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm ${className}`}>
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <p className="leading-relaxed text-[var(--color-text)]">
                <strong className="font-bold">Draft under legal review.</strong> These terms describe how AceDrill works today, but the wording may change after review. If it
                changes in a way that matters, we will tell you and ask you to agree again.
            </p>
        </div>
    );
}
