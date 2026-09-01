<?php

namespace Database\Seeders;

use App\Models\Achievement;
use Illuminate\Database\Seeder;

class AchievementSeeder extends Seeder
{
    public function run(): void
    {
        $achievements = [
            [
                'key'         => 'first_quiz',
                'name'        => 'First Steps',
                'description' => 'Complete your first quiz',
                'icon'        => '🎯',
                'xp_reward'   => 25,
                'category'    => 'quiz',
            ],
            [
                'key'         => 'quiz_5',
                'name'        => 'Getting Serious',
                'description' => 'Complete 5 quizzes',
                'icon'        => '📝',
                'xp_reward'   => 25,
                'category'    => 'quiz',
            ],
            [
                'key'         => 'quiz_10',
                'name'        => 'Quiz Enthusiast',
                'description' => 'Complete 10 quizzes',
                'icon'        => '🏆',
                'xp_reward'   => 25,
                'category'    => 'quiz',
            ],
            [
                'key'         => 'quiz_25',
                'name'        => 'Quiz Master',
                'description' => 'Complete 25 quizzes',
                'icon'        => '👑',
                'xp_reward'   => 25,
                'category'    => 'quiz',
            ],
            [
                'key'         => 'perfect_score',
                'name'        => 'Flawless',
                'description' => 'Get a perfect score on any quiz',
                'icon'        => '💎',
                'xp_reward'   => 25,
                'category'    => 'performance',
            ],
            [
                'key'         => 'perfect_3',
                'name'        => 'Triple Perfect',
                'description' => 'Get 3 perfect scores',
                'icon'        => '✨',
                'xp_reward'   => 25,
                'category'    => 'performance',
            ],
            [
                'key'         => 'streak_3',
                'name'        => 'On Fire',
                'description' => 'Maintain a 3-day streak',
                'icon'        => '🔥',
                'xp_reward'   => 25,
                'category'    => 'streak',
            ],
            [
                'key'         => 'streak_7',
                'name'        => 'Week Warrior',
                'description' => 'Maintain a 7-day streak',
                'icon'        => '⚡',
                'xp_reward'   => 25,
                'category'    => 'streak',
            ],
            [
                'key'         => 'streak_14',
                'name'        => 'Unstoppable',
                'description' => 'Maintain a 14-day streak',
                'icon'        => '🌟',
                'xp_reward'   => 25,
                'category'    => 'streak',
            ],
            [
                'key'         => 'streak_30',
                'name'        => 'Iron Will',
                'description' => 'Maintain a 30-day streak',
                'icon'        => '💪',
                'xp_reward'   => 25,
                'category'    => 'streak',
            ],
            [
                'key'         => 'mastery_50',
                'name'        => 'Halfway There',
                'description' => 'Reach 50% mastery in any subject',
                'icon'        => '📈',
                'xp_reward'   => 25,
                'category'    => 'mastery',
            ],
            [
                'key'         => 'mastery_80',
                'name'        => 'Subject Expert',
                'description' => 'Reach 80% mastery in any subject',
                'icon'        => '🎓',
                'xp_reward'   => 25,
                'category'    => 'mastery',
            ],
            [
                'key'         => 'mastery_100',
                'name'        => 'Subject Master',
                'description' => 'Reach 100% mastery in any subject',
                'icon'        => '🥇',
                'xp_reward'   => 25,
                'category'    => 'mastery',
            ],
            [
                'key'         => 'all_subjects_80',
                'name'        => 'Renaissance Student',
                'description' => 'Reach 80% mastery in all subjects',
                'icon'        => '🌍',
                'xp_reward'   => 25,
                'category'    => 'mastery',
            ],
            [
                'key'         => 'level_5',
                'name'        => 'Level Up!',
                'description' => 'Reach Level 5',
                'icon'        => '⬆️',
                'xp_reward'   => 25,
                'category'    => 'level',
            ],
            [
                'key'         => 'level_10',
                'name'        => 'High Roller',
                'description' => 'Reach Level 10',
                'icon'        => '🎰',
                'xp_reward'   => 25,
                'category'    => 'level',
            ],
            [
                'key'         => 'xp_1000',
                'name'        => 'XP Hunter',
                'description' => 'Earn 1,000 total XP',
                'icon'        => '⭐',
                'xp_reward'   => 25,
                'category'    => 'xp',
            ],
            [
                'key'         => 'xp_5000',
                'name'        => 'XP Legend',
                'description' => 'Earn 5,000 total XP',
                'icon'        => '🌟',
                'xp_reward'   => 25,
                'category'    => 'xp',
            ],
            [
                'key'         => 'speed_demon',
                'name'        => 'Speed Demon',
                'description' => 'Complete a quiz in under 2 minutes',
                'icon'        => '⚡',
                'xp_reward'   => 25,
                'category'    => 'speed',
            ],
            [
                'key'         => 'try_all_subjects',
                'name'        => 'Curious Mind',
                'description' => 'Try a quiz in every subject',
                'icon'        => '📚',
                'xp_reward'   => 25,
                'category'    => 'exploration',
            ],
        ];

        foreach ($achievements as $item) {
            Achievement::updateOrCreate(
                ['key' => $item['key']],
                $item
            );
        }
    }
}
