<?php

namespace App\Policies;

use App\Models\ClassModel;
use App\Models\User;
use App\Policies\Concerns\ChecksSchoolOwnership;

class ClassModelPolicy
{
    use ChecksSchoolOwnership;

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ClassModel $class): bool
    {
        return $this->adminManagesSchool($user, $class->school_id)
            || $user->teachesClass($class->id)
            || ($user->isLearner() && $user->classes()->where('classes.id', $class->id)->exists());
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Edit or delete the class and manage its roster: the school's admins. */
    public function update(User $user, ClassModel $class): bool
    {
        return $this->adminManagesSchool($user, $class->school_id);
    }

    public function delete(User $user, ClassModel $class): bool
    {
        return $this->update($user, $class);
    }

    /** Day-to-day class work (adding learners, interventions): the school's admins or the class's teachers. */
    public function manage(User $user, ClassModel $class): bool
    {
        return $this->update($user, $class) || $user->teachesClass($class->id);
    }
}
