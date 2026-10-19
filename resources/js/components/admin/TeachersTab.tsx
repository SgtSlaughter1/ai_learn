import { useState, useEffect } from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';
import type { TeacherItem, SchoolItem, ClassItem } from '@/types/admin';
import { executeAdminAction, setAccountActive } from '@/services/AdminOfflineService';
import { InactiveBadge } from '@/components/common/InactiveBadge';
import Pagination from '@/components/common/Pagination';
import { Skeleton } from '@/components/common/Skeleton';

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
    const [page, setPage] = useState(1);
    const [openActionDropdownId, setOpenActionDropdownId] = useState<string | number | null>(null);
    const [dropdownCoords, setDropdownCoords] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

    useEffect(() => {
        if (!openActionDropdownId) return;
        const handleClose = () => {
            setOpenActionDropdownId(null);
            setDropdownCoords(null);
        };
        window.addEventListener('scroll', handleClose, true);
        window.addEventListener('resize', handleClose);
        return () => {
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('resize', handleClose);
        };
    }, [openActionDropdownId]);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
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
        if (!(await confirmAction(editingTeacher
            ? { title: 'Save changes?', message: `Save changes to "${formData.name}"?`, confirmLabel: 'Save changes' }
            : { title: 'Create teacher?', message: `Create teacher "${formData.name}"?`, confirmLabel: 'Create teacher' }))) return;
        setSubmitting(true);

        const endpoint = editingTeacher
            ? `/api/v1/admin/teachers/${editingTeacher.id}`
            : '/api/v1/admin/teachers';
        const method = editingTeacher ? 'PATCH' : 'POST';
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

    const handleToggleActive = async (teacher: TeacherItem) => {
        const activate = teacher.is_active === false;
        if (!activate && !(await confirmAction({ title: 'Deactivate teacher?', message: `${teacher.name} won't be able to sign in until you activate them again. Nothing is deleted.`, confirmLabel: 'Deactivate', tone: 'warning' }))) return;
        const res = await setAccountActive('user', 'adminTeachers', teacher, activate);
        showToast(res.success ? (res.message || (activate ? 'Teacher activated' : 'Teacher deactivated')) : (res.error || 'Could not change the account status'), res.success ? 'success' : 'error');
        if (res.success) onRefresh();
    };

    const handleDeleteTeacher = async (teacher: TeacherItem) => {
        if (!(await confirmAction({ title: 'Remove teacher?', message: `Remove ${teacher.name}? The account is archived (not erased): they can no longer sign in and lose access to class rosters.`, confirmLabel: 'Remove teacher', tone: 'danger' }))) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminTeachers',
            action: 'delete',
            recordId: String(teacher.id),
            endpoint: `/api/v1/admin/teachers/${teacher.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);

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

    // Reset to page 1 on search or filter change
    useEffect(() => {
        setPage(1);
    }, [search, schoolFilter, classFilter]);

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

    const paginatedTeachers = filteredTeachers.slice((page - 1) * 50, page * 50);

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
                                [1, 2, 3, 4, 5].map((n) => (
                                    <tr key={n} className="hover:bg-[var(--color-background)]/50">
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
                                                <div className="space-y-1.5 flex-1">
                                                    <Skeleton variant="text" className="h-3.5 w-32" />
                                                    <Skeleton variant="text" className="h-2.5 w-24" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <Skeleton variant="text" className="h-3.5 w-28" />
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex gap-1.5">
                                                <Skeleton variant="rounded" className="h-5 w-16 rounded-lg" />
                                                <Skeleton variant="rounded" className="h-5 w-16 rounded-lg" />
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="space-y-1">
                                                <Skeleton variant="text" className="h-3.5 w-24" />
                                                <Skeleton variant="text" className="h-2.5 w-16" />
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Skeleton variant="rounded" className="w-7 h-7 rounded-lg" />
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                                paginatedTeachers.map((teacher) => {
                                    return (
                                    <tr key={teacher.id} className={`hover:bg-[var(--color-background)]/50 transition-colors ${openActionDropdownId === teacher.id ? 'relative z-30' : ''}`}>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] font-black flex items-center justify-center text-sm border border-[var(--color-primary-20)]">
                                                    {teacher.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-[var(--color-text)] flex items-center gap-1.5">
                                                        {teacher.name}
                                                        <InactiveBadge show={teacher.is_active === false} />
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
                                            <div className="relative inline-block text-left">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (openActionDropdownId === teacher.id) {
                                                            setOpenActionDropdownId(null);
                                                            setDropdownCoords(null);
                                                            return;
                                                        }
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const spaceBelow = window.innerHeight - rect.bottom;
                                                        const openUp = spaceBelow < 180;

                                                        setDropdownCoords({
                                                            top: openUp ? undefined : rect.bottom + 6,
                                                            bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                                                            right: window.innerWidth - rect.right,
                                                        });
                                                        setOpenActionDropdownId(teacher.id);
                                                    }}
                                                    className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                                                        openActionDropdownId === teacher.id
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                                                            : 'bg-[var(--color-surface)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)]'
                                                    }`}
                                                    title="Teacher Actions"
                                                >
                                                    {/* 3x3 Grid Icon */}
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                        <rect x="4" y="4" width="4" height="4" rx="1" />
                                                        <rect x="10" y="4" width="4" height="4" rx="1" />
                                                        <rect x="16" y="4" width="4" height="4" rx="1" />
                                                        <rect x="4" y="10" width="4" height="4" rx="1" />
                                                        <rect x="10" y="10" width="4" height="4" rx="1" />
                                                        <rect x="16" y="10" width="4" height="4" rx="1" />
                                                        <rect x="4" y="16" width="4" height="4" rx="1" />
                                                        <rect x="10" y="16" width="4" height="4" rx="1" />
                                                        <rect x="16" y="16" width="4" height="4" rx="1" />
                                                    </svg>
                                                    <svg
                                                        className={`w-3 h-3 transition-transform duration-200 ${
                                                            openActionDropdownId === teacher.id ? 'rotate-180' : ''
                                                        }`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {openActionDropdownId === teacher.id && dropdownCoords && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-[9998]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenActionDropdownId(null);
                                                                setDropdownCoords(null);
                                                            }}
                                                        />
                                                        <div
                                                            style={{
                                                                position: 'fixed',
                                                                top: dropdownCoords.top !== undefined ? `${dropdownCoords.top}px` : 'auto',
                                                                bottom: dropdownCoords.bottom !== undefined ? `${dropdownCoords.bottom}px` : 'auto',
                                                                right: `${dropdownCoords.right}px`,
                                                            }}
                                                            className="w-44 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl z-[9999] p-1.5 text-left animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
                                                                    openEditModal(teacher);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] hover:text-[var(--color-primary-light)] transition-colors cursor-pointer text-left"
                                                            >
                                                                <svg className="w-3.5 h-3.5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                <span>Edit Teacher</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
                                                                    void handleToggleActive(teacher);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] transition-colors cursor-pointer text-left"
                                                            >
                                                                <span className={`w-2 h-2 rounded-full ${teacher.is_active === false ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                <span>{teacher.is_active === false ? 'Activate' : 'Deactivate'}</span>
                                                            </button>

                                                            <div className="h-px bg-[var(--color-border)] my-1" />

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
                                                                    void handleDeleteTeacher(teacher);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-10)] transition-colors cursor-pointer text-left"
                                                            >
                                                                <svg className="w-3.5 h-3.5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                                <span>Remove Teacher</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={page}
                    totalItems={filteredTeachers.length}
                    itemsPerPage={50}
                    onPageChange={setPage}
                    itemLabel="teachers"
                />
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

        </div>
    );
}
