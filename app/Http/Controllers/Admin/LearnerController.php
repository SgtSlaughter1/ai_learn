<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveLearnerRequest;
use App\Http\Requests\Admin\UpdateLearnerRequest;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\Consent;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use App\Models\UserGamification;
use App\Support\ListSize;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LearnerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'learner')
            ->managedBy($request->user())
            // Each learner's current consent-form answers (null: not recorded yet), without loading their rows.
            ->select('users.*')
            ->addSelect([
                'parental_consent' => Consent::currentAnswerSubquery(Consent::PARENTAL),
                'ai_training_consent' => Consent::currentAnswerSubquery(Consent::AI_TRAINING),
            ])
            ->with([
                'learnerProfile.school:id,name',
                'gamification:id,user_id,total_xp,level,tier',
                'classes:id,name,grade_level,arm,section,program_id',
                'classes.program:id,name,code',
            ]);

        if ($request->filled('school_id')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $request->school_id));
        }

        if ($request->filled('grade_level')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('grade_level', $request->grade_level));
        }

        if ($request->filled('class_id')) {
            $query->whereHas('classes', fn ($q) => $q->where('classes.id', $request->class_id));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', SearchTerm::like($search))
                    ->orWhere('email', 'like', SearchTerm::like($search))
                    ->orWhereHas('learnerProfile', fn ($lp) => $lp->where('student_id', 'like', SearchTerm::like($search)));
            });
        }

        $learners = $query->orderBy('name')
            ->paginate(ListSize::from($request->get('per_page'), 50, 100));

        return response()->json([
            'learners' => $learners->items(),
            'data' => $learners->items(),
            'pagination' => [
                'total' => $learners->total(),
                'per_page' => $learners->perPage(),
                'current_page' => $learners->currentPage(),
                'last_page' => $learners->lastPage(),
            ],
            'meta' => [
                'current_page' => $learners->currentPage(),
                'last_page' => $learners->lastPage(),
                'per_page' => $learners->perPage(),
                'total' => $learners->total(),
            ],
        ]);
    }

    public function store(SaveLearnerRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $validated['school_id'] = $request->user()->schoolForNewRecord($validated['school_id'] ?? null);

        $targetSchool = ! empty($validated['school_id']) ? School::find($validated['school_id']) : null;

        if (! empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (! $targetClass) {
                throw ValidationException::withMessages(['class_id' => 'Selected class does not exist.']);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                throw ValidationException::withMessages(['class_id' => 'The selected class does not belong to the selected school.']);
            }
            if ($targetSchool && ! $targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                throw ValidationException::withMessages(['grade_level' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category_type_label})."]);
            }
            if (empty($validated['grade_level'])) {
                $validated['grade_level'] = $targetClass->grade_level;
            }
        }

        if (! empty($validated['grade_level']) && $targetSchool && ! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            throw ValidationException::withMessages(['grade_level' => "Grade level {$validated['grade_level']} is not supported by the school's category ({$targetSchool->category_type_label})."]);
        }

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::LEARNER,
            ]);

            LearnerProfile::create([
                'user_id' => $user->id,
                'school_id' => $validated['school_id'] ?? null,
                'grade_level' => $validated['grade_level'] ?? null,
                'student_id' => $validated['student_id'] ?? null,
                'is_active' => true,
            ]);

            UserGamification::create([
                'user_id' => $user->id,
                'total_xp' => 0,
                'current_streak' => 0,
                'level' => 1,
                'tier' => 'Newcomer',
            ]);

            if (! empty($validated['class_id'])) {
                ClassMembership::create([
                    'class_id' => $validated['class_id'],
                    'user_id' => $user->id,
                    'role' => 'learner',
                    'is_active' => true,
                ]);
            }

            return $user;
        });

        $user->load(['learnerProfile.school:id,name', 'gamification', 'classes']);

        return response()->json([
            'message' => 'Learner added successfully',
            'learner' => $user,
        ], 201);
    }

    /** The most learners one bulk consent save can cover (a large school records class by class). */
    private const CONSENT_BATCH_MAX = 500;

    /**
     * Record a learner's consent form as the school received it: Part A (using AceDrill) and
     * Part B (AI improvement). Only a changed answer adds a row, so the history stays meaningful.
     */
    public function consent(Request $request, string $id): JsonResponse
    {
        $learner = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        Gate::authorize('update', $learner);
        $validated = $request->validate([
            'parental' => ['required', 'boolean'],
            'ai_training' => ['required', 'boolean'],
        ]);

        $this->recordConsentForms($request->user(), [$learner->id], $validated['parental'], $validated['ai_training']);

        return response()->json(['parental_consent' => $validated['parental'], 'ai_training_consent' => $validated['ai_training']]);
    }

    /** The same consent form answers for many learners at once, e.g. a whole class whose forms came back. */
    public function bulkConsent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'learner_ids' => ['required', 'array', 'min:1', 'max:'.self::CONSENT_BATCH_MAX],
            'learner_ids.*' => ['required', 'string', 'distinct'],
            'parental' => ['required', 'boolean'],
            'ai_training' => ['required', 'boolean'],
        ]);

        // Every learner must be one this person manages; one outside their school refuses the whole save.
        $ids = User::where('role', 'learner')->managedBy($request->user())->whereIn('id', $validated['learner_ids'])->pluck('id');
        abort_if($ids->count() !== count($validated['learner_ids']), 403, 'Some of these learners are not in your school.');

        $added = $this->recordConsentForms($request->user(), $ids->all(), $validated['parental'], $validated['ai_training']);

        return response()->json(['learners' => $ids->count(), 'changed' => $added]);
    }

    /**
     * Add a consent row wherever a learner's current answer differs, reading every current answer
     * in one query and writing every change in one insert. Returns how many rows were added.
     *
     * @param  array<int, string>  $learnerIds  already checked as manageable by $actor
     */
    private function recordConsentForms(User $actor, array $learnerIds, bool $parental, bool $aiTraining): int
    {
        $current = User::whereIn('id', $learnerIds)
            ->select('id')
            ->addSelect([
                Consent::PARENTAL => Consent::currentAnswerSubquery(Consent::PARENTAL),
                Consent::AI_TRAINING => Consent::currentAnswerSubquery(Consent::AI_TRAINING),
            ])
            ->toBase()
            ->get();

        $now = now();
        $rows = [];
        foreach ($current as $learner) {
            foreach ([Consent::PARENTAL => $parental, Consent::AI_TRAINING => $aiTraining] as $document => $granted) {
                if ($learner->{$document} === null || (bool) $learner->{$document} !== $granted) {
                    $rows[] = [
                        'user_id' => $learner->id,
                        'document' => $document,
                        'version' => Consent::currentVersion($document),
                        'granted' => $granted,
                        'source' => Consent::SOURCE_SCHOOL,
                        'recorded_by' => $actor->id,
                        'created_at' => $now,
                    ];
                }
            }
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            Consent::insert($chunk);
        }

        return count($rows);
    }

    public function update(UpdateLearnerRequest $request, string $id): JsonResponse
    {
        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        Gate::authorize('update', $user);

        $validated = $request->validated();
        $validated['school_id'] = $request->user()->schoolForNewRecord($validated['school_id'] ?? $user->learnerProfile?->school_id);

        $effectiveSchoolId = $validated['school_id'] ?? $user->learnerProfile?->school_id;
        $targetSchool = $effectiveSchoolId ? School::find($effectiveSchoolId) : null;

        if (! empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (! $targetClass) {
                throw ValidationException::withMessages(['class_id' => 'Selected class does not exist.']);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                throw ValidationException::withMessages(['class_id' => 'The selected class does not belong to the selected school.']);
            }
            if ($targetSchool && ! $targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                throw ValidationException::withMessages(['grade_level' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category_type_label})."]);
            }
        }

        if (! empty($validated['grade_level']) && $targetSchool && ! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            throw ValidationException::withMessages(['grade_level' => "Grade level {$validated['grade_level']} is not supported by the school's category ({$targetSchool->category_type_label})."]);
        }

        DB::transaction(function () use ($user, $validated) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (! empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $user->update($userData);

            $profile = LearnerProfile::firstOrNew(['user_id' => $user->id]);
            $profile->fill([
                'school_id' => $validated['school_id'] ?? $profile->school_id,
                'grade_level' => $validated['grade_level'] ?? $profile->grade_level,
                'student_id' => $validated['student_id'] ?? $profile->student_id,
                'is_active' => $validated['is_active'] ?? $profile->is_active ?? true,
            ]);
            $profile->save();

            if (isset($validated['class_id'])) {
                if ($validated['class_id']) {
                    ClassMembership::updateOrCreate(
                        ['user_id' => $user->id, 'role' => 'learner'],
                        ['class_id' => $validated['class_id'], 'is_active' => true]
                    );
                } else {
                    ClassMembership::where('user_id', $user->id)->where('role', 'learner')->delete();
                }
            }
        });

        $user->load(['learnerProfile.school:id,name', 'gamification', 'classes']);

        return response()->json([
            'message' => 'Learner updated successfully',
            'learner' => $user,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        Gate::authorize('delete', $user);

        $user->deleteAccount();

        return response()->json(['message' => 'Learner deleted successfully', 'archived' => true]);
    }
}
