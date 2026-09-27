<?php

namespace App\Http\Requests\PastQuestion;

use Illuminate\Foundation\Http\FormRequest;

class StartExamSimulationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'exam_code' => ['required', 'string', 'max:30'],
            'exam_year' => ['nullable', 'integer'],
            'subject_ids' => ['nullable', 'array'],
            'mode' => ['nullable', 'in:simulation,practice'],
            'duration_seconds' => ['nullable', 'integer'],
            'total_questions' => ['nullable', 'integer'],
        ];
    }
}
