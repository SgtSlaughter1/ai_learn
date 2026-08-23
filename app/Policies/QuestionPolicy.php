<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\User;

class QuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function view(User $user, Question $question): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function update(User $user, Question $question): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function delete(User $user, Question $question): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }
}
