<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\SchoolExam;
use App\Models\SchoolExamAttempt;
use App\Models\SpacedRepetitionItem;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use App\Services\SchoolExams\SchoolExamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * School CBT: teachers set exams for their classes, learners sit them with the invigilator's
 * start code, and only the server marks. Corrections stay hidden until results are released.
 */
class SchoolExamTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private ClassModel $class;

    private Topic $topic;

    private User $teacher;

    private User $learner;

    /** @var array<int, array{question: Question, correct: int, wrong: int}> */
    private array $questions = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::create(['name' => 'CBT School', 'slug' => 'cbt-school', 'is_active' => true]);
        $this->class = $this->makeClass($this->school, 'ss2-a');
        $subject = Subject::factory()->create(['school_id' => $this->school->id, 'class_id' => $this->class->id, 'slug' => 'maths-cbt']);
        $this->topic = Topic::factory()->create(['subject_id' => $subject->id, 'name' => 'Algebra', 'level' => 'SS2']);

        $this->teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $this->teacher->id, 'school_id' => $this->school->id]);
        ClassMembership::create(['class_id' => $this->class->id, 'user_id' => $this->teacher->id, 'role' => 'teacher', 'is_active' => true]);

        $this->learner = $this->makeLearner($this->school, $this->class);

        for ($i = 0; $i < 3; $i++) {
            $this->questions[] = $this->makeQuestion($this->school, $this->topic);
        }
    }

    private function makeClass(School $school, string $slug): ClassModel
    {
        return ClassModel::create(['school_id' => $school->id, 'name' => strtoupper($slug), 'slug' => $slug, 'grade_level' => 'SS2', 'is_active' => true]);
    }

    private function makeLearner(School $school, ClassModel $class): User
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $school->id, 'grade_level' => 'SS2']);
        ClassMembership::create(['class_id' => $class->id, 'user_id' => $learner->id, 'role' => 'learner', 'is_active' => true]);

        return $learner;
    }

    /** @return array{question: Question, correct: int, wrong: int} */
    private function makeQuestion(School $school, Topic $topic): array
    {
        $question = Question::factory()->create(['school_id' => $school->id, 'topic_id' => $topic->id, 'marks' => 1]);
        $correct = QuestionOption::create(['question_id' => $question->id, 'option_text' => 'Right', 'is_correct' => true, 'sort_order' => 0]);
        $wrong = QuestionOption::create(['question_id' => $question->id, 'option_text' => 'Wrong', 'is_correct' => false, 'sort_order' => 1]);

        return ['question' => $question, 'correct' => $correct->id, 'wrong' => $wrong->id];
    }

    private function examPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'SS2 Maths CA 1',
            'duration_minutes' => 30,
            'opens_at' => now()->subMinutes(5)->toIso8601String(),
            'closes_at' => now()->addHours(2)->toIso8601String(),
            'pass_mark' => 50,
            'class_ids' => [$this->class->id],
            'questions' => collect($this->questions)->map(fn ($q) => ['id' => $q['question']->id])->all(),
        ], $overrides);
    }

    private function publishedExam(array $overrides = []): SchoolExam
    {
        $id = $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload($overrides))->assertCreated()->json('id');
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$id}/publish")->assertOk();

        return SchoolExam::findOrFail($id);
    }

    private function startAs(User $learner, SchoolExam $exam)
    {
        return $this->actingAs($learner)->postJson("/api/v1/exams/{$exam->id}/start", ['access_code' => $exam->access_code]);
    }

    public function test_a_teacher_sets_an_exam_for_their_own_class_from_their_school_bank(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload())
            ->assertCreated();

        $exam = SchoolExam::firstOrFail();
        $this->assertSame(SchoolExam::STATUS_DRAFT, $exam->status);
        $this->assertSame(3, $exam->question_count);
        $this->assertSame(3, $exam->total_marks);
        $this->assertSame($this->teacher->id, $exam->created_by);
    }

    public function test_times_sent_in_utc_are_stored_in_the_school_time_zone(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload([
            'opens_at' => '2026-11-02T07:00:00.000Z',
            'closes_at' => '2026-11-02T09:00:00.000Z',
        ]))->assertCreated();

        $exam = SchoolExam::firstOrFail();
        $this->assertSame('2026-11-02T07:00:00+00:00', $exam->opens_at->copy()->utc()->toIso8601String());
    }

    public function test_a_random_draw_skips_questions_already_on_the_exam(): void
    {
        $taken = $this->questions[0]['question']->id;

        $ids = $this->actingAs($this->teacher)->getJson("/api/v1/school-exams/question-bank?random=10&exclude={$taken}")
            ->assertOk()->json('data.*.id');

        $this->assertCount(2, $ids);
        $this->assertNotContains($taken, $ids);
    }

    public function test_a_teacher_cannot_use_another_schools_class_or_questions(): void
    {
        $other = School::create(['name' => 'Other', 'slug' => 'other', 'is_active' => true]);
        $otherClass = $this->makeClass($other, 'other-ss2');
        $otherSubject = Subject::factory()->create(['school_id' => $other->id, 'class_id' => $otherClass->id, 'slug' => 'other-maths']);
        $otherQuestion = $this->makeQuestion($other, Topic::factory()->create(['subject_id' => $otherSubject->id, 'level' => 'SS2']));

        $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload(['class_ids' => [$otherClass->id]]))
            ->assertUnprocessable()->assertJsonValidationErrors('class_ids');

        $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload(['questions' => [['id' => $otherQuestion['question']->id]]]))
            ->assertUnprocessable()->assertJsonValidationErrors('questions');

        $this->assertSame(0, SchoolExam::count());
    }

    public function test_learners_see_an_exam_only_once_published_and_only_in_their_class(): void
    {
        $id = $this->actingAs($this->teacher)->postJson('/api/v1/school-exams', $this->examPayload())->json('id');
        $exam = SchoolExam::findOrFail($id);

        $this->actingAs($this->learner)->get("/exams/{$id}/take")->assertForbidden();

        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$id}/publish")->assertOk()->assertJsonStructure(['access_code']);
        $this->actingAs($this->learner)->get("/exams/{$id}/take")->assertOk();

        $outsider = $this->makeLearner($this->school, $this->makeClass($this->school, 'ss2-b'));
        $this->startAs($outsider, $exam->fresh())->assertForbidden();
    }

    public function test_starting_needs_the_right_code_and_an_open_exam(): void
    {
        $exam = $this->publishedExam();

        $this->actingAs($this->learner)->postJson("/api/v1/exams/{$exam->id}/start", ['access_code' => 'WRONG1'])
            ->assertUnprocessable();
        $this->assertSame(0, SchoolExamAttempt::count());

        $later = $this->publishedExam(['title' => 'Later', 'opens_at' => now()->addDay()->toIso8601String(), 'closes_at' => now()->addDays(2)->toIso8601String()]);
        $this->startAs($this->learner, $later)->assertUnprocessable();

        // Lower case and spaces are forgiven; starting twice gives the same attempt.
        $this->actingAs($this->learner)->postJson("/api/v1/exams/{$exam->id}/start", ['access_code' => ' '.strtolower($exam->access_code).' '])->assertOk();
        $this->startAs($this->learner, $exam)->assertOk();
        $this->assertSame(1, SchoolExamAttempt::where('school_exam_id', $exam->id)->count());
    }

    public function test_the_paper_never_carries_the_answers(): void
    {
        $exam = $this->publishedExam();
        $response = $this->startAs($this->learner, $exam)->assertOk();

        $this->assertCount(3, $response->json('questions'));
        $this->assertStringNotContainsString('is_correct', $response->getContent());
        $this->assertStringNotContainsString('explanation', $response->getContent());
        $this->assertGreaterThan(0, $response->json('seconds_left'));
    }

    public function test_answers_save_on_the_attempt_start_returns(): void
    {
        // start() hands back the just-created model, which lacks the column defaults the database fills in.
        $exams = app(SchoolExamService::class);
        $attempt = $exams->start($this->publishedExam(), $this->learner);
        $examQuestionId = $attempt->paper['q'][0];

        $exams->saveAnswers($attempt, [$examQuestionId => $attempt->paper['o'][(string) $examQuestionId][0]], 0);

        $this->assertSame(1, $attempt->fresh()->answered_count);
    }

    public function test_the_score_and_topics_count_marks_not_questions(): void
    {
        // The first question is worth 5; the other two are worth 1 each.
        $exam = $this->publishedExam(['questions' => collect($this->questions)->map(fn ($q, $i) => ['id' => $q['question']->id, 'marks' => $i === 0 ? 5 : 1])->all()]);
        $this->assertSame(7, $exam->total_marks);
        $paper = $this->startAs($this->learner, $exam)->json('questions');
        $byQuestion = collect($this->questions)->keyBy(fn ($q) => $q['question']->question_text);

        // Only the 5-mark question right: 1 of 3 questions, but 5 of 7 marks.
        $heavy = $this->questions[0]['question']->question_text;
        $answers = collect($paper)->mapWithKeys(fn ($item) => [
            $item['id'] => $item['question_text'] === $heavy ? $byQuestion[$heavy]['correct'] : $byQuestion[$item['question_text']]['wrong'],
        ])->all();
        $this->actingAs($this->learner)->postJson("/api/v1/exams/{$exam->id}/submit", ['answers' => $answers])->assertOk();

        $attempt = SchoolExamAttempt::firstOrFail();
        $this->assertSame(5, $attempt->score);
        $this->assertSame(7, $attempt->max_score);
        $this->assertEquals(71.43, $attempt->percentage);
        $this->assertSame(5, collect($attempt->topic_breakdown)->sum('marks'));
        $this->assertSame(7, collect($attempt->topic_breakdown)->sum('max_marks'));

        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$exam->id}/close")->assertOk();
        $this->actingAs($this->teacher)->getJson("/api/v1/school-exams/{$exam->id}/results")
            ->assertOk()->assertJsonPath('topics.0.marks', 5)->assertJsonPath('topics.0.max_marks', 7)->assertJsonPath('topics.0.accuracy', 71);
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$exam->id}/release")->assertOk();
        $this->actingAs($this->learner)->get("/exams/{$exam->id}/result")
            ->assertInertia(fn ($page) => $page->where('attempt.correct_count', 1));
    }

    public function test_answers_are_saved_marked_on_submit_and_corrections_wait_for_release(): void
    {
        $exam = $this->publishedExam();
        $paper = $this->startAs($this->learner, $exam)->json('questions');
        $byQuestion = collect($this->questions)->keyBy(fn ($q) => $q['question']->question_text);

        // Two right, one wrong, plus an option from another question that must be ignored.
        $answers = [];
        foreach ($paper as $i => $item) {
            $q = $byQuestion[$item['question_text']];
            $answers[$item['id']] = $i < 2 ? $q['correct'] : $q['wrong'];
        }
        $this->actingAs($this->learner)->putJson("/api/v1/exams/{$exam->id}/answers", ['answers' => $answers + [999999 => 1], 'left_screen_count' => 2])
            ->assertOk();
        $attempt = SchoolExamAttempt::firstOrFail();
        $this->assertSame(3, $attempt->answered_count);
        $this->assertSame(2, $attempt->left_screen_count);

        $this->actingAs($this->learner)->postJson("/api/v1/exams/{$exam->id}/submit", ['answers' => $answers])
            ->assertOk()->assertJsonPath('redirect', "/exams/{$exam->id}/result");

        $attempt->refresh();
        $this->assertSame(SchoolExamAttempt::STATUS_SUBMITTED, $attempt->status);
        $this->assertSame(2, $attempt->score);
        $this->assertSame(3, $attempt->max_score);

        // No score or corrections yet: the teacher hasn't released results.
        $this->actingAs($this->learner)->get("/exams/{$exam->id}/result")
            ->assertInertia(fn ($page) => $page->component('Exams/Result')->where('attempt.score', null)->where('review', null));

        // Too early to release while the exam is still open.
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$exam->id}/release")->assertUnprocessable();
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$exam->id}/close")->assertOk();
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exams/{$exam->id}/release")->assertOk();

        $this->actingAs($this->learner)->get("/exams/{$exam->id}/result")
            ->assertInertia(fn ($page) => $page->where('attempt.score', 2)->has('review.questions', 3));

        // The missed question joined the learner's daily review.
        $this->assertSame(1, SpacedRepetitionItem::where('user_id', $this->learner->id)->count());
    }

    public function test_answers_after_the_deadline_are_refused_and_the_attempt_is_closed(): void
    {
        $exam = $this->publishedExam(['duration_minutes' => 5]);
        $this->startAs($this->learner, $exam)->assertOk();

        $this->travel(6)->minutes();

        $this->actingAs($this->learner)->putJson("/api/v1/exams/{$exam->id}/answers", ['answers' => []])
            ->assertStatus(409);
        $this->assertSame(SchoolExamAttempt::STATUS_AUTO_SUBMITTED, SchoolExamAttempt::firstOrFail()->status);
    }

    public function test_the_invigilator_sees_the_room_and_can_add_time_or_end_an_attempt(): void
    {
        $exam = $this->publishedExam();
        $notStarted = $this->makeLearner($this->school, $this->class);
        $this->startAs($this->learner, $exam)->assertOk();
        $attempt = SchoolExamAttempt::firstOrFail();

        $room = $this->actingAs($this->teacher)->getJson("/api/v1/school-exams/{$exam->id}/monitor")->assertOk();
        $this->assertCount(2, $room->json('learners'));
        $this->assertSame('in_progress', collect($room->json('learners'))->firstWhere('user_id', $this->learner->id)['status']);
        $this->assertNull(collect($room->json('learners'))->firstWhere('user_id', $notStarted->id)['status']);

        $deadline = $attempt->deadline_at;
        $this->actingAs($this->teacher)->postJson("/api/v1/school-exam-attempts/{$attempt->id}/extend", ['minutes' => 10])->assertOk();
        $this->assertTrue($attempt->fresh()->deadline_at->equalTo($deadline->copy()->addMinutes(10)));

        $this->actingAs($this->teacher)->postJson("/api/v1/school-exam-attempts/{$attempt->id}/end")->assertOk();
        $this->assertSame(SchoolExamAttempt::STATUS_ENDED, $attempt->fresh()->status);
        $this->assertNotNull($attempt->fresh()->score);
    }

    public function test_once_learners_have_started_the_paper_is_fixed(): void
    {
        $exam = $this->publishedExam();
        $this->startAs($this->learner, $exam)->assertOk();

        $this->actingAs($this->teacher)->patchJson("/api/v1/school-exams/{$exam->id}", $this->examPayload([
            'title' => 'Renamed', 'duration_minutes' => 90, 'questions' => [['id' => $this->questions[0]['question']->id]],
        ]))->assertOk();

        $exam->refresh();
        $this->assertSame('Renamed', $exam->title);
        $this->assertSame(30, $exam->duration_minutes);
        $this->assertSame(3, $exam->question_count);

        $this->actingAs($this->teacher)->deleteJson("/api/v1/school-exams/{$exam->id}")->assertUnprocessable();
    }

    public function test_staff_of_another_school_cannot_see_or_run_the_exam(): void
    {
        $exam = $this->publishedExam();
        $other = School::create(['name' => 'Other', 'slug' => 'other-2', 'is_active' => true]);
        $outsider = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $outsider->id, 'school_id' => $other->id]);

        $this->actingAs($outsider)->getJson("/api/v1/school-exams/{$exam->id}/monitor")->assertForbidden();
        $this->actingAs($outsider)->postJson("/api/v1/school-exams/{$exam->id}/close")->assertForbidden();
        $this->actingAs($outsider)->get('/school-exams')
            ->assertInertia(fn ($page) => $page->component('SchoolExams/Index')->has('exams.data', 0));
    }

    public function test_a_school_can_switch_cbt_off(): void
    {
        $exam = $this->publishedExam();
        $this->school->update(['cbt_enabled' => false]);

        // Fresh models: each real request loads the user (and their school) anew.
        $this->startAs($this->learner->fresh(), $exam)->assertForbidden();
        $this->actingAs($this->teacher->fresh())->postJson('/api/v1/school-exams', $this->examPayload())->assertForbidden();
    }
}
