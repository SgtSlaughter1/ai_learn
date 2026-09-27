<?php

namespace App\Policies;

use App\Models\ClassModel;
use App\Models\User;

class ClassModelPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ClassModel $class): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            return $class->school_id === $user->primarySchool()?->id;
        }

        if ($user->isTeacher()) {
            if ($user->relationLoaded('classes')) {
                return $user->classes->contains('id', $class->id);
            }
            return $user->classes()->where('classes.id', $class->id)->exists();
        }

        if ($user->isLearner()) {
            return $class->id === $user->primaryClass()?->id;
        }

        return false;
    }

    public function create(User $user): bool
    {
        return $user->isPlatformAdmin() || $user->isSchoolAdmin();
    }

    public function update(User $user, ClassModel $class): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            return $class->school_id === $user->primarySchool()?->id;
        }

        return false;
    }

    public function delete(User $user, ClassModel $class): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            return $class->school_id === $user->primarySchool()?->id;
        }

        return false;
    }

    public function manage(User $user, ClassModel $class): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            return $class->school_id === $user->primarySchool()?->id;
        }

        if ($user->isTeacher()) {
            if ($user->relationLoaded('classes')) {
                return $user->classes->contains('id', $class->id);
            }
            return $user->classes()->where('classes.id', $class->id)->exists();
        }

        return false;
    }

    public function manageLearners(User $user, ClassModel $class): bool
    {
        return $this->manage($user, $class);
    }
}
