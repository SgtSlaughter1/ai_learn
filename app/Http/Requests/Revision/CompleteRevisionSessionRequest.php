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
            'completed_count' => ['nullable', 'integer'],
            'correct_count' => ['nullable', 'integer'],
            'time_spent_seconds' => ['nullable', 'integer'],
        ];
    }
}
