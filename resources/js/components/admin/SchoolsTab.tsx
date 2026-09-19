import React, { useState } from 'react';
import type { SchoolItem } from '@/types/admin';
import SchoolMetrics from './schools/SchoolMetrics';
import SchoolFilterBar from './schools/SchoolFilterBar';
import SchoolCard from './schools/SchoolCard';
import SchoolFormModal, { type SchoolFormData } from './schools/SchoolFormModal';
import SchoolDeleteModal from './schools/SchoolDeleteModal';

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
    const [categoryFilter, setCategoryFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
    const [deletingSchool, setDeletingSchool] = useState<SchoolItem | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState<SchoolFormData>({
        name: '',
        slug: '',
        category: 'senior',
        category_ids: [3],
        address: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        description: '',
        is_active: true,
    });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const resetForm = () => {
        setFormData({
            name: '',
            slug: '',
            category: 'senior',
            category_ids: [3],
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
        const derivedIds = school.category_ids && school.category_ids.length > 0
            ? school.category_ids
            : school.category === 'primary' ? [1]
            : school.category === 'junior' ? [2]
            : school.category === 'combined' ? [1, 2]
            : [3];

        setFormData({
            name: school.name,
            slug: school.slug || '',
            category: school.category || (derivedIds.length > 1 ? 'combined' : 'senior'),
            category_ids: derivedIds,
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
                headers: getAuthHeaders(),
                credentials: 'include',
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
        } catch {
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
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (res.ok) {
                showToast('School removed successfully', 'success');
                setDeletingSchool(null);
                onRefresh();
            } else {
                const data = await res.json();
                showToast(data.message || 'Failed to delete school', 'error');
            }
        } catch {
            showToast('Network error while deleting school', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const cities = Array.from(new Set(schools.map((s) => s.city).filter(Boolean))) as string[];

    const filteredSchools = schools.filter((s) => {
        const matchesSearch =
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.city && s.city.toLowerCase().includes(search.toLowerCase())) ||
            (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
            (s.admin?.name && s.admin.name.toLowerCase().includes(search.toLowerCase()));

        const matchesCity = !cityFilter || s.city === cityFilter;
        const matchesCategory =
            !categoryFilter ||
            (s.category && s.category.toLowerCase() === categoryFilter.toLowerCase()) ||
            (categoryFilter === 'primary' && (s.category_ids || []).includes(1)) ||
            (categoryFilter === 'junior' && (s.category_ids || []).includes(2)) ||
            (categoryFilter === 'senior' && (s.category_ids || []).includes(3)) ||
            (categoryFilter === 'combined' && (s.category_ids || []).length > 1);
        const matchesStatus =
            statusFilter === 'all'
                ? true
                : statusFilter === 'active'
                ? s.is_active !== false
                : s.is_active === false;

        return matchesSearch && matchesCity && matchesCategory && matchesStatus;
    });

    const activeCount = schools.filter((s) => s.is_active !== false).length;
    const assignedAdminCount = schools.filter((s) => !!s.admin).length;

    return (
        <div className="space-y-6">
            {/* Header Metrics */}
            <SchoolMetrics
                totalSchools={schools.length}
                activeCount={activeCount}
                assignedAdminCount={assignedAdminCount}
            />

            {/* Actions & Filters Bar */}
            <SchoolFilterBar
                search={search}
                setSearch={setSearch}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                cityFilter={cityFilter}
                setCityFilter={setCityFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                cities={cities}
                onOpenRegisterModal={() => {
                    resetForm();
                    setIsCreateModalOpen(true);
                }}
            />

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
                        <SchoolCard
                            key={school.id}
                            school={school}
                            onEdit={openEditModal}
                            onDelete={(s) => setDeletingSchool(s)}
                        />
                    ))}
                </div>
            )}

            {/* Create / Edit School Modal */}
            <SchoolFormModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                editingSchool={editingSchool}
                form={formData}
                setForm={setFormData}
                submitting={submitting}
                onSubmit={handleSaveSchool}
            />

            {/* Delete Confirmation Modal */}
            <SchoolDeleteModal
                deletingSchool={deletingSchool}
                submitting={submitting}
                onClose={() => setDeletingSchool(null)}
                onConfirmDelete={handleDeleteSchool}
            />
        </div>
    );
}
