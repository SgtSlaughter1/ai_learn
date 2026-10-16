<?php

namespace App\Http\Requests\Teacher;

use Illuminate\Foundation\Http\FormRequest;

class EnrollLearnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isAnyAdmin() || $user->isTeacher() || $user->teacherProfile()->exists());
    }

    public function rules(): array
    {
        return [
            'email' => ['required_without:learner_id', 'nullable', 'email', 'exists:users,email'],
            'learner_id' => ['required_without:email', 'nullable', 'exists:users,id'],
        ];
    }
}
