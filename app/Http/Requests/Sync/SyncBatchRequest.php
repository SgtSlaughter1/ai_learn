<?php

namespace App\Http\Requests\Sync;

use Illuminate\Foundation\Http\FormRequest;

class SyncBatchRequest extends FormRequest
{
    /** Signed-in users only (route middleware); each item is authorized by its own endpoint. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:25'],
            'items.*.key' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9_\-:.]+$/', 'distinct'],
            'items.*.method' => ['required', 'in:POST,PUT,DELETE'],
            'items.*.path' => ['required', 'string', 'max:255', 'starts_with:/api/v1/'],
            'items.*.body' => ['nullable', 'array'],
        ];
    }
}
