<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AiExtractQuestionsRequest;
use App\Http\Requests\Admin\AiGenerateQuestionsRequest;
use App\Models\ClassModel;
use App\Models\Question;
use App\Models\Subject;
use App\Models\Topic;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class QuestionToolsController extends Controller
{
    public function extract(AiExtractQuestionsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $subjectName = null;
        if (! empty($validated['subject_id'])) {
            $subject = Subject::findOrFail($validated['subject_id']);
            Gate::authorize('view', $subject);
            $subjectName = $subject->name;
        }

        $topicName = null;
        if (! empty($validated['topic_id'])) {
            $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
            Gate::authorize('create', [Question::class, $topic]);
            $topicName = $topic->name;
            if (! $subjectName && $topic?->subject) {
                $subjectName = $topic->subject->name;
            }
        }

        $aiService = app(AIService::class);
        $extracted = $aiService->extractAndSolveQuestions($validated['raw_text'], $subjectName, $topicName);

        return response()->json([
            'count' => count($extracted),
            'questions' => $extracted,
        ]);
    }

    public function generate(AiGenerateQuestionsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('create', [Question::class, $topic]);
        $topicName = $topic->name;

        $subjectName = null;
        if (! empty($validated['subject_id'])) {
            $subject = Subject::findOrFail($validated['subject_id']);
            Gate::authorize('view', $subject);
            $subjectName = $subject->name;
        }
        if (! $subjectName && $topic->subject) {
            $subjectName = $topic->subject->name;
        }

        $className = null;
        if (! empty($validated['class_id'])) {
            $class = ClassModel::findOrFail($validated['class_id']);
            Gate::authorize('view', $class);
            $className = $class->name;
        }

        $gradeLevel = $validated['grade_level'] ?? $topic->level ?? null;
        $count = $validated['count'] ?? 10;

        $aiService = app(AIService::class);
        $generated = $aiService->generateQuestionsForTopic(
            topicName: $topicName,
            subjectName: $subjectName,
            className: $className,
            gradeLevel: $gradeLevel,
            count: $count
        );

        return response()->json([
            'count' => count($generated),
            'questions' => $generated,
            'topic' => [
                'id' => $topic->id,
                'name' => $topic->name,
                'subject_id' => $topic->subject_id,
            ],
        ]);
    }

    public function uploadImage(Request $request): JsonResponse
    {

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,svg,gif', 'max:5120'],
        ]);

        $file = $request->file('image');
        $filename = 'q_'.time().'_'.Str::random(10).'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs('questions', $filename, 'public');

        $url = asset('storage/'.$path);

        return response()->json([
            'success' => true,
            'url' => $url,
            'path' => $path,
            'filename' => $filename,
        ]);
    }
}
