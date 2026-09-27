<?php

namespace App\Http\Requests\PastQuestion;

use Illuminate\Foundation\Http\FormRequest;

class SubmitExamSimulationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'simulation_id' => ['nullable', 'integer'],
            'exam_code' => ['required', 'string'],
            'exam_year' => ['nullable', 'integer'],
            'time_spent_seconds' => ['nullable', 'integer'],
            'answers' => ['nullable', 'array'],
            'question_ids' => ['nullable', 'array'],
        ];
    }
}
