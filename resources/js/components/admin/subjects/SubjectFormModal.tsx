import React, { useState, useEffect, useMemo } from 'react';
import type { ClassItem, SubjectItem } from '@/types/admin';
import { formatClassOptionLabel, ALL_GRADE_GROUPS, getGradeLevelsForSchool, getGradeLevelsForTeacher } from '@/utils/format';

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
    isSubmitting?: boolean;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
}

export default function SubjectFormModal({
    isOpen,
    onClose,
    editingSubject,
    form,
    setForm,
    classes,
    onSubmit,
    isSubmitting = false,
    school,
    allowedGradeLevels,
    isTeacher,
}: SubjectFormModalProps) {
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('');

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

    // Sync initial grade level when editing
    useEffect(() => {
        if (form.class_id) {
            const matched = classes.find((c) => String(c.id) === String(form.class_id));
            if (matched?.grade_level) {
                setSelectedGradeLevel(matched.grade_level);
            }
        } else {
            setSelectedGradeLevel('');
        }
    }, [form.class_id, classes, isOpen]);

    if (!isOpen) return null;

    const filteredClasses = classes.filter(
        (c) => !selectedGradeLevel || c.grade_level === selectedGradeLevel
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-5 sm:space-y-6 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)]">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Grade Level (Optional)</label>
                            <select
                                value={selectedGradeLevel}
                                onChange={(e) => {
                                    const newGrade = e.target.value;
                                    setSelectedGradeLevel(newGrade);
                                    const currentCls = classes.find((c) => String(c.id) === String(form.class_id));
                                    if (currentCls && currentCls.grade_level !== newGrade) {
                                        setForm((f) => ({ ...f, class_id: '' }));
                                    }
                                }}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="">All Grade Levels</option>
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
                            <label className="block font-bold text-[var(--color-text)] mb-1">Target Class (Optional)</label>
                            <select
                                value={form.class_id}
                                onChange={(e) => {
                                    const cId = e.target.value;
                                    const matched = classes.find((c) => String(c.id) === cId);
                                    if (matched?.grade_level) {
                                        setSelectedGradeLevel(matched.grade_level);
                                    }
                                    setForm((f) => ({ ...f, class_id: cId ? Number(cId) : '' }));
                                }}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                            >
                                <option value="">All Classes / School-wide</option>
                                {filteredClasses.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {formatClassOptionLabel(cls)}
                                    </option>
                                ))}
                            </select>
                        </div>
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

                    <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50 cursor-pointer text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto justify-center px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{editingSubject ? 'Updating Subject...' : 'Saving Subject...'}</span>
                                </>
                            ) : (
                                <span>{editingSubject ? 'Update Subject' : 'Save Subject'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
