import React, { useState } from 'react';
import type { SubjectItem, TopicItem, ClassItem } from '@/types/admin';
import { executeAdminAction, cacheAdminTopics, getCachedAdminTopics } from '@/services/AdminOfflineService';
import SubjectFilterBar from './subjects/SubjectFilterBar';
import SubjectCard from './subjects/SubjectCard';
import SubjectFormModal, { type SubjectFormData } from './subjects/SubjectFormModal';
import TopicManagerModal from './subjects/TopicManagerModal';
import TopicFormModal, { type TopicFormData } from './subjects/TopicFormModal';
import { SkeletonCardGrid } from '@/components/common/Skeleton';

interface Props {
    subjects: SubjectItem[];
    classes?: ClassItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
    school?: { category?: string | null; category_ids?: number[] | null; allowed_grade_levels?: string[] | null } | null;
    allowedGradeLevels?: string[];
    isTeacher?: boolean;
}

export default function SubjectsTab({
    subjects,
    classes = [],
    loading,
    onRefresh,
    showToast,
    school,
    allowedGradeLevels,
    isTeacher,
}: Props) {
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
    const [isSavingSubject, setIsSavingSubject] = useState(false);
    const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
    const [gradeFilter, setGradeFilter] = useState('');
    const [selectedClassFilter, setSelectedClassFilter] = useState<string | number>('all');
    const [subjectSearch, setSubjectSearch] = useState('');
    const [subjectForm, setSubjectForm] = useState<SubjectFormData>({
        name: '',
        slug: '',
        description: '',
        class_id: '' as string | number,
        status: 'active',
        sort_order: 0,
    });

    // Topic Manager & Topic Form State
    const [selectedSubjectForTopics, setSelectedSubjectForTopics] = useState<SubjectItem | null>(null);
    const [topicsList, setTopicsList] = useState<TopicItem[]>([]);
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
    const [isSavingTopic, setIsSavingTopic] = useState(false);
    const [topicForm, setTopicForm] = useState<TopicFormData>({
        name: '',
        slug: '',
        level: 'SS1',
        description: '',
        status: 'active',
        sort_order: 0,
    });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const handleSaveSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingSubject) return;
        setIsSavingSubject(true);

        try {
            const endpoint = editingSubject
                ? `/api/v1/admin/subjects/${editingSubject.id}`
                : '/api/v1/admin/subjects';
            const method = editingSubject ? 'PUT' : 'POST';
            const tempId = editingSubject ? String(editingSubject.id) : `temp_subj_${Date.now()}`;

            const payloadData = {
                ...subjectForm,
                class_id: subjectForm.class_id ? Number(subjectForm.class_id) : null,
            };

            const matchingClass = classes.find((c) => String(c.id) === String(subjectForm.class_id));

            const optimisticSubject: SubjectItem = {
                id: editingSubject ? editingSubject.id : Date.now(),
                name: subjectForm.name,
                slug: subjectForm.slug || subjectForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                description: subjectForm.description || null,
                class_id: subjectForm.class_id ? Number(subjectForm.class_id) : null,
                school_class: matchingClass
                    ? { id: matchingClass.id, name: matchingClass.name, grade_level: matchingClass.grade_level }
                    : null,
                class_name: matchingClass ? matchingClass.name : null,
                class_grade_level: matchingClass ? matchingClass.grade_level : null,
                status: subjectForm.status,
                sort_order: subjectForm.sort_order,
                topics_count: editingSubject ? editingSubject.topics_count : 0,
                _pendingSync: true,
            };

            const res = await executeAdminAction({
                table: 'subjects',
                action: editingSubject ? 'update' : 'insert',
                recordId: tempId,
                endpoint,
                method,
                payload: payloadData,
                optimisticRecord: optimisticSubject,
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Subject saved locally (Pending Sync)' : 'Subject saved successfully'), 'success');
                setIsSubjectModalOpen(false);
                setEditingSubject(null);
                setSubjectForm({ name: '', slug: '', description: '', class_id: '', status: 'active', sort_order: 0 });
                onRefresh();
            } else {
                showToast(res.error || 'Failed to save subject', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error saving subject', 'error');
        } finally {
            setIsSavingSubject(false);
        }
    };

    const handleDeleteSubject = async (subject: SubjectItem) => {
        if (!confirm(`Delete subject "${subject.name}"? This will also remove its topics.`)) return;
        setDeletingSubjectId(subject.id);
        try {
            const res = await executeAdminAction({
                table: 'subjects',
                action: 'delete',
                recordId: String(subject.id),
                endpoint: `/api/v1/admin/subjects/${subject.id}`,
                method: 'DELETE',
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Subject deleted locally (Pending Sync)' : 'Subject deleted successfully'), 'success');
                onRefresh();
            } else {
                showToast(res.error || 'Failed to delete subject', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error deleting subject', 'error');
        } finally {
            setDeletingSubjectId(null);
        }
    };

    const openTopicManager = async (subject: SubjectItem) => {
        setSelectedSubjectForTopics(subject);
        setLoadingTopics(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminTopics(subject.id);
                setTopicsList(cached);
                return;
            }
            const res = await fetch(`/api/v1/admin/topics?subject_id=${subject.id}`, {
                headers: getAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const items = data.topics || [];
                const merged = await cacheAdminTopics(items);
                setTopicsList(merged.filter(t => t.subject_id === subject.id));
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading topics from offline storage:', err);
            const cached = await getCachedAdminTopics(subject.id);
            setTopicsList(cached);
        } finally {
            setLoadingTopics(false);
        }
    };

    const handleSaveTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubjectForTopics || isSavingTopic) return;
        setIsSavingTopic(true);

        try {
            const endpoint = editingTopic
                ? `/api/v1/admin/topics/${editingTopic.id}`
                : '/api/v1/admin/topics';
            const method = editingTopic ? 'PUT' : 'POST';
            const tempId = editingTopic ? String(editingTopic.id) : `temp_topic_${Date.now()}`;

            const optimisticTopic: TopicItem = {
                id: editingTopic ? editingTopic.id : Date.now(),
                subject_id: selectedSubjectForTopics.id,
                name: topicForm.name,
                slug: topicForm.slug || topicForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                level: topicForm.level,
                description: topicForm.description || null,
                status: topicForm.status,
                sort_order: topicForm.sort_order,
                _pendingSync: true,
            };

            const res = await executeAdminAction({
                table: 'topics',
                action: editingTopic ? 'update' : 'insert',
                recordId: tempId,
                endpoint,
                method,
                payload: {
                    ...topicForm,
                    subject_id: selectedSubjectForTopics.id,
                },
                optimisticRecord: optimisticTopic,
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Topic saved locally (Pending Sync)' : 'Topic saved successfully'), 'success');
                setIsTopicModalOpen(false);
                setEditingTopic(null);
                setTopicForm({ name: '', slug: '', level: 'SS1', description: '', status: 'active', sort_order: 0 });
                openTopicManager(selectedSubjectForTopics);
                onRefresh();
            } else {
                showToast(res.error || 'Failed to save topic', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error saving topic', 'error');
        } finally {
            setIsSavingTopic(false);
        }
    };

    const handleDeleteTopic = async (topic: TopicItem) => {
        if (!confirm(`Delete topic "${topic.name}"?`)) return;
        try {
            const res = await executeAdminAction({
                table: 'topics',
                action: 'delete',
                recordId: String(topic.id),
                endpoint: `/api/v1/admin/topics/${topic.id}`,
                method: 'DELETE',
            });

            if (res.success) {
                showToast(res.message || (res.offline ? 'Topic deleted locally (Pending Sync)' : 'Topic deleted successfully'), 'success');
                if (selectedSubjectForTopics) openTopicManager(selectedSubjectForTopics);
                onRefresh();
            } else {
                showToast(res.error || 'Failed to delete topic', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error deleting topic', 'error');
        }
    };

    const filteredSubjects = subjects.filter((subj) => {
        if (gradeFilter) {
            const cls = classes.find((c) => c.id === subj.class_id);
            const subjGrade = cls?.grade_level || subj.class_grade_level;
            if (subjGrade && subjGrade !== gradeFilter) return false;
        }
        if (selectedClassFilter !== 'all') {
            if (selectedClassFilter === 'unassigned') {
                if (subj.class_id) return false;
            } else if (String(subj.class_id || '') !== String(selectedClassFilter)) {
                return false;
            }
        }
        if (subjectSearch) {
            const query = subjectSearch.toLowerCase();
            const nameMatch = subj.name.toLowerCase().includes(query);
            const descMatch = (subj.description || '').toLowerCase().includes(query);
            const classMatch = (subj.school_class?.name || subj.class_name || '').toLowerCase().includes(query);
            if (!nameMatch && !descMatch && !classMatch) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6">
            <SubjectFilterBar
                subjectSearch={subjectSearch}
                setSubjectSearch={setSubjectSearch}
                gradeFilter={gradeFilter}
                setGradeFilter={setGradeFilter}
                selectedClassFilter={selectedClassFilter}
                setSelectedClassFilter={setSelectedClassFilter}
                classes={classes}
                school={school}
                allowedGradeLevels={allowedGradeLevels}
                isTeacher={isTeacher}
                onOpenAddSubjectModal={() => {
                    setEditingSubject(null);
                    setSubjectForm({ name: '', slug: '', description: '', class_id: '', status: 'active', sort_order: 0 });
                    setIsSubjectModalOpen(true);
                }}
            />

            {loading ? (
                <SkeletonCardGrid count={6} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
            ) : filteredSubjects.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    No subjects match your filter criteria. Click "Add Subject" to create one.
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSubjects.map((subj) => (
                        <SubjectCard
                            key={subj.id}
                            subject={subj}
                            onManageTopics={openTopicManager}
                            onEdit={(s) => {
                                setEditingSubject(s);
                                setSubjectForm({
                                    name: s.name,
                                    slug: s.slug,
                                    description: s.description || '',
                                    class_id: s.class_id ? s.class_id : '',
                                    status: s.status,
                                    sort_order: s.sort_order,
                                });
                                setIsSubjectModalOpen(true);
                            }}
                            onDelete={handleDeleteSubject}
                            isDeleting={deletingSubjectId === subj.id}
                        />
                    ))}
                </div>
            )}

            {/* Modal: Subject Create / Edit */}
            <SubjectFormModal
                isOpen={isSubjectModalOpen}
                onClose={() => setIsSubjectModalOpen(false)}
                editingSubject={editingSubject}
                form={subjectForm}
                setForm={setSubjectForm}
                classes={classes}
                school={school}
                allowedGradeLevels={allowedGradeLevels}
                isTeacher={isTeacher}
                onSubmit={handleSaveSubject}
                isSubmitting={isSavingSubject}
            />

            {/* Modal: Topic Manager */}
            <TopicManagerModal
                subject={selectedSubjectForTopics}
                topicsList={topicsList}
                loadingTopics={loadingTopics}
                onClose={() => setSelectedSubjectForTopics(null)}
                onOpenAddTopicModal={() => {
                    setEditingTopic(null);
                    const inferredLevel =
                        selectedSubjectForTopics?.school_class?.grade_level ||
                        selectedSubjectForTopics?.class_grade_level ||
                        'SS1';
                    setTopicForm({
                        name: '',
                        slug: '',
                        level: inferredLevel,
                        description: '',
                        status: 'active',
                        sort_order: topicsList.length,
                    });
                    setIsTopicModalOpen(true);
                }}
                onEditTopic={(top) => {
                    setEditingTopic(top);
                    setTopicForm({
                        name: top.name,
                        slug: top.slug,
                        level: top.level,
                        description: top.description || '',
                        status: top.status,
                        sort_order: top.sort_order,
                    });
                    setIsTopicModalOpen(true);
                }}
                onDeleteTopic={handleDeleteTopic}
            />

            {/* Sub-modal: Topic Create / Edit */}
            <TopicFormModal
                isOpen={isTopicModalOpen}
                onClose={() => setIsTopicModalOpen(false)}
                editingTopic={editingTopic}
                form={topicForm}
                setForm={setTopicForm}
                classes={classes}
                school={school}
                allowedGradeLevels={allowedGradeLevels}
                isTeacher={isTeacher}
                onSubmit={handleSaveTopic}
                isSubmitting={isSavingTopic}
            />
        </div>
    );
}
