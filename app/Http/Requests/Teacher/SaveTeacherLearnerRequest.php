<?php

namespace App\Http\Requests\Teacher;

use App\Http\Requests\Concerns\NormalizesEmail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class SaveTeacherLearnerRequest extends FormRequest
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
            'class_id' => ['required', 'exists:classes,id'],
            'student_id' => ['nullable', 'string', 'max:50'],
            'grade_level' => ['nullable', 'string', 'max:50'],
        ];
    }
}
