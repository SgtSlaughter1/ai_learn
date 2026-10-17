<?php

namespace App\Policies;

use App\Models\Question;
use App\Models\Topic;
use App\Models\User;

/**
 * The question bank: platform admins manage everything; a school's admins manage its
 * questions; teachers manage questions of the subjects of classes they teach. Global
 * (school-less) content is managed by platform admins only.
 */
class QuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAnyAdmin() || $user->isTeacher();
    }

    public function view(User $user, Question $question): bool
    {
        return $question->topic !== null && $user->can('view', $question->topic);
    }

    /** Add questions to this topic. */
    public function create(User $user, Topic $topic): bool
    {
        return $this->managesQuestionsIn($user, $topic);
    }

    public function update(User $user, Question $question): bool
    {
        return $this->managesQuestionsIn($user, $question->topic);
    }

    public function delete(User $user, Question $question): bool
    {
        return $this->update($user, $question);
    }

    private function managesQuestionsIn(User $user, ?Topic $topic): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }
        $subject = $topic?->subject;
        if (! $subject || $subject->school_id === null || ! $user->canAccessSchool($subject->school_id)) {
            return false;
        }
        $roleAllows = $user->isSchoolAdmin() || ($user->isTeacher() && $user->teachesClass($subject->class_id));

        return $roleAllows && (! $topic->level || $user->supportsGradeLevel($topic->level));
    }
}
