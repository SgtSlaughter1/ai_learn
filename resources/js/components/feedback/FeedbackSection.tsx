import React, { useState } from 'react';
import { submitFeedback } from '@/services/FeedbackOutbox';

export default function FeedbackSection() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        message: '',
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.message.trim()) return;

        setStatusMessage(null);
        setSubmitting(true);

        const payload = {
            name: form.name.trim() || undefined,
            email: form.email.trim() || undefined,
            role: 'visitor',
            category: 'general_feedback',
            message: form.message.trim(),
            meta: {
                source: 'landing_page_feedback_section',
                screen_width: window.innerWidth,
                online: navigator.onLine,
            },
        };

        try {
            const result = await submitFeedback(payload);
            if (result.status === 'rejected') {
                setStatusMessage({ text: result.error, type: 'error' });
                return;
            }
            setSubmitted(true);
            setStatusMessage(
                result.status === 'sent'
                    ? { text: 'Thank you. Your feedback has been received.', type: 'success' }
                    : { text: 'Your feedback has been saved and will be sent automatically once you are back online.', type: 'success' }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setSubmitted(false);
        setStatusMessage(null);
        setForm({
            name: '',
            email: '',
            message: '',
        });
    };

    return (
        <section id="feedback" className="py-16 sm:py-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight">
                        We Value Your Feedback
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-[var(--color-muted)] max-w-lg mx-auto">
                        Have a question, a suggestion, or need help? Share your thoughts with our team.
                    </p>
                </div>

                <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
                    {submitted ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-12 h-12 rounded-full bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center mx-auto">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text)]">
                                Thank You
                            </h3>
                            <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto">
                                {statusMessage?.text}
                            </p>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="mt-4 px-5 py-2 text-xs font-bold text-[var(--color-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl transition-colors cursor-pointer"
                            >
                                Send Another Note
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {statusMessage && statusMessage.type === 'error' && (
                                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400">
                                    {statusMessage.text}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="feedback-name" className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                        Your Name <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="feedback-name"
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. Samuel"
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)] transition-colors"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="feedback-email" className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                        Email Address <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="feedback-email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="samuel@example.com"
                                        className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)] transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="feedback-message" className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                    Your Feedback or Question <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="feedback-message"
                                    rows={5}
                                    required
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    placeholder="Write your feedback, question, or suggestion here..."
                                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)] transition-colors resize-none h-32 overflow-y-auto"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-between gap-4">
                                <span className="text-xs text-[var(--color-muted)]">
                                    Works online and offline
                                </span>
                                <button
                                    type="submit"
                                    disabled={submitting || !form.message.trim()}
                                    className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <span>Sending...</span>
                                    ) : (
                                        <span>Send Feedback</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
