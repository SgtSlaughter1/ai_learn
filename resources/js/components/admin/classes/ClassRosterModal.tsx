import React, { useState, useEffect } from 'react';
import type { ClassItem, ClassLearner } from '@/types/admin';
import Pagination from '@/components/common/Pagination';
import { useDismiss } from '@/hooks/useDismiss';

interface ClassRosterModalProps {
    isOpen: boolean;
    selectedClass: ClassItem | null;
    classLearners: ClassLearner[];
    loadingClassLearners: boolean;
    enrollLearnerEmail: string;
    setEnrollLearnerEmail: (email: string) => void;
    enrollingLearner: boolean;
    onClose: () => void;
    onEnrollLearner: (e: React.FormEvent) => void;
    onCreateLearner?: (learnerData: { name: string; email: string; password?: string; student_id?: string }) => void;
    onRemoveLearner: (learnerId: string) => void;
}

export default function ClassRosterModal({
    isOpen,
    selectedClass,
    classLearners,
    loadingClassLearners,
    enrollLearnerEmail,
    setEnrollLearnerEmail,
    enrollingLearner,
    onClose,
    onEnrollLearner,
    onCreateLearner,
    onRemoveLearner,
}: ClassRosterModalProps) {
    const { backdrop, panel } = useDismiss(true, onClose);
    const [actionTab, setActionTab] = useState<'enroll' | 'create'>('enroll');
    const [rosterPage, setRosterPage] = useState(1);
    const [newLearner, setNewLearner] = useState({
        name: '',
        email: '',
        password: '',
        student_id: '',
    });

    useEffect(() => {
        setRosterPage(1);
    }, [selectedClass?.id]);

    if (!isOpen || !selectedClass) return null;

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onCreateLearner) {
            onCreateLearner(newLearner);
            setNewLearner({ name: '', email: '', password: '', student_id: '' });
        }
    };

    const paginatedLearners = classLearners.slice((rosterPage - 1) * 50, rosterPage * 50);

    return (
        <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div {...panel} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-4 sm:space-y-6 max-h-[92vh] flex flex-col">
                <div className="flex items-start sm:items-center justify-between border-b border-[var(--color-border)] pb-4 gap-3">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate">
                            {selectedClass.name} Roster
                        </h3>
                        <p className="text-xs text-[var(--color-muted)]">
                            Grade: <strong className="text-[var(--color-primary)]">{selectedClass.grade_level}</strong> •{' '}
                            {classLearners.length} Enrolled Learners
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Mode Selector */}
                <div className="flex bg-[var(--color-background)] p-1 rounded-xl border border-[var(--color-border)] text-xs">
                    <button
                        type="button"
                        onClick={() => setActionTab('enroll')}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            actionTab === 'enroll'
                                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs border border-[var(--color-border)]'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>Enroll Existing by Email</span>
                    </button>
                    {onCreateLearner && (
                        <button
                            type="button"
                            onClick={() => setActionTab('create')}
                            className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                actionTab === 'create'
                                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs border border-[var(--color-border)]'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            <span>Add New Learner Account</span>
                        </button>
                    )}
                </div>

                {/* Form based on Mode */}
                {actionTab === 'enroll' ? (
                    <form
                        onSubmit={onEnrollLearner}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 p-3 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)]"
                    >
                        <input
                            type="email"
                            required
                            placeholder="Enter learner's email address to enroll..."
                            value={enrollLearnerEmail}
                            onChange={(e) => setEnrollLearnerEmail(e.target.value)}
                            className="flex-1 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                        />
                        <button
                            type="submit"
                            disabled={enrollingLearner}
                            className="w-full sm:w-auto justify-center px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] whitespace-nowrap flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>{enrollingLearner ? 'Enrolling...' : 'Enroll Student'}</span>
                        </button>
                    </form>
                ) : (
                    <form
                        onSubmit={handleCreateSubmit}
                        className="p-4 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)] space-y-3"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <input
                                type="text"
                                required
                                placeholder="Full Name *"
                                value={newLearner.name}
                                onChange={(e) => setNewLearner({ ...newLearner, name: e.target.value })}
                                className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            />
                            <input
                                type="email"
                                required
                                placeholder="Email Address *"
                                value={newLearner.email}
                                onChange={(e) => setNewLearner({ ...newLearner, email: e.target.value })}
                                className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            />
                            <input
                                type="password"
                                required
                                placeholder="Initial Password *"
                                value={newLearner.password}
                                onChange={(e) => setNewLearner({ ...newLearner, password: e.target.value })}
                                className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            />
                            <input
                                type="text"
                                placeholder="Student ID (Optional)"
                                value={newLearner.student_id}
                                onChange={(e) => setNewLearner({ ...newLearner, student_id: e.target.value })}
                                className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={enrollingLearner}
                                className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>{enrollingLearner ? 'Creating...' : 'Create & Add to Class'}</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* Roster Table */}
                <div className="flex-1 overflow-y-auto overflow-x-auto border border-[var(--color-border)] rounded-2xl flex flex-col justify-between">
                    <table className="w-full text-left text-xs min-w-[580px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-5)] text-[var(--color-muted)] uppercase tracking-wider font-bold sticky top-0 bg-[var(--color-surface)]">
                                <th className="py-3 px-4">Student</th>
                                <th className="py-3 px-4">Level & XP</th>
                                <th className="py-3 px-4">Streak</th>
                                <th className="py-3 px-4">Avg Mastery</th>
                                <th className="py-3 px-4">Questions</th>
                                <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loadingClassLearners ? (
                                [1, 2, 3].map((n) => (
                                    <tr key={n}>
                                        <td colSpan={6} className="py-4 px-4">
                                            <div className="h-5 bg-[var(--color-primary-5)] rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : classLearners.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-[var(--color-muted)] text-sm">
                                        No learners currently enrolled in this class.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLearners.map((lrn) => (
                                    <tr key={lrn.id} className="hover:bg-[var(--color-primary-5)] transition-colors">
                                        <td className="py-3 px-4">
                                            <p className="font-bold text-[var(--color-text)]">{lrn.name}</p>
                                            <p className="text-[11px] text-[var(--color-muted)]">{lrn.email}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="font-bold text-[var(--color-primary)]">
                                                {lrn.total_xp.toLocaleString()} XP
                                            </p>
                                            <p className="text-[10px] text-[var(--color-muted)]">
                                                Lvl {lrn.level} • {lrn.tier || 'Newcomer'}
                                            </p>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-[var(--color-accent)]">{lrn.streak}d</td>
                                        <td className="py-3 px-4">
                                            <span
                                                className={`px-2 py-0.5 rounded font-bold ${
                                                    lrn.avg_mastery >= 70
                                                        ? 'bg-[var(--color-success-10)] text-[var(--color-success)]'
                                                        : lrn.avg_mastery >= 40
                                                        ? 'bg-[var(--color-accent-10)] text-[var(--color-accent)]'
                                                        : 'bg-[var(--color-error-10)] text-[var(--color-error)]'
                                                }`}
                                            >
                                                {lrn.avg_mastery}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-[var(--color-muted)]">
                                            <strong className="text-[var(--color-text)]">{lrn.total_correct}</strong> /{' '}
                                            {lrn.total_attempted}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onRemoveLearner(lrn.id)}
                                                className="px-2.5 py-1 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] rounded-lg transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {classLearners.length > 0 && (
                        <div className="border-t border-[var(--color-border)]">
                            <Pagination
                                currentPage={rosterPage}
                                totalItems={classLearners.length}
                                itemsPerPage={50}
                                onPageChange={setRosterPage}
                                itemLabel="learners"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
