import React, { useState, useEffect } from 'react';
import type { ClassItem, ClassLearner, SchoolItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';
import { db } from '@/db/database';
import ClassFilterBar from './classes/ClassFilterBar';
import ClassCard from './classes/ClassCard';
import ClassFormModal, { type ClassFormData } from './classes/ClassFormModal';
import ClassRosterModal from './classes/ClassRosterModal';
import Pagination from '@/components/common/Pagination';
import { SkeletonCardGrid } from '@/components/common/Skeleton';

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
    const [page, setPage] = useState(1);
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [isSavingClass, setIsSavingClass] = useState(false);
    const [deletingClassId, setDeletingClassId] = useState<number | null>(null);
    const [classForm, setClassForm] = useState<ClassFormData>({
        school_id: '',
        name: '',
        grade_level: 'SS1',
        section: '',
        description: '',
    });

    // Reset page on filter changes
    useEffect(() => {
        setPage(1);
    }, [classSchoolFilter, classGradeFilter]);

    // Class Roster Modal
    const [selectedClassForRoster, setSelectedClassForRoster] = useState<ClassItem | null>(null);
    const [classLearners, setClassLearners] = useState<ClassLearner[]>([]);
    const [loadingClassLearners, setLoadingClassLearners] = useState(false);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [enrollLearnerEmail, setEnrollLearnerEmail] = useState('');
    const [enrollingLearner, setEnrollingLearner] = useState(false);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const handleSaveClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingClass) return;
        setIsSavingClass(true);

        try {
            const endpoint = editingClass
                ? `/api/v1/admin/classes/${editingClass.id}`
                : '/api/v1/admin/classes';
            const method = editingClass ? 'PATCH' : 'POST';
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
                showToast(res.message || (res.offline ? 'Class saved locally (Pending Sync)' : 'Class saved successfully'), 'success');
                setIsClassModalOpen(false);
                setEditingClass(null);
                setClassForm({
                    school_id: schools[0]?.id ? String(schools[0].id) : '',
                    name: '',
                    grade_level: 'SS1',
                    section: '',
                    description: '',
                });
                onRefresh();
            } else {
                showToast(res.error || 'Failed to save class', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error saving class', 'error');
        } finally {
            setIsSavingClass(false);
        }
    };

    const handleDeleteClass = async (cls: ClassItem) => {
        if (!confirm(`Are you sure you want to delete class ${cls.name}?`)) return;
        setDeletingClassId(cls.id);
        try {
            const res = await executeAdminAction({
                table: 'adminClasses',
                action: 'delete',
                recordId: String(cls.id),
                endpoint: `/api/v1/admin/classes/${cls.id}`,
                method: 'DELETE',
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Class deleted locally (Pending Sync)' : 'Class deleted successfully'), 'success');
                onRefresh();
            } else {
                showToast(res.error || 'Failed to delete class', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error deleting class', 'error');
        } finally {
            setDeletingClassId(null);
        }
    };

    // The roster of each class opened online is kept on the device for offline viewing.
    const rosterCacheKey = (classId: number | string) => `cached_admin_roster_${classId}`;
    const readCachedRoster = (classId: number | string): ClassLearner[] => {
        try {
            const cached = JSON.parse(localStorage.getItem(rosterCacheKey(classId)) || '[]');
            return Array.isArray(cached) ? cached : [];
        } catch {
            return [];
        }
    };
    const updateRoster = (classId: number | string, learners: ClassLearner[]) => {
        setClassLearners(learners);
        try {
            localStorage.setItem(rosterCacheKey(classId), JSON.stringify(learners));
        } catch {}
    };

    const openClassRoster = async (cls: ClassItem) => {
        setSelectedClassForRoster(cls);
        setIsRosterModalOpen(true);
        setLoadingClassLearners(true);
        try {
            const res = await fetch(`/api/v1/admin/classes/${cls.id}/learners`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`Roster request failed: ${res.status}`);
            const data = await res.json();
            updateRoster(cls.id, data.learners || []);
        } catch {
            const cached = readCachedRoster(cls.id);
            setClassLearners(cached);
            if (cached.length === 0) {
                showToast("This class roster hasn't been saved for offline use yet", 'error');
            }
        } finally {
            setLoadingClassLearners(false);
        }
    };

    const handleEnrollLearnerInClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassForRoster || !enrollLearnerEmail.trim()) return;

        const cls = selectedClassForRoster;
        const email = enrollLearnerEmail.trim();
        setEnrollingLearner(true);
        try {
            const res = await executeAdminAction({
                table: 'classMemberships',
                action: 'insert',
                recordId: `${cls.id}:${email}`,
                endpoint: `/api/v1/admin/classes/${cls.id}/enroll`,
                method: 'POST',
                payload: { email },
            });

            if (!res.success) {
                showToast(res.error || 'Failed to enroll learner', 'error');
                return;
            }

            setEnrollLearnerEmail('');
            if (res.synced) {
                showToast('Learner enrolled successfully');
                openClassRoster(cls);
                onRefresh();
            } else {
                // Saved to sync later: show the learner in the roster now.
                const known = await db.adminLearners.where('email').equals(email).first().catch(() => undefined);
                const pending: ClassLearner = {
                    id: known?.id ? String(known.id) : `pending_${email}`,
                    name: known?.name || email,
                    email,
                    level: 1,
                    total_xp: 0,
                    streak: 0,
                    topics_covered: 0,
                    avg_mastery: 0,
                    total_attempted: 0,
                    total_correct: 0,
                };
                const current = classLearners.filter((l) => l.email !== email);
                updateRoster(cls.id, [...current, pending]);
                showToast(res.message || 'Saved offline. The enrolment will sync automatically.');
            }
        } finally {
            setEnrollingLearner(false);
        }
    };

    const handleCreateNewLearnerInClass = async (learnerData: { name: string; email: string; password?: string; student_id?: string }) => {
        if (!selectedClassForRoster) return;
        setEnrollingLearner(true);

        const payload = {
            name: learnerData.name,
            email: learnerData.email,
            password: learnerData.password || 'password123',
            school_id: selectedClassForRoster.school_id,
            grade_level: selectedClassForRoster.grade_level,
            class_id: selectedClassForRoster.id,
            student_id: learnerData.student_id || null,
        };

        const res = await executeAdminAction({
            table: 'adminLearners',
            action: 'insert',
            recordId: `temp_lrn_${Date.now()}`,
            endpoint: '/api/v1/admin/learners',
            method: 'POST',
            payload,
        });

        if (res.success) {
            showToast('New learner registered and added to class roster!', 'success');
            openClassRoster(selectedClassForRoster);
            onRefresh();
        } else {
            showToast(res.error || 'Failed to create learner', 'error');
        }
        setEnrollingLearner(false);
    };

    const handleRemoveLearnerFromClass = async (learnerId: string) => {
        if (!selectedClassForRoster) return;
        if (!confirm('Remove this learner from the class?')) return;

        const cls = selectedClassForRoster;
        // Keyed by email like the enrolment, so removing someone enrolled offline (not yet
        // synced) cancels that enrolment in the queue instead of sending both.
        const email = classLearners.find((l) => l.id === learnerId)?.email ?? learnerId;
        const res = await executeAdminAction({
            table: 'classMemberships',
            action: 'delete',
            recordId: `${cls.id}:${email}`,
            endpoint: `/api/v1/admin/classes/${cls.id}/learners/${learnerId}`,
            method: 'DELETE',
        });

        if (!res.success) {
            showToast(res.error || 'Failed to remove learner', 'error');
            return;
        }
        if (res.synced) {
            showToast('Learner removed from class');
            openClassRoster(cls);
            onRefresh();
        } else {
            updateRoster(cls.id, classLearners.filter((l) => l.id !== learnerId));
            showToast(res.message || 'Saved offline. The change will sync automatically.');
        }
    };

    const filteredClasses = classes.filter((cls) => {
        if (classSchoolFilter && String(cls.school_id) !== classSchoolFilter) return false;
        if (classGradeFilter && cls.grade_level !== classGradeFilter) return false;
        return true;
    });

    const paginatedClasses = filteredClasses.slice((page - 1) * 50, page * 50);

    return (
        <div className="space-y-6">
            <ClassFilterBar
                schools={schools}
                classSchoolFilter={classSchoolFilter}
                setClassSchoolFilter={setClassSchoolFilter}
                classGradeFilter={classGradeFilter}
                setClassGradeFilter={setClassGradeFilter}
                onOpenCreateModal={() => {
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
            />

            {loading ? (
                <SkeletonCardGrid count={6} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
            ) : filteredClasses.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    <p className="font-bold text-[var(--color-text)]">No classes found</p>
                    <p className="text-xs mt-1">Create classes for JSS1-SS3 cohorts to organize and monitor your students.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {paginatedClasses.map((cls) => (
                            <ClassCard
                                key={cls.id}
                                classItem={cls}
                                onViewRoster={openClassRoster}
                                onEdit={(item) => {
                                    setEditingClass(item);
                                    setClassForm({
                                        school_id: String(item.school_id),
                                        name: item.name,
                                        grade_level: item.grade_level,
                                        section: item.section || '',
                                        description: item.description || '',
                                    });
                                    setIsClassModalOpen(true);
                                }}
                                onDelete={handleDeleteClass}
                                isDeleting={deletingClassId === cls.id}
                            />
                        ))}
                    </div>

                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <Pagination
                            currentPage={page}
                            totalItems={filteredClasses.length}
                            itemsPerPage={50}
                            onPageChange={setPage}
                            itemLabel="classes"
                        />
                    </div>
                </div>
            )}

            {/* Modal: Class Create / Edit */}
            <ClassFormModal
                isOpen={isClassModalOpen}
                onClose={() => setIsClassModalOpen(false)}
                editingClass={editingClass}
                form={classForm}
                setForm={setClassForm}
                schools={schools}
                onSubmit={handleSaveClass}
                isSubmitting={isSavingClass}
            />

            {/* Modal: Class Roster & Enrollment */}
            <ClassRosterModal
                isOpen={isRosterModalOpen}
                selectedClass={selectedClassForRoster}
                classLearners={classLearners}
                loadingClassLearners={loadingClassLearners}
                enrollLearnerEmail={enrollLearnerEmail}
                setEnrollLearnerEmail={setEnrollLearnerEmail}
                enrollingLearner={enrollingLearner}
                onClose={() => setIsRosterModalOpen(false)}
                onEnrollLearner={handleEnrollLearnerInClass}
                onCreateLearner={handleCreateNewLearnerInClass}
                onRemoveLearner={handleRemoveLearnerFromClass}
            />
        </div>
    );
}
