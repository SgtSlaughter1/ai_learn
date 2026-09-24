import { useState } from 'react';
import type { SchoolAdminItem, SchoolItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';

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

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<SchoolAdminItem | null>(null);
    const [deletingAdmin, setDeletingAdmin] = useState<SchoolAdminItem | null>(null);
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
        setSubmitting(true);

        const endpoint = editingAdmin
            ? `/api/v1/admin/school-admins/${editingAdmin.id}`
            : '/api/v1/admin/school-admins';
        const method = editingAdmin ? 'PUT' : 'POST';
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

    const handleDeleteAdmin = async () => {
        if (!deletingAdmin) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminSchoolAdmins',
            action: 'delete',
            recordId: String(deletingAdmin.id),
            endpoint: `/api/v1/admin/school-admins/${deletingAdmin.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);
        if (res.success) {
            showToast(res.message || 'School admin removed successfully', 'success');
            setDeletingAdmin(null);
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete school admin', 'error');
        }
    };

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

    const assignedCount = admins.filter(a => !!a.administered_school || !!a.school_id).length;
    const unassignedCount = admins.length - assignedCount;

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
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create School Admin</span>
                </button>
            </div>

            {/* Admin Table / List */}
            {loading ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                    <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-[var(--color-muted)]">Loading school administrators...</p>
                </div>
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
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--color-background)] border-b border-[var(--color-border)] text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                <tr>
                                    <th className="px-6 py-4">Administrator</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Assigned School</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {filteredAdmins.map((admin) => {
                                    const schoolName = admin.administered_school?.name ||
                                        schools.find(s => s.id === admin.school_id)?.name;

                                    return (
                                        <tr key={admin.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] flex items-center justify-center font-bold text-xs uppercase">
                                                        {admin.name.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-[var(--color-text)]">{admin.name}</span>
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
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(admin)}
                                                        className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingAdmin(admin)}
                                                        className="px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-5)] border border-transparent hover:border-[var(--color-error-20)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create / Edit School Admin Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
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
                                    minLength={6}
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
                                    className="px-5 py-2 text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : editingAdmin ? 'Update School Admin' : 'Create School Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-error-10)] text-[var(--color-error)] flex items-center justify-center mx-auto border border-[var(--color-error-20)]">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">Remove {deletingAdmin.name}?</h3>
                            <p className="text-sm text-[var(--color-muted)] mt-1">
                                Are you sure you want to remove this school administrator? Their school assignments will be detached.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-3">
                            <button
                                onClick={() => setDeletingAdmin(null)}
                                className="px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAdmin}
                                disabled={submitting}
                                className="px-5 py-2 text-sm font-semibold bg-[var(--color-error)] text-white hover:opacity-90 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                            >
                                {submitting ? 'Deleting...' : 'Confirm Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
