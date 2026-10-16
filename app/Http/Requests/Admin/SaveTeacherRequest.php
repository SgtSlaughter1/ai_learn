<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAnyAdmin() ?? false;
    }

    public function rules(): array
    {
        $isSuperAdmin = $this->user()?->isPlatformAdmin() ?? false;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'school_id' => [$isSuperAdmin ? 'required' : 'nullable', 'exists:schools,id'],
            'specialization' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:100'],
            'employee_id' => ['nullable', 'string', 'max:50'],
            'bio' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'class_ids' => ['nullable', 'array'],
            'class_ids.*' => ['exists:classes,id'],
            'subject_ids' => ['nullable', 'array'],
            'subject_ids.*' => ['integer', 'exists:subjects,id'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
