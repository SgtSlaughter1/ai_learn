import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { AlertTriangle, Loader2, Mail, School, ShieldCheck, UserCircle } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { confirmWithInput } from '@/components/common/ConfirmModal';
import { removeOwnAccount } from '@/services/SignOut';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface Props {
    profile?: { school_name: string | null; member_since: string | null };
}

const ROLE_LABELS: Record<string, string> = {
    platform_admin: 'Platform Admin',
    school_admin: 'School Admin',
    teacher: 'Teacher',
    learner: 'Learner',
};

export default function Profile({ profile }: Props) {
    const { auth } = usePage<{ auth?: { user?: { name: string; email: string; role: string } } }>().props;
    const user = auth?.user;
    const { isOnline } = useNetworkStatus();
    const [busy, setBusy] = useState<'deactivate' | 'delete' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (action: 'deactivate' | 'delete') => {
        setError(null);
        const password = await confirmWithInput(action === 'delete'
            ? {
                title: 'Delete your account?',
                message: 'You will be signed out straight away and your account will be removed. Your past results stay on the school record, but you will not be able to sign in again.',
                confirmLabel: 'Delete my account',
                tone: 'danger',
                input: { label: 'Enter your password to confirm', type: 'password', autoComplete: 'current-password' },
            }
            : {
                title: 'Deactivate your account?',
                message: 'You will be signed out and will not be able to sign in again until a school administrator reactivates your account. Nothing is deleted.',
                confirmLabel: 'Deactivate my account',
                tone: 'warning',
                input: { label: 'Enter your password to confirm', type: 'password', autoComplete: 'current-password' },
            });
        if (password === null) return;

        setBusy(action);
        const failure = await removeOwnAccount(action, password);
        setBusy(null);
        if (failure) setError(failure);
    };

    const details = [
        { icon: Mail, label: 'Email', value: user?.email },
        { icon: ShieldCheck, label: 'Role', value: ROLE_LABELS[user?.role ?? ''] ?? user?.role },
        { icon: School, label: 'School', value: profile?.school_name ?? (user?.role === 'platform_admin' ? 'All schools' : '—') },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-[var(--color-text)] tracking-tight">My Profile</h1>
                    <p className="text-xs text-[var(--color-muted)]">Your account details and settings.</p>
                </div>
            }
        >
            <Head title="My Profile" />

            <div className="max-w-2xl space-y-6">
                <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center">
                            <UserCircle className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-lg font-bold text-[var(--color-text)] truncate">{user?.name}</p>
                            {profile?.member_since && (
                                <p className="text-xs text-[var(--color-muted)]">Member since {new Date(profile.member_since).toLocaleDateString()}</p>
                            )}
                        </div>
                    </div>
                    <dl className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
                        {details.map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-center gap-3 px-4 py-3 text-sm">
                                <Icon className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                                <dt className="w-20 text-[var(--color-muted)] shrink-0">{label}</dt>
                                <dd className="font-semibold text-[var(--color-text)] truncate">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <p role="heading" aria-level={2} className="text-sm font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Danger Zone</p>
                    </div>

                    {!isOnline && (
                        <p className="text-xs text-[var(--color-muted)]">You need to be online to deactivate or delete your account.</p>
                    )}
                    {error && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <div>
                            <p className="text-sm font-bold text-[var(--color-text)]">Deactivate account</p>
                            <p className="text-xs text-[var(--color-muted)]">Sign out and block sign-in until an administrator reactivates you. Nothing is deleted.</p>
                        </div>
                        <button
                            type="button"
                            disabled={!isOnline || busy !== null}
                            onClick={() => void run('deactivate')}
                            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-amber-500/40 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {busy === 'deactivate' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Deactivate
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-[var(--color-surface)] p-4">
                        <div>
                            <p className="text-sm font-bold text-[var(--color-text)]">Delete account</p>
                            <p className="text-xs text-[var(--color-muted)]">Remove your account and sign out. You will not be able to sign in again.</p>
                        </div>
                        <button
                            type="button"
                            disabled={!isOnline || busy !== null}
                            onClick={() => void run('delete')}
                            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {busy === 'delete' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Delete account
                        </button>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
