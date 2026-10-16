<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AiGenerateQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isAnyAdmin() || $user->isTeacher());
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'exists:topics,id'],
            'subject_id' => ['nullable', 'exists:subjects,id'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'count' => ['nullable', 'integer', 'min:1', 'max:25'],
        ];
    }
}
