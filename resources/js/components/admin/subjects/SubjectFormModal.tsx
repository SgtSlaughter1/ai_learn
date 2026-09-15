import React from 'react';
import type { ClassItem, SubjectItem } from '@/types/admin';

export interface SubjectFormData {
    name: string;
    slug: string;
    description: string;
    class_id: string | number;
    status: string;
    sort_order: number;
}

interface SubjectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingSubject: SubjectItem | null;
    form: SubjectFormData;
    setForm: React.Dispatch<React.SetStateAction<SubjectFormData>>;
    classes: ClassItem[];
    onSubmit: (e: React.FormEvent) => void;
}

export default function SubjectFormModal({
    isOpen,
    onClose,
    editingSubject,
    form,
    setForm,
    classes,
    onSubmit,
}: SubjectFormModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text)]">
                        {editingSubject ? 'Edit Subject' : 'Add Subject'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4 text-xs">
                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Subject Name *</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            placeholder="e.g. Mathematics, Physics, Chemistry"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Target Class (Optional)</label>
                        <select
                            value={form.class_id}
                            onChange={(e) =>
                                setForm({ ...form, class_id: e.target.value ? Number(e.target.value) : '' })
                            }
                            className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                        >
                            <option value="">All Classes / School-wide</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name} ({cls.grade_level})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-[var(--color-muted)] mt-1">
                            Assign specifically to a class cohort or leave open for the entire school.
                        </p>
                    </div>

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Description</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                            placeholder="Describe key topics and curriculum coverage..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Sort Order</label>
                            <input
                                type="number"
                                value={form.sort_order}
                                onChange={(e) =>
                                    setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })
                                }
                                className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                            {editingSubject ? 'Update Subject' : 'Save Subject'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
