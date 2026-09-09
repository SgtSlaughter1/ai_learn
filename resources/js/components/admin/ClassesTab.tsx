import { useState } from 'react';
import { ClassItem, ClassLearner, SchoolItem } from '@/types/admin';
import { executeAdminAction, getAdminAuthHeaders } from '@/services/AdminOfflineService';

interface Props {
    classes: ClassItem[];
    schools: SchoolItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function ClassesTab({ classes, schools, loading, onRefresh, showToast }: Props) {
    const [classSchoolFilter, setClassSchoolFilter] = useState('');
    const [classGradeFilter, setClassGradeFilter] = useState('');
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [classForm, setClassForm] = useState({
        school_id: '',
        name: '',
        grade_level: 'SS1',
        section: '',
        description: '',
    });

    // Class Roster Modal
    const [selectedClassForRoster, setSelectedClassForRoster] = useState<ClassItem | null>(null);
    const [classLearners, setClassLearners] = useState<ClassLearner[]>([]);
    const [loadingClassLearners, setLoadingClassLearners] = useState(false);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [enrollLearnerEmail, setEnrollLearnerEmail] = useState('');
    const [enrollingLearner, setEnrollingLearner] = useState(false);

    const handleSaveClass = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = editingClass ? `/api/v1/admin/classes/${editingClass.id}` : '/api/v1/admin/classes';
        const method = editingClass ? 'PUT' : 'POST';
        const tempId = editingClass ? String(editingClass.id) : `temp_cls_${Date.now()}`;

        const selectedSchool = schools.find((s) => String(s.id) === String(classForm.school_id));
        const optimisticClass: ClassItem = {
            id: editingClass ? editingClass.id : Date.now(),
            school_id: Number(classForm.school_id),
            name: classForm.name,
            slug: classForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            grade_level: classForm.grade_level,
            section: classForm.section || null,
            description: classForm.description || null,
            is_active: true,
            learner_count: editingClass ? editingClass.learner_count : 0,
            school: selectedSchool ? { id: selectedSchool.id, name: selectedSchool.name } : undefined,
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminClasses',
            action: editingClass ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: classForm,
            optimisticRecord: optimisticClass,
        });

