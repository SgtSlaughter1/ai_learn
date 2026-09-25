import { useState } from 'react';
import type { TeacherItem, SchoolItem, ClassItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';

interface TeachersTabProps {
    teachers: TeacherItem[];
    schools: SchoolItem[];
    classes: ClassItem[];
    loading: boolean;
    isSuperAdmin?: boolean;
    onRefresh: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function TeachersTab({
    teachers,
    schools,
    classes,
    loading,
    isSuperAdmin = false,
    onRefresh,
    showToast,
}: TeachersTabProps) {
    const [search, setSearch] = useState('');
    const [schoolFilter, setSchoolFilter] = useState<string>('');
    const [classFilter, setClassFilter] = useState<string>('');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
    const [deletingTeacher, setDeletingTeacher] = useState<TeacherItem | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        school_id: '',
        class_ids: [] as number[],
        department: '',
        employee_id: '',
        bio: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            school_id: '',
            class_ids: [],
            department: '',
            employee_id: '',
            bio: '',
        });
        setEditingTeacher(null);
    };

    const openCreateModal = () => {
        resetForm();
        if (!isSuperAdmin && schools.length > 0) {
            setFormData(prev => ({ ...prev, school_id: String(schools[0].id) }));
        }
        setIsCreateModalOpen(true);
    };

    const openEditModal = (teacher: TeacherItem) => {
        setEditingTeacher(teacher);
        const currentClassIds = teacher.classes?.map(c => c.id) || [];
        setFormData({
            name: teacher.name,
            email: teacher.email,
            password: '',
            school_id: teacher.teacher_profile?.school_id ? String(teacher.teacher_profile.school_id) : '',
            class_ids: currentClassIds,
            department: teacher.teacher_profile?.department || '',
            employee_id: teacher.teacher_profile?.employee_id || '',
            bio: teacher.teacher_profile?.bio || '',
        });
        setIsCreateModalOpen(true);
    };

    const handleClassToggle = (classId: number) => {
        setFormData(prev => {
            const exists = prev.class_ids.includes(classId);
            return {
                ...prev,
                class_ids: exists
                    ? prev.class_ids.filter(id => id !== classId)
                    : [...prev.class_ids, classId],
            };
        });
    };

    const handleSaveTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const endpoint = editingTeacher
            ? `/api/v1/admin/teachers/${editingTeacher.id}`
            : '/api/v1/admin/teachers';
        const method = editingTeacher ? 'PUT' : 'POST';
        const tempId = editingTeacher ? String(editingTeacher.id) : `temp_teacher_${Date.now()}`;

        const selectedSchool = schools.find(s => String(s.id) === String(formData.school_id));
        const assignedClasses = classes.filter(c => formData.class_ids.includes(c.id));

        const optimisticTeacher: TeacherItem = {
            id: editingTeacher ? editingTeacher.id : `temp_${Date.now()}`,
            name: formData.name,
            email: formData.email,
            role: 'teacher',
            teacher_profile: {
                id: editingTeacher?.teacher_profile?.id || Date.now(),
                school_id: formData.school_id ? Number(formData.school_id) : (selectedSchool?.id || 1),
                department: formData.department || null,
                employee_id: formData.employee_id || null,
                bio: formData.bio || null,
                is_active: true,
                school: selectedSchool ? { id: selectedSchool.id, name: selectedSchool.name } : undefined,
            },
            classes: assignedClasses.map(c => ({
                id: c.id,
                name: c.name,
                grade_level: c.grade_level,
                arm: c.arm,
                section: c.section,
                school_class_arm: c.school_class_arm,
            })),
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminTeachers',
            action: editingTeacher ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: {
                name: formData.name,
                email: formData.email,
                school_id: formData.school_id ? Number(formData.school_id) : null,
                class_ids: formData.class_ids,
                department: formData.department || null,
                employee_id: formData.employee_id || null,
                bio: formData.bio || null,
                ...(formData.password ? { password: formData.password } : {}),
            },
            optimisticRecord: optimisticTeacher,
        });

        setSubmitting(false);
        if (res.success) {
            showToast(
                res.message || (editingTeacher ? 'Teacher updated successfully' : 'Teacher created & assigned successfully'),
                'success'
            );
            setIsCreateModalOpen(false);
            resetForm();
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save teacher', 'error');
        }
    };

    const handleDeleteTeacher = async () => {
        if (!deletingTeacher) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminTeachers',
            action: 'delete',
            recordId: String(deletingTeacher.id),
            endpoint: `/api/v1/admin/teachers/${deletingTeacher.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);
        setDeletingTeacher(null);

        if (res.success) {
            showToast('Teacher removed successfully', 'success');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete teacher', 'error');
        }
    };

    // Filter available classes by selected school in modal
    const modalAvailableClasses = formData.school_id
        ? classes.filter(c => String(c.school_id) === String(formData.school_id))
        : classes;

    // Filter teachers list
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch =
            !search ||
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.email.toLowerCase().includes(search.toLowerCase()) ||
            (t.teacher_profile?.employee_id && t.teacher_profile.employee_id.toLowerCase().includes(search.toLowerCase())) ||
            (t.teacher_profile?.department && t.teacher_profile.department.toLowerCase().includes(search.toLowerCase()));

        const matchesSchool = !schoolFilter || String(t.teacher_profile?.school_id) === schoolFilter;
        const matchesClass = !classFilter || t.classes?.some(c => String(c.id) === classFilter);

        return matchesSearch && matchesSchool && matchesClass;
    });

    return (
        <div className="space-y-6">
            {/* Header & Action Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl shadow-xs">
                <div>
                    <h2 className="text-xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </span>
                        Teachers & Class Teachers
                    </h2>
                    <p className="text-xs text-[var(--color-muted)] mt-1 font-medium">
                        Assign teachers to classes so they can monitor learner mastery and launch targeted interventions.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                        title="Refresh list"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--color-primary)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Teacher
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-3 rounded-2xl">
                <div className="relative flex-1 w-full">
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, staff ID or department..."
                        className="w-full pl-9 pr-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                </div>

                {isSuperAdmin && schools.length > 0 && (
                    <select
                        value={schoolFilter}
                        onChange={(e) => setSchoolFilter(e.target.value)}
                        className="w-full sm:w-48 px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                        <option value="">All Schools</option>
                        {schools.map(s => (
                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                    </select>
                )}

                {classes.length > 0 && (
                    <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="w-full sm:w-48 px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                        <option value="">All Assigned Classes</option>
                        {classes.map(c => (
                            <option key={c.id} value={String(c.id)}>{c.name} ({c.grade_level})</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Teachers Table */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]/60 text-[var(--color-muted)] uppercase tracking-wider font-extrabold text-[10px]">
                                <th className="py-3.5 px-4">Teacher</th>
                                <th className="py-3.5 px-4">School</th>
                                <th className="py-3.5 px-4">Assigned Classes</th>
                                <th className="py-3.5 px-4">Department / Staff ID</th>
                                <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
                            {loading && teachers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[var(--color-muted)]">
                                        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Loading teachers...
                                    </td>
                                </tr>
                            ) : filteredTeachers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[var(--color-muted)]">
                                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-background)] text-[var(--color-muted)] flex items-center justify-center mx-auto mb-3 border border-[var(--color-border)]">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <p className="font-bold text-sm text-[var(--color-text)]">No teachers found</p>
                                        <p className="text-xs mt-1">Add a teacher and assign them to a class to get started.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTeachers.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-[var(--color-background)]/50 transition-colors">
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] font-black flex items-center justify-center text-sm border border-[var(--color-primary-20)]">
                                                    {teacher.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                                                        {teacher.name}
                                                        {teacher._pendingSync && (
                                                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md">
                                                                Pending Sync
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-[var(--color-muted)]">{teacher.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 font-medium text-[var(--color-muted)]">
                                            {teacher.teacher_profile?.school?.name || 'Assigned School'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {(!teacher.classes || teacher.classes.length === 0) ? (
                                                <span className="text-[11px] text-[var(--color-muted)] italic">No classes assigned</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                                    {teacher.classes.map(c => (
                                                        <span
                                                            key={c.id}
                                                            className="px-2 py-0.5 text-[10px] font-bold bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] rounded-lg"
                                                        >
                                                            {c.name} {c.grade_level ? `(${c.grade_level})` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="font-semibold text-[var(--color-text)]">
                                                {teacher.teacher_profile?.department || '-'}
                                            </p>
                                            {teacher.teacher_profile?.employee_id && (
                                                <p className="text-[10px] text-[var(--color-muted)]">ID: {teacher.teacher_profile.employee_id}</p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => openEditModal(teacher)}
                                                    className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                                                    title="Edit Teacher & Class Assignment"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeletingTeacher(teacher)}
                                                    className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-red-500/10 text-[var(--color-muted)] hover:text-red-500 transition-colors cursor-pointer"
                                                    title="Remove Teacher"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
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

            {/* Create / Edit Teacher Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
                        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                            <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </span>
                                {editingTeacher ? 'Edit Teacher & Class Assignment' : 'Add New Teacher'}
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveTeacher} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Mr. David Adeleke"
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="teacher@school.com"
                                        className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                        {editingTeacher ? 'Password (leave blank to keep)' : 'Temporary Password *'}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingTeacher}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Min 6 characters"
                                        className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            {isSuperAdmin && schools.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                        School <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={formData.school_id}
                                        onChange={(e) => setFormData({ ...formData, school_id: e.target.value, class_ids: [] })}
                                        className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="">Select School...</option>
                                        {schools.map(s => (
                                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Class Assignment Multi-Select */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1.5 flex items-center justify-between">
                                    <span>Assign Class(es) as Class Teacher</span>
                                    <span className="text-[10px] text-[var(--color-primary)] font-semibold">
                                        {formData.class_ids.length} selected
                                    </span>
                                </label>
                                <div className="max-h-36 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-background)] rounded-xl p-2.5 space-y-1.5">
                                    {modalAvailableClasses.length === 0 ? (
                                        <p className="text-xs text-[var(--color-muted)] text-center py-3">
                                            No classes available for this school.
                                        </p>
                                    ) : (
                                        modalAvailableClasses.map(c => {
                                            const isSelected = formData.class_ids.includes(c.id);
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => handleClassToggle(c.id)}
                                                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                                        isSelected
                                                            ? 'bg-[var(--color-primary-10)] text-[var(--color-primary)] font-bold border border-[var(--color-primary-20)]'
                                                            : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded text-[var(--color-primary)] pointer-events-none"
                                                        />
                                                        <span>{c.name}</span>
                                                    </div>
                                                    <span className="text-[10px] text-[var(--color-muted)] font-normal">
                                                        {c.grade_level} {c.section ? `• Sec ${c.section}` : ''}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                        Department
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="e.g. Science / Physics"
                                        className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">
                                        Employee / Staff ID
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.employee_id}
                                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                        placeholder="e.g. TCH-2026-04"
                                        className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? 'Saving...' : editingTeacher ? 'Save Changes' : 'Create Teacher'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingTeacher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-5 shadow-2xl animate-scale-up space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-bold text-[var(--color-text)]">Remove Teacher</h3>
                            <p className="text-xs text-[var(--color-muted)] mt-1.5">
                                Are you sure you want to remove <strong className="text-[var(--color-text)]">{deletingTeacher.name}</strong>? They will lose access to class rosters and teacher intervention dashboards.
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5 pt-2">
                            <button
                                onClick={() => setDeletingTeacher(null)}
                                className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteTeacher}
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                {submitting ? 'Removing...' : 'Yes, Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
