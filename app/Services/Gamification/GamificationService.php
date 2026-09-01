<?php

namespace App\Services\Gamification;

use App\Models\Achievement;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use App\Models\LearnerProgress;
use App\Models\Subject;
use Carbon\Carbon;

class GamificationService
{
    // ── Level & Rank System ──

    /**
     * XP thresholds for each level.
     * Level 1 = 0, Level 2 = 100, Level 3 = 250, etc.
     */
    private const LEVEL_THRESHOLDS = [
        1   => 0,
        2   => 100,
        3   => 250,
        4   => 500,
        5   => 800,
        6   => 1200,
        7   => 1700,
        8   => 2300,
        9   => 3000,
        10  => 4000,
        11  => 5200,
        12  => 6600,
        13  => 8200,
        14  => 10000,
        15  => 12500,
    ];

    /**
     * Rank names mapped to level ranges.
     */
    private const RANK_MAP = [
        ['min_level' => 1,  'max_level' => 2,  'rank' => 'Newcomer',      'color' => '#94a3b8'],
        ['min_level' => 3,  'max_level' => 4,  'rank' => 'Learner',       'color' => '#60a5fa'],
        ['min_level' => 5,  'max_level' => 6,  'rank' => 'Scholar',       'color' => '#34d399'],
        ['min_level' => 7,  'max_level' => 8,  'rank' => 'Achiever',      'color' => '#a78bfa'],
        ['min_level' => 9,  'max_level' => 10, 'rank' => 'Expert',        'color' => '#fbbf24'],
        ['min_level' => 11, 'max_level' => 12, 'rank' => 'Master',        'color' => '#f97316'],
        ['min_level' => 13, 'max_level' => 14, 'rank' => 'Champion',      'color' => '#ef4444'],
        ['min_level' => 15, 'max_level' => 99, 'rank' => 'Legend',         'color' => '#ec4899'],
    ];

    // ── XP Rewards ──

    private const XP_CORRECT_ANSWER = 10;
    private const XP_QUIZ_COMPLETE_BASE = 25;
    private const XP_PERFECT_SCORE_BONUS = 50;
    private const XP_FIRST_ATTEMPT_BONUS = 20;
    private const XP_STREAK_DAILY_BONUS = 15;
    private array $profileCache = [];

    // ── Public Methods ──

    /**
     * Get or create gamification profile for a user.
     */
    public function getProfile(User $user): UserGamification
    {
        if (isset($this->profileCache[$user->id])) {
            return $this->profileCache[$user->id];
        }

        $profile = UserGamification::firstOrCreate(
            ['user_id' => $user->id],
            [
                'total_xp'      => 0,
                'level'         => 1,
                'rank'          => 'Newcomer',
                'current_streak'=> 0,
                'longest_streak'=> 0,
            ]
        );

        $this->recalculateLevel($profile);
        $this->profileCache[$user->id] = $profile;

        return $profile;
    }

