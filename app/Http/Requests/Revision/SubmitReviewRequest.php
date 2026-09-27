<?php

namespace App\Http\Requests\Revision;

use Illuminate\Foundation\Http\FormRequest;

class SubmitReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'item_id' => ['required', 'integer'],
            'selected_option_id' => ['nullable', 'integer'],
            'rating' => ['nullable', 'in:again,hard,good,easy'],
            'time_spent_seconds' => ['nullable', 'integer'],
        ];
    }
}
