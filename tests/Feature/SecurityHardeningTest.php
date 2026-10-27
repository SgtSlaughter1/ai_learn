<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use App\Support\ListSize;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regression tests for the "Fix first" findings of the October 2026 backend review:
 * one school (or a guest) must never reach another school's questions, quizzes or people.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, mixed> */
    private array $f = [];

    protected function setUp(): void
    {
        parent::setUp();

        $user = fn (UserRole $role) => User::factory()->create(['role' => $role]);
        $this->f['platform'] = $user(UserRole::PLATFORM_ADMIN);
        $this->f['adminA'] = $user(UserRole::SCHOOL_ADMIN);
        $this->f['adminB'] = $user(UserRole::SCHOOL_ADMIN);

        foreach (['A' => 'adminA', 'B' => 'adminB'] as $s => $admin) {
            $school = School::create(['name' => "School {$s}", 'slug' => "school-{$s}", 'is_active' => true, 'admin_user_id' => $this->f[$admin]->id]);
            $class = ClassModel::create(['school_id' => $school->id, 'name' => "SS1 {$s}", 'slug' => "ss1-{$s}", 'grade_level' => 'SS1', 'is_active' => true]);
            $learner = $user(UserRole::LEARNER);
            LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
            ClassMembership::create(['class_id' => $class->id, 'user_id' => $learner->id, 'role' => 'learner', 'is_active' => true]);

            $subject = Subject::factory()->create(['school_id' => $school->id, 'class_id' => $class->id, 'slug' => "maths-{$s}", 'status' => 'active']);
            $topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS1', 'status' => 'active']);
            $quiz = Quiz::factory()->create(['school_id' => $school->id, 'status' => 'active']);

            $questions = [];
            for ($i = 0; $i < 3; $i++) {
                $question = Question::factory()->create(['topic_id' => $topic->id, 'school_id' => $school->id, 'status' => 'active', 'difficulty' => 'medium']);
                QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
                QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);
                $quiz->questions()->attach($question->id, ['sort_order' => $i, 'marks' => 1]);
                $questions[] = $question;
            }

            $this->f["school{$s}"] = $school;
            $this->f["class{$s}"] = $class;
            $this->f["learner{$s}"] = $learner;
            $this->f["topic{$s}"] = $topic;
            $this->f["quiz{$s}"] = $quiz;
            $this->f["questions{$s}"] = $questions;
        }
    }

    // S1: practice questions and explanations

    public function test_guests_cannot_reach_the_question_endpoints(): void
    {
        $this->getJson('/api/v1/questions/similar?topic_id='.$this->f['topicB']->id)->assertUnauthorized();
        $this->postJson('/api/v1/questions/explain', ['question_id' => $this->f['questionsB'][0]->id])->assertUnauthorized();
    }

    public function test_similar_question_never_returns_another_schools_question(): void
    {
        $response = $this->actingAs($this->f['learnerA'])
            ->getJson('/api/v1/questions/similar?topic_id='.$this->f['topicB']->id)
            ->assertOk();

        $this->assertNotContains($response->json('question.id'), collect($this->f['questionsB'])->pluck('id')->all());
    }

    public function test_similar_question_accepts_a_comma_separated_exclude_list(): void
    {
        [$q1, $q2, $q3] = $this->f['questionsA'];

        $this->actingAs($this->f['learnerA'])
            ->getJson("/api/v1/questions/similar?topic_id={$this->f['topicA']->id}&exclude_ids={$q1->id},{$q2->id}")
            ->assertOk()
            ->assertJsonPath('question.id', $q3->id);
    }

    public function test_explain_refuses_another_schools_question(): void
    {
        $this->actingAs($this->f['learnerA'])
            ->postJson('/api/v1/questions/explain', ['question_id' => $this->f['questionsB'][0]->id])
            ->assertNotFound();
    }

    // S2: quizzes

    public function test_a_learner_cannot_open_or_submit_another_schools_quiz(): void
    {
        $quizB = $this->f['quizB'];

        $this->actingAs($this->f['learnerA'])->getJson("/api/v1/quizzes/{$quizB->id}")->assertForbidden();
        $this->actingAs($this->f['learnerA'])
            ->postJson('/api/v1/quizzes/attempts/'.Str::uuid().'/sync', [
                'quiz_id' => $quizB->id,
                'answers' => [['question_id' => $this->f['questionsB'][0]->id, 'selected_option_id' => null]],
            ])
            ->assertForbidden();
    }

    public function test_a_learner_can_still_open_their_own_schools_quiz(): void
    {
        $this->actingAs($this->f['learnerA'])->getJson("/api/v1/quizzes/{$this->f['quizA']->id}")->assertOk();
    }

    public function test_an_attempt_taken_offline_still_syncs_after_the_quiz_is_deactivated(): void
    {
        $quizA = $this->f['quizA'];
        $quizA->update(['status' => 'inactive']);

        $this->actingAs($this->f['learnerA'])
            ->postJson('/api/v1/quizzes/attempts/'.Str::uuid().'/sync', [
                'quiz_id' => $quizA->id,
                'answers' => collect($this->f['questionsA'])->map(fn ($q) => ['question_id' => $q->id, 'selected_option_id' => null])->all(),
            ])
            ->assertOk();
    }

    // S3: flashcards

    public function test_the_flashcard_deck_only_holds_questions_the_learner_may_see(): void
    {
        $deck = $this->actingAs($this->f['learnerA'])->getJson('/api/v1/flashcards/deck')->assertOk()->json('deck');

        $this->assertNotEmpty($deck);
        $this->assertEmpty(array_intersect(array_column($deck, 'id'), collect($this->f['questionsB'])->pluck('id')->all()));
    }

    // S5: deleting a school

    public function test_a_school_with_content_cannot_be_deleted(): void
    {
        $this->actingAs($this->f['platform'])
            ->deleteJson("/api/v1/admin/schools/{$this->f['schoolB']->id}")
            ->assertUnprocessable()
            ->assertJsonPath('in_use.classes', 1);

        $this->assertSame($this->f['schoolB']->id, Subject::where('slug', 'maths-B')->value('school_id'));
    }

    public function test_an_empty_school_can_be_deleted(): void
    {
        $empty = School::create(['name' => 'Empty', 'slug' => 'empty', 'is_active' => true]);

        $this->actingAs($this->f['platform'])->deleteJson("/api/v1/admin/schools/{$empty->id}")->assertOk();
        $this->assertNull(School::find($empty->id));
    }

    // S6: adaptive quiz

    public function test_adaptive_answers_must_belong_to_the_quiz_and_count_once(): void
    {
        $learner = $this->f['learnerA'];
        $quizA = $this->f['quizA'];

        $start = $this->actingAs($learner)->postJson("/api/v1/quizzes/{$quizA->id}/adaptive/start")->assertOk();
        $stateId = $start->json('state_id');
        $served = $start->json('question.id');

        // Another school's question: no answer key comes back.
        $this->actingAs($learner)->postJson("/api/v1/quizzes/{$quizA->id}/adaptive/answer", [
            'state_id' => $stateId, 'question_id' => $this->f['questionsB'][0]->id, 'selected_option_id' => null,
        ])->assertUnprocessable()->assertJsonMissingPath('correct_option_id');

        $this->actingAs($learner)->postJson("/api/v1/quizzes/{$quizA->id}/adaptive/answer", [
            'state_id' => $stateId, 'question_id' => $served, 'selected_option_id' => null,
        ])->assertOk();

        // The same question again can't pad the score.
        $this->actingAs($learner)->postJson("/api/v1/quizzes/{$quizA->id}/adaptive/answer", [
            'state_id' => $stateId, 'question_id' => $served, 'selected_option_id' => null,
        ])->assertUnprocessable();
    }

    // Public homepage

    public function test_the_homepage_lists_only_shared_subjects(): void
    {
        Subject::factory()->create(['school_id' => null, 'class_id' => null, 'slug' => 'shared-physics', 'name' => 'Shared Physics', 'status' => 'active']);

        $this->get('/')->assertOk()->assertSee('Shared Physics')->assertDontSee('maths-A')->assertDontSee('maths-B');
        $this->getJson('/api/stats')->assertOk()->assertJsonStructure(['total_subjects', 'total_past_questions', 'exam_counts']);
    }

    // S9: list sizes

    public function test_list_sizes_are_clamped(): void
    {
        $this->assertSame(1, ListSize::from('-1', 20, 20)); // never "no limit"
        $this->assertSame(1, ListSize::from('0', 50, 100));
        $this->assertSame(100, ListSize::from('1000000', 50, 100));
        $this->assertSame(50, ListSize::from('abc', 50, 100));
        $this->assertSame(50, ListSize::from(null, 50, 100));

        $this->actingAs($this->f['platform'])->getJson('/api/v1/admin/learners?per_page=-1')->assertOk();
        $this->actingAs($this->f['platform'])->getJson('/api/v1/admin/learners?per_page=abc')->assertOk();
    }

    // S11: question images

    public function test_svg_uploads_are_refused_and_names_use_the_real_type(): void
    {
        Storage::fake('public');
        $admin = $this->f['platform'];

        $svg = UploadedFile::fake()->createWithContent('diagram.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->actingAs($admin)->post('/api/v1/admin/questions/upload-image', ['image' => $svg], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        // A real PNG renamed to .html is refused (extension must match the contents)...
        $disguised = UploadedFile::fake()->image('page.html');
        $this->actingAs($admin)->post('/api/v1/admin/questions/upload-image', ['image' => $disguised], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        // ...and stored files are named by their detected type.
        $png = UploadedFile::fake()->image('diagram.png');
        $path = $this->actingAs($admin)->post('/api/v1/admin/questions/upload-image', ['image' => $png], ['Accept' => 'application/json'])
            ->assertOk()->json('path');
        $this->assertStringEndsWith('.png', $path);
    }

    // S12: teacher moved to another school

    public function test_a_moved_teacher_leaves_the_old_schools_classes(): void
    {
        $teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $teacher->id, 'school_id' => $this->f['schoolA']->id]);
        ClassMembership::create(['class_id' => $this->f['classA']->id, 'user_id' => $teacher->id, 'role' => 'teacher', 'is_active' => true]);

        $this->actingAs($this->f['platform'])->patchJson("/api/v1/admin/teachers/{$teacher->id}", [
            'name' => $teacher->name, 'email' => $teacher->email, 'school_id' => $this->f['schoolB']->id,
        ])->assertOk();

        $this->assertFalse(ClassMembership::where('user_id', $teacher->id)->where('class_id', $this->f['classA']->id)->exists());
        $this->actingAs($this->f['adminA'])->patchJson("/api/v1/admin/teachers/{$teacher->id}", [
            'name' => 'Taken over', 'email' => $teacher->email, 'password' => 'new-password-123', 'password_confirmation' => 'new-password-123',
        ])->assertForbidden();
    }
}
