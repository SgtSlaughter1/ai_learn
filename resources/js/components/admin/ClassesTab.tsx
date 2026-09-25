import React, { useState } from 'react';
import type { ClassItem, ClassLearner, SchoolItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';
import ClassFilterBar from './classes/ClassFilterBar';
import ClassCard from './classes/ClassCard';
import ClassFormModal, { type ClassFormData } from './classes/ClassFormModal';
import ClassRosterModal from './classes/ClassRosterModal';

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
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
    const [classForm, setClassForm] = useState<ClassFormData>({
        school_id: '',
        name: '',
        grade_level: 'SS1',
        section: '',
        description: '',
    });

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
        const endpoint = editingClass
            ? `/api/v1/admin/classes/${editingClass.id}`
            : '/api/v1/admin/classes';
        const method = editingClass ? 'PUT' : 'POST';
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
            showToast(res.message || 'Class saved successfully', 'success');
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
    };

    const handleDeleteClass = async (cls: ClassItem) => {
        if (!confirm(`Are you sure you want to delete class ${cls.name}?`)) return;
        const res = await executeAdminAction({
            table: 'adminClasses',
            action: 'delete',
            recordId: String(cls.id),
            endpoint: `/api/v1/admin/classes/${cls.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Class deleted');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete class', 'error');
        }
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
            const data = await res.json();
            setClassLearners(data.learners || []);
        } catch (err) {
            console.error(err);
            showToast('Failed to load class roster', 'error');
        } finally {
            setLoadingClassLearners(false);
        }
    };

    const handleEnrollLearnerInClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassForRoster || !enrollLearnerEmail.trim()) return;

        setEnrollingLearner(true);
        try {
            const res = await fetch(`/api/v1/admin/classes/${selectedClassForRoster.id}/enroll`, {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ email: enrollLearnerEmail.trim() }),
            });

            const data = await res.json();
            if (res.ok) {
                showToast('Learner enrolled successfully');
                setEnrollLearnerEmail('');
                openClassRoster(selectedClassForRoster);
                onRefresh();
            } else {
                showToast(data.error || data.message || 'Failed to enroll learner', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error enrolling learner', 'error');
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

        try {
            const res = await fetch(`/api/v1/admin/classes/${selectedClassForRoster.id}/learners/${learnerId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (res.ok) {
                showToast('Learner removed from class');
                openClassRoster(selectedClassForRoster);
                onRefresh();
            } else {
                showToast('Failed to remove learner', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error removing learner', 'error');
        }
    };

    const filteredClasses = classes.filter((cls) => {
        if (classSchoolFilter && String(cls.school_id) !== classSchoolFilter) return false;
        if (classGradeFilter && cls.grade_level !== classGradeFilter) return false;
        return true;
    });

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
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className="h-36 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-pulse"
                        />
                    ))}
                </div>
            ) : filteredClasses.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    <p className="font-bold text-[var(--color-text)]">No classes found</p>
                    <p className="text-xs mt-1">Create classes for JSS1-SS3 cohorts to organize and monitor your students.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClasses.map((cls) => (
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
                        />
                    ))}
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
