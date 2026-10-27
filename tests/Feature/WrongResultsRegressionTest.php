<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\School;
use App\Models\SpacedRepetitionItem;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use App\Services\Gamification\GamificationService;
use App\Services\Gamification\LeaderboardService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Regression tests for the "Wrong results" findings of the October 2026 backend review:
 * scoring, XP, streak and revision bugs that showed learners or teachers wrong numbers.
 */
class WrongResultsRegressionTest extends TestCase
{
    use RefreshDatabase;

    private User $learner;

    private ClassModel $class;

    private Topic $topic;

    /** @var array<int, Question> */
    private array $questions = [];

    protected function setUp(): void
    {
        parent::setUp();

        $school = School::create(['name' => 'School', 'slug' => 'school', 'is_active' => true]);
        $this->class = ClassModel::create(['school_id' => $school->id, 'name' => 'SS1', 'slug' => 'ss1', 'grade_level' => 'SS1', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $this->learner->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
        ClassMembership::create(['class_id' => $this->class->id, 'user_id' => $this->learner->id, 'role' => 'learner', 'is_active' => true]);

        $subject = Subject::factory()->create(['school_id' => $school->id, 'class_id' => $this->class->id, 'slug' => 'maths', 'status' => 'active']);
        $this->topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS1', 'status' => 'active']);
        for ($i = 0; $i < 8; $i++) {
            $q = Question::factory()->create(['topic_id' => $this->topic->id, 'school_id' => $school->id, 'status' => 'active']);
            QuestionOption::factory()->create(['question_id' => $q->id, 'is_correct' => true]);
            $this->questions[] = $q;
        }
    }

    private function gamification(): GamificationService
    {
        return app(GamificationService::class);
    }

    // W1

    public function test_daily_revision_works_for_a_learner_with_no_class(): void
    {
        $independent = User::factory()->create(['role' => UserRole::LEARNER]);

        $this->actingAs($independent)->getJson('/api/v1/revision/today')->assertOk();
        $this->actingAs($independent)->getJson('/api/v1/revision/stats')->assertOk();
    }

    // W2

    public function test_a_7_day_milestone_synced_days_later_keeps_the_streak(): void
    {
        UserGamification::create([
            'user_id' => $this->learner->id, 'total_xp' => 100,
            'current_streak' => 6, 'longest_streak' => 6,
            'last_active_date' => now()->subDays(4)->toDateString(),
        ]);

        // Day 7 was done offline three days ago and only synced now.
        $this->gamification()->awardXp($this->learner, 5, 'quiz_complete', null, now()->subDays(3)->setTime(10, 0));

        $profile = UserGamification::where('user_id', $this->learner->id)->first();
        $this->assertSame(7, (int) $profile->current_streak);
        $this->assertDatabaseHas('xp_transactions', ['user_id' => $this->learner->id, 'source' => 'streak_bonus']);
        $this->assertDatabaseMissing('xp_transactions', ['user_id' => $this->learner->id, 'source' => 'streak_penalty']);
    }

    // D5: days are Lagos days

    public function test_activity_just_after_lagos_midnight_counts_for_the_lagos_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-20 12:00', 'Africa/Lagos'));
        UserGamification::create([
            'user_id' => $this->learner->id, 'total_xp' => 10,
            'current_streak' => 2, 'longest_streak' => 2, 'last_active_date' => '2026-10-19',
        ]);

        // 00:30 in Lagos on the 20th, as a device sends it: 23:30 UTC on the 19th.
        $at = GamificationService::activityTime('2026-10-19T23:30:00Z');
        $this->gamification()->awardXp($this->learner, 1, 'test', null, $at);

        $this->assertSame('2026-10-20', $at->toDateString());
        $this->assertSame(3, (int) UserGamification::where('user_id', $this->learner->id)->value('current_streak'));
        Carbon::setTestNow();
    }

    // W3

    public function test_speed_demon_needs_a_quiz_under_two_minutes(): void
    {
        $quiz = Quiz::factory()->create();
        $make = fn (int $seconds) => QuizAttempt::create([
            'user_id' => $this->learner->id, 'quiz_id' => $quiz->id, 'status' => 'completed',
            'score' => 1, 'total_marks' => 2, 'started_at' => now()->subSeconds($seconds), 'completed_at' => now(),
        ]);

        $make(1800);
        $this->gamification()->awardXp($this->learner, 1, 'test');
        $this->assertFalse(UserAchievement::where('user_id', $this->learner->id)->where('achievement_key', 'speed_demon')->exists());

        $make(90);
        $this->gamification()->awardXp($this->learner, 1, 'test');
        $this->assertTrue(UserAchievement::where('user_id', $this->learner->id)->where('achievement_key', 'speed_demon')->exists());
    }

    // W4 + W5

    public function test_opening_revision_never_records_mistakes_or_touches_existing_items(): void
    {
        $mastered = SpacedRepetitionItem::create([
            'user_id' => $this->learner->id, 'question_id' => $this->questions[0]->id, 'item_type' => 'question',
            'topic_id' => $this->topic->id, 'repetition_level' => 5, 'ease_factor' => 2.6, 'interval_days' => 60,
            'consecutive_correct' => 5, 'total_reviews' => 5, 'total_mistakes' => 0,
            'next_review_at' => now()->addDays(30), 'status' => 'mastered', 'reason_tag' => 'retention_check',
        ]);

        $this->actingAs($this->learner)->getJson('/api/v1/revision/today')->assertOk();
        $this->actingAs($this->learner)->getJson('/api/v1/revision/today')->assertOk();

        $this->assertSame(0, (int) SpacedRepetitionItem::where('user_id', $this->learner->id)->sum('total_mistakes'));
        $this->assertSame('mastered', $mastered->fresh()->status);
        $this->assertSame(5, (int) $mastered->fresh()->repetition_level);
    }

    public function test_mastered_items_come_back_when_their_review_is_due(): void
    {
        SpacedRepetitionItem::create([
            'user_id' => $this->learner->id, 'question_id' => $this->questions[0]->id, 'item_type' => 'question',
            'topic_id' => $this->topic->id, 'subject_id' => $this->topic->subject_id, 'repetition_level' => 5, 'ease_factor' => 2.6,
            'interval_days' => 60, 'consecutive_correct' => 5, 'total_reviews' => 5, 'total_mistakes' => 0,
            'next_review_at' => now()->subDay(), 'status' => 'mastered', 'reason_tag' => 'retention_check',
        ]);

        $ids = collect($this->actingAs($this->learner)->getJson('/api/v1/revision/today')->assertOk()->json('data.items') ?? [])
            ->pluck('question_id')->all();
        $this->assertContains($this->questions[0]->id, $ids);
    }

    // W6

    public function test_flashcard_xp_is_capped_per_day(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($this->learner)
                ->postJson('/api/v1/flashcards/complete', ['ratings' => array_fill(0, 10, 'easy')])
                ->assertOk();
        }

        $this->assertSame(75, (int) XpTransaction::where('user_id', $this->learner->id)->where('source', 'flashcard_review')->sum('amount'));
        $this->actingAs($this->learner)->postJson('/api/v1/flashcards/complete', ['ratings' => array_fill(0, 11, 'easy')])
            ->assertUnprocessable();
    }

