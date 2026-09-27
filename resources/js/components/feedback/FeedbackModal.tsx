import React, { useState } from 'react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialName?: string;
    initialEmail?: string;
}

export default function FeedbackModal({
    isOpen,
    onClose,
    initialName = '',
    initialEmail = '',
}: FeedbackModalProps) {
    const [name, setName] = useState(initialName);
    const [email, setEmail] = useState(initialEmail);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setError(null);
        setSubmitting(true);

        const payload = {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
            role: 'visitor',
            category: 'general_feedback',
            message: message.trim(),
            meta: {
                url: window.location.href,
                online: navigator.onLine,
            },
        };

        try {
            if (!navigator.onLine) {
                const existingQueue = JSON.parse(localStorage.getItem('offline_feedbacks') || '[]');
                existingQueue.push({ ...payload, queued_at: new Date().toISOString() });
                localStorage.setItem('offline_feedbacks', JSON.stringify(existingQueue));

                setSubmitted(true);
                return;
            }

            const res = await fetch('/api/v1/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                setSubmitted(true);
            } else {
                setError(data.message || 'Unable to send feedback. Please try again.');
            }
        } catch {
            const existingQueue = JSON.parse(localStorage.getItem('offline_feedbacks') || '[]');
            existingQueue.push({ ...payload, queued_at: new Date().toISOString() });
            localStorage.setItem('offline_feedbacks', JSON.stringify(existingQueue));
            setSubmitted(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setSubmitted(false);
        setError(null);
        setMessage('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    aria-label="Close modal"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {submitted ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--color-text)]">
                            Feedback Received
                        </h3>
                        <p className="text-sm text-[var(--color-muted)]">
                            Thank you for helping us improve AceDrill.
                        </p>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-2.5 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-xl font-black text-[var(--color-text)] mb-1">
                            Share Feedback
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--color-muted)] mb-5">
                            We read every message to help improve learning on AceDrill.
                        </p>

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="modal-feedback-name" className="block text-xs font-bold text-[var(--color-text)] mb-1">
                                    Name <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                                </label>
                                <input
                                    id="modal-feedback-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)]"
                                />
                            </div>

                            <div>
                                <label htmlFor="modal-feedback-email" className="block text-xs font-bold text-[var(--color-text)] mb-1">
                                    Email <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                                </label>
                                <input
                                    id="modal-feedback-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)]"
                                />
                            </div>

                            <div>
                                <label htmlFor="modal-feedback-message" className="block text-xs font-bold text-[var(--color-text)] mb-1">
                                    Your Feedback <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="modal-feedback-message"
                                    rows={4}
                                    required
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="What went well or what can we improve?"
                                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none text-[var(--color-text)] resize-y min-h-[100px]"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !message.trim()}
                                    className="px-6 py-2.5 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? 'Sending...' : 'Send Feedback'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
