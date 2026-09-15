import React from 'react';
import type { ClassItem, SchoolItem } from '@/types/admin';

export interface ClassFormData {
    school_id: string;
    program_id?: string;
    name: string;
    grade_level: string;
    arm?: string;
    section?: string;
    description: string;
}

interface ClassFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingClass: ClassItem | null;
    form: ClassFormData;
    setForm: React.Dispatch<React.SetStateAction<ClassFormData>>;
    schools: SchoolItem[];
    onSubmit: (e: React.FormEvent) => void;
}

export default function ClassFormModal({
    isOpen,
    onClose,
    editingClass,
    form,
    setForm,
    schools,
    onSubmit,
}: ClassFormModalProps) {
    if (!isOpen) return null;

    const selectedSchool = schools.find((s) => String(s.id) === String(form.school_id)) || schools[0];
    const category = selectedSchool?.category || 'combined';

    const showEarly = category === 'combined' || category === 'primary';
    const showPrimary = category === 'combined' || category === 'primary';
    const showJunior = category === 'combined' || category === 'junior';
    const showSenior = category === 'combined' || category === 'senior';

    const isSeniorSecondary = ['SS1', 'SS2', 'SS3'].includes(form.grade_level);

    const handleSchoolChange = (newSchoolId: string) => {
        const target = schools.find((s) => String(s.id) === newSchoolId);
        const cat = target?.category || 'combined';
        let defaultGrade = form.grade_level;

        if (cat === 'senior' && !['SS1', 'SS2', 'SS3'].includes(form.grade_level)) {
            defaultGrade = 'SS1';
        } else if (cat === 'junior' && !['JSS1', 'JSS2', 'JSS3'].includes(form.grade_level)) {
            defaultGrade = 'JSS1';
        } else if (cat === 'primary' && ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'].includes(form.grade_level)) {
            defaultGrade = 'PRI1';
        }

        setForm({ ...form, school_id: newSchoolId, grade_level: defaultGrade });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text)]">
                        {editingClass ? 'Edit Class Cohort' : 'Create New Class Cohort'}
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
                        <label className="block font-bold text-[var(--color-text)] mb-1">Class Name *</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            placeholder="e.g. SS1 Science Alpha, Primary 1 Diamond"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Grade Level *</label>
                            <select
                                value={form.grade_level}
                                onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                            >
                                {showEarly && (
                                    <optgroup label="Early Childhood">
                                        <option value="CRECHE">Creche</option>
                                        <option value="KG1">KG 1</option>
                                        <option value="KG2">KG 2</option>
                                        <option value="NUR1">Nursery 1</option>
                                        <option value="NUR2">Nursery 2</option>
                                    </optgroup>
                                )}
                                {showPrimary && (
                                    <optgroup label="Primary School">
                                        <option value="PRI1">Primary 1</option>
                                        <option value="PRI2">Primary 2</option>
                                        <option value="PRI3">Primary 3</option>
                                        <option value="PRI4">Primary 4</option>
                                        <option value="PRI5">Primary 5</option>
                                        <option value="PRI6">Primary 6</option>
                                    </optgroup>
                                )}
                                {showJunior && (
                                    <optgroup label="Junior Secondary">
                                        <option value="JSS1">JSS 1</option>
                                        <option value="JSS2">JSS 2</option>
                                        <option value="JSS3">JSS 3</option>
                                    </optgroup>
                                )}
                                {showSenior && (
                                    <optgroup label="Senior Secondary">
                                        <option value="SS1">SS 1</option>
                                        <option value="SS2">SS 2</option>
                                        <option value="SS3">SS 3</option>
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Arm / Section</label>
                            <input
                                type="text"
                                value={form.arm || form.section || ''}
                                onChange={(e) => setForm({ ...form, arm: e.target.value, section: e.target.value })}
                                className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                placeholder="e.g. Alpha, Blue, Sunshine"
                            />
                        </div>
                    </div>

                    {isSeniorSecondary && (
                        <div>
                            <label className="block font-bold text-[var(--color-text)] mb-1">Academic Track / Program</label>
                            <select
                                value={form.program_id || ''}
                                onChange={(e) => setForm({ ...form, program_id: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                            >
                                <option value="">Select Academic Track (Optional)</option>
                                <option value="1">Science</option>
                                <option value="2">Humanities / Arts</option>
                                <option value="3">Business / Commercial</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">School *</label>
                        <select
                            required
                            value={form.school_id}
                            onChange={(e) => handleSchoolChange(e.target.value)}
                            className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                        >
                            {schools.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-bold text-[var(--color-text)] mb-1">Description</label>
                        <textarea
                            rows={2}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                            placeholder="Optional description of this cohort..."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer active:scale-[0.98] transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer active:scale-[0.98] transition-all duration-200"
                        >
                            {editingClass ? 'Update Class' : 'Create Class'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
