<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\NormalizesEmail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateSchoolAdminRequest extends FormRequest
{
    use NormalizesEmail;

    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email,'.$id],
            'password' => ['nullable', 'string', Password::defaults()],
            'school_id' => ['nullable', 'exists:schools,id'],
            'phone' => ['nullable', 'string', 'max:50'],
        ];
    }
}
