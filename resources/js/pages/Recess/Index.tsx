import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, BookOpen, Brain, Coffee, Layers, Lock } from 'lucide-react';
import { getCachedSubjects } from '@/services/OfflineService';
import { getSyncUser } from '@/services/SyncQueue';
import { sendOrQueue } from '@/services/SyncService';
import {
    BREAK_MINUTES, MAX_BREAKS, finishBreak, isOnBreak, onRecessChange, readRecess, ringBell, startBreak, type RecessState,
} from '@/services/Recess';
import { wordsForSubjects } from '@/components/recess/words';
import WordSearch from '@/components/recess/WordSearch';
import MakeTwentyFour from '@/components/recess/MakeTwentyFour';
import ConnectFour from '@/components/recess/ConnectFour';
import WordOfTheDay from '@/components/recess/WordOfTheDay';

type Game = 'word_search' | 'make_24' | 'connect_four' | 'word_of_the_day';

const GAMES: { id: Game; name: string; blurb: string }[] = [
    { id: 'word_search', name: 'Word Search', blurb: 'Find words from your subjects' },
    { id: 'make_24', name: 'Make 24', blurb: 'Quick mental maths' },
    { id: 'connect_four', name: 'Connect 4', blurb: 'Four in a row' },
    { id: 'word_of_the_day', name: 'Word of the Day', blurb: 'One subject word a day' },
];

