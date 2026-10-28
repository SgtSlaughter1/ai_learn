<?php

namespace App\Http\Requests\SchoolExam;

use Illuminate\Foundation\Http\FormRequest;

class SaveSchoolExamAnswersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            // The whole answer sheet: question id => chosen option id. Checked against the learner's paper.
            'answers' => ['present', 'array', 'max:'.SaveSchoolExamRequest::MAX_QUESTIONS],
            'answers.*' => ['nullable', 'integer'],
            // How many times the learner has left the exam screen so far.
            'left_screen_count' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
