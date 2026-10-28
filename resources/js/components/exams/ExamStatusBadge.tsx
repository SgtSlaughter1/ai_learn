import type { AttemptStatus, StaffExamStatus } from '@/types/exams';

const STYLES = {
    neutral: 'bg-[var(--color-surface-hover)] text-[var(--color-muted)] border-[var(--color-border)]',
    primary: 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary-20)]',
    accent: 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent-20)]',
    success: 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]',
} as const;

const EXAM: Record<StaffExamStatus, { label: string; tone: keyof typeof STYLES }> = {
    draft: { label: 'Draft', tone: 'neutral' },
    scheduled: { label: 'Scheduled', tone: 'accent' },
    open: { label: 'Open now', tone: 'success' },
    ended: { label: 'Ended', tone: 'primary' },
};

const ATTEMPT: Record<AttemptStatus | 'not_started', { label: string; tone: keyof typeof STYLES }> = {
    not_started: { label: 'Not started', tone: 'neutral' },
    in_progress: { label: 'Writing', tone: 'accent' },
    submitted: { label: 'Submitted', tone: 'success' },
    auto_submitted: { label: 'Time up', tone: 'primary' },
    ended: { label: 'Ended by invigilator', tone: 'primary' },
};

function Badge({ label, tone }: { label: string; tone: keyof typeof STYLES }) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${STYLES[tone]}`}>{label}</span>;
}

export function ExamStatusBadge({ status }: { status: StaffExamStatus }) {
    return <Badge {...EXAM[status]} />;
}

export function AttemptStatusBadge({ status }: { status: AttemptStatus | null }) {
    return <Badge {...ATTEMPT[status ?? 'not_started']} />;
}
