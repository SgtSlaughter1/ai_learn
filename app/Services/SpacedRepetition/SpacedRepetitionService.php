<?php

namespace App\Services\SpacedRepetition;

use App\Models\LearnerProgress;
use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\SpacedRepetitionItem;
use App\Models\User;
use App\Services\Gamification\GamificationService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SpacedRepetitionService
{
    public function __construct(
        protected GamificationService $gamificationService
    ) {}

    /**
     * Record an attempt on a school curriculum question (from Quiz or revision).
     * Automatically enqueues mistakes or updates the SM-2 interval.
     */
    public function recordAttempt(User $user, array $params): ?SpacedRepetitionItem
    {
        $questionId = $params['question_id'] ?? null;
        $isCorrect = (bool) ($params['is_correct'] ?? false);
        $rating = $params['rating'] ?? null; // 'again', 'hard', 'good', 'easy'

        if (!$questionId) {
            return null;
        }

        $subjectId = $params['subject_id'] ?? null;
        $topicId = $params['topic_id'] ?? null;

        if (!$subjectId || !$topicId) {
            $q = Question::with('topic.subject')->find($questionId);
            $topicId = $topicId ?: $q?->topic_id;
            $subjectId = $subjectId ?: $q?->topic?->subject_id;
        }

        // Find or instantiate existing SRS item
        $item = SpacedRepetitionItem::where('user_id', $user->id)
            ->where('question_id', $questionId)
            ->first();

        if (!$item) {
            // New item creation
            $item = new SpacedRepetitionItem([
                'user_id' => $user->id,
                'item_type' => 'question',
                'question_id' => $questionId,
                'past_question_id' => null,
                'subject_id' => $subjectId,
                'topic_id' => $topicId,
                'repetition_level' => $isCorrect ? 1 : 0,
                'ease_factor' => 2.50,
                'interval_days' => $isCorrect ? 3 : 1,
                'consecutive_correct' => $isCorrect ? 1 : 0,
                'total_reviews' => 1,
                'total_mistakes' => $isCorrect ? 0 : 1,
                'last_reviewed_at' => now(),
                'next_review_at' => $isCorrect ? now()->addDays(3) : now()->addDay(),
                'last_result' => $isCorrect ? ($rating ?: 'good') : 'wrong',
                'reason_tag' => $isCorrect ? 'fragile_mastery' : 'recent_mistake',
                'status' => 'active',
            ]);
            $item->save();
            return $item;
        }

        // Update existing item with SuperMemo SM-2 logic
        $this->applySm2Update($item, $isCorrect, $rating);
        $item->save();

        return $item;
    }

    /**
     * Apply SuperMemo SM-2 algorithm to update repetition level and next interval.
     */
    protected function applySm2Update(SpacedRepetitionItem $item, bool $isCorrect, ?string $rating = null): void
    {
        $item->total_reviews += 1;
        $item->last_reviewed_at = now();

        if (!$isCorrect || $rating === 'again') {
            // Mistake / Failed Recall: reset interval
            $item->repetition_level = 1;
            $item->interval_days = 1;
            $item->consecutive_correct = 0;
            $item->total_mistakes += 1;
            $item->ease_factor = max(1.30, round($item->ease_factor - 0.20, 2));
            $item->next_review_at = now()->addDay();
            $item->last_result = 'wrong';
            $item->reason_tag = 'recent_mistake';
            $item->status = 'active';
            return;
        }

        // Correct Recall: advance interval
        $item->consecutive_correct += 1;
        $currentLevel = $item->repetition_level;
        $currentInterval = $item->interval_days;
        $ease = $item->ease_factor;

        // Adjust Ease Factor based on user rating
        if ($rating === 'easy') {
            $ease = min(3.00, round($ease + 0.15, 2));
        } elseif ($rating === 'hard') {
            $ease = max(1.30, round($ease - 0.15, 2));
        }
        $item->ease_factor = $ease;

        // Calculate next interval progression
        if ($currentLevel === 0 || $currentInterval <= 1) {
            $nextInterval = 3;
            $nextLevel = 2;
        } elseif ($currentLevel === 1 || $currentInterval <= 3) {
            $nextInterval = 7;
            $nextLevel = 3;
        } elseif ($currentLevel === 2 || $currentInterval <= 7) {
            $nextInterval = 14;
            $nextLevel = 4;
        } else {
            $multiplier = $rating === 'easy' ? max($ease, 2.5) : ($rating === 'hard' ? 1.2 : $ease);
            $nextInterval = (int) round($currentInterval * $multiplier);
            $nextLevel = $currentLevel + 1;
        }

        // Graduation to Mastered state
        if ($item->consecutive_correct >= 5 || $nextInterval >= 60) {
            $item->status = 'mastered';
            $item->interval_days = max(60, $nextInterval);
            $item->next_review_at = now()->addDays($item->interval_days);
            $item->reason_tag = 'retention_check';
        } else {
            $item->status = 'active';
            $item->interval_days = $nextInterval;
            $item->repetition_level = $nextLevel;
            $item->next_review_at = now()->addDays($nextInterval);
            $item->reason_tag = $nextInterval >= 14 ? 'retention_check' : 'fragile_mastery';
        }

        $item->last_result = $rating ?: ($isCorrect ? 'good' : 'wrong');
    }

    /**
     * Get the class IDs and subject IDs relevant to the learner's enrolled class and program track.
     */
    public function getLearnerCurriculumScope(User $user): array
    {
        $enrolledClass = DB::table('class_memberships as cm')
            ->join('classes as c', 'c.id', '=', 'cm.class_id')
            ->where('cm.user_id', $user->id)
            ->where('cm.role', 'learner')
            ->where('c.is_active', true)
            ->select(['c.id', 'c.name', 'c.school_id', 'c.grade_level', 'c.program_id'])
            ->first();

        if (!$enrolledClass) {
            // Fallback for independent learners: general school curriculum subjects
            $schoolId = $user->learnerProfile?->school_id;
            $subjectIds = Subject::where('status', 'active')
                ->when($schoolId, function ($q, $sId) {
                    $q->where(function ($sub) use ($sId) {
                        $sub->where('school_id', $sId)->orWhereNull('school_id');
                    });
                })
                ->pluck('id')
                ->all();

            return [
                'enrolled_class_id' => null,
                'class_ids' => [],
                'subject_ids' => $subjectIds,
                'school_id' => $schoolId,
            ];
        }

        // Progression / peer classes within same school and program track
        $classQuery = DB::table('classes')
            ->where('school_id', $enrolledClass->school_id)
            ->where('is_active', true);

        if ($enrolledClass->program_id) {
            $classQuery->where(function ($q) use ($enrolledClass) {
                $q->where('program_id', $enrolledClass->program_id)
                  ->orWhere('id', $enrolledClass->id);
            });
        } else {
            $classQuery->where('id', $enrolledClass->id);
        }

        $classIds = $classQuery->pluck('id')->all();

        // Find all subjects assigned to these classes OR general subjects (class_id IS NULL) in this school
        $subjectIds = DB::table('subjects')
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->where(function ($q) use ($classIds, $enrolledClass) {
                $q->whereIn('class_id', $classIds)
                  ->orWhere(function ($sub) use ($enrolledClass) {
                      $sub->whereNull('class_id')
                          ->where(function ($s) use ($enrolledClass) {
                              $s->where('school_id', $enrolledClass->school_id)
                                ->orWhereNull('school_id');
                          });
                  });
            })
            ->pluck('id')
            ->all();

        return [
            'enrolled_class_id' => $enrolledClass->id,
            'class_ids' => $classIds,
            'subject_ids' => $subjectIds,
            'school_id' => $enrolledClass->school_id,
        ];
    }

    /**
     * Get Today's 5-Minute Revision Queue for a user (default 6 items).
     * Sourced strictly from school curriculum questions matching the learner's class and program.
     * Automatically seeds with low-mastery school topics if scheduled queue is less than limit.
     */
    public function getTodayQueue(User $user, int $limit = 6): array
    {
        $scope = $this->getLearnerCurriculumScope($user);
        $subjectIds = $scope['subject_ids'];

        // 1. Fetch active school questions due today or overdue within the learner's class/programme subjects
        $dueQuery = SpacedRepetitionItem::with([
            'question.options',
            'question.topic.subject',
            'subject',
            'topic',
        ])
        ->where('user_id', $user->id)
        ->where('status', 'active')
        ->whereNotNull('question_id')
        ->where(function ($q) {
            $q->whereNull('next_review_at')
              ->orWhere('next_review_at', '<=', now()->endOfDay());
        });

        if (!empty($subjectIds)) {
            $dueQuery->where(function ($q) use ($subjectIds) {
                $q->whereIn('subject_id', $subjectIds)
                  ->orWhereHas('question.topic', function ($tq) use ($subjectIds) {
                      $tq->whereIn('subject_id', $subjectIds);
                  });
            });
        }

        $dueItems = $dueQuery
            ->orderByRaw("CASE 
                WHEN reason_tag = 'recent_mistake' THEN 1 
                WHEN reason_tag = 'fragile_mastery' THEN 2 
                WHEN reason_tag = 'weak_topic' THEN 3 
                ELSE 4 
            END")
            ->orderBy('next_review_at', 'asc')
            ->limit($limit)
            ->get();

        $formatted = $dueItems->map(fn($item) => $this->formatQueueItem($item))->filter()->values();

        // 2. Fallback: If learner has fewer than $limit items due, seed strictly from the learner's class/programme curriculum questions
        if ($formatted->count() < $limit) {
            $needed = $limit - $formatted->count();
            $existingQuestionIds = $dueItems->pluck('question_id')->filter()->all();

            $seededItems = $this->seedRevisionItems($user, $needed, $existingQuestionIds, $scope);
            $formatted = $formatted->concat($seededItems);
        }

        // Summary statistics for the dashboard
        $stats = $this->getStats($user);

        return [
            'total_due_today' => $formatted->count(),
            'estimated_minutes' => max(3, (int) ceil($formatted->count() * 0.8)),
            'stats' => $stats,
            'items' => $formatted->all(),
        ];
    }

    /**
     * Seed extra revision items strictly from learner's class & program curriculum questions.
     */
    protected function seedRevisionItems(User $user, int $count, array $excludeQIds, array $scope = []): Collection
    {
        if (empty($scope)) {
            $scope = $this->getLearnerCurriculumScope($user);
        }

        $subjectIds = $scope['subject_ids'] ?? [];
        $enrolledClassId = $scope['enrolled_class_id'] ?? null;
        $classIds = $scope['class_ids'] ?? [];

        // Find user's lowest mastery topics from learner's enrolled class & program subjects
        $weakTopicQuery = LearnerProgress::where('user_id', $user->id)
            ->where('mastery_score', '<', 75);

        if (!empty($subjectIds)) {
            $weakTopicQuery->whereHas('topic', function ($t) use ($subjectIds) {
                $t->whereIn('subject_id', $subjectIds);
            });
        }

        $weakTopicIds = $weakTopicQuery
            ->orderBy('mastery_score', 'asc')
            ->limit(5)
            ->pluck('topic_id')
            ->all();

        $seeded = collect();

        // 1. First priority: Questions from learner's weak topics in their curriculum
        if (!empty($weakTopicIds)) {
            $weakQuestions = Question::with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereIn('topic_id', $weakTopicIds)
                ->whereNotIn('id', $excludeQIds)
                ->inRandomOrder()
                ->limit($count)
                ->get();

            foreach ($weakQuestions as $q) {
                $item = $this->recordAttempt($user, [
                    'question_id' => $q->id,
                    'is_correct' => false,
                    'rating' => 'again',
                ]);
                if ($item) {
                    $item->setRelation('question', $q);
                    $item->reason_tag = 'weak_topic';
                    $seeded->push($this->formatQueueItem($item));
                    $excludeQIds[] = $q->id;
                }
            }
        }

        // 2. Second priority: Questions from the learner's EXACT enrolled class subjects
        if ($seeded->count() < $count && $enrolledClassId) {
            $stillNeeded = $count - $seeded->count();
            $exactClassQuestions = Question::with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereNotIn('id', $excludeQIds)
                ->whereHas('topic.subject', function ($s) use ($enrolledClassId) {
                    $s->where('class_id', $enrolledClassId);
                })
                ->inRandomOrder()
                ->limit($stillNeeded)
                ->get();

            foreach ($exactClassQuestions as $q) {
                $item = $this->recordAttempt($user, [
                    'question_id' => $q->id,
                    'is_correct' => false,
                    'rating' => 'again',
                ]);
                if ($item) {
                    $item->setRelation('question', $q);
                    $item->reason_tag = 'fragile_mastery';
                    $seeded->push($this->formatQueueItem($item));
                    $excludeQIds[] = $q->id;
                }
            }
        }

        // 3. Third priority: Questions from other progression classes in the learner's PROGRAM track
        if ($seeded->count() < $count && !empty($classIds)) {
            $stillNeeded = $count - $seeded->count();
            $programQuestions = Question::with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereNotIn('id', $excludeQIds)
                ->whereHas('topic.subject', function ($s) use ($classIds) {
                    $s->whereIn('class_id', $classIds);
                })
                ->inRandomOrder()
                ->limit($stillNeeded)
                ->get();

            foreach ($programQuestions as $q) {
                $item = $this->recordAttempt($user, [
                    'question_id' => $q->id,
                    'is_correct' => false,
                    'rating' => 'again',
                ]);
                if ($item) {
                    $item->setRelation('question', $q);
                    $item->reason_tag = 'fragile_mastery';
                    $seeded->push($this->formatQueueItem($item));
                    $excludeQIds[] = $q->id;
                }
            }
        }

        // 4. Fallback: Questions from general school subjects in the learner's school curriculum
        if ($seeded->count() < $count && !empty($subjectIds)) {
            $stillNeeded = $count - $seeded->count();
            $generalQuestions = Question::with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereNotIn('id', $excludeQIds)
                ->whereHas('topic.subject', function ($s) use ($subjectIds) {
                    $s->whereIn('id', $subjectIds);
                })
                ->inRandomOrder()
                ->limit($stillNeeded)
                ->get();

            foreach ($generalQuestions as $q) {
                $item = $this->recordAttempt($user, [
                    'question_id' => $q->id,
                    'is_correct' => false,
                    'rating' => 'again',
                ]);
                if ($item) {
                    $item->setRelation('question', $q);
                    $item->reason_tag = 'fragile_mastery';
                    $seeded->push($this->formatQueueItem($item));
                }
            }
        }

        return $seeded;
    }

    /**
     * Format an SRS item for interactive client revision.
     */
    public function formatQueueItem(SpacedRepetitionItem $item): ?array
    {
        $question = $item->question;
        $pastQuestion = $item->pastQuestion;

        if (!$question && !$pastQuestion) {
            return null;
        }

        $isPq = (bool) $pastQuestion;
        $qObj = $pastQuestion ?: $question;
        $subject = $item->subject ?: ($pastQuestion?->subject ?: $qObj->topic?->subject);
        $topic = $item->topic ?: $qObj->topic;

        // Friendly badge explanation
        $badge = match ($item->reason_tag) {
            'recent_mistake' => [
                'label' => 'Recent Mistake',
                'description' => 'Fix the misconception from a previous attempt',
                'color' => 'error',
                'icon' => 'alert-circle',
            ],
            'fragile_mastery' => [
                'label' => 'Quick Refresh',
                'description' => 'A quick review to keep this topic fresh and sharp in your memory',
                'color' => 'accent',
                'icon' => 'zap',
            ],
            'retention_check' => [
                'label' => 'Memory Check',
                'description' => 'Long-term retention check to lock into memory',
                'color' => 'success',
                'icon' => 'check-circle-2',
            ],
            'weak_topic' => [
                'label' => 'Topic Mastery',
                'description' => 'Targeted practice from your lowest scoring topic',
                'color' => 'primary',
                'icon' => 'target',
            ],
            default => [
                'label' => 'Daily Recall',
                'description' => 'Reinforce core curriculum concept',
                'color' => 'primary',
                'icon' => 'book-open',
            ],
        };

        // Format options
        $options = $qObj->options->map(function ($opt, $idx) use ($isPq) {
            $letter = $isPq 
                ? ($opt->option_key ?: chr(65 + $idx))
                : chr(65 + $idx);

            return [
                'id' => $opt->id,
                'key' => strtolower($letter),
                'label' => $letter,
                'option_text' => $opt->option_text,
                'is_correct' => (bool) $opt->is_correct,
            ];
        })->values()->all();

        return [
            'id' => $item->id,
            'item_type' => $item->item_type,
            'question_id' => $item->question_id,
            'past_question_id' => $item->past_question_id,
            'subject_name' => $subject?->name ?? 'Curriculum',
            'topic_name' => $topic?->name ?? 'General Assessment',
            'exam_code' => $pastQuestion?->exam_code ? strtoupper($pastQuestion->exam_code) : null,
            'exam_year' => $pastQuestion?->exam_year,
            'question_text' => $qObj->question_text,
            'passage_text' => $pastQuestion?->passage_text,
            'image_url' => $qObj->image_url,
            'explanation' => $qObj->explanation,
            'repetition_level' => $item->repetition_level,
            'consecutive_correct' => $item->consecutive_correct,
            'interval_days' => $item->interval_days,
            'last_reviewed_at' => $item->last_reviewed_at?->diffForHumans(),
            'badge' => $badge,
            'options' => $options,
        ];
    }

    /**
     * Submit an individual revision item answer and compute SM-2 progression + XP reward.
     */
    public function submitReview(User $user, int $itemId, array $payload): array
    {
        $item = SpacedRepetitionItem::where('user_id', $user->id)->findOrFail($itemId);

        $selectedOptionId = $payload['selected_option_id'] ?? null;
        $rating = $payload['rating'] ?? null; // 'again', 'hard', 'good', 'easy'

        // Determine correctness from selected option
        $isCorrect = false;
        $correctOption = null;

        if ($item->question_id) {
            $correctOption = QuestionOption::where('question_id', $item->question_id)
                ->where('is_correct', true)
                ->first();
            if ($correctOption && $selectedOptionId && (int) $correctOption->id === (int) $selectedOptionId) {
                $isCorrect = true;
            }
        } elseif ($item->past_question_id) {
            $correctOption = PastQuestionOption::where('past_question_id', $item->past_question_id)
                ->where('is_correct', true)
                ->first();
            if ($correctOption && $selectedOptionId && (int) $correctOption->id === (int) $selectedOptionId) {
                $isCorrect = true;
            }
        }

        // If explicit rating was passed (flashcard recall rating)
        if ($rating) {
            $isCorrect = in_array($rating, ['hard', 'good', 'easy']);
        } else {
            $rating = $isCorrect ? 'good' : 'again';
        }

        // Apply SM-2 update
        $this->applySm2Update($item, $isCorrect, $rating);
        $item->save();

        // Calculate XP Reward (strictly based on correct recall)
        if (!$isCorrect || $rating === 'again') {
            $xpEarned = 0;
            $gamificationResult = [
                'total_xp' => $user->gamification?->total_xp ?? 0,
                'level' => $user->gamification?->level ?? 1,
            ];
        } else {
            $xpEarned = match ($rating) {
                'easy' => 6,
                'good' => 4,
                'hard' => 2,
                default => 3,
            };

            $gamificationResult = $this->gamificationService->awardXp(
                $user,
                $xpEarned,
                'spaced_repetition',
                "Daily Revision Recall: " . ($item->topic?->name ?? 'Concept Recall')
            );
        }

        return [
            'success' => true,
            'is_correct' => $isCorrect,
            'correct_option_id' => $correctOption?->id,
            'correct_option_text' => $correctOption?->option_text,
            'explanation' => $item->question?->explanation ?? $item->pastQuestion?->explanation,
            'new_interval_days' => $item->interval_days,
            'next_review_in' => $item->next_review_at ? $item->next_review_at->diffForHumans() : '1 day',
            'is_mastered' => $item->status === 'mastered',
            'xp_earned' => $xpEarned,
            'total_xp' => $gamificationResult['total_xp'] ?? null,
            'level' => $gamificationResult['level'] ?? null,
        ];
    }

    /**
     * Get aggregate statistics for a user's memory retention deck (scoped to learner's class/programme curriculum).
     */
    public function getStats(User $user): array
    {
        $scope = $this->getLearnerCurriculumScope($user);
        $subjectIds = $scope['subject_ids'] ?? [];

        $base = SpacedRepetitionItem::where('user_id', $user->id)->whereNotNull('question_id');

        if (!empty($subjectIds)) {
            $base->where(function ($q) use ($subjectIds) {
                $q->whereIn('subject_id', $subjectIds)
                  ->orWhereHas('question.topic', function ($tq) use ($subjectIds) {
                      $tq->whereIn('subject_id', $subjectIds);
                  });
            });
        }

        $totalItems = (clone $base)->count();
        $dueToday = (clone $base)->where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('next_review_at')
                  ->orWhere('next_review_at', '<=', now()->endOfDay());
            })->count();
        $mastered = (clone $base)->where('status', 'mastered')->count();
        $learning = (clone $base)->where('status', 'active')->count();

        return [
            'total_in_memory' => $totalItems,
            'due_today' => $dueToday,
            'mastered_items' => $mastered,
            'learning_items' => $learning,
            'retention_rate' => $totalItems > 0 ? (int) round(($mastered / $totalItems) * 100) : 0,
        ];
    }
}
