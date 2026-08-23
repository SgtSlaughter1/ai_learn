<?php

namespace App\Policies;

use App\Enums\UserRole;
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
        return $subject->status === 'active' || $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function update(User $user, Subject $subject): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function delete(User $user, Subject $subject): bool
    {
        return $user->role === UserRole::ADMIN;
    }
}
