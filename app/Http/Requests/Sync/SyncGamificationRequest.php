<?php

namespace App\Http\Requests\Sync;

use Illuminate\Foundation\Http\FormRequest;

class SyncGamificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'total_xp' => ['required', 'integer', 'min:0'],
            'level' => ['required', 'integer', 'min:1'],
            'tier' => ['nullable', 'string'],
            'current_streak' => ['required', 'integer', 'min:0'],
            'longest_streak' => ['required', 'integer', 'min:0'],
        ];
    }
}
