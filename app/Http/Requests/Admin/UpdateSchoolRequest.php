<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSchoolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isPlatformAdmin() ?? false;
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
            'admin_user_id' => ['nullable', 'exists:users,id'],
        ];
    }
}
