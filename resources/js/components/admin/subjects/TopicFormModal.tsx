import React from 'react';
import type { TopicItem } from '@/types/admin';

export interface TopicFormData {
    name: string;
    slug: string;
    level: string;
    description: string;
    status: string;
    sort_order: number;
}

interface TopicFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingTopic: TopicItem | null;
    form: TopicFormData;
    setForm: React.Dispatch<React.SetStateAction<TopicFormData>>;
    onSubmit: (e: React.FormEvent) => void;
}

export default function TopicFormModal({
    isOpen,
    onClose,
    editingTopic,
    form,
    setForm,
    onSubmit,
}: TopicFormModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                    <h4 className="text-base font-bold text-[var(--color-text)]">
                        {editingTopic ? 'Edit Topic' : 'Add Topic'}
                    </h4>
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
                        <label className="block font-bold text-[var(--color-text)] mb-1">Topic Title *</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            placeholder="e.g. Quadratic Equations, Photosynthesis"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Grade Level *</label>
                            <select
                                value={form.level}
                                onChange={(e) => setForm({ ...form, level: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="JSS1">JSS1</option>
                                <option value="JSS2">JSS2</option>
                                <option value="JSS3">JSS3</option>
                                <option value="SS1">SS1</option>
                                <option value="SS2">SS2</option>
                                <option value="SS3">SS3</option>
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

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Description / Key Objectives</label>
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                            placeholder="Explain key objectives of this lesson..."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                            Save Topic
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
