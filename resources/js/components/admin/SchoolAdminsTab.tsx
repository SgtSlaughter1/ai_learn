import { useState, useEffect } from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';
import type { SchoolAdminItem, SchoolItem } from '@/types/admin';
import { executeAdminAction, setAccountActive } from '@/services/AdminOfflineService';
import { InactiveBadge } from '@/components/common/InactiveBadge';
import Pagination from '@/components/common/Pagination';
import { SkeletonTable } from '@/components/common/Skeleton';
import { useDismiss } from '@/hooks/useDismiss';

interface SchoolAdminsTabProps {
    admins: SchoolAdminItem[];
    schools: SchoolItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function SchoolAdminsTab({
    admins,
    schools,
    loading,
    onRefresh,
    showToast,
}: SchoolAdminsTabProps) {
    const [search, setSearch] = useState('');
    const [schoolFilter, setSchoolFilter] = useState<string>('');
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
    const [editingAdmin, setEditingAdmin] = useState<SchoolAdminItem | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        school_id: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            school_id: '',
        });
        setEditingAdmin(null);
    };

    const openEditModal = (admin: SchoolAdminItem) => {
        setEditingAdmin(admin);
        setFormData({
            name: admin.name,
            email: admin.email,
            password: '',
            school_id: admin.school_id ? String(admin.school_id) : (admin.administered_school?.id ? String(admin.administered_school.id) : ''),
        });
        setIsCreateModalOpen(true);
    };

    const handleSaveAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!(await confirmAction(editingAdmin
            ? { title: 'Save changes?', message: `Save changes to "${formData.name}"?`, confirmLabel: 'Save changes' }
            : { title: 'Create school admin?', message: `Create school admin "${formData.name}"?`, confirmLabel: 'Create school admin' }))) return;
        setSubmitting(true);

        const endpoint = editingAdmin
            ? `/api/v1/admin/school-admins/${editingAdmin.id}`
            : '/api/v1/admin/school-admins';
        const method = editingAdmin ? 'PATCH' : 'POST';
        const tempId = editingAdmin ? String(editingAdmin.id) : `temp_admin_${Date.now()}`;

        const selectedSchool = schools.find(s => String(s.id) === String(formData.school_id));
        const optimisticAdmin: SchoolAdminItem = {
            id: editingAdmin ? editingAdmin.id : `temp_${Date.now()}`,
            name: formData.name,
            email: formData.email,
            role: 'school_admin',
            school_id: formData.school_id ? Number(formData.school_id) : null,
            administered_school: selectedSchool ? { id: selectedSchool.id, name: selectedSchool.name, city: selectedSchool.city } : null,
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminSchoolAdmins',
            action: editingAdmin ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: {
                name: formData.name,
                email: formData.email,
                school_id: formData.school_id ? Number(formData.school_id) : null,
                ...(formData.password ? { password: formData.password } : {}),
            },
            optimisticRecord: optimisticAdmin,
        });

        setSubmitting(false);
        if (res.success) {
            showToast(
                res.message || (editingAdmin ? 'School admin updated successfully' : 'School admin created & assigned successfully'),
                'success'
            );
            setIsCreateModalOpen(false);
            resetForm();
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save school admin', 'error');
        }
    };

    const handleToggleActive = async (admin: SchoolAdminItem) => {
        const activate = admin.is_active === false;
        if (!activate && !(await confirmAction({ title: 'Deactivate school admin?', message: `${admin.name} won't be able to sign in until you activate them again. Nothing is deleted.`, confirmLabel: 'Deactivate', tone: 'warning' }))) return;
        const res = await setAccountActive('user', 'adminSchoolAdmins', admin, activate);
        showToast(res.success ? (res.message || (activate ? 'Admin activated' : 'Admin deactivated')) : (res.error || 'Could not change the account status'), res.success ? 'success' : 'error');
        if (res.success) onRefresh();
    };

    const handleDeleteAdmin = async (admin: SchoolAdminItem) => {
        if (!(await confirmAction({ title: 'Remove school admin?', message: `Remove ${admin.name}? The account is archived (not erased), can no longer sign in, and is unlinked from its school.`, confirmLabel: 'Remove admin', tone: 'danger' }))) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminSchoolAdmins',
            action: 'delete',
            recordId: String(admin.id),
            endpoint: `/api/v1/admin/school-admins/${admin.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);
        if (res.success) {
            showToast(res.message || 'School admin removed successfully', 'success');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete school admin', 'error');
        }
    };

    // Reset to page 1 on filter changes
    useEffect(() => {
        setPage(1);
    }, [search, schoolFilter]);

    const filteredAdmins = admins.filter((a) => {
        const matchesSearch =
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.email.toLowerCase().includes(search.toLowerCase()) ||
            (a.administered_school?.name && a.administered_school.name.toLowerCase().includes(search.toLowerCase()));

        const matchesSchool = !schoolFilter ||
            (schoolFilter === 'unassigned' && !a.administered_school && !a.school_id) ||
            (String(a.school_id || a.administered_school?.id) === schoolFilter);

        return matchesSearch && matchesSchool;
    });

    const paginatedAdmins = filteredAdmins.slice((page - 1) * 50, page * 50);

    const assignedCount = admins.filter(a => !!a.administered_school || !!a.school_id).length;
    const unassignedCount = admins.length - assignedCount;

    const { backdrop, panel } = useDismiss(isCreateModalOpen, () => { setIsCreateModalOpen(false); resetForm(); });

    return (
        <div className="space-y-6">
            {/* Header Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Total School Admins</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{admins.length}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Platform school administrators</p>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Assigned to School</p>
                    <p className="text-3xl font-extrabold text-[var(--color-success)] mt-1">{assignedCount}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Active school managers</p>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Unassigned Admins</p>
                    <p className="text-3xl font-extrabold text-[var(--color-accent)] mt-1">{unassignedCount}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Admins awaiting school assignment</p>
                </div>
            </div>

            {/* Actions & Filters Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative flex-1 min-w-[220px]">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email, school..."
                            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                        <span className="absolute left-3.5 top-2.5 text-[var(--color-muted)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                    </div>

                    <select
                        value={schoolFilter}
                        onChange={(e) => setSchoolFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                    >
                        <option value="">All School Assignments</option>
                        <option value="unassigned">Unassigned Only</option>
                        {schools.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create School Admin</span>
                </button>
            </div>

            {/* Admin Table / List */}
            {loading ? (
                <SkeletonTable rows={5} columns={4} />
            ) : filteredAdmins.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-5)] text-[var(--color-primary)] flex items-center justify-center mx-auto mb-3 border border-[var(--color-border)]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text)] mt-3">No School Administrators Found</h3>
                    <p className="text-sm text-[var(--color-muted)] mt-1 max-w-md mx-auto">
                        {search || schoolFilter
                            ? 'No school administrators match your filter criteria.'
                            : 'No school administrators created yet. Click "Create School Admin" to register one.'}
                    </p>
                </div>
            ) : (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[640px]">
                            <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)] text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                <tr>
                                    <th className="px-6 py-4">Administrator</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Assigned School</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {paginatedAdmins.map((admin) => {
                                    const schoolName = admin.administered_school?.name ||
                                        schools.find(s => s.id === admin.school_id)?.name;

                                    return (
                                        <tr key={admin.id} className={`hover:bg-[var(--color-surface-hover)] transition-colors ${openActionDropdownId === admin.id ? 'relative z-30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] flex items-center justify-center font-bold text-xs uppercase">
                                                        {admin.name.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-[var(--color-text)]">{admin.name}<InactiveBadge show={admin.is_active === false} /></span>
                                                            {admin._pendingSync && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                    Pending Sync
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-muted)]">{admin.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                                    admin.role === 'platform_admin'
                                                        ? 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]'
                                                        : 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]'
                                                }`}>
                                                    {admin.role === 'platform_admin' ? 'Platform Admin' : 'School Admin'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {schoolName ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 rounded-md bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)]">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-[var(--color-text)]">{schoolName}</span>
                                                            {admin.administered_school?.city && (
                                                                <span className="text-xs text-[var(--color-muted)] ml-1.5">
                                                                    ({admin.administered_school.city})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-[var(--color-muted)] bg-[var(--color-background)] border border-[var(--color-border)]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)] inline-block" />
                                                        <span>Not assigned</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (openActionDropdownId === admin.id) {
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
                                                            setOpenActionDropdownId(admin.id);
                                                        }}
                                                        className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                                                            openActionDropdownId === admin.id
                                                                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                                                                : 'bg-[var(--color-surface)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)]'
                                                        }`}
                                                        title="Admin Actions"
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
                                                                openActionDropdownId === admin.id ? 'rotate-180' : ''
                                                            }`}
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>

                                                    {openActionDropdownId === admin.id && dropdownCoords && (
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
                                                                        openEditModal(admin);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] hover:text-[var(--color-primary-light)] transition-colors cursor-pointer text-left"
                                                                >
                                                                    <svg className="w-3.5 h-3.5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                    <span>Edit Admin</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setOpenActionDropdownId(null);
                                                                        setDropdownCoords(null);
                                                                        void handleToggleActive(admin);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-10)] transition-colors cursor-pointer text-left"
                                                                >
                                                                    <span className={`w-2 h-2 rounded-full ${admin.is_active === false ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                    <span>{admin.is_active === false ? 'Activate' : 'Deactivate'}</span>
                                                                </button>

                                                                <div className="h-px bg-[var(--color-border)] my-1" />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setOpenActionDropdownId(null);
                                                                        setDropdownCoords(null);
                                                                        void handleDeleteAdmin(admin);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-10)] transition-colors cursor-pointer text-left"
                                                                >
                                                                    <svg className="w-3.5 h-3.5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                    <span>Delete Admin</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        currentPage={page}
                        totalItems={filteredAdmins.length}
                        itemsPerPage={50}
                        onPageChange={setPage}
                        itemLabel="admins"
                    />
                </div>
            )}

            {/* Create / Edit School Admin Modal */}
            {isCreateModalOpen && (
                <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div {...panel} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-background)]">
                            <h3 className="font-bold text-lg text-[var(--color-text)] flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>{editingAdmin ? 'Edit School Administrator' : 'Create New School Admin'}</span>
                            </h3>
                            <button
                                onClick={() => { setIsCreateModalOpen(false); resetForm(); }}
                                className="text-[var(--color-muted)] hover:text-[var(--color-text)] p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Dr. Sarah Okon"
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="admin@school.com"
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    {editingAdmin ? 'Change Password (leave blank to keep current)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingAdmin}
                                    minLength={8}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    Assign to School
                                </label>
                                <select
                                    value={formData.school_id}
                                    onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                                >
                                    <option value="">-- Select School (Optional) --</option>
                                    {schools.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} {s.city ? `(${s.city})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-[var(--color-muted)] mt-1">
                                    This gives the admin management privileges for learners, classes, subjects, and questions at this school.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                                <button
                                    type="button"
                                    onClick={() => { setIsCreateModalOpen(false); resetForm(); }}
                                    className="px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting && (
                                        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    )}
                                    <span>{submitting ? 'Saving...' : editingAdmin ? 'Update School Admin' : 'Create School Admin'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
