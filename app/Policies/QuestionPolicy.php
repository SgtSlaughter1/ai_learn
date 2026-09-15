<?php

namespace App\Policies;

use App\Models\Question;
use App\Models\User;

class QuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function view(User $user, Question $question): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, Question $question): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function delete(User $user, Question $question): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }
}
