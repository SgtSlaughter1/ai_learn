<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class QuizScoringIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $learner;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->topic = Topic::factory()->create(['subject_id' => Subject::factory()->create()->id]);
    }

    /** A quiz of $count active questions, each worth 2 marks; returns [quiz, correct option ids by question]. */
    private function quizWith(int $count): array
    {
        $quiz = Quiz::factory()->create(['status' => 'active']);
        $correct = [];
        for ($i = 1; $i <= $count; $i++) {
            $question = Question::factory()->create(['topic_id' => $this->topic->id, 'status' => 'active']);
            $correct[$question->id] = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true])->id;
            QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);
            $quiz->questions()->attach($question->id, ['sort_order' => $i, 'marks' => 2]);
        }

        return [$quiz, $correct];
    }

    private function sync(Quiz $quiz, array $answers): \Illuminate\Testing\TestResponse
    {
        $id = (string) Str::uuid();

        return $this->actingAs($this->learner)->postJson("/api/v1/quizzes/attempts/{$id}/sync", [
            'quiz_id' => $quiz->id,
            'answers' => $answers,
        ]);
    }

    public function test_one_known_answer_cannot_score_a_perfect_offline_attempt(): void
    {
        [$quiz, $correct] = $this->quizWith(12);
        $questionId = array_key_first($correct);

        $this->sync($quiz, [['question_id' => $questionId, 'selected_option_id' => $correct[$questionId]]])->assertOk();

        $attempt = QuizAttempt::firstOrFail();
        $this->assertSame(2, (int) $attempt->score);
        $this->assertSame(20, (int) $attempt->total_marks); // a full set of 10 questions
        $this->assertSame(10, $attempt->answers()->count());
    }

    public function test_one_known_answer_cannot_score_a_perfect_online_attempt(): void
    {
        [$quiz, $correct] = $this->quizWith(12);
        $questionId = array_key_first($correct);

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/{$quiz->id}/submit", ['answers' => [$questionId => $correct[$questionId]]])
            ->assertOk()
            ->assertJson(['score' => 2, 'total_marks' => 20]);
    }

    public function test_a_full_honest_attempt_still_scores_fully(): void
    {
        [$quiz, $correct] = $this->quizWith(12);
        $answers = collect($correct)->take(10)
            ->map(fn ($optionId, $questionId) => ['question_id' => $questionId, 'selected_option_id' => $optionId])
            ->values()->all();

        $this->sync($quiz, $answers)->assertOk();

        $attempt = QuizAttempt::firstOrFail();
        $this->assertSame(20, (int) $attempt->score);
        $this->assertSame(20, (int) $attempt->total_marks);
    }

    public function test_a_small_quiz_is_graded_on_all_its_questions(): void
    {
        [$quiz, $correct] = $this->quizWith(3);
        $questionId = array_key_first($correct);

        $this->sync($quiz, [['question_id' => $questionId, 'selected_option_id' => $correct[$questionId]]])->assertOk();

        $attempt = QuizAttempt::firstOrFail();
        $this->assertSame(2, (int) $attempt->score);
        $this->assertSame(6, (int) $attempt->total_marks);
    }

    public function test_learners_download_no_answers_or_explanations(): void
    {
        [$quiz] = $this->quizWith(3);
        Question::query()->update(['explanation' => 'Because the answer is 42.']);

        $questions = $this->actingAs($this->learner)->getJson("/api/v1/quizzes/{$quiz->id}")
            ->assertOk()->json('quiz.questions');

        foreach ($questions as $question) {
            $this->assertNull($question['explanation']);
            $this->assertNotEmpty($question['answer_hash']); // offline grading still works
            $this->assertNotEmpty($question['explanation_sealed']); // readable only after grading
            foreach ($question['options'] as $option) {
                $this->assertArrayNotHasKey('is_correct', $option);
            }
        }
    }

    public function test_staff_still_get_answers_and_explanations(): void
    {
        [$quiz] = $this->quizWith(1);
        Question::query()->update(['explanation' => 'Because the answer is 42.']);
        $teacher = User::factory()->create(['role' => UserRole::TEACHER]);

        $question = $this->actingAs($teacher)->getJson("/api/v1/quizzes/{$quiz->id}")->assertOk()->json('quiz.questions.0');

        $this->assertSame('Because the answer is 42.', $question['explanation']);
        $this->assertArrayHasKey('is_correct', $question['options'][0]);
    }

    public function test_a_synced_attempt_shows_on_the_dashboard_straight_away(): void
    {
        [$quiz, $correct] = $this->quizWith(3);
        $this->actingAs($this->learner)->getJson('/api/v1/dashboard/stats')->assertOk(); // warms the cache

        $questionId = array_key_first($correct);
        $this->sync($quiz, [['question_id' => $questionId, 'selected_option_id' => $correct[$questionId]]])->assertOk();

        $recent = $this->actingAs($this->learner)->getJson('/api/v1/dashboard/stats')->assertOk()->json('recentAttempts');
        $this->assertSame(QuizAttempt::firstOrFail()->id, $recent[0]['id'] ?? null);
    }

    public function test_questions_from_other_quizzes_do_not_count_towards_the_set(): void
    {
        [$quiz, $correct] = $this->quizWith(12);
        [, $otherCorrect] = $this->quizWith(1);
        $questionId = array_key_first($correct);
        $foreignId = array_key_first($otherCorrect);

        $this->sync($quiz, [
            ['question_id' => $questionId, 'selected_option_id' => $correct[$questionId]],
            ['question_id' => $foreignId, 'selected_option_id' => $otherCorrect[$foreignId]],
        ])->assertOk();

        $attempt = QuizAttempt::firstOrFail();
        $this->assertSame(2, (int) $attempt->score);
        $this->assertSame(20, (int) $attempt->total_marks);
    }
}
