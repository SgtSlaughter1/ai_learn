<?php

namespace App\Http\Requests\SchoolExam;

use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class SaveSchoolExamRequest extends FormRequest
{
    /** The most questions one exam can hold; keeps a paper (and its autosave) small. */
    public const MAX_QUESTIONS = 200;

    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    /** The browser sends UTC times; the columns hold the app's own time zone. */
    protected function prepareForValidation(): void
    {
        foreach (['opens_at', 'closes_at'] as $field) {
            try {
                if (is_string($this->input($field))) {
                    $this->merge([$field => Carbon::parse($this->input($field))->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s')]);
                }
            } catch (InvalidFormatException) {
                // left as sent; the date rule reports it
            }
        }
    }

    public function rules(): array
    {
        return [
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'title' => ['required', 'string', 'max:150'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:300'],
            'opens_at' => ['required', 'date'],
            'closes_at' => ['required', 'date', 'after:opens_at'],
            'pass_mark' => ['nullable', 'integer', 'min:0', 'max:100'],
            'shuffle_questions' => ['boolean'],
            'shuffle_options' => ['boolean'],
            'show_score_immediately' => ['boolean'],
            'class_ids' => ['required', 'array', 'min:1', 'max:30'],
            'class_ids.*' => ['integer', 'distinct', 'exists:classes,id'],
            'questions' => ['required', 'array', 'min:1', 'max:'.self::MAX_QUESTIONS],
            'questions.*.id' => ['required', 'integer', 'distinct'],
            'questions.*.marks' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'closes_at.after' => 'The exam must close after it opens.',
            'class_ids.required' => 'Pick at least one class to sit the exam.',
            'questions.required' => 'Add at least one question.',
        ];
    }
}
