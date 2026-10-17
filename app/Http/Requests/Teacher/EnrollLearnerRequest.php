<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class EnrollLearnerRequest extends FormRequest
{
    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required_without:learner_id', 'nullable', 'email', 'exists:users,email'],
            'learner_id' => ['required_without:email', 'nullable', 'exists:users,id'],
        ];
    }
}
