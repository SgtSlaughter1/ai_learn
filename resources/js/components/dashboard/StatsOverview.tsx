import type { ReactNode } from 'react';
import { BookOpen, CheckCircle2, Zap, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';

interface StatsOverviewProps {
    loading: boolean;
    isOnline: boolean;
    stats: {
        totalSubjects: number;
        questionsAttempted: number;
        questionsCorrect: number;
        averageMastery: number;
        completedTopics: number;
    } | null;
    offlineStats: {
        totalSubjects: number;
        questionsAttempted: number;
        questionsCorrect: number;
        averageMastery: number;
        completedTopics: number;
    } | null;
    accuracy: number;
    className?: string;
}

export function StatsOverview({
    loading,
    isOnline,
    stats,
    offlineStats,
    accuracy,
    className = '',
}: StatsOverviewProps) {
    const currentStats = isOnline && stats ? stats : (offlineStats || stats);

    return (
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 ${className}`}>
            <StatCard
                label="Active Subjects"
                value={currentStats?.totalSubjects ?? 0}
                icon={<BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />}
                loading={loading}
            />
            <StatCard
                label="Questions Solved"
                value={currentStats?.questionsAttempted ?? 0}
                subtitle={
                    currentStats
                        ? `${currentStats.questionsCorrect ?? 0} correct answers`
                        : undefined
                }
                icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                loading={loading}
            />
            <StatCard
                label="Avg. Accuracy"
                value={`${accuracy}%`}
                subtitle="Based on quiz attempts"
                icon={<Zap className="w-4 h-4 sm:w-5 sm:h-5" />}
                loading={loading}
            />
            <StatCard
                label="Mastered Topics"
                value={currentStats?.completedTopics ?? 0}
                subtitle=">= 80% mastery level"
                icon={<Trophy className="w-4 h-4 sm:w-5 sm:h-5" />}
                loading={loading}
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    subtitle,
    icon,
    loading,
}: {
    label: string;
    value: any;
    subtitle?: string;
    icon: ReactNode;
    loading: boolean;
}) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5 lg:p-6 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start gap-1.5">
                <span className="text-[var(--color-muted)] font-medium text-xs sm:text-sm truncate">{label}</span>
                <span className="p-1.5 sm:p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg shrink-0">
                    {icon}
                </span>
            </div>
            <div className="mt-2.5 sm:mt-4">
                {loading ? (
                    <div className="space-y-1.5 sm:space-y-2">
                        <Skeleton variant="rounded" className="h-7 sm:h-8 w-14 sm:w-16 rounded-lg" animate="wave" />
                        <Skeleton variant="text" className="h-2.5 sm:h-3 w-24 sm:w-28" animate="wave" />
                    </div>
                ) : (
                    <>
                        <span className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">{value}</span>
                        {subtitle && <p className="text-[10px] sm:text-xs text-[var(--color-muted)] mt-0.5 sm:mt-1 truncate font-medium">{subtitle}</p>}
                    </>
                )}
            </div>
        </div>
    );
}
