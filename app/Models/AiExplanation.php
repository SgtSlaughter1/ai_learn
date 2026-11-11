<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * An AI-written explanation for one question version and chosen option, written once and reused.
 * People can check it: learners report problems, and whoever manages the question approves,
 * corrects or hides it.
 */
class AiExplanation extends Model
{
    public const SOURCE_QUESTION = 'question';

    public const SOURCE_PAST_QUESTION = 'past_question';

    /** As the AI wrote it, not yet checked by a person. */
    public const STATUS_AI = 'ai';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_CORRECTED = 'corrected';

    /** Not shown to learners; they get the offline explanation instead. */
    public const STATUS_HIDDEN = 'hidden';

    /** Reports that hide an unchecked explanation until someone reviews it. */
    public const REPORTS_TO_HIDE = 3;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'source_id' => 'integer',
            'version' => 'integer',
            'option_id' => 'integer',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
            'open_reports' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    public static function cacheKey(string $source, int $sourceId, int $version, int $optionId): string
    {
        return 'ai_explanation_'.($source === self::SOURCE_PAST_QUESTION ? 'pq' : 'q')."_{$sourceId}_{$version}_{$optionId}";
    }

    /** After a review or a hide, the next learner reads the new state, not the cached one. */
    public function forgetCache(): void
    {
        Cache::forget(self::cacheKey($this->source, $this->source_id, $this->version, $this->option_id));
    }

    public function isChecked(): bool
    {
        return in_array($this->review_status, [self::STATUS_APPROVED, self::STATUS_CORRECTED], true);
    }

    public function isHidden(): bool
    {
        return $this->review_status === self::STATUS_HIDDEN;
    }

    public function reports(): HasMany
    {
        return $this->hasMany(AiExplanationReport::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** The question it explains, when that question still exists. */
    public function sourceQuestion(): Question|PastQuestion|null
    {
        return $this->source === self::SOURCE_PAST_QUESTION
            ? PastQuestion::with('options')->find($this->source_id)
            : Question::with(['options', 'topic.subject'])->find($this->source_id);
    }
}
