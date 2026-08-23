<?php

namespace App\Services\Gamification;

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

    // ── Public Methods ──

    /**
     * Get or create gamification profile for a user.
     */
    public function getProfile(User $user): UserGamification
    {
        return UserGamification::firstOrCreate(
            ['user_id' => $user->id],
            [
                'total_xp'      => 0,
                'level'         => 1,
                'rank'          => 'Newcomer',
                'current_streak'=> 0,
                'longest_streak'=> 0,
            ]
        );
    }

    /**
     * Award XP and process all gamification updates after a quiz attempt.
     * Returns the list of newly earned achievements.
     */
    public function processQuizCompletion(User $user, QuizAttempt $attempt, Quiz $quiz): array
    {
        $profile = $this->getProfile($user);
        $newAchievements = [];

        // 1. Award XP for correct answers
        $correctCount = $attempt->answers()->where('is_correct', true)->count();
        $totalQuestions = $attempt->answers()->count();

        $answerXp = $correctCount * self::XP_CORRECT_ANSWER;
        if ($answerXp > 0) {
            $this->awardXp($user, $answerXp, 'correct_answer', "{$correctCount} correct answers in {$quiz->title}");
        }

        // 2. Award base quiz completion XP
        $this->awardXp($user, self::XP_QUIZ_COMPLETE_BASE, 'quiz_complete', "Completed: {$quiz->title}");

        // 3. Perfect score bonus
        if ($totalQuestions > 0 && $correctCount === $totalQuestions) {
            $this->awardXp($user, self::XP_PERFECT_SCORE_BONUS, 'perfect_score', "Perfect score on {$quiz->title}!");
        }

        // 4. First attempt bonus
        $previousAttempts = QuizAttempt::where('user_id', $user->id)
            ->where('quiz_id', $quiz->id)
            ->where('id', '!=', $attempt->id)
            ->where('status', 'completed')
            ->count();

        if ($previousAttempts === 0) {
            $this->awardXp($user, self::XP_FIRST_ATTEMPT_BONUS, 'first_attempt', "First attempt on {$quiz->title}");
        }

        // 5. Update streak
        $this->updateStreak($user);

        // 6. Recalculate level and rank
        $this->recalculateLevel($profile);

        // 7. Check and award achievements
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
     */
    public function processFlashcardCompletion(User $user, int $xpEarned, int $cardsCount): array
    {
        $profile = $this->getProfile($user);

        // 1. Award flashcard XP
        if ($xpEarned > 0) {
            $this->awardXp($user, $xpEarned, 'flashcard_complete', "Completed recall deck of {$cardsCount} flashcards");
        }

        // 2. Update streak (active study)
        $this->updateStreak($user);

        // 3. Recalculate level and rank
        $this->recalculateLevel($profile);

        // 4. Check achievements
        $newAchievements = $this->checkAchievements($user);

        return [
            'xp_earned' => $xpEarned,
            'new_level' => $profile->level,
            'new_rank' => $profile->rank,
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
            ->orderByDesc('earned_at')
            ->get()
            ->map(fn($a) => [
                'key'         => $a->achievement_key,
                'name'        => $a->name,
                'description' => $a->description,
                'icon'        => $a->icon,
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
    private function recalculateLevel(UserGamification $profile): void
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
        return [
            ['key' => 'first_quiz',          'name' => 'First Steps',        'description' => 'Complete your first quiz',               'icon' => '🎯'],
            ['key' => 'quiz_5',              'name' => 'Getting Serious',     'description' => 'Complete 5 quizzes',                     'icon' => '📝'],
            ['key' => 'quiz_10',             'name' => 'Quiz Enthusiast',     'description' => 'Complete 10 quizzes',                    'icon' => '🏆'],
            ['key' => 'quiz_25',             'name' => 'Quiz Master',         'description' => 'Complete 25 quizzes',                    'icon' => '👑'],
            ['key' => 'perfect_score',       'name' => 'Flawless',            'description' => 'Get a perfect score on any quiz',        'icon' => '💎'],
            ['key' => 'perfect_3',           'name' => 'Triple Perfect',      'description' => 'Get 3 perfect scores',                  'icon' => '✨'],
            ['key' => 'streak_3',            'name' => 'On Fire',             'description' => 'Maintain a 3-day streak',               'icon' => '🔥'],
            ['key' => 'streak_7',            'name' => 'Week Warrior',        'description' => 'Maintain a 7-day streak',               'icon' => '⚡'],
            ['key' => 'streak_14',           'name' => 'Unstoppable',         'description' => 'Maintain a 14-day streak',              'icon' => '🌟'],
            ['key' => 'streak_30',           'name' => 'Iron Will',           'description' => 'Maintain a 30-day streak',              'icon' => '💪'],
            ['key' => 'mastery_50',          'name' => 'Halfway There',       'description' => 'Reach 50% mastery in any subject',      'icon' => '📈'],
            ['key' => 'mastery_80',          'name' => 'Subject Expert',      'description' => 'Reach 80% mastery in any subject',      'icon' => '🎓'],
            ['key' => 'mastery_100',         'name' => 'Subject Master',      'description' => 'Reach 100% mastery in any subject',     'icon' => '🥇'],
            ['key' => 'all_subjects_80',     'name' => 'Renaissance Student', 'description' => 'Reach 80% mastery in all subjects',     'icon' => '🌍'],
            ['key' => 'level_5',             'name' => 'Level Up!',           'description' => 'Reach Level 5',                         'icon' => '⬆️'],
            ['key' => 'level_10',            'name' => 'High Roller',         'description' => 'Reach Level 10',                        'icon' => '🎰'],
            ['key' => 'xp_1000',             'name' => 'XP Hunter',           'description' => 'Earn 1,000 total XP',                   'icon' => '⭐'],
            ['key' => 'xp_5000',             'name' => 'XP Legend',            'description' => 'Earn 5,000 total XP',                   'icon' => '🌟'],
            ['key' => 'speed_demon',         'name' => 'Speed Demon',         'description' => 'Complete a quiz in under 2 minutes',    'icon' => '⚡'],
            ['key' => 'try_all_subjects',    'name' => 'Curious Mind',        'description' => 'Try a quiz in every subject',           'icon' => '📚'],
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

        foreach ($allDefinitions as $def) {
            if (in_array($def['key'], $existingKeys)) continue;

            if ($this->checkAchievementCondition($user, $def['key'])) {
                UserAchievement::create([
                    'user_id'         => $user->id,
                    'achievement_key' => $def['key'],
                    'name'            => $def['name'],
                    'description'     => $def['description'],
                    'icon'            => $def['icon'],
                    'earned_at'       => now(),
                ]);

                // Award bonus XP for earning achievement
                $this->awardXp($user, 25, 'achievement', "Achievement unlocked: {$def['name']}");

                $earned[] = $def;
            }
        }

        return $earned;
    }

    /**
     * Check if a specific achievement condition is met.
     */
    private function checkAchievementCondition(User $user, string $key): bool
    {
        $profile = $this->getProfile($user);

        return match ($key) {
            'first_quiz' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')->count() >= 1,

            'quiz_5' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')->count() >= 5,

            'quiz_10' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')->count() >= 10,

            'quiz_25' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')->count() >= 25,

            'perfect_score' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')
                ->whereColumn('score', '=', 'total_marks')
                ->count() >= 1,

            'perfect_3' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')
                ->whereColumn('score', '=', 'total_marks')
                ->count() >= 3,

            'streak_3' => $profile->longest_streak >= 3,
            'streak_7' => $profile->longest_streak >= 7,
            'streak_14' => $profile->longest_streak >= 14,
            'streak_30' => $profile->longest_streak >= 30,

            'mastery_50' => LearnerProgress::where('user_id', $user->id)
                ->where('mastery_score', '>=', 50)->count() >= 1,

            'mastery_80' => LearnerProgress::where('user_id', $user->id)
                ->where('mastery_score', '>=', 80)->count() >= 1,

            'mastery_100' => LearnerProgress::where('user_id', $user->id)
                ->where('mastery_score', '>=', 100)->count() >= 1,

            'all_subjects_80' => $this->checkAllSubjectsMastery($user, 80),

            'level_5' => $profile->level >= 5,
            'level_10' => $profile->level >= 10,

            'xp_1000' => $profile->total_xp >= 1000,
            'xp_5000' => $profile->total_xp >= 5000,

            'speed_demon' => QuizAttempt::where('user_id', $user->id)
                ->where('status', 'completed')
                ->get()
                ->filter(fn($attempt) => $attempt->completed_at && $attempt->started_at && $attempt->completed_at->diffInSeconds($attempt->started_at) < 120)
                ->count() >= 1,

            'try_all_subjects' => $this->checkTriedAllSubjects($user),

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
