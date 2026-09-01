import type { ReactNode } from 'react';
import { BookOpen, CheckCircle2, Zap, Trophy } from 'lucide-react';

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
}

export function StatsOverview({
    loading,
    isOnline,
    stats,
    offlineStats,
    accuracy,
}: StatsOverviewProps) {
    const currentStats = isOnline && stats ? stats : (offlineStats || stats);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                label="Active Subjects"
                value={loading ? '...' : currentStats?.totalSubjects ?? 0}
                icon={<BookOpen className="w-5 h-5" />}
                loading={loading}
            />
            <StatCard
                label="Questions Solved"
                value={loading ? '...' : currentStats?.questionsAttempted ?? 0}
                subtitle={
                    currentStats
                        ? `${currentStats.questionsCorrect ?? 0} correct answers`
                        : undefined
                }
                icon={<CheckCircle2 className="w-5 h-5" />}
                loading={loading}
            />
            <StatCard
                label="Avg. Accuracy"
                value={loading ? '...' : `${accuracy}%`}
                subtitle="Based on quiz attempts"
                icon={<Zap className="w-5 h-5" />}
                loading={loading}
            />
            <StatCard
                label="Mastered Topics"
                value={loading ? '...' : currentStats?.completedTopics ?? 0}
                subtitle=">= 80% mastery level"
                icon={<Trophy className="w-5 h-5" />}
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
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
                <span className="text-[var(--color-muted)] font-medium text-sm">{label}</span>
                <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg">
                    {icon}
                </span>
            </div>
            <div className="mt-4">
                {loading ? (
                    <div className="h-9 w-12 bg-[var(--color-background)] rounded-lg animate-pulse" />
                ) : (
                    <>
                        <span className="text-3xl font-bold text-[var(--color-text)]">{value}</span>
                        {subtitle && <p className="text-xs text-[var(--color-muted)] mt-1">{subtitle}</p>}
                    </>
                )}
            </div>
        </div>
    );
}
