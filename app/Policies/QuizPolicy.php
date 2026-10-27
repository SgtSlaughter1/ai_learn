<?php

namespace App\Policies;

use App\Models\Quiz;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolOwnership;

class QuizPolicy
{
    use ChecksSchoolOwnership;

    public function viewAny(User $user): bool
    {
        return true;
    }

    /** Active quizzes of the user's school (or shared ones); admins of that school also see inactive ones. */
    public function view(User $user, Quiz $quiz): bool
    {
        if (! $this->visibleInSchool($user, $quiz->school_id)) {
            return false;
        }

        return $quiz->status === 'active' || $this->adminManagesSchool($user, $quiz->school_id);
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, Quiz $quiz): bool
    {
        return $this->adminManagesSchool($user, $quiz->school_id);
    }

    public function delete(User $user, Quiz $quiz): bool
    {
        return $this->update($user, $quiz);
    }

    public function attempt(User $user, Quiz $quiz): bool
    {
        return $quiz->status === 'active' && $this->visibleInSchool($user, $quiz->school_id);
    }

    /**
     * Saving an attempt made offline. The quiz may have been deactivated since the learner took
     * it, so only the school check applies; otherwise the device would retry a lost attempt forever.
     */
    public function recordOfflineAttempt(User $user, Quiz $quiz): bool
    {
        return $this->visibleInSchool($user, $quiz->school_id);
    }
}
