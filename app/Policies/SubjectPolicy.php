<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\User;

class SubjectPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Subject $subject): bool
    {
        if ($user->isPlatformAdmin() || $user->isSchoolAdmin()) {
            return true;
        }

        if ($user->isTeacher()) {
            return $subject->class_id && $user->canManageClass($subject->class_id);
        }

        return $subject->status === 'active';
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, Subject $subject): bool
    {
        return $this->manage($user, $subject);
    }

    public function delete(User $user, Subject $subject): bool
    {
        return $user->isPlatformAdmin();
    }

    public function manage(User $user, Subject $subject): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            return $subject->school_id === $user->primarySchool()?->id || is_null($subject->school_id);
        }

        if ($user->isTeacher()) {
            return $subject->class_id && $user->canManageClass($subject->class_id);
        }

        return false;
    }
}
