<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isTeacher();
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'exists:topics,id'],
            'question_text' => ['required', 'string'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'in:multiple_choice,multiple_select,short_answer,essay,true_false'],
            'difficulty' => ['nullable', 'string', 'in:easy,medium,hard'],
            'explanation' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'marks' => ['nullable', 'integer', 'min:1', 'max:100'],
            'options' => ['required', 'array', 'min:2'],
            'options.*.option_text' => ['required', 'string'],
            'options.*.is_correct' => ['required', 'boolean'],
            'options.*.explanation' => ['nullable', 'string'],
            'options.*.sort_order' => ['nullable', 'integer'],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $options = $this->input('options', []);
            $hasCorrect = false;
            foreach ($options as $option) {
                if (isset($option['is_correct']) && filter_var($option['is_correct'], FILTER_VALIDATE_BOOLEAN)) {
                    $hasCorrect = true;
                    break;
                }
            }
            if (!$hasCorrect) {
                $validator->errors()->add('options', 'A question must have at least one correct option.');
            }
        });
    }
}
