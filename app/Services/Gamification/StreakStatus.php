<?php

namespace App\Services\Gamification;

use App\Models\UserGamification;
use Carbon\Carbon;

/**
 * How a streak is shown: status, title and next milestone. Read-only; GamificationService updates streaks.
 */
class StreakStatus
{
    /**
     * Calculate comprehensive streak status and milestone details.
     */
    public static function details(UserGamification $profile): array
    {
        $today = Carbon::today();
        $lastActive = $profile->last_active_date ? Carbon::parse($profile->last_active_date) : null;
        $streak = (int) $profile->current_streak;

        $hoursRemaining = max(1, (int) Carbon::now()->diffInHours(Carbon::tomorrow()));

        if ($lastActive === null) {
            $status = 'inactive';
            $isProtected = false;
        } else {
            $diffDays = (int) $lastActive->diffInDays($today);

            if ($diffDays === 0) {
                $status = 'active_today';
                $isProtected = true;
            } elseif ($diffDays === 1) {
                $status = 'at_risk';
                $isProtected = false;
            } else {
                // If they have a shield and only missed 1 day
                if (($profile->streak_freeze_count ?? 0) > 0 && $diffDays === 2) {
                    $status = 'shield_armed';
                } else {
                    $status = 'broken';
                }
                $isProtected = false;
            }
        }

        return [
            'status' => $status,
            'title' => self::title($streak),
            'next_milestone' => self::nextMilestone($streak),
            'is_protected_today' => $isProtected,
            'hours_remaining_today' => $hoursRemaining,
        ];
    }

    /**
     * Get milestone title based on streak count.
     */
    public static function title(int $streak): string
    {
        return match (true) {
            $streak >= 30 => 'Master Scholar',
            $streak >= 14 => 'Exam Champion',
            $streak >= 7 => 'Unstoppable',
            $streak >= 3 => 'Curious Thinker',
            $streak >= 1 => 'Rising Star',
            default => 'Beginner',
        };
    }

    /**
     * Get next milestone target and progress.
     */
    public static function nextMilestone(int $streak): array
    {
        if ($streak < 3) {
            $target = 3;
            $title = 'Curious Thinker';
        } elseif ($streak < 7) {
            $target = 7;
            $title = 'Unstoppable';
        } elseif ($streak < 14) {
            $target = 14;
            $title = 'Exam Champion';
        } elseif ($streak < 30) {
            $target = 30;
            $title = 'Master Scholar';
        } else {
            $target = (int) (ceil(($streak + 1) / 10) * 10);
            $title = 'Streak Legend';
        }

        $daysRemaining = max(0, $target - $streak);
        $percent = $target > 0 ? min(100, round(($streak / $target) * 100)) : 100;

        return [
            'target_days' => $target,
            'title' => $title,
            'days_remaining' => $daysRemaining,
            'percent' => $percent,
        ];
    }
}
