<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSchoolRequest extends FormRequest
{
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
            'category' => ['nullable', 'string', 'in:primary,junior,senior,combined'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'in:1,2,3'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:schools,slug,' . $id],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            // Only a school admin account can be put in charge of a school.
            'admin_user_id' => ['nullable', Rule::exists('users', 'id')->where('role', 'school_admin')->whereNull('deleted_at')],
        ];
    }
}
