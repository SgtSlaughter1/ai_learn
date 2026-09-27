<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SaveClassRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        $isSchoolAdmin = $this->user() && $this->user()->isSchoolAdmin();

        return [
            'school_id' => [$isSchoolAdmin ? 'nullable' : 'required', 'exists:schools,id'],
            'program_id' => ['nullable', 'exists:programs,id'],
            'name' => ['required', 'string', 'max:100'],
            'grade_level' => ['required', 'string', 'in:CRECHE,KG1,KG2,NUR1,NUR2,PRI1,PRI2,PRI3,PRI4,PRI5,PRI6,JSS1,JSS2,JSS3,SS1,SS2,SS3'],
            'arm' => ['nullable', 'string', 'max:50'],
            'section' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
