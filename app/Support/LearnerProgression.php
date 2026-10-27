<?php

namespace App\Support;

use App\Models\ClassModel;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The classes a learner progresses through: their enrolled class and the other classes of the
 * same track at their school (their programme; else the JSS or primary ladder; else every class).
 */
class LearnerProgression
{
    private const JUNIOR = ['JSS1', 'JSS2', 'JSS3'];

    private const PRIMARY = ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'];

    /**
     * Null for a learner with no active class.
     *
     * @return array{enrolled_class: object, class_ids: array<int, int>, grade_levels: array<int, string>}|null
     */
    public static function for(User $user): ?array
    {
        $enrolled = DB::table('class_memberships as cm')
            ->join('classes as c', 'c.id', '=', 'cm.class_id')
            ->where('cm.user_id', $user->id)
            ->where('cm.role', 'learner')
            ->where('c.is_active', true)
            ->select(['c.id', 'c.school_id', 'c.name', 'c.grade_level', 'c.program_id'])
            ->first();
        if (! $enrolled) {
            return null;
        }

        $schoolClasses = DB::table('classes')
            ->where('school_id', $enrolled->school_id)
            ->where('is_active', true)
            ->when(
                $enrolled->program_id,
                fn ($q, $programId) => $q->where(fn ($sub) => $sub->where('program_id', $programId)->orWhereNull('program_id')),
                fn ($q) => $q->whereNull('program_id')
            )
            ->orderBy('id')
            ->get(['id', 'grade_level', 'program_id'])
            ->sortBy(fn ($c) => ClassModel::GRADE_ORDER[strtoupper($c->grade_level ?? '')] ?? 99)
            ->values();

        $grade = strtoupper($enrolled->grade_level ?? '');
        $inLadder = fn (array $ladder) => fn ($c) => in_array(strtoupper($c->grade_level ?? ''), $ladder, true);
        $track = match (true) {
            (bool) $enrolled->program_id => $schoolClasses->where('program_id', $enrolled->program_id),
            in_array($grade, self::JUNIOR, true) => $schoolClasses->filter($inLadder(self::JUNIOR)),
            in_array($grade, self::PRIMARY, true) => $schoolClasses->filter($inLadder(self::PRIMARY)),
            default => $schoolClasses,
        };

        if ($track->isEmpty()) {
            return [
                'enrolled_class' => $enrolled,
                'class_ids' => [(int) $enrolled->id],
                'grade_levels' => $enrolled->grade_level ? [strtolower($enrolled->grade_level)] : [],
            ];
        }

        return [
            'enrolled_class' => $enrolled,
            'class_ids' => $track->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            'grade_levels' => $track->pluck('grade_level')->filter()->unique()->map(fn ($g) => strtolower($g))->values()->all(),
        ];
    }
}
