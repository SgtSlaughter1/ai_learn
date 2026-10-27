<?php

namespace App\Http\Requests\Admin\Concerns;

use Illuminate\Validation\Validator;

/**
 * Shared answer-key rules for saving questions: at least one correct option, and exactly one
 * unless the question is "multiple select". Two marked correct on a single-answer question used
 * to grade one of them as a mistake.
 */
trait ValidatesCorrectOptions
{
    protected function checkCorrectOptions(Validator $validator, array $options, ?string $type): void
    {
        $correct = count(array_filter($options, fn ($option) => is_array($option)
            && isset($option['is_correct'])
            && filter_var($option['is_correct'], FILTER_VALIDATE_BOOLEAN)));

        if ($correct === 0) {
            $validator->errors()->add('options', 'A question must have at least one correct option.');
        } elseif ($correct > 1 && ($type ?? 'multiple_choice') !== 'multiple_select') {
            $validator->errors()->add('options', 'Mark only one correct option, or set the type to "multiple select".');
        }
    }
}
