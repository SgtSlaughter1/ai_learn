<?php

namespace App\Policies;

use App\Models\Question;
use App\Models\Topic;
use App\Models\User;

class QuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin() || $user->isTeacher();
    }

    public function view(User $user, Question $question): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        $topic = $question->relationLoaded('topic') ? $question->topic : $question->topic()->first();
        if (!$topic) {
            return false;
        }

        return $user->can('view', $topic);
    }

    public function create(User $user, ?Topic $topic = null): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($topic) {
            return $user->can('manage', $topic);
        }

        return $user->isSchoolAdmin() || $user->isTeacher();
    }

    public function update(User $user, Question $question): bool
    {
        return $this->manage($user, $question);
    }

    public function delete(User $user, Question $question): bool
    {
        return $this->manage($user, $question);
    }

    public function manage(User $user, Question $question): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        $topic = $question->relationLoaded('topic') ? $question->topic : $question->topic()->first();
        if (!$topic) {
            return false;
        }

        return $user->can('manage', $topic);
    }
}
