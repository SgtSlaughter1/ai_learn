<?php

namespace App\Http\Requests\SchoolExam;

use Illuminate\Foundation\Http\FormRequest;

class ExtendSchoolExamAttemptRequest extends FormRequest
{
    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'minutes' => ['required', 'integer', 'min:1', 'max:120'],
        ];
    }
}
