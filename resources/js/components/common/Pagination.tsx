interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage?: number;
    onPageChange: (page: number) => void;
    className?: string;
    itemLabel?: string;
}

export default function Pagination({
    currentPage,
    totalItems,
    itemsPerPage = 50,
    onPageChange,
    className = '',
    itemLabel = 'records',
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const from = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
    const to = Math.min(safeCurrentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            let start = Math.max(2, safeCurrentPage - 1);
            let end = Math.min(totalPages - 1, safeCurrentPage + 1);

            if (safeCurrentPage <= 3) {
                start = 2;
                end = 4;
            } else if (safeCurrentPage >= totalPages - 2) {
                start = totalPages - 3;
                end = totalPages - 1;
            }

            if (start > 2) {
                pages.push('...');
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (end < totalPages - 1) {
                pages.push('...');
            }

            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-b-2xl text-xs select-none ${className}`}>
            {/* Entry Summary */}
            <div className="flex items-center gap-2 text-[var(--color-muted)] font-medium">
                <span>
                    Showing <strong className="font-bold text-[var(--color-text)]">{from}</strong> to{' '}
                    <strong className="font-bold text-[var(--color-text)]">{to}</strong> of{' '}
                    <strong className="font-bold text-[var(--color-text)]">{totalItems}</strong> {itemLabel}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary-light)] font-bold text-[10px] border border-[var(--color-primary-20)] tracking-wide">
                    {itemsPerPage} / page
                </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(safeCurrentPage - 1)}
                    disabled={safeCurrentPage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-primary-10)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)] disabled:opacity-35 disabled:pointer-events-none transition-all duration-150 text-[var(--color-text)] font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title="Previous Page"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Prev</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                        if (p === '...') {
                            return (
                                <span key={`dots-${idx}`} className="px-2 py-1 text-[var(--color-muted)] font-bold tracking-widest text-xs">
                                    &hellip;
                                </span>
                            );
                        }

                        const pageNum = Number(p);
                        const isActive = pageNum === safeCurrentPage;

                        return (
                            <button
                                key={pageNum}
                                type="button"
                                onClick={() => onPageChange(pageNum)}
                                className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
                                    isActive
                                        ? 'bg-[var(--color-primary)] text-white shadow-xs border border-[var(--color-primary-light)]/30 ring-2 ring-[var(--color-primary)]/20'
                                        : 'border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-primary-10)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)] text-[var(--color-text)]'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(safeCurrentPage + 1)}
                    disabled={safeCurrentPage >= totalPages}
                    className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-primary-10)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)] disabled:opacity-35 disabled:pointer-events-none transition-all duration-150 text-[var(--color-text)] font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title="Next Page"
                >
                    <span>Next</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
