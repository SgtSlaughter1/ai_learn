import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Head, usePage } from '@inertiajs/react';
import { AlertTriangle, Bell, Briefcase, GraduationCap, Hash, Layers, Loader2, Mail, MapPin, Phone, School, ShieldCheck, UserCircle, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { confirmWithInput } from '@/components/common/ConfirmModal';
import { removeOwnAccount } from '@/services/SignOut';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import PopUpSetting from '@/components/notifications/PopUpSetting';

interface ProfileClass {
    id: number;
    name: string;
    grade_level: string | null;
    arm: string | null;
    teachers: string[];
    learners?: number;
}

interface ProfileSchool {
    id: number;
    name: string;
    levels: string;
    city: string | null;
    admin: string | null;
    is_active: boolean;
    learners: number;
    teachers: number;
    classes: number;
}

interface Props {
    profile?: {
        school_name: string | null;
        member_since: string | null;
        school?: { name: string; levels: string; address: string | null; phone: string | null; email: string | null } | null;
        learner?: { student_id: string | null; grade_level: string | null } | null;
        teacher?: { employee_id: string | null; department: string | null } | null;
        classes?: ProfileClass[];
        school_counts?: { teachers: number; learners: number; classes: number } | null;
        schools?: ProfileSchool[];
        ai_training?: { allowed: boolean; can_change: boolean };
    };
}

type Detail = { icon: LucideIcon; label: string; value?: string | null };

/**
 * Whether this person's de-identified data may help improve AceDrill's AI. Adults switch it here;
 * a learner's answer comes from their parent's consent form, so they only see it.
 */
function AiTrainingChoice({ initial, canChange }: { initial: boolean; canChange: boolean }) {
    const [allowed, setAllowed] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const change = async (next: boolean) => {
        setSaving(true);
        setError(null);
        try {
            const token = decodeURIComponent(document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');
            const res = await fetch('/api/v1/account/ai-training', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
                body: JSON.stringify({ allowed: next }),
            });
            if (!res.ok) throw new Error(String(res.status));
            setAllowed(next);
        } catch {
            setError("Your choice couldn't be saved. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-[var(--color-text)] leading-relaxed">
                AceDrill may use questions, answers and chats, with names and anything that identifies you removed, to improve its AI. Saying no changes nothing else in the app.
            </p>
            {canChange ? (
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-text)] cursor-pointer">
                    <input type="checkbox" checked={allowed} disabled={saving} onChange={(e) => change(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
                    Use my de-identified data to improve AceDrill's AI
                </label>
            ) : (
                <p className="text-sm font-semibold text-[var(--color-text)]">
                    {allowed ? 'Yes, your parent or guardian agreed.' : 'No, your data is not used for this.'}{' '}
                    <span className="font-normal text-[var(--color-muted)]">Your school records this from your parent or guardian's consent form.</span>
                </p>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-[var(--color-error)]">{error}</p>}
            <p className="text-xs text-[var(--color-muted)]">
                Read the <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a> and <a href="/terms" className="underline underline-offset-2">Terms of Use</a>.
            </p>
        </div>
    );
}

/** Label-over-value rows, separated by hairlines; no box of its own (the card is the box). */
function DetailList({ items }: { items: Detail[] }) {
    const shown = items.filter((item) => item.value);
    if (shown.length === 0) return null;
    return (
        <dl className="grid @md:grid-cols-2 gap-x-6">
            {shown.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 py-3 border-t border-[var(--color-border)]">
                    <Icon className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" aria-hidden />
                    <div className="min-w-0">
                        <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
                        <dd className="text-sm font-semibold text-[var(--color-text)] break-words">{value}</dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}

const ROLE_LABELS: Record<string, string> = {
    platform_admin: 'Platform Admin',
    school_admin: 'School Admin',
    teacher: 'Teacher',
    learner: 'Learner',
};

export default function Profile({ profile }: Props) {
    const { auth } = usePage<{ auth?: { user?: { id: string; name: string; email: string; role: string } } }>().props;
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

    const school = profile?.school ?? null;
    const classes = profile?.classes ?? [];
    const isLearner = user?.role === 'learner';
    const isTeacher = user?.role === 'teacher';
    const isSchoolAdmin = user?.role === 'school_admin';
    const isPlatformAdmin = user?.role === 'platform_admin';
    const schools = profile?.schools ?? [];
    const counts = isSchoolAdmin ? profile?.school_counts : null;
    const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word.endsWith('s') ? `${word}es` : `${word}s`}`;

    const details: Detail[] = [
        { icon: Mail, label: 'Email', value: user?.email },
        { icon: ShieldCheck, label: 'Role', value: ROLE_LABELS[user?.role ?? ''] ?? user?.role },
        { icon: Hash, label: 'Student ID', value: profile?.learner?.student_id },
        { icon: GraduationCap, label: 'Level', value: profile?.learner?.grade_level },
        { icon: Hash, label: 'Staff ID', value: profile?.teacher?.employee_id },
        { icon: Briefcase, label: 'Department', value: profile?.teacher?.department },
        { icon: School, label: 'School', value: school ? null : user?.role === 'platform_admin' ? 'All schools' : 'Not linked to a school yet' },
    ];

    const schoolDetails: Detail[] = school
        ? [
            { icon: Layers, label: 'Levels', value: school.levels },
            { icon: MapPin, label: 'Address', value: school.address },
            { icon: Phone, label: 'Phone', value: school.phone },
            { icon: Mail, label: 'Email', value: school.email },
        ]
        : [];

    const initials = (user?.name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    const card = '@container rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6';
    const listTitle = isLearner ? 'My classes' : isTeacher ? 'Classes I teach' : isSchoolAdmin ? `Classes at ${school?.name ?? 'your school'}` : 'All schools';
    const showList = isLearner || isTeacher || isSchoolAdmin || isPlatformAdmin;

    return (
        <AuthenticatedLayout
            header={<PageHeader icon={UserCircle} title="My Profile" subtitle="Your account, your school and your classes." />}
        >
            <Head title="My Profile" />

            <div className="space-y-6">
                {/* Who you are and where you belong: a matched pair. */}
                <div className={`grid gap-6 items-stretch ${school ? 'lg:grid-cols-2' : ''}`}>
                    <section className={card} aria-labelledby="account-heading">
                        <div className="flex items-center gap-4 pb-4">
                            <div className="w-14 h-14 shrink-0 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center text-lg font-extrabold" aria-hidden>
                                {initials || <UserCircle className="w-7 h-7" />}
                            </div>
                            <div className="min-w-0">
                                <h2 id="account-heading" className="text-lg font-bold text-[var(--color-text)] break-words">{user?.name}</h2>
                                <p className="text-xs text-[var(--color-muted)]">
                                    {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                                    {profile?.member_since && ` · Member since ${new Date(profile.member_since).toLocaleDateString()}`}
                                </p>
                            </div>
                        </div>
                        <DetailList items={details.filter((d) => d.label !== 'Role')} />
                    </section>

                    {school && (
                        <section className={card} aria-labelledby="school-heading">
                            <div className="flex items-center gap-4 pb-4">
                                <div className="w-14 h-14 shrink-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-5)] text-[var(--color-primary)] flex items-center justify-center">
                                    <School className="w-7 h-7" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <h2 id="school-heading" className="text-lg font-bold text-[var(--color-text)] break-words">{school.name}</h2>
                                    <p className="text-xs text-[var(--color-muted)]">{isSchoolAdmin ? 'The school you run' : 'Your school'}</p>
                                </div>
                            </div>
                            {counts && (
                                <dl className="grid grid-cols-3 border-t border-[var(--color-border)] py-3 text-center">
                                    {([['Teachers', counts.teachers], ['Learners', counts.learners], ['Classes', counts.classes]] as const).map(([label, n]) => (
                                        <div key={label}>
                                            <dd className="text-xl font-extrabold tabular-nums text-[var(--color-text)]">{n}</dd>
                                            <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
                                        </div>
                                    ))}
                                </dl>
                            )}
                            <DetailList items={schoolDetails} />
                        </section>
                    )}
                </div>

                {showList && (
                    <section className={card} aria-labelledby="list-heading">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-4">
                            <h2 id="list-heading" className="text-lg font-bold text-[var(--color-text)]">{listTitle}</h2>
                            <p className="text-xs text-[var(--color-muted)]">
                                {isLearner
                                    ? 'Your school puts you in these classes. Ask your school admin if one is wrong.'
                                    : isTeacher
                                    ? 'Your school admin assigns these classes.'
                                    : isSchoolAdmin
                                    ? 'Manage classes from Classes in the sidebar.'
                                    : `${plural(schools.length, 'school')} on AceDrill. Manage them from Schools in the sidebar.`}
                            </p>
                        </div>

                        {isPlatformAdmin ? (
                            schools.length === 0 ? (
                                <p className="border-t border-[var(--color-border)] pt-6 pb-2 text-center text-sm text-[var(--color-muted)]">No schools yet.</p>
                            ) : (
                                <ul className="grid md:grid-cols-2 gap-x-6">
                                    {schools.map((item) => (
                                        <li key={item.id} className="flex items-start gap-3 py-3 border-t border-[var(--color-border)]">
                                            <School className="w-4 h-4 mt-0.5 text-[var(--color-primary)] shrink-0" aria-hidden />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-[var(--color-text)]">
                                                    {item.name}
                                                    {!item.is_active && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Inactive</span>}
                                                </p>
                                                <p className="text-xs text-[var(--color-muted)]">
                                                    {[item.levels, item.city, item.admin ? `Admin: ${item.admin}` : 'No admin yet'].filter(Boolean).join(' · ')}
                                                </p>
                                                <p className="text-xs text-[var(--color-muted)] tabular-nums">
                                                    {plural(item.learners, 'learner')} · {plural(item.teachers, 'teacher')} · {plural(item.classes, 'class')}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        ) : classes.length === 0 ? (
                            <p className="border-t border-[var(--color-border)] pt-6 pb-2 text-center text-sm text-[var(--color-muted)]">
                                {isLearner ? "You're not in a class yet." : isTeacher ? "You don't have a class yet." : 'No classes yet.'}
                            </p>
                        ) : (
                            <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-6">
                                {classes.map((cls) => (
                                    <li key={cls.id} className="flex items-start gap-3 py-3 border-t border-[var(--color-border)]">
                                        <Users className="w-4 h-4 mt-0.5 text-[var(--color-primary)] shrink-0" aria-hidden />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-[var(--color-text)]">
                                                {cls.name}
                                                {cls.arm && <span className="font-semibold text-[var(--color-muted)]"> · Arm {cls.arm}</span>}
                                            </p>
                                            {!isTeacher && (
                                                <p className="text-xs text-[var(--color-muted)]">
                                                    {cls.teachers.length > 0 ? `Teacher: ${cls.teachers.join(', ')}` : 'No teacher assigned yet'}
                                                    {cls.learners !== undefined && ` · ${plural(cls.learners, 'learner')}`}
                                                </p>
                                            )}
                                        </div>
                                        {cls.grade_level && (
                                            <span className="shrink-0 rounded-lg bg-[var(--color-primary-5)] px-2 py-1 text-[11px] font-bold text-[var(--color-primary)]">
                                                {cls.grade_level}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                <section id="notifications" className={`${card} mt-6 scroll-mt-20`} aria-labelledby="notifications-heading">
                    <div className="flex items-center gap-2 pb-3">
                        <Bell className="w-4 h-4 text-[var(--color-primary)]" aria-hidden />
                        <h2 id="notifications-heading" className="text-base font-bold text-[var(--color-text)]">Pop-up notifications</h2>
                    </div>
                    <PopUpSetting userId={user?.id} isLearner={user?.role === 'learner'} />
                </section>

                {profile?.ai_training && (
                    <section className={`${card} mt-6`} aria-labelledby="privacy-heading">
                        <div className="flex items-center gap-2 pb-3">
                            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" aria-hidden />
                            <h2 id="privacy-heading" className="text-base font-bold text-[var(--color-text)]">Your data and AI</h2>
                        </div>
                        <AiTrainingChoice initial={profile.ai_training.allowed} canChange={profile.ai_training.can_change} />
                    </section>
                )}

                {/* Rare and irreversible, so it comes last and stays quiet until needed. */}
                <section className="rounded-3xl border border-rose-500/30 bg-[var(--color-surface)] p-5 sm:p-6 mt-10" aria-labelledby="danger-heading">
                    <div className="flex items-center gap-2 pb-4">
                        <AlertTriangle className="w-4 h-4 text-rose-500" aria-hidden />
                        <h2 id="danger-heading" className="text-base font-bold text-[var(--color-text)]">Leave AceDrill</h2>
                    </div>

                    {!isOnline && (
                        <p className="pb-3 text-xs text-[var(--color-muted)]">You need to be online to deactivate or delete your account.</p>
                    )}
                    {error && <p role="alert" className="pb-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

                    <div className="grid md:grid-cols-2 gap-x-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-t border-[var(--color-border)]">
                            <div className="min-w-0 flex-1 basis-56">
                                <p className="text-sm font-bold text-[var(--color-text)]">Deactivate account</p>
                                <p className="text-xs text-[var(--color-muted)]">Sign out and block sign-in until an administrator reactivates you. Nothing is deleted.</p>
                            </div>
                            <button
                                type="button"
                                disabled={!isOnline || busy !== null}
                                onClick={() => void run('deactivate')}
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-xl border border-amber-500/40 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {busy === 'deactivate' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Deactivate
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-t border-[var(--color-border)]">
                            <div className="min-w-0 flex-1 basis-56">
                                <p className="text-sm font-bold text-[var(--color-text)]">Delete account</p>
                                <p className="text-xs text-[var(--color-muted)]">Remove your account and sign out. You will not be able to sign in again.</p>
                            </div>
                            <button
                                type="button"
                                disabled={!isOnline || busy !== null}
                                onClick={() => void run('delete')}
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {busy === 'delete' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Delete account
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
