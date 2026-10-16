<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAnyAdmin() || $this->user()?->isTeacher();
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:subjects,slug,' . $id],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'grade_levels' => ['nullable', 'array'],
            'grade_levels.*' => ['string', 'max:50'],
        ];
    }
}
