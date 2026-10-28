<?php

namespace App\Http\Requests\SchoolExam;

use Illuminate\Foundation\Http\FormRequest;

class StartSchoolExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            // The start code the invigilator reads out in the room.
            'access_code' => ['required', 'string', 'max:12'],
        ];
    }
}
