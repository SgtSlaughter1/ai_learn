<?php

namespace App\Http\Requests\Quiz;

use Illuminate\Foundation\Http\FormRequest;

class SubmitQuizAttemptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'answers' => ['required', 'array'],
            // Same bounds as the offline sync: a negative value put started_at in the future.
            'duration_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ];
    }
}
