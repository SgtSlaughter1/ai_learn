<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SubjectWebController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Subjects/Index');
    }

    public function show(Request $request, string $slug): Response
    {
        return Inertia::render('Subjects/Show', [
            'slug' => $slug,
        ]);
    }

    public function getSubjects(Request $request): JsonResponse
    {
        $user = $request->user();

        // Fetch active subjects and calculate progress percentages for this learner
        $subjects = Subject::where('status', 'active')
            ->select(['id', 'name', 'slug', 'description'])
            ->orderBy('sort_order')
            ->get()
            ->map(function ($subject) use ($user) {
                $totalTopics = $subject->topics()->count();
                $completedTopics = LearnerProgress::where('user_id', $user->id)
                    ->whereIn('topic_id', $subject->topics()->pluck('id'))
                    ->where('mastery_score', '>=', 80)
                    ->count();
                
                return [
                    'id' => $subject->id,
                    'name' => $subject->name,
                    'slug' => $subject->slug,
                    'description' => $subject->description,
                    'progress_percent' => $totalTopics > 0 ? round(($completedTopics / $totalTopics) * 100) : 0,
                    'topics_count' => $totalTopics,
                ];
            });

        return response()->json([
            'subjects' => $subjects,
        ]);
    }

    public function getSubjectDetails(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();

        $subject = Subject::where('slug', $slug)
            ->where('status', 'active')
            ->select(['id', 'name', 'slug', 'description'])
            ->firstOrFail();

        // Fetch topics and map learner progress
        $topics = $subject->topics()
            ->select(['id', 'subject_id', 'name', 'slug', 'level', 'description', 'sort_order'])
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->get()
            ->map(function ($topic) use ($user) {
                $progress = LearnerProgress::where('user_id', $user->id)
                    ->where('topic_id', $topic->id)
                    ->first();

                return [
                    'id' => $topic->id,
                    'subject_id' => $topic->subject_id,
                    'name' => $topic->name,
                    'slug' => $topic->slug,
                    'level' => $topic->level,
                    'description' => $topic->description,
                    'progress' => $progress ? [
                        'questions_attempted' => $progress->questions_attempted,
                        'questions_correct' => $progress->questions_correct,
                        'mastery_score' => $progress->mastery_score,
                    ] : null
                ];
            });

        $quizzes = Quiz::where('status', 'active')
            ->whereHas('questions.topic', function ($query) use ($subject) {
                $query->where('subject_id', $subject->id);
            })
            ->select(['id', 'title', 'description', 'time_limit_minutes'])
            ->get();

        return response()->json([
            'subject' => $subject,
            'topics' => $topics,
            'quizzes' => $quizzes,
        ]);
    }
}
