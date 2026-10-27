<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\EnrollClassLearnerRequest;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ClassLearnerController extends Controller
{
    public function index(Request $request, int $classId): JsonResponse
    {

        $class = ClassModel::with('school:id,name')->findOrFail($classId);
        Gate::authorize('update', $class);

        $learnerIds = ClassMembership::where('class_id', $classId)
            ->where('role', 'learner')
            ->where('is_active', true)
            ->pluck('user_id');

        if ($learnerIds->isEmpty()) {
            return response()->json([
                'class' => $class,
                'learners' => [],
            ]);
        }

        $progressMap = DB::table('learner_progress')
            ->whereIn('user_id', $learnerIds)
            ->groupBy('user_id')
            ->selectRaw('
                user_id,
                COUNT(*) as topics_covered,
                AVG(mastery_score) as avg_mastery,
                SUM(questions_attempted) as total_attempted,
                SUM(questions_correct) as total_correct
            ')
            ->get()
            ->keyBy('user_id');

        $learners = DB::table('users as u')
            ->whereIn('u.id', $learnerIds)
            ->leftJoin('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(ug.level, 1) as level'),
                DB::raw("COALESCE(ug.tier, 'Newcomer') as tier"),
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw('COALESCE(ug.current_streak, 0) as streak'),
            ])
            ->orderByDesc('ug.total_xp')
            ->get()
            ->map(function ($u) use ($progressMap) {
                $p = $progressMap->get($u->id);

                return [
                    'id' => (string) $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'level' => (int) $u->level,
                    'tier' => $u->tier,
                    'total_xp' => (int) $u->total_xp,
                    'streak' => (int) $u->streak,
                    'topics_covered' => (int) ($p?->topics_covered ?? 0),
                    'avg_mastery' => (int) round($p?->avg_mastery ?? 0),
                    'total_attempted' => (int) ($p?->total_attempted ?? 0),
                    'total_correct' => (int) ($p?->total_correct ?? 0),
                ];
            });

        return response()->json([
            'class' => $class,
            'learners' => $learners,
        ]);
    }

    public function store(EnrollClassLearnerRequest $request, int $classId): JsonResponse
    {

        $class = ClassModel::findOrFail($classId);
        Gate::authorize('update', $class);

        $validated = $request->validated();

        $learner = null;
        if (! empty($validated['email'])) {
            $learner = User::where('email', $validated['email'])->first();
        } elseif (! empty($validated['learner_id'])) {
            $learner = User::find($validated['learner_id']);
        } elseif (! empty($validated['user_id'])) {
            $learner = User::find($validated['user_id']);
        }

        if (! $learner) {
            abort(404, 'Learner not found');
        }

        if (! $learner->isLearner()) {
            throw ValidationException::withMessages(['email' => 'Selected user is not a learner']);
        }
        Gate::authorize('enrol', [$learner, $class]);

        // createOrFirst relies on the unique (class_id, user_id) index, so a retried or
        // concurrent enrolment reuses the membership instead of failing on a duplicate.
        $membership = ClassMembership::createOrFirst(
            ['class_id' => $classId, 'user_id' => $learner->id],
            ['role' => 'learner', 'is_active' => true]
        );
        if (! $membership->wasRecentlyCreated && ! $membership->is_active) {
            $membership->update(['is_active' => true]);
        }

        return response()->json(['message' => 'Learner enrolled into class successfully']);
    }

    public function destroy(Request $request, int $classId, string $learnerId): JsonResponse
    {
        Gate::authorize('update', ClassModel::findOrFail($classId));

        ClassMembership::where('class_id', $classId)
            ->where('user_id', $learnerId)
            ->where('role', 'learner')
            ->update(['is_active' => false]);

        return response()->json(['message' => 'Learner removed from class']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal Guards
    // ──────────────────────────────────────────────────────────────────────────
}
