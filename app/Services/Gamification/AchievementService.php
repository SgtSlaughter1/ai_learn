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
use Illuminate\Support\Facades\DB;

/**
 * Badges: their definitions, the conditions for each, and awarding them.
 */
class AchievementService
{
    /**
     * Retrieve all achievement definitions from DB or fallback configuration.
     *
     * @return array<int, array{key: string, name: string, description: string, icon: string, xp_reward: int, category?: string}>
     */
    public function definitions(): array
    {
        $dbAchievements = Achievement::all();
        if ($dbAchievements->isNotEmpty()) {
            return $dbAchievements->map(fn (Achievement $a) => [
                'key' => $a->key,
                'name' => $a->name,
                'description' => $a->description,
                'icon' => $a->icon,
                'xp_reward' => $a->xp_reward ?? 0,
                'category' => $a->category,
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
     * Award every badge the learner now qualifies for (and its XP) and return the new ones.
     * Pass the locked profile from GamificationService so the XP lands in the same transaction.
     */
    public function check(User $user, UserGamification $profile): array
    {
        $allDefinitions = $this->definitions();
        $existingKeys = UserAchievement::where('user_id', $user->id)
            ->pluck('achievement_key')
            ->toArray();

        $pendingDefs = array_filter(
            $allDefinitions,
            fn (array $def) => ! in_array($def['key'], $existingKeys, true)
        );

        if (empty($pendingDefs)) {
            return [];
        }

        // Preload user snapshot in two indexed queries to prevent N+1 query bottlenecks

        $completedAttempts = QuizAttempt::where('user_id', $user->id)
            ->where('status', 'completed')
            ->select(['id', 'score', 'total_marks', 'started_at', 'completed_at'])
            ->get();

        $completedCount = $completedAttempts->count();
        $perfectCount = $completedAttempts->filter(fn (QuizAttempt $a) => $a->total_marks > 0 && $a->score >= $a->total_marks)->count();
        $hasSpeedDemon = $completedAttempts->contains(
            // started -> completed: Carbon 3 differences are signed, so the reverse order was always negative.
            fn (QuizAttempt $a) => $a->completed_at && $a->started_at
                && ($seconds = $a->started_at->diffInSeconds($a->completed_at)) >= 0 && $seconds < 120
        );

        $progressStats = LearnerProgress::where('user_id', $user->id)
            ->selectRaw('
                COUNT(CASE WHEN mastery_score >= 50 THEN 1 END) as count_50,
                COUNT(CASE WHEN mastery_score >= 80 THEN 1 END) as count_80,
                COUNT(CASE WHEN mastery_score >= 100 THEN 1 END) as count_100
            ')
            ->first();

        $snapshot = [
            'profile' => $profile,
            'completed_count' => $completedCount,
            'perfect_count' => $perfectCount,
            'has_speed_demon' => $hasSpeedDemon,
            'count_50' => (int) ($progressStats?->count_50 ?? 0),
            'count_80' => (int) ($progressStats?->count_80 ?? 0),
            'count_100' => (int) ($progressStats?->count_100 ?? 0),
        ];

        $earned = [];
        $achievementBonusXp = 0;
        $achievementTransactions = [];
        $now = now();

        foreach ($pendingDefs as $def) {
            if ($this->checkAchievementCondition($user, $def['key'], $snapshot)) {
                // insertOrIgnore: if a concurrent request already unlocked it, skip the reward
                // instead of failing on the unique (user_id, achievement_key) index.
                $inserted = UserAchievement::insertOrIgnore([
                    'user_id' => $user->id,
                    'achievement_key' => $def['key'],
                    'name' => $def['name'],
                    'description' => $def['description'],
                    'icon' => $def['icon'],
                    'earned_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                if ($inserted === 0) {
                    continue;
                }

                $rewardXp = $def['xp_reward'] ?? 25;
                $achievementBonusXp += $rewardXp;
                $achievementTransactions[] = [
                    'user_id' => $user->id,
                    'amount' => $rewardXp,
                    'source' => 'achievement',
                    'description' => "Achievement unlocked: {$def['name']}",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $earned[] = $def;
            }
        }

        if ($achievementBonusXp > 0) {
            $profile->total_xp += $achievementBonusXp;
            $profile->save();
            Levels::recalculate($profile);
            XpTransaction::insert($achievementTransactions);
        }

        return $earned;
    }

    /**
     * Check if a specific achievement condition evaluates to true.
     */
    private function checkAchievementCondition(User $user, string $key, array $snapshot): bool
    {
        /** @var UserGamification $profile */
        $profile = $snapshot['profile'];

        return match ($key) {
            'first_quiz' => $snapshot['completed_count'] >= 1,
            'quiz_5' => $snapshot['completed_count'] >= 5,
            'quiz_10' => $snapshot['completed_count'] >= 10,
            'quiz_25' => $snapshot['completed_count'] >= 25,

            'perfect_score' => $snapshot['perfect_count'] >= 1,
            'perfect_3' => $snapshot['perfect_count'] >= 3,

            'streak_3' => $profile->longest_streak >= 3,
            'streak_7' => $profile->longest_streak >= 7,
            'streak_14' => $profile->longest_streak >= 14,
            'streak_30' => $profile->longest_streak >= 30,

            'mastery_50' => $snapshot['count_50'] >= 1,
            'mastery_80' => $snapshot['count_80'] >= 1,
            'mastery_100' => $snapshot['count_100'] >= 1,

            'all_subjects_80' => $snapshot['count_80'] > 0 && $this->checkAllSubjectsMastery($user, 80),
            'level_5' => $profile->level >= 5,
            'level_10' => $profile->level >= 10,
            'xp_1000' => $profile->total_xp >= 1000,
            'xp_5000' => $profile->total_xp >= 5000,
            'speed_demon' => $snapshot['has_speed_demon'],
            'try_all_subjects' => $snapshot['completed_count'] >= 2 && $this->checkTriedAllSubjects($user),

            default => false,
        };
    }

    /** Active subjects this learner can study (their school's and the shared ones). */
    private function learnerSubjectIds(User $user): array
    {
        return Subject::forUser($user)->where('status', 'active')->pluck('id')->all();
    }

    /**
     * Whether every subject the learner can study averages at least $threshold mastery over the
     * topics they have practised. (It used to pass on any single topic at 80%, and compared
     * against every school's subjects.)
     */
    private function checkAllSubjectsMastery(User $user, int $threshold): bool
    {
        $subjectIds = $this->learnerSubjectIds($user);
        if ($subjectIds === []) {
            return false;
        }

        $masteredSubjects = LearnerProgress::where('learner_progress.user_id', $user->id)
            ->join('topics', 'learner_progress.topic_id', '=', 'topics.id')
            ->whereIn('topics.subject_id', $subjectIds)
            ->groupBy('topics.subject_id')
            ->havingRaw('AVG(learner_progress.mastery_score) >= ?', [$threshold])
            ->pluck('topics.subject_id');

        return $masteredSubjects->count() >= count($subjectIds);
    }

    /** Whether the learner has completed a quiz in every subject they can study. */
    private function checkTriedAllSubjects(User $user): bool
    {
        $subjectIds = $this->learnerSubjectIds($user);
        if ($subjectIds === []) {
            return false;
        }

        $triedSubjects = QuizAttempt::where('quiz_attempts.user_id', $user->id)
            ->where('quiz_attempts.status', 'completed')
            ->join('quiz_questions', 'quiz_attempts.quiz_id', '=', 'quiz_questions.quiz_id')
            ->join('questions', 'quiz_questions.question_id', '=', 'questions.id')
            ->join('topics', 'questions.topic_id', '=', 'topics.id')
            ->whereIn('topics.subject_id', $subjectIds)
            ->distinct('topics.subject_id')
            ->count('topics.subject_id');

        return $triedSubjects >= count($subjectIds);
    }
}
