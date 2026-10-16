<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class EnrollClassLearnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAnyAdmin() || $this->user()?->isTeacher();
    }

    public function rules(): array
    {
        return [
            'email' => ['required_without_all:learner_id,user_id', 'nullable', 'email', 'exists:users,email'],
            'learner_id' => ['required_without_all:email,user_id', 'nullable', 'exists:users,id'],
            'user_id' => ['required_without_all:email,learner_id', 'nullable', 'exists:users,id'],
        ];
    }
}
