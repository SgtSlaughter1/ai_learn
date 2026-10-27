<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    // SoftDeletes = archiving: archived users keep their quiz history but cannot sign in.
    use HasFactory, HasUuids, Notifiable, SoftDeletes;

    /**
     * Only what account forms set. is_active, archived_email and email_verified_at change through
     * forceFill in the code that owns them, so request data can never switch them.
     */
    protected $fillable = ['name', 'email', 'password', 'role'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
        ];
    }

    /**
     * Send the password reset notification.
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    // --- School Relationships ---

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function learnerProfile(): HasOne
    {
        return $this->hasOne(LearnerProfile::class);
    }

    public function classMemberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class);
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(ClassModel::class, 'class_memberships', 'user_id', 'class_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function schools(): HasManyThrough
    {
        return $this->hasManyThrough(School::class, TeacherProfile::class, 'user_id', 'id', null, 'school_id')
            ->union($this->hasManyThrough(School::class, LearnerProfile::class, 'user_id', 'id', null, 'school_id')->getQuery());
    }

    // --- Gamification ---

    public function gamification(): HasOne
    {
        return $this->hasOne(UserGamification::class);
    }

    public function learnerProgress(): HasMany
    {
        return $this->hasMany(LearnerProgress::class);
    }

    public function administeredSchool(): HasOne
    {
        return $this->hasOne(School::class, 'admin_user_id');
    }

    public function isPlatformAdmin(): bool
    {
        return $this->role === UserRole::PLATFORM_ADMIN || $this->role === 'platform_admin';
    }

    public function isSuperAdmin(): bool
    {
        return $this->isPlatformAdmin();
    }

    public function isSchoolAdmin(): bool
    {
        return $this->role === UserRole::SCHOOL_ADMIN || $this->role === 'school_admin';
    }

    /**
     * In this application, 'isAdmin' is strictly reserved for School Administrators.
     * Platform/Super administrators use 'isSuperAdmin()' or 'isPlatformAdmin()'.
     */
    public function isAdmin(): bool
    {
        return $this->isSchoolAdmin();
    }

    /**
     * Helper to check if user has any administrative privileges (Super Admin or School Admin).
     */
    public function isAnyAdmin(): bool
    {
        return $this->isPlatformAdmin() || $this->isSchoolAdmin();
    }

    public function isTeacher(): bool
    {
        return $this->role === UserRole::TEACHER || $this->role === 'teacher';
    }

    public function isLearner(): bool
    {
        return $this->role === UserRole::LEARNER || $this->role === 'learner';
    }

    // ── School scope: the one rule every policy and query scope uses ──

    private bool $managedSchoolResolved = false;

    private ?int $managedSchoolIdCache = null;

    /**
     * The school this account belongs to: the school a school admin administers, a
     * teacher's profile school, or a learner's profile/class school. Null when the
     * account has none (and for platform admins, who are not bound to one school).
     */
    public function managedSchoolId(): ?int
    {
        if (! $this->managedSchoolResolved) {
            $id = match (true) {
                $this->isSchoolAdmin() => $this->administeredSchool()->value('id'),
                $this->isTeacher() => $this->teacherProfile()->value('school_id'),
                $this->isLearner() => $this->learnerProfile()->whereNotNull('school_id')->value('school_id')
                    ?? $this->classes()->where('classes.is_active', true)->value('classes.school_id'),
                default => null,
            };
            $this->managedSchoolIdCache = $id !== null ? (int) $id : null;
            $this->managedSchoolResolved = true;
        }

        return $this->managedSchoolIdCache;
    }

    /**
     * Whether this account may act on data of the given school. Platform admins may act
     * on any school and on global (school-less) content; everyone else only on their own
     * school, never on global content.
     */
    public function canAccessSchool(int|string|null $schoolId): bool
    {
        if ($this->isPlatformAdmin()) {
            return true;
        }

        return $schoolId !== null && $this->managedSchoolId() !== null && (int) $schoolId === $this->managedSchoolId();
    }

    /** @var array<int, int>|null */
    private ?array $taughtClassIdsCache = null;

    /** Classes this user teaches: active teacher memberships of active classes (loaded once per request). */
    public function taughtClassIds(): array
    {
        if ($this->taughtClassIdsCache === null) {
            $this->taughtClassIdsCache = ! $this->isTeacher() ? [] : ClassMembership::where('user_id', $this->id)
                ->where('role', 'teacher')
                ->where('is_active', true)
                ->whereHas('schoolClass', fn ($q) => $q->where('is_active', true))
                ->pluck('class_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return $this->taughtClassIdsCache;
    }

    public function teachesClass(int|string|null $classId): bool
    {
        return $classId !== null && in_array((int) $classId, $this->taughtClassIds(), true);
    }

    /** Whether this (learner or teacher) account belongs to the school, through its profile or a class. */
    public function belongsToSchool(int $schoolId): bool
    {
        return static::whereKey($this->id)->belongingToSchool($schoolId)->exists();
    }

    /** Accounts attached to the school through a learner/teacher profile or a class membership. */
    public function scopeBelongingToSchool($query, int $schoolId)
    {
        return $query->where(function ($q) use ($schoolId) {
            $q->whereHas('learnerProfile', fn ($p) => $p->where('school_id', $schoolId))
                ->orWhereHas('teacherProfile', fn ($p) => $p->where('school_id', $schoolId))
                ->orWhereHas('classMemberships', fn ($m) => $m->whereIn('class_id', ClassModel::where('school_id', $schoolId)->select('id')));
        });
    }

    /**
     * The school a record created by this user belongs to: platform admins choose (or
     * leave it global with null); everyone else always creates in their own school.
     */
    public function schoolForNewRecord(int|string|null $requested = null): ?int
    {
        if ($this->isPlatformAdmin()) {
            return $requested !== null && $requested !== '' ? (int) $requested : null;
        }

        // Null means "global" (shared with every school), which only platform admins may create.
        return $this->managedSchoolId() ?? abort(403, 'Your account is not linked to a school.');
    }

    /** Accounts the actor may see in admin lists: all for platform admins, else their school's. */
    public function scopeManagedBy($query, User $actor)
    {
        return $actor->isPlatformAdmin() ? $query : $query->belongingToSchool($actor->managedSchoolId() ?? 0);
    }

    /**
     * The school record for this account. Platform admins get the first school as a
     * default context for school-level screens; everyone else gets their own school or
     * null (never someone else's school).
     */
    /** Looked up once per request, like managedSchoolId(): scoping calls this several times. */
    private bool $primarySchoolResolved = false;

    private ?School $primarySchoolCache = null;

    public function primarySchool(): ?School
    {
        if (! $this->primarySchoolResolved) {
            if ($this->isPlatformAdmin()) {
                $this->primarySchoolCache = School::first();
            } else {
                $schoolId = $this->managedSchoolId();
                $this->primarySchoolCache = $schoolId ? School::find($schoolId) : null;
            }
            $this->primarySchoolResolved = true;
        }

        return $this->primarySchoolCache;
    }

    /**
     * Whether this user is attached to a school (profile, roster or administered school).
     * Independent (self-signup) learners have none and are scoped to general-knowledge content.
     */
    /** Recess is on unless the learner's school switched it off (learners with no school get it). */
    public function recessEnabled(): bool
    {
        return $this->primarySchool()?->recess_enabled !== false;
    }

    public function hasSchoolAccess(): bool
    {
        if ($this->isPlatformAdmin()) {
            return true;
        }

        return $this->managedSchoolId() !== null;
    }

    /**
     * Get primary enrolled class for this learner.
     */
    public function primaryClass(): ?ClassModel
    {
        return $this->classes()->where('classes.is_active', true)->first();
    }

    /**
     * Get progressive classes window (full program track or section ladder in school).
     */
    public function classProgressionWindow(int $aheadCount = 2): array
    {
        $currentClass = $this->primaryClass();
        if (! $currentClass) {
            return [];
        }

        $gradeOrder = ClassModel::GRADE_ORDER;

        // 1. Program Track (e.g., SS1-SS3 Science / Business / Humanities)
        if ($currentClass->program_id) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->where('program_id', $currentClass->program_id)
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        $currentGrade = strtoupper($currentClass->grade_level ?? '');

        // 2. Junior Secondary section (JSS1 - JSS3)
        if (in_array($currentGrade, ['JSS1', 'JSS2', 'JSS3'])) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->whereIn('grade_level', ['JSS1', 'JSS2', 'JSS3'])
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        // 3. Primary section (PRI1 - PRI6)
        if (in_array($currentGrade, ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->whereIn('grade_level', ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        return ClassModel::where('school_id', $currentClass->school_id)
            ->where('is_active', true)
            ->whereNull('program_id')
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->pluck('id')
            ->all();
    }

    protected ?array $memoizedAllowedGradeLevels = null;

    protected ?array $memoizedGradeOptions = null;

    /**
     * Compute allowed grade levels strictly based on the user's role, school, and assigned classes.
     * Includes in-memory memoization and eager loading awareness for zero N+1 queries.
     */
    public function allowedGradeLevels(): array
    {
        if ($this->memoizedAllowedGradeLevels !== null) {
            return $this->memoizedAllowedGradeLevels;
        }

        if ($this->isPlatformAdmin()) {
            return $this->memoizedAllowedGradeLevels = School::allowedGradeLevelsForCategoryIds(null);
        }

        $school = $this->primarySchool();
        $schoolAllowed = $school ? $school->allowedGradeLevels() : School::allowedGradeLevelsForCategoryIds(null);

        if ($this->isTeacher()) {
            if ($this->relationLoaded('classes')) {
                $teacherClassGrades = $this->classes
                    ->where('is_active', true)
                    ->pluck('grade_level')
                    ->filter()
                    ->map(fn ($g) => strtoupper(str_replace(' ', '', (string) $g)))
                    ->unique()
                    ->values()
                    ->toArray();
            } else {
                $teacherClassGrades = $this->classes()
                    ->where('classes.is_active', true)
                    ->pluck('grade_level')
                    ->filter()
                    ->map(fn ($g) => strtoupper(str_replace(' ', '', (string) $g)))
                    ->unique()
                    ->values()
                    ->toArray();
            }

            if (empty($teacherClassGrades)) {
                return $this->memoizedAllowedGradeLevels = [];
            }

            return $this->memoizedAllowedGradeLevels = array_values(array_intersect($teacherClassGrades, $schoolAllowed));
        }

        if ($this->isSchoolAdmin()) {
            return $this->memoizedAllowedGradeLevels = $schoolAllowed;
        }

        if ($this->isLearner()) {
            $class = $this->primaryClass();
            $grade = $class?->grade_level ? strtoupper(str_replace(' ', '', (string) $class->grade_level)) : null;

            return $this->memoizedAllowedGradeLevels = ($grade ? [$grade] : []);
        }

        return $this->memoizedAllowedGradeLevels = $schoolAllowed;
    }

    /**
     * Compute structured grade options for the user with request-level memoization.
     */
    public function gradeOptions(): array
    {
        if ($this->memoizedGradeOptions !== null) {
            return $this->memoizedGradeOptions;
        }

        return $this->memoizedGradeOptions = School::filterGradeOptions($this->allowedGradeLevels());
    }

    /**
     * Check if user has permission for a specific grade level.
     */
    public function supportsGradeLevel(?string $gradeLevel): bool
    {
        if (! $gradeLevel) {
            return false;
        }
        $normalized = strtoupper(str_replace(' ', '', $gradeLevel));

        return in_array($normalized, $this->allowedGradeLevels(), true);
    }

    /**
     * Delete this account with everything that ties it to classes and schools: it leaves its
     * class rosters, a teacher's staff profile is removed and a school admin is unlinked from
     * the school. The account itself is archived (see removeAccount). Used by admins and by
     * users deleting their own account.
     */
    public function deleteAccount(): void
    {
        DB::transaction(function () {
            ClassMembership::where('user_id', $this->id)->delete();
            if ($this->isTeacher()) {
                $this->teacherProfile()->delete();
            }
            School::where('admin_user_id', $this->id)->update(['admin_user_id' => null]);
            $this->removeAccount();
        });
    }

    /**
     * Delete this account. Deletes are always soft (archived): the account can't sign in
     * and no longer appears anywhere, but its record and history are kept. The email is
     * freed so it can be used for a new account.
     *
     * @return bool always true (the account was archived, not erased)
     */
    public function removeAccount(): bool
    {
        $this->forceFill([
            'archived_email' => $this->email,
            'email' => 'archived+'.$this->id.'@archived.invalid',
            'remember_token' => null,
        ])->save();
        $this->delete();

        return true;
    }

    /**
     * Why this account may not sign in right now, or null when it may: the account itself
     * is deactivated, or it belongs to a school that is. Platform admins have no school.
     * Deactivated accounts keep everything and work again once reactivated.
     */
    public function signInBlockedReason(): ?string
    {
        // Only an explicit false counts: a just-created model hasn't loaded the default yet.
        if ($this->is_active === false) {
            return 'This account has been deactivated. Please contact your school administrator.';
        }

        $schoolId = $this->isPlatformAdmin() ? null : $this->managedSchoolId();
        if ($schoolId === null && $this->isSchoolAdmin()) {
            return 'Your account is not linked to a school yet. Please contact the platform administrator.';
        }
        if ($schoolId !== null && School::whereKey($schoolId)->where('is_active', false)->exists()) {
            return 'Your school\'s account has been deactivated. Please contact your school administrator.';
        }

        return null;
    }
}