        if (res.success) {
            showToast(res.message || 'Class saved successfully', 'success');
            setIsClassModalOpen(false);
            setEditingClass(null);
            setClassForm({ school_id: schools[0]?.id ? String(schools[0].id) : '', name: '', grade_level: 'SS1', section: '', description: '' });
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save class', 'error');
        }
    };

    const handleDeleteClass = async (cls: ClassItem) => {
        if (!confirm(`Are you sure you want to delete class ${cls.name}?`)) return;
        const res = await executeAdminAction({
            table: 'adminClasses',
            action: 'delete',
            recordId: String(cls.id),
            endpoint: `/api/v1/admin/classes/${cls.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Class deleted');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete class', 'error');
        }
    };

    const openClassRoster = async (cls: ClassItem) => {
        setSelectedClassForRoster(cls);
        setIsRosterModalOpen(true);
        setLoadingClassLearners(true);
        try {
            const res = await fetch(`/api/v1/admin/classes/${cls.id}/learners`);
            const data = await res.json();
            setClassLearners(data.learners || []);
        } catch (err) {
            console.error(err);
            showToast('Failed to load class roster', 'error');
        } finally {
            setLoadingClassLearners(false);
        }
    };

    const handleEnrollLearnerInClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassForRoster || !enrollLearnerEmail.trim()) return;

        setEnrollingLearner(true);
        try {
            const res = await fetch(`/api/v1/admin/classes/${selectedClassForRoster.id}/enroll`, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ email: enrollLearnerEmail.trim() }),
            });

            const data = await res.json();
            if (res.ok) {
                showToast('Learner enrolled successfully');
                setEnrollLearnerEmail('');
                openClassRoster(selectedClassForRoster);
                onRefresh();
            } else {
                showToast(data.error || data.message || 'Failed to enroll learner', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error enrolling learner', 'error');
        } finally {
            setEnrollingLearner(false);
        }
    };

    const handleRemoveLearnerFromClass = async (learnerId: string) => {
        if (!selectedClassForRoster) return;
        if (!confirm('Remove this learner from the class?')) return;

        try {
            const res = await fetch(`/api/v1/admin/classes/${selectedClassForRoster.id}/learners/${learnerId}`, {
                method: 'DELETE',
                headers: getAdminAuthHeaders(),
            });

            if (res.ok) {
                showToast('Learner removed from class');
                openClassRoster(selectedClassForRoster);
                onRefresh();
            } else {
                showToast('Failed to remove learner', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error removing learner', 'error');
        }
    };

    const filteredClasses = classes.filter((cls) => {
        if (classSchoolFilter && String(cls.school_id) !== classSchoolFilter) return false;
        if (classGradeFilter && cls.grade_level !== classGradeFilter) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {schools.length > 1 && (
                        <select
                            value={classSchoolFilter}
                            onChange={(e) => setClassSchoolFilter(e.target.value)}
                            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)]"
                        >
                            <option value="">All Schools</option>
                            {schools.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={classGradeFilter}
                        onChange={(e) => setClassGradeFilter(e.target.value)}
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
                        setEditingClass(null);
                        setClassForm({
                            school_id: schools[0]?.id ? String(schools[0].id) : '',
                            name: '',
                            grade_level: 'SS1',
                            section: '',
                            description: '',
                        });
                        setIsClassModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Class
                </button>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-36 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filteredClasses.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    <p className="font-bold text-[var(--color-text)]">No classes found</p>
                    <p className="text-xs mt-1">Create classes for JSS1-SS3 cohorts to organize and monitor your students.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClasses.map((cls) => (
                        <div key={cls.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[var(--color-primary)]/50 transition-colors">
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-base text-[var(--color-text)]">{cls.name}</h4>
                                        {cls._pendingSync && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                Pending Sync
                                            </span>
                                        )}
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-5)] text-[var(--color-primary)] text-xs font-extrabold">
                                        {cls.grade_level}
                                    </span>
                                </div>
                                {cls.section && (
                                    <p className="text-xs text-[var(--color-muted)] font-semibold mb-2">Section: {cls.section}</p>
                                )}
                                {cls.description && (
                                    <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-4">{cls.description}</p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between mt-3">
                                <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>{cls.learner_count ?? 0}</span> learners
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => openClassRoster(cls)}
                                        className="px-3 py-1.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                    >
                                        View Roster
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingClass(cls);
                                            setClassForm({
                                                school_id: String(cls.school_id),
                                                name: cls.name,
                                                grade_level: cls.grade_level,
                                                section: cls.section || '',
                                                description: cls.description || '',
                                            });
                                            setIsClassModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:text-[var(--color-primary)] rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-[0.98]"
                                        title="Edit Class"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClass(cls)}
                                        className="p-1.5 hover:bg-[var(--color-error-5)] text-[var(--color-muted)] hover:text-[var(--color-error)] rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-[0.98]"
                                        title="Delete Class"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Class Create / Edit */}
            {isClassModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">
                                {editingClass ? 'Edit Class Cohort' : 'Create New Class Cohort'}
                            </h3>
                            <button onClick={() => setIsClassModalOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Class Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={classForm.name}
                                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                    placeholder="e.g. SS1 Alpha, JSS2 Gold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Grade Level *</label>
                                    <select
                                        value={classForm.grade_level}
                                        onChange={(e) => setClassForm({ ...classForm, grade_level: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
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
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Section / Arm</label>
                                    <input
                                        type="text"
                                        value={classForm.section}
                                        onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none"
                                        placeholder="e.g. Science, Arts, Arm A"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">School *</label>
                                <select
                                    required
                                    value={classForm.school_id}
                                    onChange={(e) => setClassForm({ ...classForm, school_id: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none cursor-pointer"
                                >
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Description</label>
                                <textarea
                                    rows={2}
                                    value={classForm.description}
                                    onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none"
                                    placeholder="Optional description of this cohort..."
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]">
                                    {editingClass ? 'Update Class' : 'Create Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Class Roster & Enrollment */}
            {isRosterModalOpen && selectedClassForRoster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">
                                    {selectedClassForRoster.name} Roster
                                </h3>
                                <p className="text-xs text-[var(--color-muted)]">
                                    Grade: <strong className="text-[var(--color-primary)]">{selectedClassForRoster.grade_level}</strong> • {classLearners.length} Enrolled Learners
                                </p>
                            </div>
                            <button onClick={() => setIsRosterModalOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Quick Enroll Form */}
                        <form onSubmit={handleEnrollLearnerInClass} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-primary-5)]/30 border border-[var(--color-border)]">
                            <input
                                type="email"
                                required
                                placeholder="Enter learner's email address to enroll..."
                                value={enrollLearnerEmail}
                                onChange={(e) => setEnrollLearnerEmail(e.target.value)}
                                className="flex-1 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none"
                            />
                            <button
                                type="submit"
                                disabled={enrollingLearner}
                                className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                {enrollingLearner ? 'Enrolling...' : 'Enroll Student'}
                            </button>
                        </form>

                        {/* Roster Table */}
                        <div className="flex-1 overflow-y-auto border border-[var(--color-border)] rounded-2xl">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-5)]/20 text-[var(--color-muted)] uppercase tracking-wider font-bold sticky top-0 bg-[var(--color-surface)]">
                                        <th className="py-3 px-4">Student</th>
                                        <th className="py-3 px-4">Level & XP</th>
                                        <th className="py-3 px-4">Streak</th>
                                        <th className="py-3 px-4">Avg Mastery</th>
                                        <th className="py-3 px-4">Questions</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {loadingClassLearners ? (
                                        [1, 2, 3].map((n) => (
                                            <tr key={n}>
                                                <td colSpan={6} className="py-4 px-4">
                                                    <div className="h-5 bg-[var(--color-primary-5)] rounded animate-pulse" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : classLearners.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-[var(--color-muted)] text-sm">
                                                No learners currently enrolled in this class cohort.
                                            </td>
                                        </tr>
                                    ) : (
                                        classLearners.map((lrn) => (
                                            <tr key={lrn.id} className="hover:bg-[var(--color-primary-5)]/20 transition-colors">
                                                <td className="py-3 px-4">
                                                    <p className="font-bold text-[var(--color-text)]">{lrn.name}</p>
                                                    <p className="text-[11px] text-[var(--color-muted)]">{lrn.email}</p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="font-bold text-[var(--color-primary)]">{lrn.total_xp.toLocaleString()} XP</p>
                                                    <p className="text-[10px] text-[var(--color-muted)]">Lvl {lrn.level} • {lrn.rank}</p>
                                                </td>
                                                <td className="py-3 px-4 font-bold text-[var(--color-accent-dark,var(--color-primary))]">
                                                    {lrn.streak}d
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded font-bold ${
                                                        lrn.avg_mastery >= 70 ? 'bg-emerald-500/10 text-emerald-600' : lrn.avg_mastery >= 40 ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'
                                                    }`}>
                                                        {lrn.avg_mastery}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-[var(--color-muted)]">
                                                    <strong className="text-[var(--color-text)]">{lrn.total_correct}</strong> / {lrn.total_attempted}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveLearnerFromClass(lrn.id)}
                                                        className="px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
