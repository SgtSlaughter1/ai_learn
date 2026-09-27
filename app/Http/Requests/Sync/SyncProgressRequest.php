<?php

namespace App\Http\Requests\Sync;

use Illuminate\Foundation\Http\FormRequest;

class SyncProgressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'integer', 'exists:topics,id'],
            'questions_attempted' => ['required', 'integer', 'min:0'],
            'questions_correct' => ['required', 'integer', 'min:0'],
            'mastery_score' => ['required', 'numeric', 'min:0', 'max:100'],
            'ability_score' => ['nullable', 'numeric'],
        ];
    }
}
