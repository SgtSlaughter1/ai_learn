<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\AiExplanation;
use App\Models\AiExplanationReport;
use App\Models\PastQuestion;
use App\Models\Question;
use App\Models\User;
use App\Services\AI\AiInputSanitizer;
use App\Services\AIService;
use App\Services\Notifications\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * People check the AI's explanations. Anyone signed in can report one that looks wrong; the
 * staff who manage the question (its school's admins, the teachers of its class, or a platform
 * admin for shared and past questions) see the reported ones and approve, correct or hide them.
 */
class AiExplanationReviewController extends Controller
{
    public function __construct(private AIService $ai, private AiInputSanitizer $sanitizer, private Notifier $notifier) {}

    public function report(Request $request, AiExplanation $explanation): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canSee($user, $explanation), 404);
        $validated = $request->validate([
            'reason' => ['required', Rule::in(AiExplanationReport::REASONS)],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        [$hidden, $counted] = DB::transaction(function () use ($explanation, $user, $validated) {
            $explanation = AiExplanation::lockForUpdate()->find($explanation->id);
            $report = AiExplanationReport::firstOrNew(['ai_explanation_id' => $explanation->id, 'user_id' => $user->id]);
            // Reporting again counts once, until a reviewer has looked at it since: then it's a new report.
            if ($report->exists && ($explanation->reviewed_at === null || $report->created_at > $explanation->reviewed_at)) {
                return [$explanation->isHidden(), false];
            }
            $report->fill(['reason' => $validated['reason'], 'note' => $validated['note'] ?? null, 'created_at' => now()])->save();

            $explanation->open_reports++;
            // A checked explanation goes back to its reviewers but stays up; an unchecked one
            // reported by several people comes down until someone looks at it.
            if ($explanation->review_status === AiExplanation::STATUS_AI && $explanation->open_reports >= AiExplanation::REPORTS_TO_HIDE) {
                $explanation->review_status = AiExplanation::STATUS_HIDDEN;
            }
            $explanation->save();
            $explanation->forgetCache();

            return [$explanation->isHidden(), true];
        });
        if ($counted) {
            $this->notifier->explanationReported($explanation->refresh());
        }

        return response()->json(['reported' => true, 'hidden' => $hidden]);
    }

    /** Reported explanations this person may review, for the current version of each question. */
    public function index(Request $request): JsonResponse
    {
        $items = $this->reviewable($request->user());

        return response()->json(['data' => $items, 'count' => $items->count()]);
    }

    /** A fresh AI explanation for the reviewer to edit; nothing is saved until they do. */
    public function draft(Request $request, AiExplanation $explanation): JsonResponse
    {
        $question = $this->reviewableSource($request->user(), $explanation);
        $optionId = $explanation->option_id ?: null;
        $body = $question instanceof PastQuestion
            ? $this->ai->explainPastQuestion($question, $optionId, draft: true)
            : $this->ai->explainAnswer($question, $optionId, draft: true);

        if (trim($body) === '') {
            return response()->json(['message' => 'The AI is not available right now. Edit the text yourself, or try again later.'], 503);
        }

        return response()->json(['body' => $this->sanitizer->sanitizeOutput($body)]);
    }

    public function review(Request $request, AiExplanation $explanation): JsonResponse
    {
        $user = $request->user();
        $this->reviewableSource($user, $explanation);
        $validated = $request->validate([
            'action' => ['required', Rule::in(['approve', 'correct', 'hide'])],
            'body' => ['required_if:action,correct', 'nullable', 'string', 'max:5000'],
        ]);

        $explanation->forceFill([
            'review_status' => match ($validated['action']) {
                'approve' => AiExplanation::STATUS_APPROVED,
                'correct' => AiExplanation::STATUS_CORRECTED,
                'hide' => AiExplanation::STATUS_HIDDEN,
            },
            'body' => $validated['action'] === 'correct' ? $this->sanitizer->sanitizeOutput($validated['body']) : $explanation->body,
            'open_reports' => 0,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ])->save();
        $explanation->forgetCache();
        $this->notifier->explanationReviewed($explanation, $user);

        return response()->json(['data' => ['id' => $explanation->id, 'review_status' => $explanation->review_status]]);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function reviewable(User $user)
    {
        $query = AiExplanation::where('open_reports', '>', 0)->with('reports');
        if (! $user->isPlatformAdmin()) {
            $schoolId = $user->managedSchoolId();
            $query->where('source', AiExplanation::SOURCE_QUESTION)->whereIn('source_id', Question::query()
                ->join('topics', 'topics.id', '=', 'questions.topic_id')
                ->join('subjects', 'subjects.id', '=', 'topics.subject_id')
                ->where('subjects.school_id', $schoolId ?? 0)
                ->when($user->isTeacher(), fn ($q) => $q->whereIn('subjects.class_id', $user->taughtClassIds() ?: [0]))
                ->select('questions.id'));
        }

        return $query->orderByRaw("CASE WHEN review_status = 'hidden' THEN 0 ELSE 1 END")
            ->orderByDesc('open_reports')
            ->limit(50)
            ->get()
            ->map(fn (AiExplanation $explanation) => $this->present($user, $explanation))
            ->filter()
            ->values();
    }

    /** The question behind the explanation, when this person may review it and it hasn't changed since. */
    private function reviewableSource(User $user, AiExplanation $explanation): Question|PastQuestion
    {
        $question = $explanation->sourceQuestion();
        abort_unless($question !== null && $this->canReview($user, $explanation, $question), 404);
        abort_if($this->isOutdated($explanation, $question), 409, 'This question has been edited since; learners now get a new explanation.');

        return $question;
    }

    private function canReview(User $user, AiExplanation $explanation, Question|PastQuestion $question): bool
    {
        if ($user->isPlatformAdmin()) {
            return true;
        }

        return $question instanceof Question && $user->can('update', $question);
    }

    /** Whether this person could have been shown the explanation: questions they can see, or any past question. */
    private function canSee(User $user, AiExplanation $explanation): bool
    {
        return $explanation->source === AiExplanation::SOURCE_PAST_QUESTION
            ? PastQuestion::whereKey($explanation->source_id)->exists()
            : Question::forUser($user)->whereKey($explanation->source_id)->exists();
    }

    private function isOutdated(AiExplanation $explanation, Question|PastQuestion $question): bool
    {
        return (int) ($question->updated_at?->timestamp ?? 0) !== $explanation->version;
    }

    private function present(User $user, AiExplanation $explanation): ?array
    {
        $question = $explanation->sourceQuestion();
        if ($question === null || $this->isOutdated($explanation, $question) || ! $this->canReview($user, $explanation, $question)) {
            return null;
        }
        // Reports since the last review are the open ones.
        $open = $explanation->reports->filter(fn ($r) => $explanation->reviewed_at === null || $r->created_at > $explanation->reviewed_at);

        return [
            'id' => $explanation->id,
            'source' => $explanation->source,
            'question_text' => $question->question_text,
            'options' => $question->options->map(fn ($o) => ['id' => $o->id, 'text' => $o->option_text, 'is_correct' => (bool) $o->is_correct])->values(),
            'chosen_option_id' => $explanation->option_id ?: null,
            'body' => $explanation->body,
            'review_status' => $explanation->review_status,
            'open_reports' => $explanation->open_reports,
            'reasons' => $open->countBy('reason'),
            'notes' => $open->pluck('note')->filter()->take(5)->values(),
        ];
    }
}
