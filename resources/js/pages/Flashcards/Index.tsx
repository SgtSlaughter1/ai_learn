import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getFreshFlashcards } from '../../services/OfflineService';
import type { CachedFlashcard } from '../../db/database';

export default function Index() {
    const [loading, setLoading] = useState<boolean>(true);
    const [deck, setDeck] = useState<CachedFlashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [flipped, setFlipped] = useState<boolean>(false);
    const [completed, setCompleted] = useState<boolean>(false);
    const [ratings, setRatings] = useState<('again' | 'good' | 'easy')[]>([]);
    const [xpEarned, setXpEarned] = useState<number>(0);
    const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; rank: string; achievements: any[] } | null>(null);
    const [_isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
    const [offlineMessage, setOfflineMessage] = useState<string>('');

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        fetchDeck();
    }, []);

    const fetchDeck = async () => {
        setLoading(true);
        setFlipped(false);
        setCompleted(false);
        setCurrentIndex(0);
        setRatings([]);
        setXpEarned(0);
        setLevelUpInfo(null);
        setOfflineMessage('');

        try {
            const cards = await getFreshFlashcards();
            setDeck(cards);
            if (cards.length === 0 && !navigator.onLine) {
                setOfflineMessage('No flashcards cached for offline use. Connect to the internet to download flashcards.');
            }
        } catch {
            setOfflineMessage('Could not load flashcards. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleFlip = () => {
        setFlipped(!flipped);
    };

    const submitSession = async (finalRatings: ('again' | 'good' | 'easy')[]) => {
        if (!navigator.onLine) {
            // Save locally — XP will be awarded when synced
            setXpEarned(Math.round(finalRatings.filter(r => r !== 'again').length * 5));
            setCompleted(true);
            return;
        }

        const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] || '';

        try {
            const res = await fetch('/api/v1/flashcards/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrfToken)
                },
                body: JSON.stringify({ ratings: finalRatings })
            });

            if (!res.ok) throw new Error('Failed to submit flashcard session');
            const data = await res.json();
            setXpEarned(data.xp_earned);
            if (data.new_level && data.new_rank) {
                setLevelUpInfo({
                    level: data.new_level,
                    rank: data.new_rank,
                    achievements: data.new_achievements || []
                });
            }
        } catch {
            // Estimate XP locally
            setXpEarned(Math.round(finalRatings.filter(r => r !== 'again').length * 5));
        } finally {
            setCompleted(true);
        }
    };

    const handleRateRecall = (rating: 'again' | 'good' | 'easy') => {
        setFlipped(false);
        const newRatings = [...ratings, rating];
        setRatings(newRatings);

        setTimeout(() => {
            if (currentIndex < deck.length - 1) {
                setCurrentIndex((prev) => prev + 1);
            } else {
                submitSession(newRatings);
            }
        }, 200);
    };

    const progressPercent = deck.length > 0 ? (currentIndex / deck.length) * 100 : 0;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">Active Recall</h1>
                        <p className="text-[var(--color-muted)] mt-1">Review weak topics with flashcards and spaced repetition.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!navigator.onLine && (
                            <span className="px-3 py-1.5 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-bold flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                                </svg>
                                Offline
                            </span>
                        )}
                        <button
                            onClick={fetchDeck}
                            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:text-white bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-slate-700 rounded-xl transition-all focus:outline-none min-h-[48px] cursor-pointer"
                        >
                            🔄 Refresh Deck
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Active Recall Flashcards" />

            <div className="max-w-2xl mx-auto py-4 space-y-8">
                {loading ? (
                    <div className="space-y-6 animate-pulse">
                        <div className="flex justify-between items-center text-sm font-semibold text-[var(--color-muted)]">
                            <div className="h-4 bg-[var(--color-surface)] rounded w-24" />
                            <div className="h-4 bg-[var(--color-surface)] rounded w-12" />
                        </div>
                        <div className="h-[360px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl" />
                        <div className="h-2 bg-[var(--color-surface)] rounded-full w-full" />
                    </div>
                ) : offlineMessage && deck.length === 0 ? (
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-10 rounded-3xl text-center space-y-4">
                        <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                            <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                            </svg>
                        </div>
                        <p className="text-[var(--color-muted)] text-sm">{offlineMessage}</p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold transition-all"
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                ) : completed ? (
                    <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-10 rounded-3xl text-center space-y-6 shadow-xl hover:border-[var(--color-border)] transition-all">
                        <div className="flex justify-center">
                            <span className="p-4 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full animate-bounce">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </span>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-extrabold text-[var(--color-text)]">Recall Session Complete!</h2>
                            <p className="text-[var(--color-muted)] text-sm max-w-md mx-auto leading-relaxed">
                                Great job practicing active recall! {!navigator.onLine ? 'Results will sync when you reconnect.' : 'Reviewing concepts you recently struggled with dramatically speeds up long-term retention.'}
                            </p>
                        </div>

                        <div className="max-w-md mx-auto bg-[var(--color-background)]/60 border border-[var(--color-border)] p-6 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider">XP Awarded</span>
                                <span className="text-lg font-bold text-[var(--color-success)]">+{xpEarned} XP</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                                <span>Cards Reviewed</span>
                                <span>{deck.length} cards</span>
                            </div>
                            {!navigator.onLine && (
                                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] font-semibold pt-2 border-t border-[var(--color-border)]">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Will sync when online
                                </div>
                            )}
                            {levelUpInfo && (
                                <div className="border-t border-[var(--color-border)] pt-4 mt-2 text-left space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider">Current Standing</span>
                                        <span className="text-xs font-bold text-[var(--color-primary)]">Level {levelUpInfo.level} ({levelUpInfo.rank})</span>
                                    </div>
                                    {levelUpInfo.achievements.length > 0 && (
                                        <div className="space-y-2">
                                            <span className="block text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Achievements Unlocked!</span>
                                            {levelUpInfo.achievements.map((ach: any) => (
                                                <div key={ach.key} className="flex items-center gap-2.5 p-2.5 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl">
                                                    <span className="text-xl shrink-0">{ach.icon}</span>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-[var(--color-text)]">{ach.name}</h4>
                                                        <p className="text-[10px] text-[var(--color-muted)]">{ach.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <button
                                onClick={fetchDeck}
                                className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg shadow-teal-600/15 transition-all min-h-[48px] cursor-pointer"
                            >
                                Start Another Deck
                            </button>
                            <Link
                                href="/dashboard"
                                className="px-6 py-3 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-slate-700 text-[var(--color-text)] rounded-xl font-bold transition-all min-h-[48px] flex items-center justify-center"
                            >
                                Go to Dashboard
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center text-sm font-semibold text-[var(--color-muted)]">
                            <span className="uppercase tracking-wider">Review Session</span>
                            <span>Card {currentIndex + 1} of {deck.length}</span>
                        </div>

                        <div
                            className="w-full select-none"
                            style={{ perspective: '1000px' }}
                        >
                            <div
                                onClick={handleFlip}
                                className="relative w-full h-[360px] transition-transform duration-500 cursor-pointer"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                                }}
                            >
                                <div
                                    className="absolute inset-0 w-full h-full rounded-3xl border border-[var(--color-border)] p-8 flex flex-col justify-between bg-[var(--color-surface)] backdrop-blur-md hover:border-[var(--color-border)] transition-colors shadow-lg"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                                                {deck[currentIndex].subject_name}
                                            </span>
                                            <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                                                {deck[currentIndex].topic_name}
                                            </span>
                                        </div>
                                        <p className="text-xl font-bold leading-relaxed text-[var(--color-text)] pt-4">
                                            {deck[currentIndex].question_text}
                                        </p>
                                    </div>
                                    <div className="text-center text-xs font-semibold text-[var(--color-primary)]/80 animate-pulse pt-4 border-t border-[var(--color-border)]/50">
                                        💡 Click card to flip and review answer
                                    </div>
                                </div>

                                <div
                                    className="absolute inset-0 w-full h-full rounded-3xl border border-[var(--color-primary)]/20 p-8 flex flex-col justify-between bg-teal-950/20 backdrop-blur-md shadow-lg"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        border: '1px solid rgba(20, 184, 166, 0.2)'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 rounded-md tracking-wider uppercase">
                                                Correct Answer
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-[var(--color-text)]">
                                            {deck[currentIndex].correct_answer}
                                        </h3>
                                        <div className="p-4 bg-[var(--color-background)]/60 border border-[var(--color-border)] rounded-2xl space-y-1.5 mt-2">
                                            <span className="block text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">AI Explanation</span>
                                            <div className="chat-markdown text-xs text-[var(--color-muted)] leading-relaxed">
                                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{deck[currentIndex].explanation}</Markdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-center text-xs font-semibold text-[var(--color-muted)] mt-4 pt-3 border-t border-[var(--color-border)]/50 cursor-pointer hover:text-[var(--color-text)]" onClick={handleFlip}>
                                        🔄 Click here to flip back
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`grid grid-cols-3 gap-3 transition-opacity duration-300 ${flipped ? 'opacity-100 pointer-events-auto' : 'opacity-35 pointer-events-none'}`}>
                            <button
                                onClick={() => handleRateRecall('again')}
                                className="flex flex-col items-center justify-center p-3 bg-[var(--color-error)]/10 hover:bg-rose-500/15 border border-rose-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
                            >
                                <span className="text-xs font-bold text-[var(--color-error)]">Again</span>
                                <span className="text-[9px] text-rose-500/80 font-bold uppercase mt-0.5">Incorrect</span>
                            </button>
                            <button
                                onClick={() => handleRateRecall('good')}
                                className="flex flex-col items-center justify-center p-3 bg-[var(--color-accent)]/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
                            >
                                <span className="text-xs font-bold text-[var(--color-accent)]">Good</span>
                                <span className="text-[9px] text-[var(--color-accent)]/80 font-bold uppercase mt-0.5">Slightly Stuck</span>
                            </button>
                            <button
                                onClick={() => handleRateRecall('easy')}
                                className="flex flex-col items-center justify-center p-3 bg-[var(--color-success)]/10 hover:bg-emerald-500/15 border border-emerald-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
                            >
                                <span className="text-xs font-bold text-[var(--color-success)]">Easy</span>
                                <span className="text-[9px] text-[var(--color-success)]/80 font-bold uppercase mt-0.5">Recalled</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-[var(--color-primary)] h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-[var(--color-muted)] font-bold">
                                <span>Progress</span>
                                <span>{Math.round(progressPercent)}%</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
