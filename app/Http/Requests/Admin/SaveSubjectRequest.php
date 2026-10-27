<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveSubjectRequest extends FormRequest
{
    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:subjects,slug'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'class_id' => ['nullable', 'exists:classes,id'],
        ];
    }
}
