import { Link } from '@inertiajs/react';
import { FileText, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';

/**
 * Combine attempts saved on this device with the server's list: one row per attempt id,
 * newest first. Device attempts not yet verified by the server show as provisional.
 */
export function mergeRecentAttempts(
    local: Array<{ id: string; quiz_id: number; quiz_title?: string; status: string; score: number | null; total_marks: number | null; completed_at: string | null; verified?: boolean; synced: boolean }>,
    server: DashboardAttempt[],
    titleFor: (quizId: number) => string | undefined,
    limit = 5,
): DashboardAttempt[] {
    const byId = new Map<string, DashboardAttempt>();
    for (const attempt of server) {
        if (attempt?.id) byId.set(String(attempt.id), attempt);
    }
    for (const a of local) {
        if (a.status !== 'completed' || byId.has(String(a.id))) continue; // the server's row wins
        byId.set(String(a.id), {
            id: String(a.id),
            quiz_title: a.quiz_title || titleFor(a.quiz_id) || `Quiz Assessment #${a.quiz_id}`,
            status: a.verified || a.synced ? 'completed' : 'provisional',
            score: a.score ?? null,
            total_marks: a.total_marks ?? null,
            completed_at: a.completed_at,
        });
    }
    return [...byId.values()]
        .sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))
        .slice(0, limit);
}

export interface DashboardAttempt {
    id: string;
    quiz_title: string;
    /** 'completed', 'in_progress', or 'provisional' (graded on the device, awaiting server verification). */
    status: string;
    score: number | null;
    total_marks: number | null;
    completed_at: string | null;
}

export function OverallMasteryCard({
    loading,
    averageMastery,
    className = '',
}: {
    loading: boolean;
    averageMastery: number;
    className?: string;
}) {
    return (
        <div
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between min-h-[320px] shadow-sm h-full ${className}`}
        >
            <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Overall Mastery</h2>
                <p className="text-[var(--color-muted)] text-xs mt-1">Average topic understanding score.</p>
            </div>
            <div className="my-6 flex justify-center items-center">
                {loading ? (
                    <div className="h-40 w-40 rounded-full border border-[var(--color-border)] flex items-center justify-center">
                        <Skeleton variant="circular" className="h-36 w-36" animate="wave" />
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
            <div className="text-center text-xs text-[var(--color-muted)] bg-[var(--color-background)] py-2.5 rounded-xl border border-[var(--color-border)] flex items-center justify-center gap-1.5 font-medium shadow-2xs">
                {loading ? (
                    <Skeleton variant="text" className="h-3.5 w-32 mx-auto" />
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
    );
}

export function RecentQuizActivityCard({
    loading,
    isOnline,
    attempts,
    className = '',
}: {
    loading: boolean;
    isOnline: boolean;
    attempts: DashboardAttempt[] | null | undefined;
    className?: string;
}) {
    const attemptList: DashboardAttempt[] = Array.isArray(attempts)
        ? attempts
        : attempts && typeof attempts === 'object'
        ? (Array.isArray((attempts as any).data) ? (attempts as any).data : Object.values(attempts))
        : [];

    return (
        <div
            className={`bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between min-h-[320px] ${className}`}
        >
            <div>
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Quiz Activity</h2>
                    {attemptList.length > 0 && (
                        <Link
                            href="/subjects"
                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                        >
                            <span>Take quiz</span>
                            <span>→</span>
                        </Link>
                    )}
                </div>
                <p className="text-[var(--color-muted)] text-xs mt-1 flex items-center gap-1.5">
                    {!isOnline && (
                        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    )}
                    <span>{isOnline ? 'Your recent quizzes and practice sessions.' : 'Saved offline (will sync when you reconnect)'}</span>
                </p>
            </div>

            <div className="my-auto py-4">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="flex items-center justify-between p-3.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl"
                            >
                                <div className="flex items-center space-x-3 w-2/3">
                                    <Skeleton variant="rounded" className="h-9 w-9 shrink-0" animate="wave" />
                                    <div className="space-y-2 w-full">
                                        <Skeleton variant="text" className="h-4 w-3/4" animate="wave" />
                                        <Skeleton variant="text" className="h-3 w-1/4" animate="wave" />
                                    </div>
                                </div>
                                <Skeleton variant="rounded" className="h-5 w-12" animate="wave" />
                            </div>
                        ))}
                    </div>
                ) : attemptList.length === 0 ? (
                    <div className="text-center py-7 px-4 border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-background)] flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-2.5 shadow-2xs">
                            <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-[var(--color-text)]">No attempts recorded yet</p>
                        <p className="text-xs text-[var(--color-muted)] mt-1 max-w-sm">
                            Complete topic quizzes or practice questions to track your mastery scores here.
                        </p>
                        <Link
                            href="/subjects"
                            className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                        >
                            <span>Take your first quiz now</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {attemptList.map((attempt, index) => (
                            <div
                                key={attempt.id ? `attempt-${attempt.id}` : `attempt-idx-${index}`}
                                className="flex items-center justify-between p-3.5 bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-xl transition-all"
                            >
                                <div className="flex items-center space-x-3 min-w-0">
                                    <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg shrink-0">
                                        <FileText className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                                            {attempt.quiz_title}
                                        </h3>
                                        <p className="text-[10px] text-[var(--color-muted)] font-semibold uppercase tracking-wider">
                                            {attempt.status === 'provisional'
                                                ? 'Provisional · verified when online'
                                                : attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 pl-3">
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
                        ))}
                    </div>
                )}
            </div>

            {/* Card footer sync/status note */}
            <div className="pt-2 text-[11px] text-[var(--color-muted)] flex items-center justify-between font-medium">
                <span>
                    {attemptList.length > 0
                        ? `Showing latest ${attemptList.length} attempts`
                        : 'Practice sessions are saved locally'}
                </span>
                <span className="text-[var(--color-primary)] font-semibold">
                    {isOnline ? 'Online Sync Active' : 'Offline Mode'}
                </span>
            </div>
        </div>
    );
}

interface RecentAttemptsListProps {
    loading: boolean;
    isOnline: boolean;
    attempts: DashboardAttempt[] | null | undefined;
    averageMastery: number;
}

export function RecentAttemptsList({
    loading,
    isOnline,
    attempts,
    averageMastery,
}: RecentAttemptsListProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 h-full">
            <OverallMasteryCard
                loading={loading}
                averageMastery={averageMastery}
                className="lg:col-span-1"
            />
            <RecentQuizActivityCard
                loading={loading}
                isOnline={isOnline}
                attempts={attempts}
                className="lg:col-span-2"
            />
        </div>
    );
}
