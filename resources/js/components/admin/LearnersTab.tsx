import { useState } from 'react';
import type { Learner, SchoolItem, ClassItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';
import { getGradeLevelsForSchool, formatClassOptionLabel } from '@/utils/format';

interface Props {
    learners: Learner[];
    schools: SchoolItem[];
    classes?: ClassItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function LearnersTab({ learners, schools, classes = [], loading, onRefresh, showToast }: Props) {
    const [learnerSearch, setLearnerSearch] = useState('');
    const [learnerGradeFilter, setLearnerGradeFilter] = useState('');
    const [learnerSchoolFilter, setLearnerSchoolFilter] = useState('');
    const [learnerClassFilter, setLearnerClassFilter] = useState('');
    const [isLearnerModalOpen, setIsLearnerModalOpen] = useState(false);
    const [editingLearner, setEditingLearner] = useState<Learner | null>(null);
    const [learnerForm, setLearnerForm] = useState({
        name: '',
        email: '',
        password: '',
        school_id: '',
        grade_level: 'SS1',
        student_id: '',
        class_id: '',
    });

    const handleSaveLearner = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = editingLearner ? `/api/v1/admin/learners/${editingLearner.id}` : '/api/v1/admin/learners';
        const method = editingLearner ? 'PUT' : 'POST';
        const tempId = editingLearner ? editingLearner.id : `temp_lrn_${Date.now()}`;

        const selectedSchool = schools.find((s) => String(s.id) === String(learnerForm.school_id));
        const selectedClass = classes.find((c) => String(c.id) === String(learnerForm.class_id));

        const optimisticLearner: Learner = {
            id: tempId,
            name: learnerForm.name,
            email: learnerForm.email,
            learner_profile: {
                id: Date.now(),
                school_id: learnerForm.school_id ? Number(learnerForm.school_id) : null,
                student_id: learnerForm.student_id || null,
                grade_level: learnerForm.grade_level || selectedClass?.grade_level || 'SS1',
                is_active: true,
                school: selectedSchool ? { id: selectedSchool.id, name: selectedSchool.name } : undefined,
            },
            classes: selectedClass ? [{ id: selectedClass.id, name: selectedClass.name }] : [],
            gamification: {
                total_xp: 0,
                level: 1,
                tier: 'Newcomer',
            },
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminLearners',
            action: editingLearner ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: learnerForm,
            optimisticRecord: optimisticLearner,
        });

        if (res.success) {
            showToast(res.message || 'Learner saved successfully', 'success');
            setIsLearnerModalOpen(false);
            setEditingLearner(null);
            setLearnerForm({ name: '', email: '', password: '', school_id: '', grade_level: 'SS1', student_id: '', class_id: '' });
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save learner', 'error');
        }
    };

    const handleDeleteLearner = async (learner: Learner) => {
        if (!confirm(`Are you sure you want to delete learner ${learner.name}?`)) return;
        const res = await executeAdminAction({
            table: 'adminLearners',
            action: 'delete',
            recordId: learner.id,
            endpoint: `/api/v1/admin/learners/${learner.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Learner deleted');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete learner', 'error');
        }
    };

    // Filter available classes for the filter dropdown based on school and/or grade
    const availableFilterClasses = classes.filter((c) => {
        if (learnerSchoolFilter && String(c.school_id) !== learnerSchoolFilter) return false;
        if (learnerGradeFilter && c.grade_level !== learnerGradeFilter) return false;
        return true;
    });

    const filteredLearners = learners.filter((lrn) => {
        if (learnerSchoolFilter && String(lrn.learner_profile?.school_id) !== learnerSchoolFilter) return false;
        if (learnerGradeFilter && lrn.learner_profile?.grade_level !== learnerGradeFilter) return false;
        if (learnerClassFilter && !lrn.classes?.some((c) => String(c.id) === learnerClassFilter)) return false;
        if (learnerSearch) {
            const q = learnerSearch.toLowerCase();
            const nameMatch = lrn.name.toLowerCase().includes(q);
            const emailMatch = lrn.email.toLowerCase().includes(q);
            const studentIdMatch = lrn.learner_profile?.student_id?.toLowerCase().includes(q);
            const classMatch = lrn.classes?.some((c) => c.name.toLowerCase().includes(q));
            if (!nameMatch && !emailMatch && !studentIdMatch && !classMatch) return false;
        }
        return true;
    });

    // Available classes in modal based on selected school and selected grade
    const modalAvailableClasses = classes.filter((c) => {
        if (learnerForm.school_id && String(c.school_id) !== String(learnerForm.school_id)) return false;
        if (learnerForm.grade_level && c.grade_level && c.grade_level !== learnerForm.grade_level) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by name, email, ID..."
                        value={learnerSearch}
                        onChange={(e) => setLearnerSearch(e.target.value)}
                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-56"
                    />
                    {schools.length > 1 && (
                        <select
                            value={learnerSchoolFilter}
                            onChange={(e) => {
                                setLearnerSchoolFilter(e.target.value);
                                setLearnerClassFilter('');
                            }}
                            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                        >
                            <option value="">All Schools</option>
                            {schools.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={learnerGradeFilter}
                        onChange={(e) => {
                            setLearnerGradeFilter(e.target.value);
                            setLearnerClassFilter('');
                        }}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                    >
                        <option value="">All Grade Levels</option>
                        {(() => {
                            const selectedFilterSchool = schools.find((s) => String(s.id) === learnerSchoolFilter) || (schools.length === 1 ? schools[0] : null);
                            const filterGradeGroups = getGradeLevelsForSchool(selectedFilterSchool?.category);
                            return filterGradeGroups.map((grp) => (
                                <optgroup key={grp.group} label={grp.group}>
                                    {grp.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ));
                        })()}
                    </select>
                    {availableFilterClasses.length > 0 && (
                        <select
                            value={learnerClassFilter}
                            onChange={(e) => setLearnerClassFilter(e.target.value)}
                            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
                        >
                            <option value="">All Classes</option>
                            {availableFilterClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {formatClassOptionLabel(cls)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <button
                    onClick={() => {
                        setEditingLearner(null);
                        setLearnerForm({
                            name: '',
                            email: '',
                            password: '',
                            school_id: schools[0]?.id ? String(schools[0].id) : '',
                            grade_level: 'SS1',
                            student_id: '',
                            class_id: '',
                        });
                        setIsLearnerModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Learner
                </button>
            </div>

            {/* Learners Table */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-5)]/20 text-[var(--color-muted)] uppercase tracking-wider font-bold">
                                <th className="py-3.5 px-4">Learner</th>
                                <th className="py-3.5 px-4">Grade & Class</th>
                                <th className="py-3.5 px-4">School</th>
                                <th className="py-3.5 px-4">XP & Level</th>
                                <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                [1, 2, 3, 4].map((n) => (
                                    <tr key={n}>
                                        <td colSpan={5} className="py-4 px-4">
                                            <div className="h-6 bg-[var(--color-primary-5)] rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredLearners.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[var(--color-muted)] text-sm">
                                        No learners found. Click "Add New Learner" to provision students.
                                    </td>
                                </tr>
                            ) : (
                                filteredLearners.map((learner) => (
                                    <tr key={learner.id} className="hover:bg-[var(--color-primary-5)]/20 transition-colors">
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-[var(--color-text)]">{learner.name}</p>
                                                {learner._pendingSync && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                        Pending Sync
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-[var(--color-muted)]">{learner.email}</p>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded-md bg-[var(--color-primary-5)] text-[var(--color-primary)] font-bold text-xs">
                                                    {learner.learner_profile?.grade_level || 'General'}
                                                </span>
                                                {learner.classes && learner.classes.length > 0 && (
                                                    learner.classes.map((c) => (
                                                        <span key={c.id} className="px-2 py-0.5 rounded-md bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs">
                                                            {c.name}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                            {learner.learner_profile?.student_id && (
                                                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">ID: {learner.learner_profile.student_id}</p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-[var(--color-muted)] font-medium">
                                            {learner.learner_profile?.school?.name || 'Primary School'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2 font-bold">
                                                <span className="text-[var(--color-accent)]">{learner.gamification?.total_xp.toLocaleString() || 0} XP</span>
                                                <span className="text-[10px] text-[var(--color-muted)]">Lvl {learner.gamification?.level || 1}</span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingLearner(learner);
                                                        setLearnerForm({
                                                            name: learner.name,
                                                            email: learner.email,
                                                            password: '',
                                                            school_id: learner.learner_profile?.school_id ? String(learner.learner_profile.school_id) : '',
                                                            grade_level: learner.learner_profile?.grade_level || 'SS1',
                                                            student_id: learner.learner_profile?.student_id || '',
                                                            class_id: learner.classes?.[0]?.id ? String(learner.classes[0].id) : '',
                                                        });
                                                        setIsLearnerModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLearner(learner)}
                                                    className="px-2.5 py-1 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Learner Create / Edit */}
            {isLearnerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">
                                {editingLearner ? 'Edit Learner Profile' : 'Enroll New Learner'}
                            </h3>
                            <button onClick={() => setIsLearnerModalOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveLearner} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={learnerForm.name}
                                    onChange={(e) => setLearnerForm({ ...learnerForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                    placeholder="e.g. John Doe"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Email Address *</label>
                                <input
                                    type="email"
                                    required
                                    value={learnerForm.email}
                                    onChange={(e) => setLearnerForm({ ...learnerForm, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                    placeholder="learner@example.com"
                                />
                            </div>

                            {!editingLearner && (
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Initial Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={learnerForm.password}
                                        onChange={(e) => setLearnerForm({ ...learnerForm, password: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">School *</label>
                                <select
                                    value={learnerForm.school_id}
                                    onChange={(e) => {
                                        const newSchoolId = e.target.value;
                                        const target = schools.find((s) => String(s.id) === newSchoolId);
                                        const cat = target?.category || 'combined';
                                        let defaultGrade = learnerForm.grade_level;

                                        if (cat === 'senior' && !['SS1', 'SS2', 'SS3'].includes(learnerForm.grade_level)) {
                                            defaultGrade = 'SS1';
                                        } else if (cat === 'junior' && !['JSS1', 'JSS2', 'JSS3'].includes(learnerForm.grade_level)) {
                                            defaultGrade = 'JSS1';
                                        } else if (cat === 'primary' && ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'].includes(learnerForm.grade_level)) {
                                            defaultGrade = 'PRI1';
                                        }

                                        setLearnerForm({ ...learnerForm, school_id: newSchoolId, grade_level: defaultGrade, class_id: '' });
                                    }}
                                    className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                >
                                    <option value="">Select School...</option>
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Grade Level *</label>
                                    <select
                                        value={learnerForm.grade_level}
                                        onChange={(e) => {
                                            const newGrade = e.target.value;
                                            const currentCls = classes.find((c) => String(c.id) === learnerForm.class_id);
                                            const classId = currentCls && currentCls.grade_level !== newGrade ? '' : learnerForm.class_id;
                                            setLearnerForm({ ...learnerForm, grade_level: newGrade, class_id: classId });
                                        }}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                    >
                                        {(() => {
                                            const sel = schools.find((s) => String(s.id) === String(learnerForm.school_id)) || schools[0];
                                            const groups = getGradeLevelsForSchool(sel?.category);
                                            return groups.map((grp) => (
                                                <optgroup key={grp.group} label={grp.group}>
                                                    {grp.options.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ));
                                        })()}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Assigned Class</label>
                                    <select
                                        value={learnerForm.class_id}
                                        onChange={(e) => {
                                            const selectedClsId = e.target.value;
                                            const matchedCls = classes.find((c) => String(c.id) === selectedClsId);
                                            setLearnerForm({
                                                ...learnerForm,
                                                class_id: selectedClsId,
                                                grade_level: matchedCls?.grade_level || learnerForm.grade_level,
                                            });
                                        }}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                    >
                                        <option value="">No Class (General)</option>
                                        {modalAvailableClasses.map((cls) => (
                                            <option key={cls.id} value={cls.id}>
                                                {formatClassOptionLabel(cls)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Student ID</label>
                                <input
                                    type="text"
                                    value={learnerForm.student_id}
                                    onChange={(e) => setLearnerForm({ ...learnerForm, student_id: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                    placeholder="e.g. STU-001"
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                                <button type="button" onClick={() => setIsLearnerModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]">
                                    {editingLearner ? 'Update Learner' : 'Add Learner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
