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
        return $subject->status === 'active' || $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, Subject $subject): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function delete(User $user, Subject $subject): bool
    {
        return $user->isPlatformAdmin();
    }
}
