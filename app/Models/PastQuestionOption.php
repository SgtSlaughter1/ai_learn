<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PastQuestionOption extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'is_correct' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function pastQuestion(): BelongsTo
    {
        return $this->belongsTo(PastQuestion::class);
    }
}