    /**
     * Award XP and process all gamification updates after a quiz attempt.
     * Returns the list of newly earned achievements.
     */
    public function processQuizCompletion(User $user, QuizAttempt $attempt, Quiz $quiz): array
    {
        $profile = $this->getProfile($user);

        $totalQuestions = $attempt->relationLoaded('answers') ? $attempt->answers->count() : $attempt->answers()->count();
        $correctCount = $attempt->relationLoaded('answers')
            ? $attempt->answers->where('is_correct', true)->count()
            : $attempt->answers()->where('is_correct', true)->count();

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
            ]
        ];

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

        // Batch update XP in a single query and insert transactions in 1 bulk write
        $profile->increment('total_xp', $xpEarnedTotal);
        $profile->total_xp += $xpEarnedTotal;
        $this->recalculateLevel($profile);
        XpTransaction::insert($transactions);

        // 5. Update streak
        $this->updateStreak($user);

        // 6. Check and award achievements
        $newAchievements = $this->checkAchievements($user);

        return $newAchievements;
    }

    /**
     * Record daily activity and update streak.
     */
    public function recordDailyActivity(User $user): void
    {
        $this->updateStreak($user);
    }

    /**
     * Award XP and process gamification updates after a flashcard session completion.
     * Returns gamification progress (xp earned, level, rank, new achievements).
     */
    public function processFlashcardCompletion(User $user, int $xpEarned, int $cardsReviewed): array
    {
        $profile = $this->getProfile($user);
        $oldLevel = $profile->level;
        $oldRank = $profile->rank;

        // 1. Award flashcard XP
        if ($xpEarned > 0) {
            $this->awardXp($user, $xpEarned, 'flashcard_review', "Reviewed {$cardsReviewed} flashcards");
        }

        // 2. Update streak
        $this->updateStreak($user);

        // 3. Check achievements
        $newAchievements = $this->checkAchievements($user);

        return [
            'xp_earned'        => $xpEarned,
            'new_level'        => $profile->level > $oldLevel ? $profile->level : null,
            'new_rank'         => $profile->rank !== $oldRank ? $profile->rank : null,
            'new_achievements' => $newAchievements,
        ];
    }

    /**
     * Get full gamification dashboard data.
     */
    public function getDashboardData(User $user): array
    {
        $profile = $this->getProfile($user);

        // Calculate XP needed for next level
        $nextLevelThreshold = self::LEVEL_THRESHOLDS[$profile->level + 1] ?? null;
        $currentLevelThreshold = self::LEVEL_THRESHOLDS[$profile->level] ?? 0;
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
            ->map(fn($t) => [
                'amount'      => $t->amount,
                'source'      => $t->source,
                'description' => $t->description,
                'created_at'  => $t->created_at->diffForHumans(),
            ]);

        // Achievements
        $achievements = UserAchievement::where('user_id', $user->id)
            ->with('achievement')
            ->orderByDesc('earned_at')
            ->get()
            ->map(fn($a) => [
                'key'         => $a->achievement_key,
                'name'        => $a->name,
                'description' => $a->description ?? $a->achievement?->description,
                'icon'        => $a->icon ?? $a->achievement?->icon,
                'xp_reward'   => $a->achievement?->xp_reward ?? 25,
                'earned_at'   => $a->earned_at->diffForHumans(),
            ]);

        // All possible achievements (for showing locked ones)
        $allAchievements = $this->getAllAchievementDefinitions();
        $earnedKeys = $achievements->pluck('key')->toArray();
        $lockedAchievements = collect($allAchievements)
            ->filter(fn($a) => !in_array($a['key'], $earnedKeys))
            ->values();

        return [
            'total_xp'            => $profile->total_xp,
            'level'               => $profile->level,
            'rank'                => $profile->rank,
            'rank_color'          => $this->getRankColor($profile->level),
            'current_streak'      => $profile->current_streak,
            'longest_streak'      => $profile->longest_streak,
            'xp_progress_percent' => $xpProgressPercent,
            'xp_into_level'       => $xpIntoLevel,
            'xp_for_next_level'   => $xpForNextLevel,
            'next_level'          => $nextLevelThreshold !== null ? $profile->level + 1 : null,
            'recent_xp'           => $recentXp,
            'achievements'        => $achievements,
            'locked_achievements' => $lockedAchievements,
            'total_achievements'  => count($allAchievements),
            'earned_achievements' => count($achievements),
        ];
    }

    /**
     * Get leaderboard (top users by XP).
     */
    public function getLeaderboard(User $currentUser, int $limit = 10): array
    {
        $topUsers = UserGamification::with('user:id,name')
            ->orderByDesc('total_xp')
            ->limit($limit)
            ->get()
            ->map(fn($g, $index) => [
                'rank_position' => $index + 1,
                'user_id'       => $g->user_id,
                'name'          => $g->user->name ?? 'Unknown',
                'total_xp'      => $g->total_xp,
                'level'         => $g->level,
                'rank'          => $g->rank,
                'is_current_user' => $g->user_id === $currentUser->id,
            ]);

        // If current user not in top, add them with their position
        $currentUserRank = UserGamification::where('total_xp', '>', function ($query) use ($currentUser) {
            $query->select('total_xp')
                ->from('user_gamification')
                ->where('user_id', $currentUser->id);
        }) ->count() + 1;

        $currentUserProfile = $this->getProfile($currentUser);
        $currentUserEntry = [
            'rank_position'   => $currentUserRank,
            'user_id'         => $currentUser->id,
            'name'            => $currentUser->name,
            'total_xp'        => $currentUserProfile->total_xp,
            'level'           => $currentUserProfile->level,
            'rank'            => $currentUserProfile->rank,
            'is_current_user' => true,
        ];

        return [
            'top_users'       => $topUsers->toArray(),
            'current_user'    => $currentUserEntry,
            'current_user_in_top' => $topUsers->contains('user_id', $currentUser->id),
        ];
    }

    // ── Private Helpers ──

    /**
     * Award XP to a user and log the transaction.
     */
    private function awardXp(User $user, int $amount, string $source, ?string $description = null): void
    {
        $profile = $this->getProfile($user);
        $profile->increment('total_xp', $amount);
        $profile->total_xp += $amount;
        $this->recalculateLevel($profile);

        XpTransaction::create([
            'user_id'     => $user->id,
            'amount'      => $amount,
            'source'      => $source,
            'description' => $description,
        ]);
    }

    /**
     * Update daily streak based on last active date.
     */
    private function updateStreak(User $user): void
    {
        $profile = $this->getProfile($user);
        $today = Carbon::today();
        /** @var Carbon|null $lastActive */
        $lastActive = $profile->last_active_date;

        if ($lastActive === null) {
            // First time active
            $profile->update([
                'current_streak' => 1,
                'longest_streak' => max($profile->longest_streak, 1),
                'last_active_date' => $today,
            ]);
            return;
        }

        $daysSinceLastActive = $lastActive->diffInDays($today);

        if ($daysSinceLastActive === 0) {
            // Already active today, no streak change
            return;
        }

        if ($daysSinceLastActive === 1) {
            // Consecutive day — extend streak
            $newStreak = $profile->current_streak + 1;
            $profile->update([
                'current_streak'   => $newStreak,
                'longest_streak'   => max($profile->longest_streak, $newStreak),
                'last_active_date' => $today,
            ]);

            // Streak bonus XP every 7 days
            if ($newStreak % 7 === 0) {
                $bonusXp = self::XP_STREAK_DAILY_BONUS * ($newStreak / 7);
                $this->awardXp($user, $bonusXp, 'streak_bonus', "{$newStreak}-day streak bonus!");
            }
        } else {
            // Streak broken
            $profile->update([
                'current_streak'   => 1,
                'last_active_date' => $today,
            ]);
        }
    }

    /**
     * Recalculate level and rank based on total XP.
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

        $newRank = $this->getRankForLevel($newLevel);

        if ($newLevel !== $profile->level || $newRank !== $profile->rank) {
            $profile->update([
                'level' => $newLevel,
                'rank'  => $newRank,
            ]);
            $profile->level = $newLevel;
            $profile->rank = $newRank;
        }
    }

    /**
     * Get rank name for a given level.
     */
    private function getRankForLevel(int $level): string
    {
        foreach (self::RANK_MAP as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['rank'];
            }
        }
        return 'Newcomer';
    }

    /**
     * Get rank color for a given level.
     */
    private function getRankColor(int $level): string
    {
        foreach (self::RANK_MAP as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['color'];
            }
        }
        return '#94a3b8';
    }

    // ── Achievement System ──

    /**
     * Define all possible achievements.
     */
    private function getAllAchievementDefinitions(): array
    {
        $dbAchievements = Achievement::all();
        if ($dbAchievements->isNotEmpty()) {
            return $dbAchievements->map(fn($a) => [
                'key'         => $a->key,
                'name'        => $a->name,
                'description' => $a->description,
                'icon'        => $a->icon,
                'xp_reward'   => $a->xp_reward ?? 25,
                'category'    => $a->category,
            ])->toArray();
        }

        return [
            ['key' => 'first_quiz',          'name' => 'First Steps',        'description' => 'Complete your first quiz',               'icon' => '🎯', 'xp_reward' => 25],
            ['key' => 'quiz_5',              'name' => 'Getting Serious',     'description' => 'Complete 5 quizzes',                     'icon' => '📝', 'xp_reward' => 25],
            ['key' => 'quiz_10',             'name' => 'Quiz Enthusiast',     'description' => 'Complete 10 quizzes',                    'icon' => '🏆', 'xp_reward' => 25],
            ['key' => 'quiz_25',             'name' => 'Quiz Master',         'description' => 'Complete 25 quizzes',                    'icon' => '👑', 'xp_reward' => 25],
            ['key' => 'perfect_score',       'name' => 'Flawless',            'description' => 'Get a perfect score on any quiz',        'icon' => '💎', 'xp_reward' => 25],
            ['key' => 'perfect_3',           'name' => 'Triple Perfect',      'description' => 'Get 3 perfect scores',                  'icon' => '✨', 'xp_reward' => 25],
            ['key' => 'streak_3',            'name' => 'On Fire',             'description' => 'Maintain a 3-day streak',               'icon' => '🔥', 'xp_reward' => 25],
            ['key' => 'streak_7',            'name' => 'Week Warrior',        'description' => 'Maintain a 7-day streak',               'icon' => '⚡', 'xp_reward' => 25],
            ['key' => 'streak_14',           'name' => 'Unstoppable',         'description' => 'Maintain a 14-day streak',              'icon' => '🌟', 'xp_reward' => 25],
            ['key' => 'streak_30',           'name' => 'Iron Will',           'description' => 'Maintain a 30-day streak',              'icon' => '💪', 'xp_reward' => 25],
            ['key' => 'mastery_50',          'name' => 'Halfway There',       'description' => 'Reach 50% mastery in any subject',      'icon' => '📈', 'xp_reward' => 25],
            ['key' => 'mastery_80',          'name' => 'Subject Expert',      'description' => 'Reach 80% mastery in any subject',      'icon' => '🎓', 'xp_reward' => 25],
            ['key' => 'mastery_100',         'name' => 'Subject Master',      'description' => 'Reach 100% mastery in any subject',     'icon' => '🥇', 'xp_reward' => 25],
            ['key' => 'all_subjects_80',     'name' => 'Renaissance Student', 'description' => 'Reach 80% mastery in all subjects',     'icon' => '🌍', 'xp_reward' => 25],
            ['key' => 'level_5',             'name' => 'Level Up!',           'description' => 'Reach Level 5',                         'icon' => '⬆️', 'xp_reward' => 25],
            ['key' => 'level_10',            'name' => 'High Roller',         'description' => 'Reach Level 10',                        'icon' => '🎰', 'xp_reward' => 25],
            ['key' => 'xp_1000',             'name' => 'XP Hunter',           'description' => 'Earn 1,000 total XP',                   'icon' => '⭐', 'xp_reward' => 25],
            ['key' => 'xp_5000',             'name' => 'XP Legend',            'description' => 'Earn 5,000 total XP',                   'icon' => '🌟', 'xp_reward' => 25],
            ['key' => 'speed_demon',         'name' => 'Speed Demon',         'description' => 'Complete a quiz in under 2 minutes',    'icon' => '⚡', 'xp_reward' => 25],
            ['key' => 'try_all_subjects',    'name' => 'Curious Mind',        'description' => 'Try a quiz in every subject',           'icon' => '📚', 'xp_reward' => 25],
        ];
    }

    /**
     * Check all achievement conditions and award any newly earned ones.
     */
    private function checkAchievements(User $user): array
    {
        $earned = [];
        $allDefinitions = $this->getAllAchievementDefinitions();
        $existingKeys = UserAchievement::where('user_id', $user->id)
            ->pluck('achievement_key')
            ->toArray();

        $pendingDefs = array_filter($allDefinitions, fn($def) => !in_array($def['key'], $existingKeys));
        if (empty($pendingDefs)) {
            return [];
        }

        // Preload snapshot in only 2 indexed queries to avoid 20+ SQL queries per check
        $profile = $this->getProfile($user);

        $completedAttempts = QuizAttempt::where('user_id', $user->id)
            ->where('status', 'completed')
            ->select(['id', 'score', 'total_marks', 'started_at', 'completed_at'])
            ->get();

        $completedCount = $completedAttempts->count();
        $perfectCount = $completedAttempts->filter(fn ($a) => $a->total_marks > 0 && $a->score >= $a->total_marks)->count();
        $hasSpeedDemon = $completedAttempts->contains(
            fn ($a) => $a->completed_at && $a->started_at && $a->completed_at->diffInSeconds($a->started_at) < 120
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

        $achievementBonusXp = 0;
        $achievementTransactions = [];
        $now = now();

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
            $profile->increment('total_xp', $achievementBonusXp);
            $profile->total_xp += $achievementBonusXp;
            $this->recalculateLevel($profile);
            XpTransaction::insert($achievementTransactions);
        }

        return $earned;
    }

    /**
     * Check if a specific achievement condition is met using preloaded snapshot.
     */
    private function checkAchievementCondition(User $user, string $key, array $snapshot): bool
    {
        $profile = $snapshot['profile'];

        return match ($key) {
            'first_quiz'    => $snapshot['completed_count'] >= 1,
            'quiz_5'        => $snapshot['completed_count'] >= 5,
            'quiz_10'       => $snapshot['completed_count'] >= 10,
            'quiz_25'       => $snapshot['completed_count'] >= 25,

            'perfect_score' => $snapshot['perfect_count'] >= 1,
            'perfect_3'     => $snapshot['perfect_count'] >= 3,

            'streak_3'      => $profile->longest_streak >= 3,
            'streak_7'      => $profile->longest_streak >= 7,
            'streak_14'     => $profile->longest_streak >= 14,
            'streak_30'     => $profile->longest_streak >= 30,

            'mastery_50'    => $snapshot['count_50'] >= 1,
            'mastery_80'    => $snapshot['count_80'] >= 1,
            'mastery_100'   => $snapshot['count_100'] >= 1,

            'all_subjects_80'  => $snapshot['count_80'] > 0 && $this->checkAllSubjectsMastery($user, 80),
            'level_5'          => $profile->level >= 5,
            'level_10'         => $profile->level >= 10,
            'xp_1000'          => $profile->total_xp >= 1000,
            'xp_5000'          => $profile->total_xp >= 5000,
            'speed_demon'      => $snapshot['has_speed_demon'],
            'try_all_subjects' => $snapshot['completed_count'] >= 2 && $this->checkTriedAllSubjects($user),

            default => false,
        };
    }

    /**
     * Check if user has 80%+ mastery in ALL subjects.
     */
    private function checkAllSubjectsMastery(User $user, int $threshold): bool
    {
        $totalSubjects = Subject::where('status', 'active')->count();
        if ($totalSubjects === 0) return false;

        $masteredSubjects = LearnerProgress::where('user_id', $user->id)
            ->where('mastery_score', '>=', $threshold)
            ->distinct('topic_id')
            ->count();

        // Check if user has progress in all subjects
        $subjectsWithProgress = LearnerProgress::where('user_id', $user->id)
            ->whereHas('topic')
            ->join('topics', 'learner_progress.topic_id', '=', 'topics.id')
            ->distinct('topics.subject_id')
            ->count('topics.subject_id');

        return $subjectsWithProgress >= $totalSubjects && $masteredSubjects > 0;
    }

    /**
     * Check if user has tried a quiz in every subject.
     */
    private function checkTriedAllSubjects(User $user): bool
    {
        $totalSubjects = Subject::where('status', 'active')->count();
        if ($totalSubjects === 0) return false;

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
