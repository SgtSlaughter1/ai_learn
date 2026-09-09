import { useState } from 'react';
import { SubjectItem, TopicItem } from '@/types/admin';
import { executeAdminAction } from '@/services/AdminOfflineService';

interface Props {
    subjects: SubjectItem[];
    loading: boolean;
    onRefresh: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function SubjectsTab({ subjects, loading, onRefresh, showToast }: Props) {
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
    const [subjectForm, setSubjectForm] = useState({
        name: '',
        slug: '',
        description: '',
        status: 'active',
        sort_order: 0,
    });

    // Topic Modal
    const [selectedSubjectForTopics, setSelectedSubjectForTopics] = useState<SubjectItem | null>(null);
    const [topicsList, setTopicsList] = useState<TopicItem[]>([]);
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
    const [topicForm, setTopicForm] = useState({
        name: '',
        slug: '',
        level: 'SS1',
        description: '',
        status: 'active',
        sort_order: 0,
    });

    const handleSaveSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = editingSubject ? `/api/v1/admin/subjects/${editingSubject.id}` : '/api/v1/admin/subjects';
        const method = editingSubject ? 'PUT' : 'POST';
        const tempId = editingSubject ? String(editingSubject.id) : `temp_subj_${Date.now()}`;

        const optimisticSubject: SubjectItem = {
            id: editingSubject ? editingSubject.id : Date.now(),
            name: subjectForm.name,
            slug: subjectForm.slug || subjectForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: subjectForm.description || null,
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
            payload: subjectForm,
            optimisticRecord: optimisticSubject,
        });

