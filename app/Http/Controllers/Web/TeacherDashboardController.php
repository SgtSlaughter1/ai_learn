<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\ClassMembership;
use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TeacherDashboardController extends Controller
{
    /**
     * Render the teacher dashboard page.
     */
    public function index(Request $request): mixed
    {
        $user = $request->user();

        // Get teacher's school
        $teacherProfile = $user->teacherProfile()->with('school')->first();
        $school = $teacherProfile?->school;

        if (!$school) {
            // Teacher without a school — show setup page
            return Inertia::render('teacher/Dashboard', [
                'school' => null,
                'classes' => [],
                'selectedClass' => null,
            ]);
        }

        // Get teacher's classes
        $classes = ClassModel::where('school_id', $school->id)
            ->whereHas('memberships', fn ($q) => $q->where('user_id', $user->id)->where('role', 'teacher'))
            ->withCount(['learnerUsers as learner_count'])
            ->get();

        // Selected class (from query param or first class)
        $selectedClassId = $request->get('class_id');
        $selectedClass = $selectedClassId
            ? $classes->firstWhere('id', $selectedClassId)
            : $classes->first();

        return Inertia::render('teacher/Dashboard', [
            'school' => [
                'id' => $school->id,
                'name' => $school->name,
                'slug' => $school->slug,
            ],
            'classes' => $classes->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'grade_level' => $c->grade_level,
                'learner_count' => $c->learner_count,
            ]),
            'selectedClass' => $selectedClass?->id,
        ]);
    }

    /**
     * Get aggregated stats for the teacher's classes.
     */
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $teacherProfile = $user->teacherProfile()->first();
        $school = $teacherProfile?->school;

        if (!$school) {
            return response()->json(['classes' => [], 'overview' => $this->emptyOverview()]);
        }

        // Get all class IDs this teacher teaches
        $classIds = ClassMembership::where('user_id', $user->id)
            ->where('role', 'teacher')
            ->pluck('class_id');

        $selectedClassId = $request->get('class_id');

        // Get learners in the selected class (or all classes)
        $learnerQuery = User::whereHas('classMemberships', function ($q) use ($classIds, $selectedClassId) {
            $q->where('role', 'learner');
            if ($selectedClassId) {
                $q->where('class_id', $selectedClassId);
            } else {
                $q->whereIn('class_id', $classIds);
            }
        });

        $learnerIds = $learnerQuery->pluck('id');

        // Overview stats
        $progressStats = LearnerProgress::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(DISTINCT user_id) as total_learners, SUM(questions_attempted) as total_attempted, SUM(questions_correct) as total_correct, AVG(mastery_score) as avg_mastery')
            ->first();

        $quizStats = QuizAttempt::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(*) as total_attempts, AVG(score) as avg_score, MAX(score) as best_score')
            ->where('status', 'completed')
            ->first();

        $topPerformers = User::whereIn('id', $learnerIds)
            ->with(['gamification'])
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'total_xp' => $u->gamification?->total_xp ?? 0,
                'level' => $u->gamification?->level ?? 1,
                'rank' => $u->gamification?->rank ?? 'Newcomer',
            ])
            ->sortByDesc('total_xp')
            ->take(10)
            ->values();

        $strugglingLearners = User::whereIn('id', $learnerIds)
            ->with(['learnerProgress' => function ($q) {
                $q->selectRaw('user_id, AVG(mastery_score) as avg_mastery');
                $q->groupBy('user_id');
            }])
            ->get()
            ->filter(fn ($u) => $u->learnerProgress->isNotEmpty() && $u->learnerProgress->first()->avg_mastery < 40)
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'avg_mastery' => round($u->learnerProgress->first()->avg_mastery),
            ])
            ->sortBy('avg_mastery')
            ->values();

        return response()->json([
            'overview' => [
                'total_learners' => (int) ($progressStats->total_learners ?? 0),
                'total_attempted' => (int) ($progressStats->total_attempted ?? 0),
                'total_correct' => (int) ($progressStats->total_correct ?? 0),
                'avg_mastery' => round($progressStats->avg_mastery ?? 0),
                'total_attempts' => (int) ($quizStats->total_attempts ?? 0),
                'avg_score' => round($quizStats->avg_score ?? 0),
                'best_score' => round($quizStats->best_score ?? 0),
            ],
            'top_performers' => $topPerformers,
            'struggling_learners' => $strugglingLearners,
            'classes' => ClassModel::where('school_id', $school->id)
                ->whereHas('memberships', fn ($q) => $q->where('user_id', $user->id)->where('role', 'teacher'))
                ->withCount(['learnerUsers as learner_count'])
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'learner_count' => $c->learner_count,
                ]),
        ]);
    }

    /**
     * Get learners in a specific class with their performance data.
     */
    public function getClassLearners(Request $request, int $classId): JsonResponse
    {
        $user = $request->user();

        // Verify teacher has access to this class
        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        $class = ClassModel::withCount('learnerUsers')->find($classId);
        $learnerIds = ClassMembership::where('class_id', $classId)
            ->where('role', 'learner')
            ->pluck('user_id');

        $learners = User::whereIn('id', $learnerIds)
            ->with(['gamification', 'learnerProgress' => function ($q) {
                $q->selectRaw('user_id, COUNT(*) as topics_covered, AVG(mastery_score) as avg_mastery, SUM(questions_attempted) as total_attempted, SUM(questions_correct) as total_correct');
                $q->groupBy('user_id');
            }])
            ->get()
            ->map(function ($u) {
                $progress = $u->learnerProgress->first();
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'level' => $u->gamification?->level ?? 1,
                    'rank' => $u->gamification?->rank ?? 'Newcomer',
                    'total_xp' => $u->gamification?->total_xp ?? 0,
                    'streak' => $u->gamification?->current_streak ?? 0,
                    'topics_covered' => $progress?->topics_covered ?? 0,
                    'avg_mastery' => round($progress?->avg_mastery ?? 0),
                    'total_attempted' => $progress?->total_attempted ?? 0,
                    'total_correct' => $progress?->total_correct ?? 0,
                ];
            })
            ->sortByDesc('total_xp')
            ->values();

        return response()->json([
            'class' => [
                'id' => $class->id,
                'name' => $class->name,
                'learner_count' => $class->learner_count,
            ],
            'learners' => $learners,
        ]);
    }

    /**
     * Create a new class within the teacher's school.
     */
    public function createClass(Request $request): JsonResponse
    {
        $user = $request->user();
        $teacherProfile = $user->teacherProfile()->first();

        if (!$teacherProfile) {
            return response()->json(['error' => 'No school profile found'], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
        ]);

        $slug = \Str::slug($validated['name']) . '-' . \Str::random(5);

        $class = ClassModel::create([
            'school_id' => $teacherProfile->school_id,
            'name' => $validated['name'],
            'slug' => $slug,
            'grade_level' => $validated['grade_level'] ?? null,
            'section' => $validated['section'] ?? null,
            'description' => $validated['description'] ?? null,
        ]);

        // Auto-enroll teacher as class teacher
        ClassMembership::create([
            'class_id' => $class->id,
            'user_id' => $user->id,
            'role' => 'teacher',
        ]);

        return response()->json([
            'class' => [
                'id' => $class->id,
                'name' => $class->name,
                'slug' => $class->slug,
            ],
            'message' => 'Class created successfully',
        ]);
    }

    /**
     * Enroll a learner into a class.
     */
    public function enrollLearner(Request $request, int $classId): JsonResponse
    {
        $user = $request->user();

        // Verify teacher has access
        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $learner = User::where('email', $validated['email'])->first();

        if ($learner->role !== \App\Enums\UserRole::LEARNER) {
            return response()->json(['error' => 'User is not a learner'], 400);
        }

        // Check if already enrolled
        $exists = ClassMembership::where('class_id', $classId)
            ->where('user_id', $learner->id)
            ->first();

        if ($exists) {
            if ($exists->is_active) {
                return response()->json(['error' => 'Learner already enrolled in this class'], 400);
            }
            $exists->update(['is_active' => true]);
        } else {
            ClassMembership::create([
                'class_id' => $classId,
                'user_id' => $learner->id,
                'role' => 'learner',
            ]);

            // Create learner profile in the school if not exists
            $class = ClassModel::find($classId);
            if (!$learner->learnerProfile()->where('school_id', $class->school_id)->exists()) {
                \App\Models\LearnerProfile::create([
                    'user_id' => $learner->id,
                    'school_id' => $class->school_id,
                    'grade_level' => $class->grade_level,
                ]);
            }
        }

        return response()->json(['message' => 'Learner enrolled successfully']);
    }

    /**
     * Remove a learner from a class.
     */
    public function removeLearner(Request $request, int $classId, int $learnerId): JsonResponse
    {
        $user = $request->user();

        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        ClassMembership::where('class_id', $classId)
            ->where('user_id', $learnerId)
            ->where('role', 'learner')
            ->update(['is_active' => false]);

        return response()->json(['message' => 'Learner removed from class']);
    }

    private function emptyOverview(): array
    {
        return [
            'total_learners' => 0,
            'total_attempted' => 0,
            'total_correct' => 0,
            'avg_mastery' => 0,
            'total_attempts' => 0,
            'avg_score' => 0,
            'best_score' => 0,
        ];
    }
}
