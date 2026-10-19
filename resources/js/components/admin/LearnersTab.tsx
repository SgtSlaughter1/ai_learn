import { useState, useEffect } from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';
import type { Learner, SchoolItem, ClassItem } from '@/types/admin';
import { executeAdminAction, setAccountActive } from '@/services/AdminOfflineService';
import { InactiveBadge } from '@/components/common/InactiveBadge';
import { getGradeLevelsForSchool, formatClassOptionLabel } from '@/utils/format';
import Pagination from '@/components/common/Pagination';
import { Skeleton } from '@/components/common/Skeleton';

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
    const [isLearnerModalOpen, setIsLearnerModalOpen] = useState(false);
    const [editingLearner, setEditingLearner] = useState<Learner | null>(null);
    const [isSavingLearner, setIsSavingLearner] = useState(false);
    const [deletingLearnerId, setDeletingLearnerId] = useState<string | number | null>(null);
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
        if (isSavingLearner) return;
        if (!(await confirmAction(editingLearner
            ? { title: 'Save changes?', message: `Save changes to "${learnerForm.name}"?`, confirmLabel: 'Save changes' }
            : { title: 'Create learner?', message: `Create learner "${learnerForm.name}"?`, confirmLabel: 'Create learner' }))) return;
        setIsSavingLearner(true);

        try {
            const endpoint = editingLearner ? `/api/v1/admin/learners/${editingLearner.id}` : '/api/v1/admin/learners';
            const method = editingLearner ? 'PATCH' : 'POST';
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
                showToast(res.message || (res.offline ? 'Learner saved locally (Pending Sync)' : 'Learner saved successfully'), 'success');
                setIsLearnerModalOpen(false);
                setEditingLearner(null);
                setLearnerForm({ name: '', email: '', password: '', school_id: '', grade_level: 'SS1', student_id: '', class_id: '' });
                onRefresh();
            } else {
                showToast(res.error || 'Failed to save learner', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error saving learner', 'error');
        } finally {
            setIsSavingLearner(false);
        }
    };

    const handleToggleActive = async (learner: Learner) => {
        const activate = learner.is_active === false;
        if (!activate && !(await confirmAction({ title: 'Deactivate learner?', message: `${learner.name} won't be able to sign in until you activate them again. Nothing is deleted.`, confirmLabel: 'Deactivate', tone: 'warning' }))) return;
        const res = await setAccountActive('user', 'adminLearners', learner, activate);
        showToast(res.success ? (res.message || (activate ? 'Learner activated' : 'Learner deactivated')) : (res.error || 'Could not change the account status'), res.success ? 'success' : 'error');
        if (res.success) onRefresh();
    };

    const handleDeleteLearner = async (learner: Learner) => {
        if (!(await confirmAction({ title: 'Delete learner?', message: `Delete ${learner.name}? The account is archived (not erased) and can no longer sign in.`, confirmLabel: 'Delete learner', tone: 'danger' }))) return;
        setDeletingLearnerId(learner.id);
        try {
            const res = await executeAdminAction({
                table: 'adminLearners',
                action: 'delete',
                recordId: learner.id,
                endpoint: `/api/v1/admin/learners/${learner.id}`,
                method: 'DELETE',
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Learner deleted locally (Pending Sync)' : 'Learner deleted'), 'success');
                onRefresh();
            } else {
                showToast(res.error || 'Failed to delete learner', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error deleting learner', 'error');
        } finally {
            setDeletingLearnerId(null);
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

    useEffect(() => {
        setPage(1);
    }, [learnerSearch, learnerGradeFilter, learnerSchoolFilter, learnerClassFilter]);

    const paginatedLearners = filteredLearners.slice((page - 1) * 50, page * 50);

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
                            const filterGradeGroups = getGradeLevelsForSchool(selectedFilterSchool);
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
                    className="w-full md:w-auto justify-center px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
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
                    <table className="w-full text-left text-xs min-w-[640px]">
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
                                [1, 2, 3, 4, 5].map((n) => (
                                    <tr key={n} className="hover:bg-[var(--color-primary-5)]/10">
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
                                                <div className="space-y-1.5 flex-1">
                                                    <Skeleton variant="text" className="h-3.5 w-32" />
                                                    <Skeleton variant="text" className="h-2.5 w-24" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="space-y-1">
                                                <Skeleton variant="rounded" className="h-5 w-16 rounded-md" />
                                                <Skeleton variant="text" className="h-2.5 w-20" />
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <Skeleton variant="text" className="h-3.5 w-28" />
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="space-y-1">
                                                <Skeleton variant="rounded" className="h-5 w-20 rounded-full" />
                                                <Skeleton variant="text" className="h-2.5 w-14" />
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Skeleton variant="rounded" className="w-7 h-7 rounded-lg" />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : paginatedLearners.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-[var(--color-muted)] text-sm">
                                        No learners found. Click "Add New Learner" to provision students.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLearners.map((learner) => {
                                    return (
                                    <tr key={learner.id} className={`hover:bg-[var(--color-primary-5)]/20 transition-colors ${openActionDropdownId === learner.id ? 'relative z-30' : ''}`}>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-[var(--color-text)]">{learner.name}<InactiveBadge show={learner.is_active === false} /></p>
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
                                            <div className="relative inline-block text-left">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (openActionDropdownId === learner.id) {
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
                                                        setOpenActionDropdownId(learner.id);
                                                    }}
                                                    className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                                                        openActionDropdownId === learner.id
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                                                            : 'bg-[var(--color-surface)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)]'
                                                    }`}
                                                    title="Learner Actions"
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
                                                            openActionDropdownId === learner.id ? 'rotate-180' : ''
                                                        }`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {openActionDropdownId === learner.id && dropdownCoords && (
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
                                                            className="w-40 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl z-[9999] p-1.5 text-left animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
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
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] hover:text-[var(--color-primary-light)] transition-colors cursor-pointer text-left"
                                                            >
                                                                <svg className="w-3.5 h-3.5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                <span>Edit Profile</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
                                                                    void handleToggleActive(learner);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] transition-colors cursor-pointer text-left"
                                                            >
                                                                <span className={`w-2 h-2 rounded-full ${learner.is_active === false ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                <span>{learner.is_active === false ? 'Activate' : 'Deactivate'}</span>
                                                            </button>

                                                            <div className="h-px bg-[var(--color-border)] my-1" />

                                                            <button
                                                                type="button"
                                                                disabled={deletingLearnerId === learner.id}
                                                                onClick={() => {
                                                                    setOpenActionDropdownId(null);
                                                                    setDropdownCoords(null);
                                                                    handleDeleteLearner(learner);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-10)] transition-colors cursor-pointer text-left disabled:opacity-50"
                                                            >
                                                                {deletingLearnerId === learner.id ? (
                                                                    <svg className="w-3.5 h-3.5 animate-spin text-[var(--color-error)]" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-3.5 h-3.5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                )}
                                                                <span>{deletingLearnerId === learner.id ? 'Deleting...' : 'Delete Learner'}</span>
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
                    totalItems={filteredLearners.length}
                    itemsPerPage={50}
                    onPageChange={setPage}
                    itemLabel="learners"
                />
            </div>

            {/* Modal: Learner Create / Edit */}
            {isLearnerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
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
                                        const availableGrades = getGradeLevelsForSchool(target).flatMap((g) => g.options.map((o) => o.value));
                                        let defaultGrade = learnerForm.grade_level;

                                        if (!availableGrades.includes(learnerForm.grade_level) && availableGrades.length > 0) {
                                            defaultGrade = availableGrades[0];
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
                                            const groups = getGradeLevelsForSchool(sel);
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
                                <button
                                    type="button"
                                    onClick={() => setIsLearnerModalOpen(false)}
                                    disabled={isSavingLearner}
                                    className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingLearner}
                                    className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-2"
                                >
                                    {isSavingLearner ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>{editingLearner ? 'Updating Learner...' : 'Saving Learner...'}</span>
                                        </>
                                    ) : (
                                        <span>{editingLearner ? 'Update Learner' : 'Add Learner'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
