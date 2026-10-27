import React, { useMemo } from 'react';
import type { TopicItem, ClassItem } from '@/types/admin';
import { ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';
import { useDismiss } from '@/hooks/useDismiss';

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
    isSubmitting?: boolean;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
    classes?: ClassItem[];
}

export default function TopicFormModal({
    isOpen,
    onClose,
    editingTopic,
    form,
    setForm,
    onSubmit,
    isSubmitting = false,
    school,
    allowedGradeLevels,
    isTeacher,
    classes = [],
}: TopicFormModalProps) {
    const availableGradeGroups = useMemo(() => {
        if (allowedGradeLevels && allowedGradeLevels.length > 0) {
            const allowedSet = new Set(allowedGradeLevels.map((g) => g.toUpperCase()));
            return ALL_GRADE_GROUPS.map((grp) => ({
                ...grp,
                options: grp.options.filter((opt) => allowedSet.has(opt.value.toUpperCase())),
            })).filter((grp) => grp.options.length > 0);
        }
        if (isTeacher) {
            return getGradeLevelsForTeacher(classes, school);
        }
        if (school) {
            return getGradeLevelsForSchool(school);
        }
        if (classes && classes.length > 0) {
            return getGradeLevelsForTeacher(classes, school);
        }
        return ALL_GRADE_GROUPS;
    }, [allowedGradeLevels, isTeacher, school, classes]);

    const { backdrop, panel } = useDismiss(isOpen, onClose);

    if (!isOpen) return null;

    return (
        <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div {...panel} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Grade Level *</label>
                            <select
                                value={form.level}
                                onChange={(e) => setForm({ ...form, level: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                {availableGradeGroups.map((grp) => (
                                    <optgroup key={grp.group} label={grp.group}>
                                        {grp.options.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
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

                    <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50 cursor-pointer text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto justify-center px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{editingTopic ? 'Updating Topic...' : 'Saving Topic...'}</span>
                                </>
                            ) : (
                                <span>{editingTopic ? 'Update Topic' : 'Save Topic'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
