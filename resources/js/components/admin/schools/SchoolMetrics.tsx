interface SchoolMetricsProps {
    totalSchools: number;
    activeCount: number;
    assignedAdminCount: number;
}

export default function SchoolMetrics({
    totalSchools,
    activeCount,
    assignedAdminCount,
}: SchoolMetricsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Total Schools</p>
                <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{totalSchools}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">Platform registered campuses</p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Active Status</p>
                <p className="text-3xl font-extrabold text-[var(--color-success)] mt-1">{activeCount}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">Operational institutions</p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Assigned School Admins</p>
                <p className="text-3xl font-extrabold text-[var(--color-primary)] mt-1">{assignedAdminCount}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">Schools with designated admin</p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Needs School Admin</p>
                <p className="text-3xl font-extrabold text-[var(--color-accent)] mt-1">
                    {totalSchools - assignedAdminCount}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">Unassigned leadership</p>
            </div>
        </div>
    );
}
