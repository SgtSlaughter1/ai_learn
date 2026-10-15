<?php

namespace App\Http\Requests\Revision;

use Illuminate\Foundation\Http\FormRequest;

class CompleteRevisionSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'completed_count' => ['nullable', 'integer', 'min:0', 'max:50'],
            'correct_count' => ['nullable', 'integer', 'min:0', 'lte:completed_count'],
            'time_spent_seconds' => ['nullable', 'integer'],
            'completed_at' => ['nullable', 'date'],
        ];
    }
}
