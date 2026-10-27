<?php

namespace App\Http\Requests\Recess;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordRecessWinRequest extends FormRequest
{
    /** The games Recess offers; anything else is not a win to pay for. */
    public const GAMES = ['word_search', 'make_24', 'word_of_the_day', 'connect_four'];

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'game' => ['required', 'string', Rule::in(self::GAMES)],
            // When it was won on the device; offline wins sync later.
            'won_at' => ['nullable', 'date'],
        ];
    }
}
