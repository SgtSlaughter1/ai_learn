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
            'client_id' => ['nullable', 'string', 'max:64'],
            'mode' => ['nullable', 'in:simulation,practice'],
            'duration_seconds' => ['nullable', 'integer'],
            'completed_at' => ['nullable', 'date'],
            'exam_code' => ['required', 'string'],
            'exam_year' => ['nullable', 'integer'],
            'time_spent_seconds' => ['nullable', 'integer'],
            'answers' => ['nullable', 'array'],
            'question_ids' => ['nullable', 'array'],
        ];
    }
}
