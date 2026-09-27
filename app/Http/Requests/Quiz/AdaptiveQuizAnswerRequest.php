<?php

namespace App\Http\Requests\Quiz;

use Illuminate\Foundation\Http\FormRequest;

class AdaptiveQuizAnswerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'state_id' => ['required'],
            'question_id' => ['required', 'integer'],
            'selected_option_id' => ['nullable', 'integer'],
        ];
    }
}
