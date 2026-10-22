<?php

namespace App\Policies;

use App\Models\QuestionContext;
use App\Models\User;

/** A shared passage is managed by whoever may manage questions in its topic. */
class QuestionContextPolicy
{
    public function __construct(private QuestionPolicy $questions) {}

    public function view(User $user, QuestionContext $context): bool
    {
        return $context->topic !== null && $user->can('view', $context->topic);
    }

    public function update(User $user, QuestionContext $context): bool
    {
        return $context->topic !== null && $this->questions->create($user, $context->topic);
    }

    public function delete(User $user, QuestionContext $context): bool
    {
        return $this->update($user, $context);
    }
}
