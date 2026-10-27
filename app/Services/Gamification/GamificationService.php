<?php

namespace App\Services\Gamification;

use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class GamificationService
{
    /**
     * Base XP reward amounts.
     */
    public const XP_CORRECT_ANSWER = 1;

    public const XP_QUIZ_COMPLETE_BASE = 5;

    public const XP_PERFECT_SCORE_BONUS = 3;

    public const XP_FIRST_ATTEMPT_BONUS = 2;

    public const XP_STREAK_DAILY_BONUS = 5;

    /**
     * Most XP a learner can earn per server day from sources the device reports (the server can't
     * re-check the ratings or counts). About three full decks or revision sessions; without a cap a
     * script could mint unlimited XP and top the leaderboard.
     */
    /** XP taken when a streak breaks without a shield. */
    private const STREAK_MISS_PENALTY = 15;

    /** Streak lengths that earn a Streak Freeze shield, and how many a learner can hold. */
    private const SHIELD_MILESTONES = [7, 14, 30];

    private const MAX_SHIELDS = 2;

    private const DAILY_XP_CAPS = [
        'flashcard_review' => 75,
        'daily_revision_bonus' => 30,
    ];

    /**
     * In-memory cache for loaded user profiles during the current request lifecycle.
     *
     * @var array<string, UserGamification>
     */
    private array $profileCache = [];

    public function __construct(private AchievementService $achievements) {}

    // ──────────────────────────────────────────────────────────────────────────
    // Public API Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve or initialize the gamification profile for a user.
     */
    public function getProfile(User $user): UserGamification
    {
        if (isset($this->profileCache[$user->id])) {
            return $this->profileCache[$user->id];
        }

        $profile = UserGamification::firstOrCreate(
            ['user_id' => $user->id],
            [
                'total_xp' => 0,
                'level' => 1,
                'tier' => 'Newcomer',
                'current_streak' => 0,
                'longest_streak' => 0,
            ]
        );

        Levels::recalculate($profile);
        $this->profileCache[$user->id] = $profile;

        return $profile;
    }

    /**
     * When a learning activity happened, from a client-supplied timestamp (offline work
     * synced later). Clamped so a wrong device clock can't move it into the future or
     * more than 30 days back; missing or invalid values mean "now".
     */
    public static function activityTime(mixed $value): Carbon
    {
        if (! is_string($value) || $value === '') {
            return now();
        }
        try {
            // In the app's timezone: a device sends UTC ("...Z"), and both startOfDay() for streaks
            // and Eloquent (which saves the wall-clock time as is) need the app's local time.
            $at = Carbon::parse($value)->setTimezone(config('app.timezone'));
        } catch (\Throwable) {
            return now();
        }
        if ($at->isFuture()) {
            return now();
        }

        return $at->lt(now()->subDays(30)) ? now()->subDays(30) : $at;
    }

    /**
     * Re-read the profile with a row lock (call inside a transaction) so concurrent XP
     * writes for the same learner queue up instead of overwriting each other's totals.
     */
    private function lockProfile(User $user): UserGamification
    {
        $profile = $this->getProfile($user);

        // Refresh the cached instance in place so every caller keeps sharing one object.
        $locked = UserGamification::whereKey($profile->getKey())->lockForUpdate()->first();
        $profile->setRawAttributes($locked->getAttributes(), true);

        return $profile;
    }

    /**
     * Process XP awards, streaks, and achievements upon quiz completion.
     *
     * @return array Newly earned achievements
     */
    public function processQuizCompletion(User $user, QuizAttempt $attempt, Quiz $quiz, ?Carbon $activityAt = null): array
    {
        return DB::transaction(function () use ($user, $attempt, $quiz, $activityAt) {
            $profile = $this->lockProfile($user);

            $answers = $attempt->relationLoaded('answers') ? $attempt->answers : $attempt->answers()->get();
            $totalQuestions = $answers->count();
            $correctCount = $answers->where('is_correct', true)->count();

            $xpEarnedTotal = self::XP_QUIZ_COMPLETE_BASE;
            $now = now();
            $transactions = [
                [
                    'user_id' => $user->id,
                    'amount' => self::XP_QUIZ_COMPLETE_BASE,
                    'source' => 'quiz_complete',
                    'description' => "Completed: {$quiz->title}",
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ];

            // 1. Correct answers reward
            $answerXp = $correctCount * self::XP_CORRECT_ANSWER;
            if ($answerXp > 0) {
                $xpEarnedTotal += $answerXp;
                $transactions[] = [
                    'user_id' => $user->id,
                    'amount' => $answerXp,
                    'source' => 'correct_answer',
                    'description' => "{$correctCount} correct answers in {$quiz->title}",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // 2. Perfect score bonus
            if ($totalQuestions > 0 && $correctCount === $totalQuestions) {
                $xpEarnedTotal += self::XP_PERFECT_SCORE_BONUS;
                $transactions[] = [
                    'user_id' => $user->id,
                    'amount' => self::XP_PERFECT_SCORE_BONUS,
                    'source' => 'perfect_score',
                    'description' => "Perfect score on {$quiz->title}!",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // 3. First attempt bonus
            $previousAttempts = QuizAttempt::where('user_id', $user->id)
                ->where('quiz_id', $quiz->id)
                ->where('id', '!=', $attempt->id)
                ->where('status', 'completed')
                ->count();

            if ($previousAttempts === 0) {
                $xpEarnedTotal += self::XP_FIRST_ATTEMPT_BONUS;
                $transactions[] = [
                    'user_id' => $user->id,
                    'amount' => self::XP_FIRST_ATTEMPT_BONUS,
                    'source' => 'first_attempt',
                    'description' => "First attempt on {$quiz->title}",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // 4. Update profile XP and write transactions
            $profile->total_xp += $xpEarnedTotal;
            $profile->save();
            Levels::recalculate($profile);
            XpTransaction::insert($transactions);

            // 5. Update streak (offline attempts count towards the day they were taken)
            $this->updateStreak($user, $activityAt);

            // 6. Check and award achievements
            return $this->achievements->check($user, $this->getProfile($user));
        });
    }

    /**
     * Award an attempt's XP exactly once, however many times it is called (retried jobs,
     * a sync racing the online submit).
     *
     * @return array Newly earned achievements (empty when already awarded)
     */
    public function awardQuizCompletionOnce(QuizAttempt $attempt, ?Carbon $activityAt = null): array
    {
        return DB::transaction(function () use ($attempt, $activityAt) {
            // Atomic claim: only one caller can set it, and it's rolled back if awarding fails.
            $claimed = QuizAttempt::whereKey($attempt->getKey())
                ->whereNull('xp_awarded_at')
                ->update(['xp_awarded_at' => now()]);
            if ($claimed === 0) {
                return [];
            }

            return $this->processQuizCompletion($attempt->user, $attempt, $attempt->quiz, $activityAt);
        });
    }

    /**
     * Record daily activity to maintain user streak.
     */
    public function recordDailyActivity(User $user): void
    {
        $this->updateStreak($user);
    }

    /**
     * Award XP and process gamification updates after a flashcard session.
     *
     * @return array Progress summary (xp_earned, new_level, new_tier, new_achievements)
     */
    public function processFlashcardCompletion(User $user, int $xpEarned, int $cardsReviewed, ?Carbon $activityAt = null): array
    {
        return DB::transaction(function () use ($user, $xpEarned, $cardsReviewed, $activityAt) {
            $this->lockProfile($user); // one session update at a time per learner
            $xpEarned = $this->withinDailyCap($user, 'flashcard_review', $xpEarned);

            // Awarding XP already updates the streak and checks achievements; only do it
            // here when there was no XP to award.
            if ($xpEarned > 0) {
                $award = $this->awardXpLocked($user, $xpEarned, 'flashcard_review', "Reviewed {$cardsReviewed} flashcards", $activityAt);

                return [
                    'xp_earned' => $xpEarned,
                    'new_level' => $award['new_level'],
                    'new_tier' => $award['new_tier'],
                    'new_achievements' => $award['new_achievements'],
                ];
            }

            return [
                'xp_earned' => 0,
                'new_level' => null,
                'new_tier' => null,
                'new_achievements' => $this->recordActivityWithoutXp($user, $activityAt),
            ];
        });
    }

    /**
     * Award XP and process gamification updates after a daily spaced repetition revision session.
     *
     * @return array Progress summary (bonus_xp, total_xp, level, tier, new_level, new_tier, new_achievements)
     */
    public function processRevisionCompletion(User $user, int $correctCount, int $totalQuestions, ?Carbon $activityAt = null): array
    {
        return DB::transaction(function () use ($user, $correctCount, $totalQuestions, $activityAt) {
            $profile = $this->lockProfile($user);
            $oldLevel = $profile->level;
            $oldTier = $profile->tier;

            // Performance-based XP: only award completion bonus XP if learner answered questions correctly
            $bonusXp = 0;
            if ($correctCount > 0) {
                $bonusXp = $correctCount * self::XP_CORRECT_ANSWER;
                if ($totalQuestions > 0 && $correctCount === $totalQuestions) {
                    $bonusXp += self::XP_PERFECT_SCORE_BONUS;
                }
            }
            $bonusXp = $this->withinDailyCap($user, 'daily_revision_bonus', $bonusXp);

            // Awarding XP already updates the streak and checks achievements.
            $newAchievements = $bonusXp > 0
                ? $this->awardXpLocked(
                    $user,
                    $bonusXp,
                    'daily_revision_bonus',
                    "Daily Revision: {$correctCount}/{$totalQuestions} correct",
                    $activityAt
                )['new_achievements']
                : $this->recordActivityWithoutXp($user, $activityAt);

            return [
                'bonus_xp' => $bonusXp,
                'total_xp' => $profile->fresh()->total_xp,
                'level' => $profile->level,
                'tier' => $profile->tier,
                'new_level' => $profile->level > $oldLevel ? $profile->level : null,
                'new_tier' => $profile->tier !== $oldTier ? $profile->tier : null,
                'new_achievements' => $newAchievements,
            ];
        });
    }

    /**
     * Get aggregated gamification dashboard metrics for a user.
     */
    public function getDashboardData(User $user): array
    {
        $profile = $this->getProfile($user);

        // Level & XP Progress Calculations
        $nextLevelThreshold = Levels::THRESHOLDS[$profile->level + 1] ?? null;
        $currentLevelThreshold = Levels::THRESHOLDS[$profile->level] ?? 0;
        $xpIntoLevel = $profile->total_xp - $currentLevelThreshold;
        $xpForNextLevel = $nextLevelThreshold !== null
            ? $nextLevelThreshold - $currentLevelThreshold
            : 0;

        $xpProgressPercent = $xpForNextLevel > 0
            ? min(100, round(($xpIntoLevel / $xpForNextLevel) * 100))
            : 100;

        // Recent XP transactions
        $recentXp = XpTransaction::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (XpTransaction $t) => [
                'amount' => $t->amount,
                'source' => $t->source,
                'description' => $t->description,
                'created_at' => $t->created_at->diffForHumans(),
            ]);

        // Unlocked user achievements
        $achievements = UserAchievement::where('user_id', $user->id)
            ->with('achievement')
            ->orderByDesc('earned_at')
            ->get()
            ->map(fn (UserAchievement $a) => [
                'key' => $a->achievement_key,
                'name' => $a->name,
                'description' => $a->description ?? $a->achievement?->description,
                'icon' => $a->icon ?? $a->achievement?->icon,
                'xp_reward' => $a->achievement?->xp_reward ?? 0,
                'earned_at' => $a->earned_at->diffForHumans(),
            ]);

        // Locked achievements
        $allAchievements = $this->achievements->definitions();
        $earnedKeys = $achievements->pluck('key')->toArray();
        $lockedAchievements = collect($allAchievements)
            ->filter(fn (array $a) => ! in_array($a['key'], $earnedKeys, true))
            ->values();

        $tier = $profile->tier ?? 'Newcomer';
        $tierColor = Levels::tierColor($profile->level);

        $streakInfo = StreakStatus::details($profile);

        return [
            'total_xp' => $profile->total_xp,
            'level' => $profile->level,
            'tier' => $tier,
            'tier_color' => $tierColor,
            'current_streak' => $profile->current_streak,
            'longest_streak' => $profile->longest_streak,
            'streak_freeze_count' => $profile->streak_freeze_count ?? 1,
            'streak_status' => $streakInfo['status'],
            'streak_title' => $streakInfo['title'],
            'next_milestone' => $streakInfo['next_milestone'],
            'is_protected_today' => $streakInfo['is_protected_today'],
            'hours_remaining_today' => $streakInfo['hours_remaining_today'],
            'xp_progress_percent' => $xpProgressPercent,
            'xp_into_level' => $xpIntoLevel,
            'xp_for_next_level' => $xpForNextLevel,
            'next_level' => $nextLevelThreshold !== null ? $profile->level + 1 : null,
            'recent_xp' => $recentXp->values()->all(),
            'achievements' => $achievements->values()->all(),
            'locked_achievements' => $lockedAchievements->values()->all(),
            'total_achievements' => count($allAchievements),
            'earned_achievements' => count($achievements),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Award XP to a user and record the transaction log.
     */
    public function awardXp(User $user, int $amount, string $source, ?string $description = null, ?Carbon $activityAt = null): array
    {
        return DB::transaction(fn () => $this->awardXpLocked($user, $amount, $source, $description, $activityAt));
    }

    /** A session that earned no XP still counts towards the streak and achievements. */
    private function recordActivityWithoutXp(User $user, ?Carbon $activityAt): array
    {
        $this->updateStreak($user, $activityAt);

        return $this->achievements->check($user, $this->getProfile($user));
    }

    private function awardXpLocked(User $user, int $amount, string $source, ?string $description, ?Carbon $activityAt = null): array
    {
        $profile = $this->lockProfile($user);
        $oldLevel = $profile->level;
        $oldTier = $profile->tier;

        $this->creditXp($profile, $amount, $source, $description);

        $this->updateStreak($user, $activityAt);
        $newAchievements = $this->achievements->check($user, $this->getProfile($user));

        return [
            'total_xp' => $profile->total_xp,
            'level' => $profile->level,
            'tier' => $profile->tier,
            'new_level' => $profile->level > $oldLevel ? $profile->level : null,
            'new_tier' => $profile->tier !== $oldTier ? $profile->tier : null,
            'new_achievements' => $newAchievements,
        ];
    }

    /** The part of $amount still allowed today for a capped source (all of it for other sources). */
    private function withinDailyCap(User $user, string $source, int $amount): int
    {
        $cap = self::DAILY_XP_CAPS[$source] ?? null;
        if ($cap === null || $amount <= 0) {
            return $amount;
        }

        $earnedToday = (int) XpTransaction::where('user_id', $user->id)
            ->where('source', $source)
            ->where('created_at', '>=', Carbon::today())
            ->sum('amount');

        return max(0, min($amount, $cap - $earnedToday));
    }

    /**
     * Add XP to a locked profile, recalculate the level and log the transaction. No streak or
     * achievement side effects, so the streak code itself can call it for milestone bonuses.
     */
    private function creditXp(UserGamification $profile, int $amount, string $source, ?string $description): void
    {
        $profile->total_xp += $amount;
        $profile->save();
        Levels::recalculate($profile);

        XpTransaction::create([
            'user_id' => $profile->user_id,
            'amount' => $amount,
            'source' => $source,
            'description' => $description,
        ]);
    }

    /**
     * Record daily activity to maintain user streak, applying shields or penalties as appropriate.
     */
    private function updateStreak(User $user, ?Carbon $activityAt = null): void
    {
        $profile = $this->getProfile($user);
        // Activity synced from an offline device counts for the day it happened.
        $today = $activityAt ? $activityAt->copy()->startOfDay() : Carbon::today();
        /** @var Carbon|null $lastActive */
        $lastActive = $profile->last_active_date ? Carbon::parse($profile->last_active_date)->startOfDay() : null;

        if ($lastActive !== null && $today->lt($lastActive)) {
            // Older than the last recorded activity (synced late): the streak already covers it.
            return;
        }

        if ($lastActive === null) {
            $profile->update([
                'current_streak' => 1,
                'longest_streak' => max($profile->longest_streak, 1),
                'last_active_date' => $today,
            ]);

            return;
        }

        // Carbon 3 returns a float here; cast so the === comparisons below match.
        $daysSinceLastActive = (int) $lastActive->diffInDays($today);

        if ($daysSinceLastActive === 0) {
            return;
        }

        if ($daysSinceLastActive === 1) {
            $newStreak = $profile->current_streak + 1;
            $updates = [
                'current_streak' => $newStreak,
                'longest_streak' => max($profile->longest_streak, $newStreak),
                'last_active_date' => $today,
            ];

            // A Streak Freeze shield on each milestone, up to MAX_SHIELDS held at once
            if (in_array($newStreak, self::SHIELD_MILESTONES, true)) {
                if (($profile->streak_freeze_count ?? 0) < self::MAX_SHIELDS) {
                    $updates['streak_freeze_count'] = ($profile->streak_freeze_count ?? 0) + 1;
                }
            }

            $profile->update($updates);

            // Award weekly milestone streak bonus XP
            if ($newStreak % 7 === 0) {
                $bonusXp = (int) (self::XP_STREAK_DAILY_BONUS * ($newStreak / 7));
                // Only the XP: going through awardXpLocked would run updateStreak again with today's
                // date, which penalised or double-counted streaks for activity synced days later.
                $this->creditXp($this->lockProfile($user), $bonusXp, 'streak_bonus', "{$newStreak}-day streak milestone bonus!");
            }
        } elseif ($daysSinceLastActive === 2 && ($profile->streak_freeze_count ?? 0) > 0) {
            // Shield auto-deployed! Preserves the streak!
            $newStreak = $profile->current_streak + 1;
            $profile->update([
                'current_streak' => $newStreak,
                'longest_streak' => max($profile->longest_streak, $newStreak),
                'streak_freeze_count' => max(0, $profile->streak_freeze_count - 1),
                'streak_shield_used_at' => $today,
                'last_active_date' => $today,
            ]);

            XpTransaction::create([
                'user_id' => $user->id,
                'amount' => 0,
                'source' => 'streak_freeze',
                'description' => "🛡️ Streak Freeze Shield auto-deployed! Your {$newStreak}-day streak was saved.",
            ]);
        } else {
            // Missed streak without shield: apply a minor XP penalty & reset streak to 1
            $penaltyXp = self::STREAK_MISS_PENALTY;
            $newTotalXp = max(0, $profile->total_xp - $penaltyXp);
            $deductedAmount = $profile->total_xp - $newTotalXp;

            $profile->update([
                'current_streak' => 1,
                'total_xp' => $newTotalXp,
                'last_active_date' => $today,
                'last_streak_penalty_at' => $today,
            ]);

            if ($deductedAmount > 0) {
                XpTransaction::create([
                    'user_id' => $user->id,
                    'amount' => -$deductedAmount,
                    'source' => 'streak_penalty',
                    'description' => "Missed daily streak (-{$deductedAmount} XP). Rebuild your momentum today!",
                ]);
            }
            Levels::recalculate($profile);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

}
