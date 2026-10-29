<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** An AI-written explanation for one question version and chosen option, written once and reused. */
class AiExplanation extends Model
{
    public const SOURCE_QUESTION = 'question';

    public const SOURCE_PAST_QUESTION = 'past_question';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'source_id' => 'integer',
            'version' => 'integer',
            'option_id' => 'integer',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
        ];
    }
}
