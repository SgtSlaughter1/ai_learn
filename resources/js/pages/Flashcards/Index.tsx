import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getFreshFlashcards } from '@/services/OfflineService';
import type { CachedFlashcard } from '@/db/database';
import { FlashcardCard } from '@/components/flashcards/FlashcardCard';
import { FlashcardRatingBar, RecallRating } from '@/components/flashcards/FlashcardRatingBar';
import { FlashcardSessionComplete } from '@/components/flashcards/FlashcardSessionComplete';
import { FlashcardProgressBar } from '@/components/flashcards/FlashcardProgressBar';

export default function Index() {
    const [loading, setLoading] = useState<boolean>(true);
    const [deck, setDeck] = useState<CachedFlashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [flipped, setFlipped] = useState<boolean>(false);
    const [completed, setCompleted] = useState<boolean>(false);
    const [ratings, setRatings] = useState<RecallRating[]>([]);
    const [xpEarned, setXpEarned] = useState<number>(0);
    const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; tier: string; achievements: any[] } | null>(null);
    const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
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

    const submitSession = async (finalRatings: RecallRating[]) => {
        if (!navigator.onLine) {
            setXpEarned(Math.round(finalRatings.filter((r) => r !== 'again').length * 5));
            setCompleted(true);
            return;
        }

        const csrfToken =
            document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || '';

        try {
            const res = await fetch('/api/v1/flashcards/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrfToken),
                },
                body: JSON.stringify({ ratings: finalRatings }),
            });

            if (!res.ok) throw new Error('Failed to submit flashcard session');
            const data = await res.json();
            setXpEarned(data.xp_earned);
            if (data.new_level && data.new_tier) {
                setLevelUpInfo({
                    level: data.new_level,
                    tier: data.new_tier,
                    achievements: data.new_achievements || [],
                });
            }
        } catch {
            setXpEarned(Math.round(finalRatings.filter((r) => r !== 'again').length * 5));
        } finally {
            setCompleted(true);
        }
    };

    const handleRateRecall = (rating: RecallRating) => {
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

    const currentCard = deck[currentIndex];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
                            Active Recall
                        </h1>
                        <p className="text-[var(--color-muted)] mt-1">
                            Review weak topics with flashcards and spaced repetition.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isOffline && (
                            <span className="px-3 py-1.5 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-bold flex items-center gap-1.5">
                                <WifiOff className="w-3.5 h-3.5" />
                                Offline
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={fetchDeck}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:text-white bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-slate-700 rounded-xl transition-all focus:outline-none min-h-[48px] cursor-pointer"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh Deck
                        </button>
                    </div>
                </div>
            }
        >
            <Head>
                <title>Active Recall Flashcards & Spaced Repetition | AILEARN</title>
                <meta name="description" content="Practice curriculum concepts with spaced-repetition flashcards on AILEARN. Build long-term memory and topic mastery offline." />
            </Head>

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
                            <WifiOff className="w-8 h-8 text-[var(--color-accent)]" />
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
                    <FlashcardSessionComplete
                        xpEarned={xpEarned}
                        cardsCount={deck.length}
                        isOnline={!isOffline}
                        levelUpInfo={levelUpInfo}
                        onRestart={fetchDeck}
                    />
                ) : (
                    currentCard && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center text-sm font-semibold text-[var(--color-muted)]">
                                <span className="uppercase tracking-wider">Review Session</span>
                                <span>
                                    Card {currentIndex + 1} of {deck.length}
                                </span>
                            </div>

                            {/* 3D Flippable Flashcard */}
                            <FlashcardCard
                                card={currentCard}
                                flipped={flipped}
                                onFlip={handleFlip}
                            />

                            {/* Spaced Repetition Rating Bar */}
                            <FlashcardRatingBar
                                flipped={flipped}
                                onRate={handleRateRecall}
                            />

                            {/* Progress Bar */}
                            <FlashcardProgressBar
                                currentIndex={currentIndex}
                                totalCards={deck.length}
                            />
                        </div>
                    )
                )}
            </div>
        </AuthenticatedLayout>
    );
}
