import React, { useState, useEffect } from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';
import type { SchoolItem } from '@/types/admin';
import { executeAdminAction, setAccountActive } from '@/services/AdminOfflineService';
import SchoolMetrics from './schools/SchoolMetrics';
import SchoolFilterBar from './schools/SchoolFilterBar';
import SchoolCard from './schools/SchoolCard';
import SchoolFormModal, { type SchoolFormData } from './schools/SchoolFormModal';
import Pagination from '@/components/common/Pagination';
import { SkeletonCardGrid } from '@/components/common/Skeleton';

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
    const [page, setPage] = useState(1);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
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
        const derivedIds = school.category_ids && school.category_ids.length > 0 ? school.category_ids : [3];
        const selectValue = derivedIds.length > 1 ? 'combined' : ({ 1: 'primary', 2: 'junior' } as Record<number, string>)[derivedIds[0]] ?? 'senior';

        setFormData({
            name: school.name,
            slug: school.slug || '',
            category: selectValue,
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
        if (!(await confirmAction(editingSchool
            ? { title: 'Save changes?', message: `Save changes to "${formData.name}"?`, confirmLabel: 'Save changes' }
            : { title: 'Create school?', message: `Create school "${formData.name}"?`, confirmLabel: 'Create school' }))) return;
        setSubmitting(true);

        const endpoint = editingSchool
            ? `/api/v1/admin/schools/${editingSchool.id}`
            : '/api/v1/admin/schools';
        const method = editingSchool ? 'PATCH' : 'POST';
        const tempId = editingSchool ? String(editingSchool.id) : `temp_school_${Date.now()}`;

        const optimisticSchool: SchoolItem = {
            id: editingSchool ? editingSchool.id : Date.now(),
            name: formData.name,
            slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
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
            payload: (({ category: _selectValue, ...rest }) => rest)(formData),
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

    const handleDeleteSchool = async (school: SchoolItem) => {
        if (!(await confirmAction({ title: 'Delete school?', message: `Delete ${school.name}? This unlinks its classes and members. To stop its users signing in without deleting anything, deactivate it instead.`, confirmLabel: 'Delete school', tone: 'danger' }))) return;
        setSubmitting(true);

        const res = await executeAdminAction({
            table: 'adminSchools',
            action: 'delete',
            recordId: String(school.id),
            endpoint: `/api/v1/admin/schools/${school.id}`,
            method: 'DELETE',
        });

        setSubmitting(false);
        if (res.success) {
            showToast(res.message || 'School removed successfully', 'success');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete school', 'error');
        }
    };

    const cities = Array.from(new Set(schools.map((s) => s.city).filter(Boolean))) as string[];

    // Reset to page 1 on filter changes
    useEffect(() => {
        setPage(1);
    }, [search, categoryFilter, cityFilter, statusFilter]);

    const filteredSchools = schools.filter((s) => {
        const matchesSearch =
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.city && s.city.toLowerCase().includes(search.toLowerCase())) ||
            (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
            (s.admin?.name && s.admin.name.toLowerCase().includes(search.toLowerCase()));

        const matchesCity = !cityFilter || s.city === cityFilter;
        const matchesCategory =
            !categoryFilter ||
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

    const paginatedSchools = filteredSchools.slice((page - 1) * 50, page * 50);

    const activeCount = schools.filter((s) => s.is_active !== false).length;
    const assignedAdminCount = schools.filter((s) => !!s.admin).length;


    const handleToggleActive = async (school: SchoolItem) => {
        const activate = school.is_active === false;
        if (!activate && !(await confirmAction({ title: 'Deactivate school?', message: `${school.name}'s school admin, teachers and learners won't be able to sign in until you activate it again. Nothing is deleted.`, confirmLabel: 'Deactivate school', tone: 'warning' }))) return;
        const res = await setAccountActive('school', 'adminSchools', school, activate);
        showToast(res.success ? (res.message || (activate ? 'School activated' : 'School deactivated')) : (res.error || 'Could not change the school status'), res.success ? 'success' : 'error');
        if (res.success) onRefresh();
    };

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
                <SkeletonCardGrid count={6} />
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
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedSchools.map((school) => (
                            <SchoolCard
                                key={school.id}
                                school={school}
                                onEdit={openEditModal}
                                onDelete={(s) => void handleDeleteSchool(s)}
                                onToggleActive={handleToggleActive}
                            />
                        ))}
                    </div>

                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <Pagination
                            currentPage={page}
                            totalItems={filteredSchools.length}
                            itemsPerPage={50}
                            onPageChange={setPage}
                            itemLabel="schools"
                        />
                    </div>
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

        </div>
    );
}
