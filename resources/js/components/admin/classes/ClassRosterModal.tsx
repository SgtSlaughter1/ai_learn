import React from 'react';
import type { ClassItem, ClassLearner } from '@/types/admin';

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
    onRemoveLearner,
}: ClassRosterModalProps) {
    if (!isOpen || !selectedClass) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">
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
                        className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Quick Enroll Form */}
                <form
                    onSubmit={onEnrollLearner}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)]"
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
                        className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] whitespace-nowrap flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{enrollingLearner ? 'Enrolling...' : 'Enroll Student'}</span>
                    </button>
                </form>

                {/* Roster Table */}
                <div className="flex-1 overflow-y-auto border border-[var(--color-border)] rounded-2xl">
                    <table className="w-full text-left text-xs">
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
                                        No learners currently enrolled in this class cohort.
                                    </td>
                                </tr>
                            ) : (
                                classLearners.map((lrn) => (
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
                </div>
            </div>
        </div>
    );
}