const clock = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function RecessIndex() {
    const { auth } = usePage<{ auth: { user?: { recess_enabled?: boolean } | null } }>().props;
    const enabled = auth?.user?.recess_enabled !== false;

    const [state, setState] = useState<RecessState>(readRecess);
    const [now, setNow] = useState(Date.now());
    const [game, setGame] = useState<Game>('word_search');
    const [subjectNames, setSubjectNames] = useState<string[]>([]);
    const [bellRang, setBellRang] = useState(false);
    const [winNote, setWinNote] = useState<string | null>(null);

    useEffect(() => onRecessChange(() => setState(readRecess())), []);
    useEffect(() => {
        getCachedSubjects().then((subjects) => setSubjectNames(subjects.map((s) => s.name))).catch(() => {});
    }, []);

    // A break that ended while the learner was away just ends; one that ends on screen rings.
    useEffect(() => {
        if (state.endsAt !== null && state.endsAt <= Date.now()) finishBreak();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onBreak = isOnBreak(state, now);
    useEffect(() => {
        if (!onBreak) return;
        const t = setInterval(() => {
            const t2 = Date.now();
            setNow(t2);
            const s = readRecess();
            if (s.endsAt !== null && s.endsAt <= t2) {
                finishBreak();
                ringBell();
                setBellRang(true);
            }
        }, 1000);
        return () => clearInterval(t);
    }, [onBreak]);

    const pool = useMemo(() => wordsForSubjects(subjectNames), [subjectNames]);

    const reportWin = async (which: Game) => {
        if (!getSyncUser()) return;
        try {
            const result = await sendOrQueue<{ xp_earned: number }>({
                table_name: 'recessWins',
                endpoint: '/api/v1/recess/wins',
                method: 'POST',
                payload: { game: which, won_at: new Date().toISOString() },
            });
            if (result.status === 'sent') {
                setWinNote(result.data.xp_earned > 0 ? `+${result.data.xp_earned} XP for the win!` : "Nice win! You've already had today's Recess XP.");
            } else if (result.status === 'queued') {
                setWinNote('Nice win! If it is your first today, your XP is added when you are back online.');
            }
        } catch {
            // The win still counts on screen; XP is a bonus.
        }
    };

    useEffect(() => {
        if (!winNote) return;
        const t = setTimeout(() => setWinNote(null), 4000);
        return () => clearTimeout(t);
    }, [winNote]);

    const remaining = state.endsAt ? state.endsAt - now : 0;
    const progress = onBreak ? remaining / (BREAK_MINUTES * 60_000) : 0;

    const header = <PageHeader icon={Coffee} title="Recess" subtitle={`Learn first, then take a ${BREAK_MINUTES}-minute break.`} />;

    return (
        <AuthenticatedLayout header={header}>
            <Head title="Recess" />

            <div className="max-w-5xl mx-auto space-y-6">
                {!enabled ? (
                    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center space-y-2">
                        <Lock className="w-8 h-8 mx-auto text-[var(--color-muted)]" aria-hidden />
                        <h2 className="text-lg font-bold text-[var(--color-text)]">Recess is switched off for your school</h2>
                        <p className="text-sm text-[var(--color-muted)]">Your school has turned game breaks off. Keep going with your lessons!</p>
                    </section>
                ) : onBreak ? (
                    <>
                        <section className="sticky top-0 md:top-16 z-20 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 shadow-xs">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Coffee className="w-5 h-5 text-[var(--color-primary)]" aria-hidden />
                                    <span className="text-sm font-bold text-[var(--color-text)]">Break time</span>
                                </div>
                                <span className="text-2xl font-extrabold tabular-nums text-[var(--color-text)]" aria-label={`${clock(remaining)} left`}>
                                    {clock(remaining)}
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden" aria-hidden>
                                <div className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
                            </div>
                        </section>

                        <nav className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="Games">
                            {GAMES.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setGame(g.id)}
                                    aria-pressed={game === g.id}
                                    className={`text-left rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                                        game === g.id
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-10)]'
                                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                                    }`}
                                >
                                    <span className="block text-sm font-bold text-[var(--color-text)]">{g.name}</span>
                                    <span className="block text-xs text-[var(--color-muted)]">{g.blurb}</span>
                                </button>
                            ))}
                        </nav>

                        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
                            {game === 'word_search' && <WordSearch pool={pool} onWin={() => reportWin('word_search')} />}
                            {game === 'make_24' && <MakeTwentyFour onWin={() => reportWin('make_24')} />}
                            {game === 'connect_four' && <ConnectFour onWin={() => reportWin('connect_four')} />}
                            {game === 'word_of_the_day' && <WordOfTheDay onWin={() => reportWin('word_of_the_day')} />}
                        </section>
                    </>
                ) : (
                    <>
                        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                                        {state.breaks > 0
                                            ? `You have ${state.breaks} ${state.breaks === 1 ? 'break' : 'breaks'} ready`
                                            : 'Earn your next break'}
                                    </h2>
                                    <p className="text-sm text-[var(--color-muted)]">
                                        Each quiz, flashcard deck or daily review you finish earns a {BREAK_MINUTES}-minute break (up to {MAX_BREAKS} saved).
                                    </p>
                                </div>
                                {state.breaks > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            startBreak();
                                            setNow(Date.now());
                                            setBellRang(false);
                                        }}
                                        className="min-h-11 px-5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold cursor-pointer hover:opacity-90"
                                    >
                                        Start a {BREAK_MINUTES}-minute break
                                    </button>
                                )}
                            </div>

                            {state.breaks === 0 && (
                                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                    <Link href="/subjects" className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50">
                                        <BookOpen className="w-4 h-4 text-[var(--color-primary)]" aria-hidden /> Take a quiz
                                    </Link>
                                    <Link href="/flashcards" className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50">
                                        <Layers className="w-4 h-4 text-[var(--color-primary)]" aria-hidden /> Review flashcards
                                    </Link>
                                    <Link href="/dashboard" className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50">
                                        <Brain className="w-4 h-4 text-[var(--color-primary)]" aria-hidden /> Do the daily review
                                    </Link>
                                </div>
                            )}
                        </section>

                        {/* One puzzle a day is a reason to open the app, so it doesn't need a break. */}
                        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 space-y-4">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--color-text)]">Word of the Day</h2>
                                <p className="text-sm text-[var(--color-muted)]">Free every day, no break needed.</p>
                            </div>
                            <WordOfTheDay onWin={() => reportWin('word_of_the_day')} />
                        </section>
                    </>
                )}
            </div>

            {winNote && (
                <div role="status" className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] px-4 py-2 text-sm font-bold shadow-lg">
                    {winNote}
                </div>
            )}

            {bellRang && (
                <div onMouseDown={(e) => { if (e.target === e.currentTarget) setBellRang(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="bell-title">
                    <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 text-center space-y-4 shadow-2xl">
                        <BellRing className="w-10 h-10 mx-auto text-[var(--color-accent)]" aria-hidden />
                        <h2 id="bell-title" className="text-xl font-extrabold text-[var(--color-text)]">Break's over!</h2>
                        <p className="text-sm text-[var(--color-muted)]">Time to crush your next topic 🚀</p>
                        <div className="flex flex-col gap-2">
                            <Link href="/dashboard" className="min-h-11 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold">
                                Back to learning
                            </Link>
                            <button type="button" onClick={() => setBellRang(false)} className="min-h-11 rounded-xl text-sm font-bold text-[var(--color-muted)] cursor-pointer">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
