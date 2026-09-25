import { Link } from '@inertiajs/react';
import { FileText } from 'lucide-react';

export interface DashboardAttempt {
    id: string;
    quiz_title: string;
    status: string;
    score: number | null;
    total_marks: number | null;
    completed_at: string | null;
}

interface RecentAttemptsListProps {
    loading: boolean;
    isOnline: boolean;
    attempts: DashboardAttempt[];
    averageMastery: number;
}

export function RecentAttemptsList({
    loading,
    isOnline,
    attempts,
    averageMastery,
}: RecentAttemptsListProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Mastery Level Circular Indicator */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between min-h-[320px] shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">Overall Mastery</h2>
                    <p className="text-[var(--color-muted)] text-xs mt-1">Average topic understanding score.</p>
                </div>
                <div className="my-8 flex justify-center items-center">
                    {loading ? (
                        <div className="h-40 w-40 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center animate-pulse">
                            <div className="h-32 w-32 rounded-full bg-[var(--color-surface)]" />
                        </div>
                    ) : (
                        <div className="relative h-40 w-40 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="var(--color-border)" strokeWidth="8" fill="transparent" />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    stroke="var(--color-primary)"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray="251.2"
                                    strokeDashoffset={251.2 - (251.2 * averageMastery) / 100}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className="text-4xl font-extrabold text-[var(--color-text)]">
                                    {averageMastery}%
                                </span>
                                <span className="block text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-wider mt-0.5">
                                    Mastery
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-center text-xs text-[var(--color-muted)] bg-[var(--color-background)] py-2.5 rounded-xl border border-[var(--color-border)] flex items-center justify-center gap-1.5 font-medium">
                    {loading ? (
                        <span className="text-[var(--color-muted)] font-bold">Loading mastery...</span>
                    ) : averageMastery >= 80 ? (
                        <>
                            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>Excellent Progress!</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span>Keep practicing to unlock mastery!</span>
                        </>
                    )}
                </div>
            </div>

            {/* Recent Attempts logs */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl lg:col-span-2 shadow-sm">
                <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Quiz Activity</h2>
                <p className="text-[var(--color-muted)] text-xs mt-1 flex items-center gap-1.5">
                    {!isOnline && (
                        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    )}
                    <span>{isOnline ? 'Your recent quizzes and practice sessions.' : 'Saved offline (will sync when you reconnect)'}</span>
                </p>

                <div className="mt-6 space-y-4">
                    {loading ? (
                        [1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="flex items-center justify-between p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl animate-pulse"
                            >
                                <div className="flex items-center space-x-3 w-2/3">
                                    <div className="h-9 w-9 bg-[var(--color-surface)] rounded-lg shrink-0" />
                                    <div className="space-y-2 w-full">
                                        <div className="h-4 bg-[var(--color-surface)] rounded w-3/4" />
                                        <div className="h-3 bg-[var(--color-surface)] rounded w-1/4" />
                                    </div>
                                </div>
                                <div className="h-5 bg-[var(--color-surface)] rounded w-12" />
                            </div>
                        ))
                    ) : attempts.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-background)]">
                            <p className="text-sm text-[var(--color-muted)]">No attempts found yet.</p>
                            <Link
                                href="/subjects"
                                className="text-[var(--color-primary)] hover:opacity-80 text-xs font-semibold mt-2 inline-block"
                            >
                                Take your first quiz now →
                            </Link>
                        </div>
                    ) : (
                        attempts.map((attempt) => (
                            <div
                                key={attempt.id}
                                className="flex items-center justify-between p-4 bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-xl transition-all"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg">
                                        <FileText className="w-5 h-5" />
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                            {attempt.quiz_title}
                                        </h3>
                                        <p className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider">
                                            {attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-[var(--color-text)]">
                                        {attempt.score !== null && attempt.total_marks !== null
                                            ? `${attempt.score}/${attempt.total_marks}`
                                            : 'N/A'}
                                    </span>
                                    {attempt.score !== null &&
                                        attempt.total_marks !== null &&
                                        attempt.total_marks > 0 && (
                                            <span className="block text-[10px] text-[var(--color-muted)] font-semibold uppercase tracking-wider mt-0.5">
                                                {Math.round((attempt.score / attempt.total_marks) * 100)}% accuracy
                                            </span>
                                        )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
