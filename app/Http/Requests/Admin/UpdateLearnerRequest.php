<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLearnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAnyAdmin() ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email,' . $id],
            'password' => ['nullable', 'string', 'min:6'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'student_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
