import { useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import LearnerDashboard from './learner/Dashboard';

export default function DashboardDispatcher() {
    const { auth } = usePage<{ auth?: { user?: { role?: string } } }>().props;

    const role = auth?.user?.role;

    useEffect(() => {
        // App navigation (not a full reload) so this also works offline.
        if (role === 'platform_admin' || role === 'school_admin') {
            router.visit('/admin/dashboard', { replace: true });
        } else if (role === 'teacher') {
            router.visit('/teacher/dashboard', { replace: true });
        }
    }, [role]);

    if (role === 'platform_admin' || role === 'school_admin' || role === 'teacher') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-r-transparent"></div>
            </div>
        );
    }

    return <LearnerDashboard />;
}
