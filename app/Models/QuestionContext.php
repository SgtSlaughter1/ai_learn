<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Shared material several questions are about: a comprehension passage, a poem or
 * extract, a diagram or a table. Stored once; questions point to it with context_id
 * and are shown in context_order, always together.
 */
class QuestionContext extends Model
{
    use HasFactory;

    public const TYPES = ['passage', 'poem', 'diagram', 'table'];

    protected $guarded = [];

    protected $casts = [
        'show_line_numbers' => 'boolean',
    ];

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class, 'context_id')->orderBy('context_order')->orderBy('id');
    }

    /** What learners' devices get: everything needed to show it, nothing else. */
    public function toLearnerArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'instructions' => $this->instructions,
            'body' => $this->body,
            'image_url' => $this->image_url,
            'show_line_numbers' => (bool) $this->show_line_numbers,
        ];
    }

    public static function learnerArrays(iterable $ids): array
    {
        $ids = collect($ids)->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        return static::whereIn('id', $ids)->get()->map->toLearnerArray()->values()->all();
    }
}
