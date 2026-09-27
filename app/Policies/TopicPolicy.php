<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;

class TopicPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Topic $topic): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        $subject = $topic->relationLoaded('subject') ? $topic->subject : $topic->subject()->first();
        if (!$subject) {
            return false;
        }

        if ($user->isSchoolAdmin()) {
            $schoolId = $user->primarySchool()?->id;
            $matchesSchool = $subject->school_id === $schoolId || is_null($subject->school_id);
            $matchesGrade = !$topic->level || $user->supportsGradeLevel($topic->level);
            return $matchesSchool && $matchesGrade;
        }

        if ($user->isTeacher()) {
            $canManageSubject = $user->canManageSubject($subject);
            $matchesGrade = !$topic->level || $user->supportsGradeLevel($topic->level);
            return $canManageSubject && $matchesGrade;
        }

        return true;
    }

    public function create(User $user, ?Subject $subject = null, ?string $gradeLevel = null): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        if ($user->isSchoolAdmin()) {
            if ($subject && $subject->school_id && $subject->school_id !== $user->primarySchool()?->id) {
                return false;
            }
            if ($gradeLevel && !$user->supportsGradeLevel($gradeLevel)) {
                return false;
            }
            return true;
        }

        if ($user->isTeacher()) {
            if ($subject && !$user->canManageSubject($subject)) {
                return false;
            }
            if ($gradeLevel && !$user->supportsGradeLevel($gradeLevel)) {
                return false;
            }
            return true;
        }

        return false;
    }

    public function update(User $user, Topic $topic): bool
    {
        return $this->manage($user, $topic);
    }

    public function delete(User $user, Topic $topic): bool
    {
        return $this->manage($user, $topic);
    }

    public function manage(User $user, Topic $topic): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        $subject = $topic->relationLoaded('subject') ? $topic->subject : $topic->subject()->first();
        if (!$subject || !$user->canManageSubject($subject)) {
            return false;
        }

        if ($topic->level && !$user->supportsGradeLevel($topic->level)) {
            return false;
        }

        return true;
    }
}
