<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolOwnership;

class SubjectPolicy
{
    use ChecksSchoolOwnership;

    public function viewAny(User $user): bool
    {
        return true;
    }

    /** Global or own-school subjects; inactive ones only for the staff who manage content. */
    public function view(User $user, Subject $subject): bool
    {
        if (! $this->visibleInSchool($user, $subject->school_id)) {
            return false;
        }

        return $subject->status === 'active' || $user->isAdmin() || $user->isTeacher();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Global subjects: platform admins only; school subjects: that school's admins. */
    public function update(User $user, Subject $subject): bool
    {
        return $this->adminManagesSchool($user, $subject->school_id);
    }

    public function delete(User $user, Subject $subject): bool
    {
        return $this->update($user, $subject);
    }
}
