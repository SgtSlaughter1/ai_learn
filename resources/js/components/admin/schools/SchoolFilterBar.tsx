interface SchoolFilterBarProps {
    search: string;
    setSearch: (v: string) => void;
    categoryFilter: string;
    setCategoryFilter: (v: string) => void;
    cityFilter: string;
    setCityFilter: (v: string) => void;
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    cities: string[];
    onOpenRegisterModal: () => void;
}

export default function SchoolFilterBar({
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    cityFilter,
    setCityFilter,
    statusFilter,
    setStatusFilter,
    cities,
    onOpenRegisterModal,
}: SchoolFilterBarProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
            <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative flex-1 min-w-[220px]">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by school name, city, school admin..."
                        className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                    />
                    <span className="absolute left-3.5 top-2.5 text-[var(--color-muted)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                </div>

                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                >
                    <option value="">All Categories</option>
                    <option value="senior">Senior Secondary</option>
                    <option value="junior">Junior Secondary</option>
                    <option value="primary">Primary School</option>
                    <option value="combined">Combined</option>
                </select>

                {cities.length > 0 && (
                    <select
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                    >
                        <option value="">All Cities</option>
                        {cities.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                )}

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
            </div>

            <button
                type="button"
                onClick={onOpenRegisterModal}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Register New School</span>
            </button>
        </div>
    );
}
