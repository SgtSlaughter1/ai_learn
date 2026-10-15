<?php

namespace App\Policies\Concerns;

use App\Models\User;

/**
 * The shared rule for records that belong to a school (or are global when school_id is null):
 * platform admins manage everything; school admins manage their own school's records;
 * global content is managed by platform admins only.
 */
trait ChecksSchoolOwnership
{
    protected function adminManagesSchool(User $user, int|string|null $schoolId): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        return $user->isSchoolAdmin() && $user->canAccessSchool($schoolId);
    }

    /** Readable by everyone when global, otherwise by members of that school. */
    protected function visibleInSchool(User $user, int|string|null $schoolId): bool
    {
        return $schoolId === null || $user->canAccessSchool($schoolId);
    }
}
