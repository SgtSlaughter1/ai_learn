<?php

namespace App\Policies;

use App\Models\School;
use App\Models\User;

class SchoolPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAnyAdmin();
    }

    public function view(User $user, School $school): bool
    {
        return $user->canAccessSchool($school->id);
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin();
    }

    public function update(User $user, School $school): bool
    {
        return $user->isPlatformAdmin();
    }

    public function delete(User $user, School $school): bool
    {
        return $user->isPlatformAdmin();
    }

    /** Learner-facing settings such as Recess: the platform, or that school's own admin. */
    public function manageLearnerSettings(User $user, School $school): bool
    {
        return $user->isPlatformAdmin() || ($user->isSchoolAdmin() && $user->managedSchoolId() === $school->id);
    }
}
