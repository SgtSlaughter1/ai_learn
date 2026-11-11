<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\AiExplanation;
use App\Models\AiExplanationReport;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * A person checks the AI's explanations: learners report one that looks wrong, several reports
 * take an unchecked one down, and the staff who manage the question approve, correct or hide it.
 */
class AiExplanationReviewTest extends TestCase
{
    use RefreshDatabase;

    private const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

    private User $admin;

    private User $teacher;

    private ClassModel $class;

    private Question $question;

    private QuestionOption $wrong;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.api_key' => 'test-groq-key',
            'services.groq.model' => 'model-a',
            'services.groq.fallback_model' => null,
            'services.groq.base_url' => 'https://api.groq.com/openai/v1',
            'services.gemini.api_key' => null,
            'services.ai.provider' => null,
        ]);
        Cache::flush();

        $this->admin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $school = School::create(['name' => 'School A', 'slug' => 'school-a', 'is_active' => true, 'admin_user_id' => $this->admin->id]);
        $this->class = ClassModel::create(['school_id' => $school->id, 'name' => 'SS1 A', 'slug' => 'ss1-a', 'grade_level' => 'SS1', 'is_active' => true]);
        $subject = Subject::factory()->create(['school_id' => $school->id, 'class_id' => $this->class->id, 'status' => 'active']);
        $topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS1', 'status' => 'active']);

        $this->teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $this->teacher->id, 'school_id' => $school->id]);
        ClassMembership::create(['class_id' => $this->class->id, 'user_id' => $this->teacher->id, 'role' => 'teacher', 'is_active' => true]);

        $this->question = Question::factory()->create(['topic_id' => $topic->id, 'school_id' => $school->id, 'question_text' => 'What is 2 + 2?']);
        QuestionOption::create(['question_id' => $this->question->id, 'option_text' => '4', 'is_correct' => true, 'sort_order' => 0]);
        $this->wrong = QuestionOption::create(['question_id' => $this->question->id, 'option_text' => '5', 'is_correct' => false, 'sort_order' => 1]);
    }

    private function learner(): User
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $this->class->school_id, 'grade_level' => 'SS1']);
        ClassMembership::create(['class_id' => $this->class->id, 'user_id' => $learner->id, 'role' => 'learner', 'is_active' => true]);

        return $learner;
    }

    private static function groqReply(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content], 'finish_reason' => 'stop']]];
    }

    private function explain(User $learner)
    {
        return $this->actingAs($learner)->postJson('/api/v1/ai/explain', ['question_id' => $this->question->id, 'selected_option_id' => $this->wrong->id]);
    }

    public function test_learners_see_the_explanation_is_unchecked_and_three_reports_take_it_down(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5, because maths.'))]);
        $first = $this->learner();

        $response = $this->explain($first)->assertOk();
        $id = $response->json('review.id');
        $this->assertSame([false, true], [$response->json('review.checked'), $response->json('review.can_report')]);

        // Reporting twice counts once.
        $this->actingAs($first)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong', 'note' => 'It is 4'])->assertOk();
        $this->actingAs($first)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertJson(['hidden' => false]);
        $this->actingAs($this->learner())->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'confusing'])->assertJson(['hidden' => false]);
        $this->actingAs($this->learner())->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertJson(['hidden' => true]);
        $this->assertSame([3, AiExplanation::STATUS_HIDDEN], [AiExplanation::find($id)->open_reports, AiExplanation::find($id)->review_status]);

        // Now learners get the offline explanation, with nothing to report, and the AI isn't asked again.
        $after = $this->explain($this->learner())->assertOk();
        $this->assertStringNotContainsString('because maths', $after->json('explanation'));
        $this->assertNull($after->json('review'));
        Http::assertSentCount(1);
    }

    public function test_the_teacher_of_the_class_reviews_and_learners_see_the_correction_as_checked(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5.'))]);
        $id = $this->explain($learner = $this->learner())->json('review.id');
        $this->actingAs($learner)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong', 'note' => 'It is 4'])->assertOk();

        $queue = $this->actingAs($this->teacher)->getJson('/api/v1/admin/ai-explanations')->assertOk();
        $this->assertSame([1, 'What is 2 + 2?', $this->wrong->id, 1, ['It is 4']], [
            $queue->json('count'), $queue->json('data.0.question_text'), $queue->json('data.0.chosen_option_id'), $queue->json('data.0.reasons.wrong'), $queue->json('data.0.notes'),
        ]);

        $this->actingAs($this->teacher)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'correct', 'body' => '5 is wrong: 2 + 2 is **4**.<script>x</script>'])
            ->assertOk()->assertJsonPath('data.review_status', AiExplanation::STATUS_CORRECTED);

        $saved = AiExplanation::find($id);
        $this->assertSame(['5 is wrong: 2 + 2 is **4**.', 0, $this->teacher->id], [$saved->body, $saved->open_reports, $saved->reviewed_by]);
        $this->actingAs($this->teacher)->getJson('/api/v1/admin/ai-explanations')->assertJsonPath('count', 0);

        // The cached copy was replaced: the next learner reads the correction, marked as checked.
        $this->explain($this->learner())->assertJsonPath('explanation', '5 is wrong: 2 + 2 is **4**.')->assertJsonPath('review.checked', true);
        $this->assertSame(1, AiExplanationReport::count(), 'The report stays as history.');
    }

    public function test_a_reviewer_can_ask_the_ai_for_a_fresh_draft_without_saving_it(): void
    {
        Http::fake([self::GROQ => Http::sequence()->push(self::groqReply('First try.'))->push(self::groqReply('A better explanation.'))]);
        $id = $this->explain($this->learner())->json('review.id');

        $this->actingAs($this->admin)->postJson("/api/v1/admin/ai-explanations/{$id}/draft")->assertOk()->assertJsonPath('body', 'A better explanation.');
        $this->assertSame('First try.', AiExplanation::find($id)->body);
    }

    public function test_only_the_staff_who_manage_the_question_can_review_it(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5.'))]);
        $id = $this->explain($learner = $this->learner())->json('review.id');
        $this->actingAs($learner)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertOk();

        $otherAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        School::create(['name' => 'School B', 'slug' => 'school-b', 'is_active' => true, 'admin_user_id' => $otherAdmin->id]);
        $otherTeacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $otherTeacher->id, 'school_id' => $this->class->school_id]);

        foreach ([$otherAdmin, $otherTeacher] as $user) {
            $this->actingAs($user)->getJson('/api/v1/admin/ai-explanations')->assertJsonPath('count', 0);
            $this->actingAs($user)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'approve'])->assertNotFound();
        }
        $this->actingAs($learner)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'approve'])->assertForbidden();
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'approve'])->assertOk();
    }

    public function test_reports_notify_the_managing_staff_once_and_a_review_clears_it_and_tells_the_teacher(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5.'))]);
        $id = $this->explain($this->learner())->json('review.id');
        $otherTeacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $otherTeacher->id, 'school_id' => $this->class->school_id]);

        foreach (range(1, 3) as $i) {
            $this->actingAs($this->learner())->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertOk();
        }

        // One notification each, brought up to date by later reports; none for a teacher of another class.
        foreach ([$this->teacher, $this->admin] as $user) {
            $this->assertSame(1, $user->notifications()->count());
            $summary = $this->actingAs($user)->getJson('/api/v1/notifications/summary')->assertOk();
            $this->assertSame([1, 1, 'An AI explanation was reported'], [$summary->json('unread'), $summary->json('reviews'), $summary->json('latest.title')]);
            $this->assertSame('3 learners reported an AI explanation', $user->notifications()->first()->data['title']);
            $this->assertStringContainsString('hidden from learners', $user->notifications()->first()->data['body']);
        }
        $this->assertSame('/teacher/dashboard?tab=questions', $this->teacher->notifications()->first()->data['url']);
        $this->assertSame(0, $otherTeacher->notifications()->count());

        // The admin corrects it: everyone's alert about it is cleared, and the class teacher is told.
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'correct', 'body' => 'It is 4.'])->assertOk();
        $this->actingAs($this->admin)->getJson('/api/v1/notifications/summary')->assertJson(['unread' => 0, 'reviews' => 0]);
        $teacher = $this->actingAs($this->teacher)->getJson('/api/v1/notifications/summary');
        $this->assertSame([1, 0], [$teacher->json('unread'), $teacher->json('reviews')]);
        $this->assertSame('Your school admin corrected an AI explanation', $this->teacher->unreadNotifications()->first()->data['title']);
    }

    public function test_an_approved_explanation_reported_again_returns_to_the_queue_but_stays_up(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 4.'))]);
        $id = $this->explain($this->learner())->json('review.id');
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'approve'])->assertOk();

        foreach (range(1, 3) as $i) {
            $this->actingAs($this->learner())->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'confusing'])->assertJson(['hidden' => false]);
        }
        $this->assertSame(AiExplanation::STATUS_APPROVED, AiExplanation::find($id)->review_status);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/ai-explanations')->assertJsonPath('count', 1);
    }

    public function test_someone_who_reported_before_a_review_can_report_the_reviewed_version(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5.'))]);
        $id = $this->explain($learner = $this->learner())->json('review.id');
        $this->actingAs($learner)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertOk();
        $this->travel(1)->minutes();
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'correct', 'body' => 'Still unclear.'])->assertOk();
        $this->travel(1)->minutes();

        $this->actingAs($learner)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'confusing', 'note' => 'Still confusing'])->assertOk();
        $this->assertSame(1, AiExplanation::find($id)->open_reports);
        $this->actingAs($this->admin)->getJson('/api/v1/admin/ai-explanations')->assertJsonPath('data.0.notes', ['Still confusing']);
        $this->assertSame(1, AiExplanationReport::count(), 'One row per person, updated.');
    }

    public function test_an_explanation_for_an_edited_question_leaves_the_queue(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 5.'))]);
        $id = $this->explain($learner = $this->learner())->json('review.id');
        $this->actingAs($learner)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertOk();

        $this->travel(1)->minutes();
        $this->question->update(['question_text' => 'What is 2 + 2, exactly?']);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/ai-explanations')->assertJsonPath('count', 0);
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/ai-explanations/{$id}", ['action' => 'approve'])->assertStatus(409);
    }

    public function test_a_learner_cannot_report_an_explanation_for_a_question_they_cannot_see(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('2 + 2 is 4.'))]);
        $id = $this->explain($this->learner())->json('review.id');

        $outsider = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($outsider)->postJson("/api/v1/ai/explanations/{$id}/report", ['reason' => 'wrong'])->assertNotFound();
        $this->assertSame(0, AiExplanationReport::count());
    }
}
