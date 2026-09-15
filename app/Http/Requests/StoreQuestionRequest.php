<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isPlatformAdmin() || $this->user()?->isSchoolAdmin();
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'exists:topics,id'],
            'question_text' => ['required', 'string'],
            'type' => ['nullable', 'string', 'in:multiple_choice'],
            'difficulty' => ['nullable', 'string', 'in:easy,medium,hard'],
            'explanation' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'options' => ['required', 'array', 'min:2'],
            'options.*.option_text' => ['required', 'string'],
            'options.*.is_correct' => ['required', 'boolean'],
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
