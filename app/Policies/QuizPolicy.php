<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Quiz;
use App\Models\User;

class QuizPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Quiz $quiz): bool
    {
        return $quiz->status === 'active' || $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function create(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function update(User $user, Quiz $quiz): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::TEACHER;
    }

    public function delete(User $user, Quiz $quiz): bool
    {
        return $user->role === UserRole::ADMIN;
    }

    public function attempt(User $user, Quiz $quiz): bool
    {
        return $quiz->status === 'active';
    }
}
