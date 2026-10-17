<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class AssignInterventionRequest extends FormRequest
{
    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'learner_id' => ['required', 'exists:users,id'],
            'topic_id' => ['required', 'exists:topics,id'],
            'question_count' => ['nullable', 'integer', 'min:1', 'max:50'],
            'intervention_type' => ['nullable', 'in:remedial_quiz,targeted_flashcards,ai_tutor_session'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
