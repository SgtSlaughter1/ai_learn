<?php

namespace App\Services\Gamification;

use App\Models\Achievement;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Subject;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class GamificationService
{
    /**
     * XP thresholds required to reach each level.
     * Level 1 starts at 0 XP.
     */
    public const LEVEL_THRESHOLDS = [
        1  => 0,
        2  => 100,
        3  => 250,
        4  => 500,
        5  => 800,
        6  => 1200,
        7  => 1700,
        8  => 2300,
        9  => 3000,
        10 => 4000,
        11 => 5200,
        12 => 6600,
        13 => 8200,
        14 => 10000,
        15 => 12500,
    ];

    /**
     * Tier definitions mapped to level ranges and visual color tokens.
     */
    public const TIER_MAP = [
        ['min_level' => 1,  'max_level' => 2,  'tier' => 'Newcomer',  'color' => '#94a3b8'],
        ['min_level' => 3,  'max_level' => 4,  'tier' => 'Learner',   'color' => '#60a5fa'],
        ['min_level' => 5,  'max_level' => 6,  'tier' => 'Scholar',   'color' => '#34d399'],
        ['min_level' => 7,  'max_level' => 8,  'tier' => 'Achiever',  'color' => '#a78bfa'],
        ['min_level' => 9,  'max_level' => 10, 'tier' => 'Expert',    'color' => '#fbbf24'],
        ['min_level' => 11, 'max_level' => 12, 'tier' => 'Master',    'color' => '#f97316'],
        ['min_level' => 13, 'max_level' => 14, 'tier' => 'Champion',  'color' => '#ef4444'],
        ['min_level' => 15, 'max_level' => 99, 'tier' => 'Legend',    'color' => '#ec4899'],
    ];

    /**
     * Base XP reward amounts.
     */
    public const XP_CORRECT_ANSWER      = 1;
    public const XP_QUIZ_COMPLETE_BASE  = 5;
    public const XP_PERFECT_SCORE_BONUS = 3;
    public const XP_FIRST_ATTEMPT_BONUS = 2;
    public const XP_STREAK_DAILY_BONUS  = 5;

    /**
     * In-memory cache for loaded user profiles during the current request lifecycle.
     *
     * @var array<string, UserGamification>
     */
    private array $profileCache = [];

    // ──────────────────────────────────────────────────────────────────────────
    // Public API Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve or initialize the gamification profile for a user.
     *
     * @param  User  $user
     * @return UserGamification
     */
    public function getProfile(User $user): UserGamification
    {
        if (isset($this->profileCache[$user->id])) {
            return $this->profileCache[$user->id];
        }

        $profile = UserGamification::firstOrCreate(
            ['user_id' => $user->id],
            [
                'total_xp'       => 0,
                'level'          => 1,
                'tier'           => 'Newcomer',
                'current_streak' => 0,
                'longest_streak' => 0,
            ]
        );

        $this->recalculateLevel($profile);
        $this->profileCache[$user->id] = $profile;

        return $profile;
    }

    /**
     * Process XP awards, streaks, and achievements upon quiz completion.
     *
     * @param  User         $user
     * @param  QuizAttempt  $attempt
     * @param  Quiz         $quiz
     * @return array        Newly earned achievements
     */
    public function processQuizCompletion(User $user, QuizAttempt $attempt, Quiz $quiz): array
    {
        return DB::transaction(function () use ($user, $attempt, $quiz) {
            $profile = $this->getProfile($user);

            $answers = $attempt->relationLoaded('answers') ? $attempt->answers : $attempt->answers()->get();
            $totalQuestions = $answers->count();
            $correctCount   = $answers->where('is_correct', true)->count();

            $xpEarnedTotal = self::XP_QUIZ_COMPLETE_BASE;
            $now = now();
            $transactions = [
                [
                    'user_id'     => $user->id,
                    'amount'      => self::XP_QUIZ_COMPLETE_BASE,
                    'source'      => 'quiz_complete',
                    'description' => "Completed: {$quiz->title}",
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ],
            ];

            // 1. Correct answers reward
            $answerXp = $correctCount * self::XP_CORRECT_ANSWER;
            if ($answerXp > 0) {
                $xpEarnedTotal += $answerXp;
                $transactions[] = [
                    'user_id'     => $user->id,
                    'amount'      => $answerXp,
                    'source'      => 'correct_answer',
                    'description' => "{$correctCount} correct answers in {$quiz->title}",
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
            }

            // 2. Perfect score bonus
            if ($totalQuestions > 0 && $correctCount === $totalQuestions) {
                $xpEarnedTotal += self::XP_PERFECT_SCORE_BONUS;
                $transactions[] = [
                    'user_id'     => $user->id,
                    'amount'      => self::XP_PERFECT_SCORE_BONUS,
                    'source'      => 'perfect_score',
                    'description' => "Perfect score on {$quiz->title}!",
                    'created_at'  => $now,
                    'updated_at'  => $now,
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
                    'user_id'     => $user->id,
                    'amount'      => self::XP_FIRST_ATTEMPT_BONUS,
                    'source'      => 'first_attempt',
                    'description' => "First attempt on {$quiz->title}",
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
            }

            // 4. Update profile XP and write transactions
            $profile->total_xp += $xpEarnedTotal;
            $profile->save();
            $this->recalculateLevel($profile);
            XpTransaction::insert($transactions);

            // 5. Update streak
            $this->updateStreak($user);

            // 6. Check and award achievements
            return $this->checkAchievements($user);
        });
    }

    /**
     * Record daily activity to maintain user streak.
     *
     * @param  User  $user
     * @return void
     */
    public function recordDailyActivity(User $user): void
    {
        $this->updateStreak($user);
    }

    /**
     * Award XP and process gamification updates after a flashcard session.
     *
     * @param  User  $user
     * @param  int   $xpEarned
     * @param  int   $cardsReviewed
     * @return array Progress summary (xp_earned, new_level, new_tier, new_achievements)
     */
    public function processFlashcardCompletion(User $user, int $xpEarned, int $cardsReviewed): array
    {
        return DB::transaction(function () use ($user, $xpEarned, $cardsReviewed) {
            $profile  = $this->getProfile($user);
            $oldLevel = $profile->level;
            $oldTier  = $profile->tier;

            if ($xpEarned > 0) {
                $this->awardXp($user, $xpEarned, 'flashcard_review', "Reviewed {$cardsReviewed} flashcards");
            }

            $this->updateStreak($user);
            $newAchievements = $this->checkAchievements($user);

            return [
                'xp_earned'        => $xpEarned,
                'new_level'        => $profile->level > $oldLevel ? $profile->level : null,
                'new_tier'         => $profile->tier !== $oldTier ? $profile->tier : null,
                'new_achievements' => $newAchievements,
            ];
        });
    }

    /**
     * Award XP and process gamification updates after a daily spaced repetition revision session.
     *
     * @param  User  $user
     * @param  int   $correctCount
     * @param  int   $totalQuestions
     * @return array Progress summary (bonus_xp, total_xp, level, tier, new_level, new_tier, new_achievements)
     */
    public function processRevisionCompletion(User $user, int $correctCount, int $totalQuestions): array
    {
        return DB::transaction(function () use ($user, $correctCount, $totalQuestions) {
            $profile  = $this->getProfile($user);
            $oldLevel = $profile->level;
            $oldTier  = $profile->tier;

            // Performance-based XP: only award completion bonus XP if learner answered questions correctly
            $bonusXp = 0;
            if ($correctCount > 0) {
                $bonusXp = $correctCount * self::XP_CORRECT_ANSWER;
                if ($totalQuestions > 0 && $correctCount === $totalQuestions) {
                    $bonusXp += self::XP_PERFECT_SCORE_BONUS;
                }
            }

            if ($bonusXp > 0) {
                $this->awardXp(
                    $user,
                    $bonusXp,
                    'daily_revision_bonus',
                    "Daily Revision: {$correctCount}/{$totalQuestions} correct"
                );
            } else {
                $this->updateStreak($user);
            }

            $newAchievements = $this->checkAchievements($user);

            return [
                'bonus_xp'         => $bonusXp,
                'total_xp'         => $profile->fresh()->total_xp,
                'level'            => $profile->level,
                'tier'             => $profile->tier,
                'new_level'        => $profile->level > $oldLevel ? $profile->level : null,
                'new_tier'         => $profile->tier !== $oldTier ? $profile->tier : null,
                'new_achievements' => $newAchievements,
            ];
        });
    }

    /**
     * Get aggregated gamification dashboard metrics for a user.
     *
     * @param  User  $user
     * @return array
     */
    public function getDashboardData(User $user): array
    {
        $profile = $this->getProfile($user);

        // Level & XP Progress Calculations
        $nextLevelThreshold    = self::LEVEL_THRESHOLDS[$profile->level + 1] ?? null;
        $currentLevelThreshold = self::LEVEL_THRESHOLDS[$profile->level] ?? 0;
        $xpIntoLevel           = $profile->total_xp - $currentLevelThreshold;
        $xpForNextLevel        = $nextLevelThreshold !== null
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
            ->map(fn(XpTransaction $t) => [
                'amount'      => $t->amount,
                'source'      => $t->source,
                'description' => $t->description,
                'created_at'  => $t->created_at->diffForHumans(),
            ]);

        // Unlocked user achievements
        $achievements = UserAchievement::where('user_id', $user->id)
            ->with('achievement')
            ->orderByDesc('earned_at')
            ->get()
            ->map(fn(UserAchievement $a) => [
                'key'         => $a->achievement_key,
                'name'        => $a->name,
                'description' => $a->description ?? $a->achievement?->description,
                'icon'        => $a->icon ?? $a->achievement?->icon,
                'xp_reward'   => $a->achievement?->xp_reward ?? 25,
                'earned_at'   => $a->earned_at->diffForHumans(),
            ]);

        // Locked achievements
        $allAchievements    = $this->getAllAchievementDefinitions();
        $earnedKeys         = $achievements->pluck('key')->toArray();
        $lockedAchievements = collect($allAchievements)
            ->filter(fn(array $a) => !in_array($a['key'], $earnedKeys, true))
            ->values();

        $tier      = $profile->tier ?? 'Newcomer';
        $tierColor = $this->getTierColor($profile->level);

        return [
            'total_xp'            => $profile->total_xp,
            'level'               => $profile->level,
            'tier'                => $tier,
            'tier_color'          => $tierColor,
            'current_streak'      => $profile->current_streak,
            'longest_streak'      => $profile->longest_streak,
            'xp_progress_percent' => $xpProgressPercent,
            'xp_into_level'       => $xpIntoLevel,
            'xp_for_next_level'   => $xpForNextLevel,
            'next_level'          => $nextLevelThreshold !== null ? $profile->level + 1 : null,
            'recent_xp'           => $recentXp->values()->all(),
            'achievements'        => $achievements->values()->all(),
            'locked_achievements' => $lockedAchievements->values()->all(),
            'total_achievements'  => count($allAchievements),
            'earned_achievements' => count($achievements),
        ];
    }

    /**
     * Retrieve the leaderboard standings and the current user's placement.
     *
     * @param  User  $currentUser
     * @param  int   $limit
     * @return array
     */
    public function getLeaderboard(User $currentUser, int $limit = 10): array
    {
        $topUsersData = Cache::remember("gamification:leaderboard:top:{$limit}", now()->addMinutes(5), function () use ($limit) {
            return UserGamification::with('user:id,name')
                ->orderByDesc('total_xp')
                ->limit($limit)
                ->get()
                ->map(fn(UserGamification $g, int $index) => [
                    'position'        => $index + 1,
                    'user_id'         => $g->user_id,
                    'name'            => $g->user->name ?? 'Unknown',
                    'total_xp'        => $g->total_xp,
                    'level'           => $g->level,
                    'tier'            => $g->tier ?? 'Newcomer',
                ])
                ->all();
        });

        $topUsers = array_map(function ($item) use ($currentUser) {
            $item['is_current_user'] = $item['user_id'] === $currentUser->id;
            return $item;
        }, $topUsersData);

        $currentUserPosition = UserGamification::where('total_xp', '>', function ($query) use ($currentUser) {
            $query->select('total_xp')
                ->from('user_gamification')
                ->where('user_id', $currentUser->id);
        })->count() + 1;

        $currentUserProfile = $this->getProfile($currentUser);
        $currentUserEntry = [
            'position'        => $currentUserPosition,
            'user_id'         => $currentUser->id,
            'name'            => $currentUser->name,
            'total_xp'        => $currentUserProfile->total_xp,
            'level'           => $currentUserProfile->level,
            'tier'            => $currentUserProfile->tier ?? 'Newcomer',
            'is_current_user' => true,
        ];

        return [
            'top_users'           => $topUsers,
            'current_user'        => $currentUserEntry,
            'current_user_in_top' => collect($topUsers)->contains('user_id', $currentUser->id),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal Progression & Recalculation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Award XP to a user and record the transaction log.
     *
     * @param  User         $user
     * @param  int          $amount
     * @param  string       $source
     * @param  string|null  $description
     * @return array
     */
    public function awardXp(User $user, int $amount, string $source, ?string $description = null): array
    {
        $profile  = $this->getProfile($user);
        $oldLevel = $profile->level;
        $oldTier  = $profile->tier;

        $profile->total_xp += $amount;
        $profile->save();
        $this->recalculateLevel($profile);

        XpTransaction::create([
            'user_id'     => $user->id,
            'amount'      => $amount,
            'source'      => $source,
            'description' => $description,
        ]);

        $this->updateStreak($user);
        $newAchievements = $this->checkAchievements($user);

        return [
            'total_xp'         => $profile->total_xp,
            'level'            => $profile->level,
            'tier'             => $profile->tier,
            'new_level'        => $profile->level > $oldLevel ? $profile->level : null,
            'new_tier'         => $profile->tier !== $oldTier ? $profile->tier : null,
            'new_achievements' => $newAchievements,
        ];
    }

    /**
     * Update user daily activity streak based on the last recorded date.
     *
     * @param  User  $user
     * @return void
     */
    private function updateStreak(User $user): void
    {
        $profile = $this->getProfile($user);
        $today   = Carbon::today();
        /** @var Carbon|null $lastActive */
        $lastActive = $profile->last_active_date;

        if ($lastActive === null) {
            $profile->update([
                'current_streak'   => 1,
                'longest_streak'   => max($profile->longest_streak, 1),
                'last_active_date' => $today,
            ]);
            return;
        }

        $daysSinceLastActive = $lastActive->diffInDays($today);

        if ($daysSinceLastActive === 0) {
            return;
        }

        if ($daysSinceLastActive === 1) {
            $newStreak = $profile->current_streak + 1;
            $profile->update([
                'current_streak'   => $newStreak,
                'longest_streak'   => max($profile->longest_streak, $newStreak),
                'last_active_date' => $today,
            ]);

            // Award weekly milestone streak bonus
            if ($newStreak % 7 === 0) {
                $bonusXp = (int) (self::XP_STREAK_DAILY_BONUS * ($newStreak / 7));
                $this->awardXp($user, $bonusXp, 'streak_bonus', "{$newStreak}-day streak bonus!");
            }
        } else {
            $profile->update([
                'current_streak'   => 1,
                'last_active_date' => $today,
            ]);
        }
    }

    /**
     * Recalculate level and tier based on accumulated total XP.
     *
     * @param  UserGamification  $profile
     * @return void
     */
    public function recalculateLevel(UserGamification $profile): void
    {
        $newLevel = 1;
        foreach (self::LEVEL_THRESHOLDS as $level => $threshold) {
            if ($profile->total_xp >= $threshold) {
                $newLevel = $level;
            } else {
                break;
            }
        }

        $newTier = $this->getTierForLevel($newLevel);

        if ($newLevel !== $profile->level || $newTier !== $profile->tier) {
            $profile->update([
                'level' => $newLevel,
                'tier'  => $newTier,
            ]);
            $profile->level = $newLevel;
            $profile->tier  = $newTier;
        }
    }

    /**
     * Resolve tier title based on player level.
     *
     * @param  int  $level
     * @return string
     */
    public function getTierForLevel(int $level): string
    {
        foreach (self::TIER_MAP as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['tier'];
            }
        }
        return 'Newcomer';
    }

    /**
     * Resolve tier color token based on player level.
     *
     * @param  int  $level
     * @return string
     */
    public function getTierColor(int $level): string
    {
        foreach (self::TIER_MAP as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['color'];
            }
        }
        return '#94a3b8';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Achievement System
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve all achievement definitions from DB or fallback configuration.
     *
     * @return array<int, array{key: string, name: string, description: string, icon: string, xp_reward: int, category?: string}>
     */
    private function getAllAchievementDefinitions(): array
    {
        $dbAchievements = Achievement::all();
        if ($dbAchievements->isNotEmpty()) {
            return $dbAchievements->map(fn(Achievement $a) => [
                'key'         => $a->key,
                'name'        => $a->name,
                'description' => $a->description,
                'icon'        => $a->icon,
                'xp_reward'   => $a->xp_reward ?? 25,
                'category'    => $a->category,
            ])->toArray();
        }

        return [
            ['key' => 'first_quiz',          'name' => 'First Steps',        'description' => 'Complete your first quiz',               'icon' => 'target',         'xp_reward' => 5],
            ['key' => 'quiz_5',              'name' => 'Getting Serious',     'description' => 'Complete 5 quizzes',                     'icon' => 'file-text',      'xp_reward' => 5],
            ['key' => 'quiz_10',             'name' => 'Quiz Enthusiast',     'description' => 'Complete 10 quizzes',                    'icon' => 'award',          'xp_reward' => 10],
            ['key' => 'quiz_25',             'name' => 'Quiz Master',         'description' => 'Complete 25 quizzes',                    'icon' => 'crown',          'xp_reward' => 10],
            ['key' => 'perfect_score',       'name' => 'Flawless',            'description' => 'Get a perfect score on any quiz',        'icon' => 'gem',            'xp_reward' => 5],
            ['key' => 'perfect_3',           'name' => 'Triple Perfect',      'description' => 'Get 3 perfect scores',                  'icon' => 'sparkles',       'xp_reward' => 10],
            ['key' => 'streak_3',            'name' => 'On Fire',             'description' => 'Maintain a 3-day streak',               'icon' => 'flame',          'xp_reward' => 5],
            ['key' => 'streak_7',            'name' => 'Week Warrior',        'description' => 'Maintain a 7-day streak',               'icon' => 'zap',            'xp_reward' => 5],
            ['key' => 'streak_14',           'name' => 'Unstoppable',         'description' => 'Maintain a 14-day streak',              'icon' => 'star',           'xp_reward' => 10],
            ['key' => 'streak_30',           'name' => 'Iron Will',           'description' => 'Maintain a 30-day streak',              'icon' => 'activity',       'xp_reward' => 10],
            ['key' => 'mastery_50',          'name' => 'Halfway There',       'description' => 'Reach 50% mastery in any subject',      'icon' => 'trending-up',    'xp_reward' => 5],
            ['key' => 'mastery_80',          'name' => 'Subject Expert',      'description' => 'Reach 80% mastery in any subject',      'icon' => 'graduation-cap', 'xp_reward' => 10],
            ['key' => 'mastery_100',         'name' => 'Subject Master',      'description' => 'Reach 100% mastery in any subject',     'icon' => 'medal',          'xp_reward' => 10],
            ['key' => 'all_subjects_80',     'name' => 'Renaissance Student', 'description' => 'Reach 80% mastery in all subjects',     'icon' => 'globe',          'xp_reward' => 10],
            ['key' => 'level_5',             'name' => 'Level Up!',           'description' => 'Reach Level 5',                         'icon' => 'arrow-up',       'xp_reward' => 5],
            ['key' => 'level_10',            'name' => 'High Roller',         'description' => 'Reach Level 10',                        'icon' => 'gift',           'xp_reward' => 10],
            ['key' => 'xp_1000',             'name' => 'XP Hunter',           'description' => 'Earn 1,000 total XP',                   'icon' => 'star',           'xp_reward' => 10],
            ['key' => 'xp_5000',             'name' => 'XP Legend',            'description' => 'Earn 5,000 total XP',                   'icon' => 'award',          'xp_reward' => 10],
            ['key' => 'speed_demon',         'name' => 'Speed Demon',         'description' => 'Complete a quiz in under 2 minutes',    'icon' => 'zap',            'xp_reward' => 5],
            ['key' => 'try_all_subjects',    'name' => 'Curious Mind',        'description' => 'Try a quiz in every subject',           'icon' => 'book-open',      'xp_reward' => 5],
        ];
    }

    /**
     * Evaluate pending achievements against user metrics snapshot.
     *
     * @param  User  $user
     * @return array
     */
    private function checkAchievements(User $user): array
    {
        $allDefinitions = $this->getAllAchievementDefinitions();
        $existingKeys   = UserAchievement::where('user_id', $user->id)
            ->pluck('achievement_key')
            ->toArray();

        $pendingDefs = array_filter(
            $allDefinitions,
            fn(array $def) => !in_array($def['key'], $existingKeys, true)
        );

        if (empty($pendingDefs)) {
            return [];
        }

        // Preload user snapshot in two indexed queries to prevent N+1 query bottlenecks
        $profile = $this->getProfile($user);

        $completedAttempts = QuizAttempt::where('user_id', $user->id)
            ->where('status', 'completed')
            ->select(['id', 'score', 'total_marks', 'started_at', 'completed_at'])
            ->get();

        $completedCount = $completedAttempts->count();
        $perfectCount   = $completedAttempts->filter(fn(QuizAttempt $a) => $a->total_marks > 0 && $a->score >= $a->total_marks)->count();
        $hasSpeedDemon  = $completedAttempts->contains(
            fn(QuizAttempt $a) => $a->completed_at && $a->started_at && $a->completed_at->diffInSeconds($a->started_at) < 120
        );

        $progressStats = LearnerProgress::where('user_id', $user->id)
            ->selectRaw('
                COUNT(CASE WHEN mastery_score >= 50 THEN 1 END) as count_50,
                COUNT(CASE WHEN mastery_score >= 80 THEN 1 END) as count_80,
                COUNT(CASE WHEN mastery_score >= 100 THEN 1 END) as count_100
            ')
            ->first();

        $snapshot = [
            'profile'         => $profile,
            'completed_count' => $completedCount,
            'perfect_count'   => $perfectCount,
            'has_speed_demon' => $hasSpeedDemon,
            'count_50'        => (int) ($progressStats?->count_50 ?? 0),
            'count_80'        => (int) ($progressStats?->count_80 ?? 0),
            'count_100'       => (int) ($progressStats?->count_100 ?? 0),
        ];

        $earned                  = [];
        $achievementBonusXp      = 0;
        $achievementTransactions = [];
        $now                     = now();

        foreach ($pendingDefs as $def) {
            if ($this->checkAchievementCondition($user, $def['key'], $snapshot)) {
                UserAchievement::create([
                    'user_id'         => $user->id,
                    'achievement_key' => $def['key'],
                    'name'            => $def['name'],
                    'description'     => $def['description'],
                    'icon'            => $def['icon'],
                    'earned_at'       => $now,
                ]);

                $rewardXp = $def['xp_reward'] ?? 25;
                $achievementBonusXp += $rewardXp;
                $achievementTransactions[] = [
                    'user_id'     => $user->id,
                    'amount'      => $rewardXp,
                    'source'      => 'achievement',
                    'description' => "Achievement unlocked: {$def['name']}",
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];

                $earned[] = $def;
            }
        }

        if ($achievementBonusXp > 0) {
            $profile->total_xp += $achievementBonusXp;
            $profile->save();
            $this->recalculateLevel($profile);
            XpTransaction::insert($achievementTransactions);
        }

        return $earned;
    }

    /**
     * Check if a specific achievement condition evaluates to true.
     *
     * @param  User    $user
     * @param  string  $key
     * @param  array   $snapshot
     * @return bool
     */
    private function checkAchievementCondition(User $user, string $key, array $snapshot): bool
    {
        /** @var UserGamification $profile */
        $profile = $snapshot['profile'];

        return match ($key) {
            'first_quiz'       => $snapshot['completed_count'] >= 1,
            'quiz_5'           => $snapshot['completed_count'] >= 5,
            'quiz_10'          => $snapshot['completed_count'] >= 10,
            'quiz_25'          => $snapshot['completed_count'] >= 25,

            'perfect_score'    => $snapshot['perfect_count'] >= 1,
            'perfect_3'        => $snapshot['perfect_count'] >= 3,

            'streak_3'         => $profile->longest_streak >= 3,
            'streak_7'         => $profile->longest_streak >= 7,
            'streak_14'        => $profile->longest_streak >= 14,
            'streak_30'        => $profile->longest_streak >= 30,

            'mastery_50'       => $snapshot['count_50'] >= 1,
            'mastery_80'       => $snapshot['count_80'] >= 1,
            'mastery_100'      => $snapshot['count_100'] >= 1,

            'all_subjects_80'  => $snapshot['count_80'] > 0 && $this->checkAllSubjectsMastery($user, 80),
            'level_5'          => $profile->level >= 5,
            'level_10'         => $profile->level >= 10,
            'xp_1000'          => $profile->total_xp >= 1000,
            'xp_5000'          => $profile->total_xp >= 5000,
            'speed_demon'      => $snapshot['has_speed_demon'],
            'try_all_subjects' => $snapshot['completed_count'] >= 2 && $this->checkTriedAllSubjects($user),

            default            => false,
        };
    }

    /**
     * Check if a user has achieved the mastery threshold across active subjects.
     *
     * @param  User  $user
     * @param  int   $threshold
     * @return bool
     */
    private function checkAllSubjectsMastery(User $user, int $threshold): bool
    {
        $totalSubjects = Subject::where('status', 'active')->count();
        if ($totalSubjects === 0) {
            return false;
        }

        $masteredSubjects = LearnerProgress::where('user_id', $user->id)
            ->where('mastery_score', '>=', $threshold)
            ->distinct('topic_id')
            ->count();

        $subjectsWithProgress = LearnerProgress::where('user_id', $user->id)
            ->whereHas('topic')
            ->join('topics', 'learner_progress.topic_id', '=', 'topics.id')
            ->distinct('topics.subject_id')
            ->count('topics.subject_id');

        return $subjectsWithProgress >= $totalSubjects && $masteredSubjects > 0;
    }

    /**
     * Check if a user has attempted quizzes in all active subjects.
     *
     * @param  User  $user
     * @return bool
     */
    private function checkTriedAllSubjects(User $user): bool
    {
        $totalSubjects = Subject::where('status', 'active')->count();
        if ($totalSubjects === 0) {
            return false;
        }

        $triedSubjects = QuizAttempt::where('quiz_attempts.user_id', $user->id)
            ->where('quiz_attempts.status', 'completed')
            ->join('quizzes', 'quiz_attempts.quiz_id', '=', 'quizzes.id')
            ->join('quiz_questions', 'quizzes.id', '=', 'quiz_questions.quiz_id')
            ->join('questions', 'quiz_questions.question_id', '=', 'questions.id')
            ->join('topics', 'questions.topic_id', '=', 'topics.id')
            ->distinct('topics.subject_id')
            ->count('topics.subject_id');

        return $triedSubjects >= $totalSubjects;
    }
}
