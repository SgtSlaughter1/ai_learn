<?php

namespace App\Policies;

use App\Models\SchoolExam;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolOwnership;

class SchoolExamPolicy
{
    use ChecksSchoolOwnership;

    /** A school's own admins and teachers, when the school has CBT on. Platform admins oversee but don't set exams. */
    public function create(User $user): bool
    {
        return ($user->isSchoolAdmin() || $user->isTeacher()) && $user->managedSchoolId() !== null && $user->cbtEnabled();
    }

    /** The school's admins, the teacher who set it, and teachers of a class sitting it. */
    public function manage(User $user, SchoolExam $exam): bool
    {
        if ($this->adminManagesSchool($user, $exam->school_id)) {
            return true;
        }

        if (! $user->isTeacher() || ! $user->canAccessSchool($exam->school_id)) {
            return false;
        }

        return $exam->created_by === $user->id
            || $exam->classes()->whereIn('classes.id', $user->taughtClassIds())->exists();
    }

    /** A learner in one of the exam's classes, once it is published. */
    public function take(User $user, SchoolExam $exam): bool
    {
        return $user->isLearner()
            && ! $exam->isDraft()
            && $user->canAccessSchool($exam->school_id)
            && $user->cbtEnabled()
            && $exam->classes()->whereIn('classes.id', $user->classes()->where('classes.is_active', true)->select('classes.id'))->exists();
    }
}
