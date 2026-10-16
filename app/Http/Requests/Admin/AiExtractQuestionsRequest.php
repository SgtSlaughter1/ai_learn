<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AiExtractQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isAnyAdmin() || $user->isTeacher());
    }

    public function rules(): array
    {
        return [
            'raw_text' => ['required', 'string'],
            'subject_id' => ['nullable', 'exists:subjects,id'],
            'topic_id' => ['nullable', 'exists:topics,id'],
        ];
    }
}
