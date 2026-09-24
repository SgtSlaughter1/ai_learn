import React, { useState } from 'react';
import type { SchoolItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';
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

        const endpoint = editingSchool
            ? `/api/v1/admin/schools/${editingSchool.id}`
            : '/api/v1/admin/schools';
        const method = editingSchool ? 'PUT' : 'POST';
        const tempId = editingSchool ? String(editingSchool.id) : `temp_school_${Date.now()}`;

        const optimisticSchool: SchoolItem = {
            id: editingSchool ? editingSchool.id : Date.now(),
            name: formData.name,
            slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category: formData.category,
            category_ids: formData.category_ids,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null,
            email: formData.email || null,
            description: formData.description || null,
            is_active: formData.is_active,
            learners_count: editingSchool ? editingSchool.learners_count : 0,
            classes_count: editingSchool ? editingSchool.classes_count : 0,
            _pendingSync: true,
        };

        const res = await executeAdminAction({
            table: 'adminSchools',
            action: editingSchool ? 'update' : 'insert',
            recordId: tempId,
            endpoint,
            method,
            payload: formData,
            optimisticRecord: optimisticSchool,
        });

        setSubmitting(false);
        if (res.success) {
            showToast(res.message || (editingSchool ? 'School updated successfully' : 'School created successfully'), 'success');
            setIsCreateModalOpen(false);
            resetForm();
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save school', 'error');
        }
    };

    const handleDeleteSchool = async () => {
        if (!deletingSchool) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminSchools',
            action: 'delete',
            recordId: String(deletingSchool.id),
            endpoint: `/api/v1/admin/schools/${deletingSchool.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);
        if (res.success) {
            showToast(res.message || 'School removed successfully', 'success');
            setDeletingSchool(null);
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete school', 'error');
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
