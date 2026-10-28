<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/** A CBT a school sets for its own classes. */
class SchoolExam extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CLOSED = 'closed';

    /** Question types the exam screen can show and the server can mark. */
    public const QUESTION_TYPES = ['multiple_choice', 'true_false'];

    /** Characters for start codes: no 0/O or 1/I/L, so a code read out in a hall isn't misheard. */
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'results_released_at' => 'datetime',
            'shuffle_questions' => 'boolean',
            'shuffle_options' => 'boolean',
            'show_score_immediately' => 'boolean',
            'duration_minutes' => 'integer',
            'pass_mark' => 'integer',
            'question_count' => 'integer',
            'total_marks' => 'integer',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(ClassModel::class, 'school_exam_classes', 'school_exam_id', 'class_id');
    }

    public function examQuestions(): HasMany
    {
        return $this->hasMany(SchoolExamQuestion::class)->orderBy('position');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(SchoolExamAttempt::class);
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isOpen(?Carbon $at = null): bool
    {
        $at ??= now();

        return $this->status === self::STATUS_PUBLISHED && $at->between($this->opens_at, $this->closes_at);
    }

    public function resultsReleased(): bool
    {
        return $this->results_released_at !== null;
    }

    public static function newAccessCode(): string
    {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
        }

        return $code;
    }

    /** Exams staff may see: all for platform admins, the school's for its admins, and for teachers the ones they set or whose classes they teach. */
    public function scopeVisibleToStaff(Builder $query, User $user): Builder
    {
        if ($user->isPlatformAdmin()) {
            return $query;
        }

        $schoolId = $user->managedSchoolId();
        if ($schoolId === null) {
            return $query->whereRaw('1 = 0');
        }

        $query->where('school_id', $schoolId);

        if ($user->isSchoolAdmin()) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->where('created_by', $user->id)
                ->orWhereHas('classes', fn (Builder $c) => $c->whereIn('classes.id', $user->taughtClassIds()));
        });
    }

    /** Published exams set for any of the learner's active classes. */
    public function scopeForLearner(Builder $query, User $learner): Builder
    {
        $classIds = $learner->classes()->where('classes.is_active', true)->pluck('classes.id');

        return $query->where('status', '!=', self::STATUS_DRAFT)
            ->whereIn('id', SchoolExamClass::query()->select('school_exam_id')->whereIn('class_id', $classIds));
    }
}
