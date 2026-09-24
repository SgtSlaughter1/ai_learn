import type { SubjectItem, TopicItem } from '@/types/admin';

interface TopicManagerModalProps {
    subject: SubjectItem | null;
    topicsList: TopicItem[];
    loadingTopics: boolean;
    onClose: () => void;
    onOpenAddTopicModal: () => void;
    onEditTopic: (topic: TopicItem) => void;
    onDeleteTopic: (topic: TopicItem) => void;
}

export default function TopicManagerModal({
    subject,
    topicsList,
    loadingTopics,
    onClose,
    onOpenAddTopicModal,
    onEditTopic,
    onDeleteTopic,
}: TopicManagerModalProps) {
    if (!subject) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">
                            Topics in {subject.name}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)]">
                            {topicsList.length} total topics configured
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onOpenAddTopicModal}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Add Topic</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                    {loadingTopics ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="h-16 bg-[var(--color-primary-5)] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : topicsList.length === 0 ? (
                        <p className="text-center py-8 text-[var(--color-muted)] text-xs">
                            No topics created for this subject yet.
                        </p>
                    ) : (
                        topicsList.map((top) => (
                            <div
                                key={top.id}
                                className="p-4 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-bold text-sm text-[var(--color-text)]">{top.name}</h5>
                                        {top._pendingSync && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                Pending Sync
                                            </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] text-[10px] font-bold">
                                            {top.level}
                                        </span>
                                    </div>
                                    {top.description && (
                                        <p className="text-[11px] text-[var(--color-muted)]">{top.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onEditTopic(top)}
                                        className="px-2.5 py-1 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all border border-[var(--color-border)]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteTopic(top)}
                                        className="px-2.5 py-1 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
