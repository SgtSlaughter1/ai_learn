<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * One consent given or withdrawn. Rows are only ever added, so the history is the proof; the
 * newest row per user and document is the current answer.
 */
class Consent extends Model
{
    public const UPDATED_AT = null;

    /** The Terms of Use and Privacy Policy, accepted together (an acknowledgement for learners). */
    public const TERMS = 'terms';

    /** Part A of the parental consent form, recorded by the school. */
    public const PARENTAL = 'parental';

    /** Using the person's data, de-identified, to improve AceDrill's AI. No answer counts as no. */
    public const AI_TRAINING = 'ai_training';

    public const SOURCE_SELF = 'self';

    public const SOURCE_SCHOOL = 'school';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['granted' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Add a consent row. The version defaults to the current one for that document. */
    public static function record(User $user, string $document, bool $granted, string $source, ?User $recordedBy = null, ?string $version = null): self
    {
        return self::create([
            'user_id' => $user->id,
            'document' => $document,
            'version' => $version ?? self::currentVersion($document),
            'granted' => $granted,
            'source' => $source,
            'recorded_by' => $recordedBy?->id,
        ]);
    }

    public static function currentVersion(string $document): string
    {
        return (string) config($document === self::TERMS ? 'legal.version' : 'legal.consent_form_version');
    }

    /** The newest row for one user and document, or null when none was recorded. */
    public static function latestFor(User $user, string $document): ?self
    {
        return self::where('user_id', $user->id)->where('document', $document)->orderByDesc('id')->first();
    }

    /**
     * A subquery for the user's current answer to one document (1, 0 or null), to add as a column
     * on a list of users without loading their consent rows.
     */
    public static function currentAnswerSubquery(string $document): QueryBuilder
    {
        return self::query()
            ->select('granted')
            ->whereColumn('consents.user_id', 'users.id')
            ->where('document', $document)
            ->orderByDesc('id')
            ->limit(1)
            ->toBase();
    }
}
