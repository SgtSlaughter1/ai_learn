import { useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import LearnerDashboard from './learner/Dashboard';

export default function DashboardDispatcher() {
    const { auth } = usePage<{ auth?: { user?: { role?: string } } }>().props;

    const role = auth?.user?.role;

    useEffect(() => {
        if (role === 'platform_admin' || role === 'school_admin') {
            window.location.href = '/admin/dashboard';
        } else if (role === 'teacher') {
            window.location.href = '/teacher/dashboard';
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
