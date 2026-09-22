import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { PastQuestionsHub } from '@/components/past-questions/PastQuestionsHub';

export default function PastQuestionsIndex() {
    return (
        <AuthenticatedLayout>
            <Head title="Past Questions & CBT Exam Simulation Hub" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <PastQuestionsHub />
            </div>
        </AuthenticatedLayout>
    );
}
