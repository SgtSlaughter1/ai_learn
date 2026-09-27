import type { SchoolItem } from '@/types/admin';

interface SchoolDeleteModalProps {
    deletingSchool: SchoolItem | null;
    submitting: boolean;
    onClose: () => void;
    onConfirmDelete: () => void;
}

export default function SchoolDeleteModal({
    deletingSchool,
    submitting,
    onClose,
    onConfirmDelete,
}: SchoolDeleteModalProps) {
    if (!deletingSchool) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-error-10)] text-[var(--color-error)] flex items-center justify-center mx-auto border border-[var(--color-error-20)]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-[var(--color-text)]">Delete {deletingSchool.name}?</h3>
                    <p className="text-sm text-[var(--color-muted)] mt-1">
                        Are you sure you want to remove this school? This will unlink associated classes and members.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmDelete}
                        disabled={submitting}
                        className="px-5 py-2 text-sm font-semibold bg-[var(--color-error)] text-white hover:opacity-90 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting && (
                            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        <span>{submitting ? 'Deleting...' : 'Confirm Delete'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
