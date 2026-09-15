<?php

namespace App\Policies;

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
        return $quiz->status === 'active' || $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, Quiz $quiz): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function delete(User $user, Quiz $quiz): bool
    {
        return $user->isPlatformAdmin();
    }

    public function attempt(User $user, Quiz $quiz): bool
    {
        return $quiz->status === 'active';
    }
}
