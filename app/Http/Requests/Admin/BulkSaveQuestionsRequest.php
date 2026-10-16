<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class BulkSaveQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAnyAdmin() || $this->user()?->isTeacher();
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'exists:topics,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.question_text' => ['required', 'string'],
            'questions.*.image_url' => ['nullable', 'string', 'max:500'],
            'questions.*.type' => ['nullable', 'string', 'in:multiple_choice,multiple_select,short_answer,essay,true_false'],
            'questions.*.difficulty' => ['nullable', 'string', 'in:easy,medium,hard'],
            'questions.*.explanation' => ['nullable', 'string'],
            'questions.*.options' => ['required', 'array', 'min:2'],
            'questions.*.options.*.option_text' => ['required', 'string'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
            'questions.*.options.*.explanation' => ['nullable', 'string'],
        ];
    }
}
