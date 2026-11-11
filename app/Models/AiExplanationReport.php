<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A learner's (or anyone's) report that an AI explanation looks wrong, confusing or unsuitable. */
class AiExplanationReport extends Model
{
    public const REASONS = ['wrong', 'confusing', 'inappropriate'];

    public const UPDATED_AT = null;

    protected $guarded = [];

    public function explanation(): BelongsTo
    {
        return $this->belongsTo(AiExplanation::class, 'ai_explanation_id');
    }
}