        if (res.success) {
            showToast(res.message || 'Subject saved successfully', 'success');
            setIsSubjectModalOpen(false);
            setEditingSubject(null);
            setSubjectForm({ name: '', slug: '', description: '', status: 'active', sort_order: 0 });
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save subject', 'error');
        }
    };

    const handleDeleteSubject = async (subject: SubjectItem) => {
        if (!confirm(`Delete subject "${subject.name}"? This will also remove its topics.`)) return;
        const res = await executeAdminAction({
            table: 'subjects',
            action: 'delete',
            recordId: String(subject.id),
            endpoint: `/api/v1/admin/subjects/${subject.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Subject deleted');
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete subject', 'error');
        }
    };

    const openTopicManager = async (subject: SubjectItem) => {
        setSelectedSubjectForTopics(subject);
        setLoadingTopics(true);
        try {
            const res = await fetch(`/api/v1/admin/topics?subject_id=${subject.id}`);
            const data = await res.json();
            setTopicsList(data.topics || []);
        } catch (err) {
            console.error(err);
            setTopicsList([]);
        } finally {
            setLoadingTopics(false);
        }
    };

    const handleSaveTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubjectForTopics) return;

        const endpoint = editingTopic ? `/api/v1/admin/topics/${editingTopic.id}` : '/api/v1/admin/topics';
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
            showToast(res.message || 'Topic saved successfully', 'success');
            setIsTopicModalOpen(false);
            setEditingTopic(null);
            setTopicForm({ name: '', slug: '', level: 'SS1', description: '', status: 'active', sort_order: 0 });
            openTopicManager(selectedSubjectForTopics);
            onRefresh();
        } else {
            showToast(res.error || 'Failed to save topic', 'error');
        }
    };

    const handleDeleteTopic = async (topic: TopicItem) => {
        if (!confirm(`Delete topic "${topic.name}"?`)) return;
        const res = await executeAdminAction({
            table: 'topics',
            action: 'delete',
            recordId: String(topic.id),
            endpoint: `/api/v1/admin/topics/${topic.id}`,
            method: 'DELETE',
        });

        if (res.success) {
            showToast(res.message || 'Topic deleted');
            if (selectedSubjectForTopics) openTopicManager(selectedSubjectForTopics);
            onRefresh();
        } else {
            showToast(res.error || 'Failed to delete topic', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-[var(--color-text)]">Curriculum Hierarchy</h3>
                    <p className="text-xs text-[var(--color-muted)]">Configure subjects and manage topics with grade-level objectives</p>
                </div>
                <button
                    onClick={() => {
                        setEditingSubject(null);
                        setSubjectForm({ name: '', slug: '', description: '', status: 'active', sort_order: 0 });
                        setIsSubjectModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Subject
                </button>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : subjects.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-muted)] text-sm">
                    No subjects created yet. Click "Add Subject" to begin.
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {subjects.map((subj) => (
                        <div key={subj.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-[var(--color-primary)]/50 transition-colors">
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-base text-[var(--color-text)]">{subj.name}</h4>
                                            {subj._pendingSync && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    Pending Sync
                                                </span>
                                            )}
                                        </div>
                                        {subj.school?.name ? (
                                            <span className="text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-5)] px-2 py-0.5 rounded border border-[var(--color-primary)]/20 mt-1 inline-block">
                                                {subj.school.name}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-[var(--color-muted)] bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded border border-[var(--color-border)] mt-1 inline-block">
                                                General Knowledge
                                            </span>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${subj.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'}`}>
                                        {subj.status}
                                    </span>
                                </div>
                                {subj.description && (
                                    <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-4">{subj.description}</p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between mt-3">
                                <span className="text-xs font-bold text-[var(--color-muted)] flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {subj.topics_count ?? 0} topics
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => openTopicManager(subj)}
                                        className="px-3 py-1.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98] cursor-pointer text-[var(--color-primary)] text-xs font-bold rounded-lg transition-all"
                                    >
                                        Manage Topics
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingSubject(subj);
                                            setSubjectForm({
                                                name: subj.name,
                                                slug: subj.slug,
                                                description: subj.description || '',
                                                status: subj.status,
                                                sort_order: subj.sort_order,
                                            });
                                            setIsSubjectModalOpen(true);
                                        }}
                                        className="p-1.5 hover:bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:text-[var(--color-primary)] active:scale-[0.98] cursor-pointer rounded-lg text-xs font-bold transition-all"
                                        title="Edit Subject"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSubject(subj)}
                                        className="p-1.5 hover:bg-[var(--color-error-5)] text-[var(--color-muted)] hover:text-[var(--color-error)] active:scale-[0.98] cursor-pointer rounded-lg text-xs font-bold transition-all"
                                        title="Delete Subject"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Subject Create / Edit */}
            {isSubjectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">
                                {editingSubject ? 'Edit Subject' : 'Add Subject'}
                            </h3>
                            <button onClick={() => setIsSubjectModalOpen(false)} className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Subject Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={subjectForm.name}
                                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    placeholder="e.g. Mathematics, Physics, Chemistry"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={subjectForm.description}
                                    onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                                    placeholder="Describe key topics and curriculum coverage..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Status</label>
                                    <select
                                        value={subjectForm.status}
                                        onChange={(e) => setSubjectForm({ ...subjectForm, status: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        value={subjectForm.sort_order}
                                        onChange={(e) => setSubjectForm({ ...subjectForm, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                                <button type="button" onClick={() => setIsSubjectModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                                    {editingSubject ? 'Update Subject' : 'Save Subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Topic Manager */}
            {selectedSubjectForTopics && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--color-text)]">
                                    Topics in {selectedSubjectForTopics.name}
                                </h3>
                                <p className="text-xs text-[var(--color-muted)]">{topicsList.length} total topics configured</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setEditingTopic(null);
                                        setTopicForm({ name: '', slug: '', level: 'SS1', description: '', status: 'active', sort_order: topicsList.length });
                                        setIsTopicModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>Add Topic</span>
                                </button>
                                <button onClick={() => setSelectedSubjectForTopics(null)} className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {loadingTopics ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((n) => (
                                        <div key={n} className="h-16 bg-[var(--color-primary-5)] rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : topicsList.length === 0 ? (
                                <p className="text-center py-8 text-[var(--color-muted)] text-xs">No topics created for this subject yet.</p>
                            ) : (
                                topicsList.map((top) => (
                                    <div key={top.id} className="p-4 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h5 className="font-bold text-sm text-[var(--color-text)]">{top.name}</h5>
                                                {top._pendingSync && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                        Pending Sync
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] text-[10px] font-bold">
                                                    {top.level}
                                                </span>
                                            </div>
                                            {top.description && (
                                                <p className="text-[11px] text-[var(--color-muted)]">{top.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
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
                                                className="px-2.5 py-1 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTopic(top)}
                                                className="px-2.5 py-1 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-modal: Topic Create / Edit */}
            {isTopicModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                            <h4 className="text-base font-bold text-[var(--color-text)]">
                                {editingTopic ? 'Edit Topic' : 'Add Topic'}
                            </h4>
                            <button onClick={() => setIsTopicModalOpen(false)} className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Topic Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={topicForm.name}
                                    onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    placeholder="e.g. Quadratic Equations, Photosynthesis"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Grade Level *</label>
                                    <select
                                        value={topicForm.level}
                                        onChange={(e) => setTopicForm({ ...topicForm, level: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] font-semibold outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="JSS1">JSS1</option>
                                        <option value="JSS2">JSS2</option>
                                        <option value="JSS3">JSS3</option>
                                        <option value="SS1">SS1</option>
                                        <option value="SS2">SS2</option>
                                        <option value="SS3">SS3</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-[var(--color-muted)] mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        value={topicForm.sort_order}
                                        onChange={(e) => setTopicForm({ ...topicForm, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-[var(--color-muted)] mb-1">Description / Key Objectives</label>
                                <textarea
                                    rows={3}
                                    value={topicForm.description}
                                    onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                                    placeholder="Explain key objectives of this lesson..."
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                                <button type="button" onClick={() => setIsTopicModalOpen(false)} className="px-4 py-2 text-xs font-bold text-[var(--color-muted)] cursor-pointer">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                                    Save Topic
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
