/** Shown next to an account or school that has been deactivated (it cannot sign in). */
export function InactiveBadge({ show }: { show?: boolean }) {
    if (!show) return null;
    return (
        <span
            title="Deactivated: cannot sign in until activated again"
            className="ml-1.5 inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 align-middle"
        >
            Inactive
        </span>
    );
}
