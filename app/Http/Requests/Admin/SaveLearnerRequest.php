<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\NormalizesEmail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class SaveLearnerRequest extends FormRequest
{
    use NormalizesEmail;

    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'school_id' => ['nullable', 'exists:schools,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'class_id' => ['nullable', 'exists:classes,id'],
            'student_id' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
