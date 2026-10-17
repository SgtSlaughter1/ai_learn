<?php

namespace App\Policies;

use App\Models\ClassModel;
use App\Models\User;

/**
 * Managing other accounts (learners, teachers, school admins).
 * Platform admins manage every account except other platform admins; school admins
 * manage the learners and teachers of their own school.
 */
class UserPolicy
{
    public function update(User $actor, User $target): bool
    {
        if ($actor->is($target) || $target->isPlatformAdmin()) {
            return false;
        }
        if ($actor->isPlatformAdmin()) {
            return true;
        }
        if (! $actor->isSchoolAdmin() || ! ($target->isLearner() || $target->isTeacher())) {
            return false;
        }
        $schoolId = $actor->managedSchoolId();

        return $schoolId !== null && $target->belongsToSchool($schoolId);
    }

    public function delete(User $actor, User $target): bool
    {
        return $this->update($actor, $target);
    }

    /**
     * Adding a learner to a class: whoever manages the class may add that school's
     * learners, and self-registered learners who don't belong to any school yet.
     */
    public function enrol(User $actor, User $learner, ClassModel $class): bool
    {
        if (! $learner->isLearner() || ! $actor->can('manage', $class)) {
            return false;
        }
        if ($actor->isPlatformAdmin()) {
            return true;
        }

        return $learner->belongsToSchool((int) $class->school_id)
            || ($learner->managedSchoolId() === null && ! $learner->classMemberships()->exists());
    }

    /** Working with a learner's progress (interventions): their admins, or a teacher of one of their classes. */
    public function coach(User $actor, User $learner): bool
    {
        if (! $learner->isLearner()) {
            return false;
        }
        if ($this->update($actor, $learner)) {
            return true;
        }

        return $actor->isTeacher() && $learner->classMemberships()
            ->where('role', 'learner')
            ->where('is_active', true)
            ->pluck('class_id')
            ->contains(fn ($classId) => $actor->teachesClass($classId));
    }
}
