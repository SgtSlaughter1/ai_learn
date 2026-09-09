import { useState } from 'react';
import type { SchoolItem } from '@/types/admin';

interface SchoolsTabProps {
    schools: SchoolItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function SchoolsTab({
    schools,
    loading,
    onRefresh,
    showToast,
}: SchoolsTabProps) {
    const [search, setSearch] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
    const [deletingSchool, setDeletingSchool] = useState<SchoolItem | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        address: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        description: '',
        is_active: true,
    });

    const resetForm = () => {
        setFormData({
            name: '',
            slug: '',
            address: '',
            city: '',
            state: '',
            phone: '',
            email: '',
            description: '',
            is_active: true,
        });
        setEditingSchool(null);
    };

    const openEditModal = (school: SchoolItem) => {
        setEditingSchool(school);
        setFormData({
            name: school.name,
            slug: school.slug || '',
            address: school.address || '',
            city: school.city || '',
            state: school.state || '',
            phone: school.phone || '',
            email: school.email || '',
            description: school.description || '',
            is_active: school.is_active ?? true,
        });
        setIsCreateModalOpen(true);
    };

    const handleSaveSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const url = editingSchool
                ? `/api/v1/admin/schools/${editingSchool.id}`
                : '/api/v1/admin/schools';
            const method = editingSchool ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                showToast(
                    editingSchool ? 'School updated successfully' : 'School created successfully',
                    'success'
                );
                setIsCreateModalOpen(false);
                resetForm();
                onRefresh();
            } else {
                showToast(data.message || data.error || 'Failed to save school', 'error');
            }
        } catch (err) {
            showToast('Network error while saving school', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSchool = async () => {
        if (!deletingSchool) return;
        setSubmitting(true);

        try {
            const res = await fetch(`/api/v1/admin/schools/${deletingSchool.id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
            });

            if (res.ok) {
                showToast('School removed successfully', 'success');
                setDeletingSchool(null);
                onRefresh();
            } else {
                const data = await res.json();
                showToast(data.message || 'Failed to delete school', 'error');
            }
        } catch (err) {
            showToast('Network error while deleting school', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const cities = Array.from(new Set(schools.map(s => s.city).filter(Boolean))) as string[];

    const filteredSchools = schools.filter(s => {
        const matchesSearch =
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.city && s.city.toLowerCase().includes(search.toLowerCase())) ||
            (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
            (s.admin?.name && s.admin.name.toLowerCase().includes(search.toLowerCase()));
        
        const matchesCity = !cityFilter || s.city === cityFilter;
        const matchesStatus =
            statusFilter === 'all'
                ? true
                : statusFilter === 'active'
                ? s.is_active !== false
                : s.is_active === false;

        return matchesSearch && matchesCity && matchesStatus;
    });

    const activeCount = schools.filter(s => s.is_active !== false).length;
    const assignedAdminCount = schools.filter(s => !!s.admin).length;

    return (
        <div className="space-y-6">
            {/* Header Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Total Schools</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{schools.length}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Platform registered campuses</p>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Active Status</p>
                    <p className="text-3xl font-extrabold text-[var(--color-success)] mt-1">{activeCount}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Operational institutions</p>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Assigned School Admins</p>
                    <p className="text-3xl font-extrabold text-[var(--color-primary)] mt-1">{assignedAdminCount}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Schools with designated admin</p>
                </div>
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Needs School Admin</p>
                    <p className="text-3xl font-extrabold text-[var(--color-accent)] mt-1">{schools.length - assignedAdminCount}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">Unassigned leadership</p>
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
                            placeholder="Search by school name, city, school admin..."
                            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                        <span className="absolute left-3.5 top-2.5 text-[var(--color-muted)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                    </div>

                    {cities.length > 0 && (
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                        >
                            <option value="">All Cities</option>
                            {cities.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </select>
                </div>

                <button
                    onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Register New School</span>
                </button>
            </div>

            {/* Schools Grid / List */}
            {loading ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                    <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-[var(--color-muted)]">Loading registered schools...</p>
                </div>
            ) : filteredSchools.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-5)] text-[var(--color-primary)] flex items-center justify-center mx-auto mb-3 border border-[var(--color-border)]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text)] mt-3">No Schools Found</h3>
                    <p className="text-sm text-[var(--color-muted)] mt-1 max-w-md mx-auto">
                        {search || cityFilter || statusFilter !== 'all'
                            ? 'No schools match your search filters.'
                            : 'No schools have been registered yet. Click "Register New School" to start.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map((school) => (
                        <div
                            key={school.id}
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] flex items-center justify-center font-bold text-lg">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[var(--color-text)] text-base group-hover:text-[var(--color-primary)] transition-colors">
                                                {school.name}
                                            </h3>
                                            <p className="text-xs text-[var(--color-muted)]">
                                                {[school.city, school.state].filter(Boolean).join(', ') || 'Location unset'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        school.is_active !== false
                                            ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success-20)]'
                                            : 'bg-[var(--color-error-10)] text-[var(--color-error)] border border-[var(--color-error-20)]'
                                    }`}>
                                        {school.is_active !== false ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                {school.description && (
                                    <p className="text-xs text-[var(--color-muted)] mt-3 line-clamp-2">
                                        {school.description}
                                    </p>
                                )}

                                {/* Admin Info Box */}
                                <div className="mt-4 p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span>School Administrator</span>
                                    </p>
                                    {school.admin ? (
                                        <div className="mt-1">
                                            <p className="text-xs font-bold text-[var(--color-text)]">{school.admin.name}</p>
                                            <p className="text-[11px] text-[var(--color-muted)] truncate">{school.admin.email}</p>
                                        </div>
                                    ) : (
                                        <div className="mt-1 flex items-center justify-between">
                                            <span className="text-xs text-[var(--color-muted)] italic">No school admin assigned</span>
                                        </div>
                                    )}
                                </div>

                                {/* Counts / Metadata */}
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                                    <div>
                                        <span className="font-bold text-[var(--color-text)]">{school.classes_count ?? (school.classes?.length || 0)}</span> Classes
                                    </div>
                                    <div>
                                        <span className="font-bold text-[var(--color-text)]">{school.learners_count ?? 0}</span> Learners
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">
                                <button
                                    onClick={() => openEditModal(school)}
                                    className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                >
                                    Edit School
                                </button>
                                <button
                                    onClick={() => setDeletingSchool(school)}
                                    className="px-3 py-1.5 text-xs font-semibold text-[var(--color-error)] hover:bg-[var(--color-error-5)] border border-transparent hover:border-[var(--color-error-20)] rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit School Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-background)]">
                            <h3 className="font-bold text-lg text-[var(--color-text)] flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{editingSchool ? 'Edit School Details' : 'Register New School'}</span>
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

                        <form onSubmit={handleSaveSchool} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    School Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. AILEARN Academy"
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="e.g. Lagos"
                                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                        State / Region
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        placeholder="e.g. Lagos State"
                                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    Physical Address
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="e.g. 12 Innovation Way"
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="admin@school.edu"
                                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+234 800 000 0000"
                                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1 uppercase tracking-wider">
                                    Description / Mission
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief details about the institution..."
                                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">
                                    Active (Operational and accessible by staff)
                                </label>
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
                                    {submitting ? 'Saving...' : editingSchool ? 'Update School' : 'Create School'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingSchool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-error-10)] text-[var(--color-error)] flex items-center justify-center mx-auto border border-[var(--color-error-20)]">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">Delete {deletingSchool.name}?</h3>
                            <p className="text-sm text-[var(--color-muted)] mt-1">
                                Are you sure you want to remove this school? This will unlink associated classes and members.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-3">
                            <button
                                onClick={() => setDeletingSchool(null)}
                                className="px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSchool}
                                disabled={submitting}
                                className="px-5 py-2 text-sm font-semibold bg-[var(--color-error)] text-white hover:opacity-90 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                            >
                                {submitting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
