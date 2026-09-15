import React from 'react';
import type { SchoolItem } from '@/types/admin';

export interface SchoolFormData {
    name: string;
    category: string;
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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
                <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-background)]">
                    <h3 className="font-bold text-lg text-[var(--color-text)] flex items-center gap-2">
                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                                placeholder="e.g. AILEARN Academy"
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
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] font-semibold text-[var(--color-text)] transition-colors"
                            >
                                <option value="senior">Senior Secondary (SS1 - SS3)</option>
                                <option value="junior">Junior Secondary (JSS1 - JSS3)</option>
                                <option value="primary">Primary School (Primary 1 - 6)</option>
                                <option value="combined">Combined</option>
                            </select>
                        </div>
                    </div>

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

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : editingSchool ? 'Update School' : 'Create School'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
