import React from 'react';
import type { SchoolItem } from '@/types/admin';
import { useDismiss } from '@/hooks/useDismiss';

export interface SchoolFormData {
    name: string;
    /** Which option the category select shows. Only category_ids is sent to the server. */
    category: string;
    category_ids: number[];
    slug: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    email: string;
    description: string;
    is_active: boolean;
}

interface SchoolFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingSchool: SchoolItem | null;
    form: SchoolFormData;
    setForm: React.Dispatch<React.SetStateAction<SchoolFormData>>;
    submitting: boolean;
    onSubmit: (e: React.FormEvent) => void;
}

export default function SchoolFormModal({
    isOpen,
    onClose,
    editingSchool,
    form,
    setForm,
    submitting,
    onSubmit,
}: SchoolFormModalProps) {
    const { backdrop, panel } = useDismiss(isOpen, onClose);

    if (!isOpen) return null;

    const isCombined = form.category === 'combined';

    const handleCategoryChange = (cat: string) => {
        let ids: number[] = form.category_ids || [];
        if (cat === 'primary') {
            ids = [1];
        } else if (cat === 'junior') {
            ids = [2];
        } else if (cat === 'senior') {
            ids = [3];
        } else if (cat === 'combined') {
            if (ids.length <= 1) {
                ids = [1, 2];
            }
        }
        setForm({ ...form, category: cat, category_ids: ids });
    };

    const toggleCategoryId = (id: number) => {
        let current = [...(form.category_ids || [])];
        if (current.includes(id)) {
            current = current.filter((c) => c !== id);
        } else {
            current.push(id);
        }
        current.sort((a, b) => a - b);

        let derivedCat = form.category;
        if (current.length === 1) {
            if (current[0] === 1) derivedCat = 'primary';
            else if (current[0] === 2) derivedCat = 'junior';
            else if (current[0] === 3) derivedCat = 'senior';
        } else if (current.length > 1) {
            derivedCat = 'combined';
        }

        setForm({ ...form, category_ids: current, category: derivedCat });
    };

    return (
        <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div {...panel} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-background)]">
                    <h3 className="font-bold text-base sm:text-lg text-[var(--color-text)] flex items-center gap-2">
                        <svg className="w-5 h-5 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.8}
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                        </svg>
                        <span>{editingSchool ? 'Edit School Details' : 'Register New School'}</span>
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                School Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. AceDrill Academy"
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                School Category *
                            </label>
                            <select
                                required
                                value={form.category || 'senior'}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] font-semibold text-[var(--color-text)] transition-colors"
                            >
                                <option value="senior">Senior Secondary Only (SS1 - SS3)</option>
                                <option value="junior">Junior Secondary Only (JSS1 - JSS3)</option>
                                <option value="primary">Primary School Only (Primary 1 - 6)</option>
                                <option value="combined">Combined / Multi-Category</option>
                            </select>
                        </div>
                    </div>

                    {isCombined && (
                        <div className="p-3.5 bg-[var(--color-background)] border border-[var(--color-primary)]/30 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                                    Select Active Categories * (Pick 2 or more)
                                </label>
                                <span className="text-[11px] text-[var(--color-muted)] font-medium">
                                    {(form.category_ids || []).length} selected
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 1, label: 'Primary School', sub: 'Creche - Pri 6' },
                                    { id: 2, label: 'Junior Secondary', sub: 'JSS 1 - 3' },
                                    { id: 3, label: 'Senior Secondary', sub: 'SS 1 - 3' },
                                ].map((cat) => {
                                    const isChecked = (form.category_ids || []).includes(cat.id);
                                    return (
                                        <label
                                            key={cat.id}
                                            onClick={() => toggleCategoryId(cat.id)}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                                                isChecked
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-xs'
                                                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-muted)] opacity-70'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // Handled by label onClick
                                                className="mt-0.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] pointer-events-none"
                                            />
                                            <div className="text-xs">
                                                <div className="font-bold text-[var(--color-text)] leading-tight">{cat.label}</div>
                                                <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{cat.sub}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            {(form.category_ids || []).length < 2 && (
                                <p className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>Please select at least 2 categories for a combined school.</span>
                                </p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                City
                            </label>
                            <input
                                type="text"
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                                placeholder="e.g. Lagos"
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                State / Region
                            </label>
                            <input
                                type="text"
                                value={form.state}
                                onChange={(e) => setForm({ ...form, state: e.target.value })}
                                placeholder="e.g. Lagos State"
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                            Physical Address
                        </label>
                        <input
                            type="text"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder="e.g. 12 Innovation Way"
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                Contact Email
                            </label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="admin@school.edu"
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+234 800 000 0000"
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                            Description / Mission
                        </label>
                        <textarea
                            rows={2}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Brief details about the institution..."
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="is_active_laravel"
                            checked={form.is_active}
                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                            className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                        />
                        <label htmlFor="is_active_laravel" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">
                            Active (Operational and accessible by staff)
                        </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full sm:w-auto justify-center px-5 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                        >
                            {submitting && (
                                <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            )}
                            <span>{submitting ? 'Saving School...' : editingSchool ? 'Update School' : 'Create School'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
