<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;

/** Topics are managed by whoever manages their subject, within the grades the user covers. */
class TopicPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Topic $topic): bool
    {
        return $topic->subject !== null && $user->can('view', $topic->subject);
    }

    public function create(User $user, Subject $subject): bool
    {
        return $user->can('update', $subject);
    }

    public function update(User $user, Topic $topic): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        return $topic->subject !== null
            && $user->can('update', $topic->subject)
            && (! $topic->level || $user->supportsGradeLevel($topic->level));
    }

    public function delete(User $user, Topic $topic): bool
    {
        return $this->update($user, $topic);
    }
}
