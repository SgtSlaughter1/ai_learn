<?php

namespace App\Http\Requests\PastQuestion;

use Illuminate\Foundation\Http\FormRequest;

class ExplainPastQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'past_question_id' => ['required', 'integer', 'exists:past_questions,id'],
            'selected_option_id' => ['nullable', 'integer'],
        ];
    }
}
