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
                <div className="text-center text-xs text-[var(--color-muted)] bg-[var(--color-background)] py-2.5 rounded-xl border border-[var(--color-border)]">
                    {loading ? (
                        <span className="text-[var(--color-muted)] font-bold">Loading mastery...</span>
                    ) : averageMastery >= 80 ? (
                        '🌟 Excellent Progress!'
                    ) : (
                        '📈 Keep practicing to unlock mastery!'
                    )}
                </div>
            </div>

            {/* Recent Attempts logs */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl lg:col-span-2 shadow-sm">
                <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Quiz Activity</h2>
                <p className="text-[var(--color-muted)] text-xs mt-1">
                    {isOnline ? 'Your recent diagnostic quiz assessments.' : '📱 Cached data — will sync when online'}
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
