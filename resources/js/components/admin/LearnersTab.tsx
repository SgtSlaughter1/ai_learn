import { useState } from 'react';
import type { Learner, SchoolItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';

interface Props {
    learners: Learner[];
    schools: SchoolItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function LearnersTab({ learners, schools, loading, onRefresh, showToast }: Props) {
    const [learnerSearch, setLearnerSearch] = useState('');
    const [learnerGradeFilter, setLearnerGradeFilter] = useState('');
    const [learnerSchoolFilter, setLearnerSchoolFilter] = useState('');
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
        const optimisticLearner: Learner = {
            id: tempId,
            name: learnerForm.name,
            email: learnerForm.email,
            learner_profile: {
                id: Date.now(),
                school_id: learnerForm.school_id ? Number(learnerForm.school_id) : null,
                student_id: learnerForm.student_id || null,
                grade_level: learnerForm.grade_level || 'SS1',
                is_active: true,
                school: selectedSchool ? { id: selectedSchool.id, name: selectedSchool.name } : undefined,
            },
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

    const filteredLearners = learners.filter((lrn) => {
        if (learnerSchoolFilter && String(lrn.learner_profile?.school_id) !== learnerSchoolFilter) return false;
        if (learnerGradeFilter && lrn.learner_profile?.grade_level !== learnerGradeFilter) return false;
        if (learnerSearch) {
            const q = learnerSearch.toLowerCase();
            const nameMatch = lrn.name.toLowerCase().includes(q);
            const emailMatch = lrn.email.toLowerCase().includes(q);
            const studentIdMatch = lrn.learner_profile?.student_id?.toLowerCase().includes(q);
            if (!nameMatch && !emailMatch && !studentIdMatch) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={learnerSearch}
                        onChange={(e) => setLearnerSearch(e.target.value)}
                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none w-64"
                    />
                    {schools.length > 1 && (
                        <select
                            value={learnerSchoolFilter}
                            onChange={(e) => setLearnerSchoolFilter(e.target.value)}
                            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)]"
                        >
                            <option value="">All Schools</option>
                            {schools.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={learnerGradeFilter}
                        onChange={(e) => setLearnerGradeFilter(e.target.value)}
                        className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)]"
                    >
                        <option value="">All Grade Levels</option>
                        <option value="JSS1">JSS1</option>
                        <option value="JSS2">JSS2</option>
                        <option value="JSS3">JSS3</option>
                        <option value="SS1">SS1</option>
                        <option value="SS2">SS2</option>
                        <option value="SS3">SS3</option>
                    </select>
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
                                <th className="py-3.5 px-4">Grade & ID</th>
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
                                            <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] font-bold">
                                                {learner.learner_profile?.grade_level || 'SS1'}
                                            </span>
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

                                        setLearnerForm({ ...learnerForm, school_id: newSchoolId, grade_level: defaultGrade });
                                    }}
                                    className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                >
                                    <option value="">Select School...</option>
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Grade Level *</label>
                                    <select
                                        value={learnerForm.grade_level}
                                        onChange={(e) => setLearnerForm({ ...learnerForm, grade_level: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                    >
                                        {(() => {
                                            const sel = schools.find((s) => String(s.id) === String(learnerForm.school_id)) || schools[0];
                                            const cat = sel?.category || 'combined';
                                            const showEarly = cat === 'combined' || cat === 'primary';
                                            const showPrimary = cat === 'combined' || cat === 'primary';
                                            const showJunior = cat === 'combined' || cat === 'junior';
                                            const showSenior = cat === 'combined' || cat === 'senior';

                                            return (
                                                <>
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
                                                </>
                                            );
                                        })()}
                                    </select>
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