    // W7

    public function test_progress_sync_never_overwrites_server_totals(): void
    {
        LearnerProgress::create(['user_id' => $this->learner->id, 'topic_id' => $this->topic->id, 'questions_attempted' => 4, 'questions_correct' => 2, 'mastery_score' => 50]);

        $this->actingAs($this->learner)->postJson('/api/v1/progress/sync', [
            'topic_id' => $this->topic->id, 'questions_attempted' => 999999, 'questions_correct' => 999999, 'mastery_score' => 100,
        ])->assertOk()->assertJsonPath('progress.questions_attempted', 4);

        $this->assertSame(50, (int) LearnerProgress::where('user_id', $this->learner->id)->value('mastery_score'));
    }

    // W8

    public function test_a_removed_learner_no_longer_counts_in_the_class(): void
    {
        $this->assertSame(1, $this->class->learnerUsers()->count());
        ClassMembership::where('class_id', $this->class->id)->where('user_id', $this->learner->id)->update(['is_active' => false]);
        $this->assertSame(0, $this->class->learnerUsers()->count());
    }

    // W9

    public function test_a_new_learner_is_not_ranked_first(): void
    {
        $leader = User::factory()->create(['role' => UserRole::LEARNER]);
        UserGamification::create(['user_id' => $leader->id, 'total_xp' => 500]);

        $board = app(LeaderboardService::class)->board($this->learner);
        $this->assertSame(2, $board['current_user']['position']);
    }

    // W11

    public function test_a_late_sync_does_not_move_last_attempted_backwards(): void
    {
        $recent = Carbon::now()->subHour()->startOfSecond();
        LearnerProgress::recordResults($this->learner->id, [$this->topic->id => ['attempted' => 1, 'correct' => 1]], $recent);
        LearnerProgress::recordResults($this->learner->id, [$this->topic->id => ['attempted' => 1, 'correct' => 0]], now()->subWeeks(3));

        $row = LearnerProgress::where('user_id', $this->learner->id)->first();
        $this->assertTrue($row->last_attempted_at->equalTo($recent));
        $this->assertSame(2, (int) $row->questions_attempted);
    }
}
