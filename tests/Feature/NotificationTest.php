<?php

namespace Tests\Feature;

use App\Enums\UserRole;
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
use App\Notifications\AppNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The bell: who is told what, the counts, and marking notifications read. */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;

    private User $learner;

    private Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();
        $admin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $school = School::create(['name' => 'School A', 'slug' => 'school-a', 'is_active' => true, 'admin_user_id' => $admin->id]);
        $class = ClassModel::create(['school_id' => $school->id, 'name' => 'SS1 A', 'slug' => 'ss1-a', 'grade_level' => 'SS1', 'is_active' => true]);
        $subject = Subject::factory()->create(['school_id' => $school->id, 'class_id' => $class->id, 'status' => 'active']);
        $this->topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS1', 'status' => 'active', 'name' => 'Fractions']);

        $this->teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        TeacherProfile::create(['user_id' => $this->teacher->id, 'school_id' => $school->id]);
        ClassMembership::create(['class_id' => $class->id, 'user_id' => $this->teacher->id, 'role' => 'teacher', 'is_active' => true]);

        $this->learner = User::factory()->create(['role' => UserRole::LEARNER, 'name' => 'Ada Obi']);
        LearnerProfile::create(['user_id' => $this->learner->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
        ClassMembership::create(['class_id' => $class->id, 'user_id' => $this->learner->id, 'role' => 'learner', 'is_active' => true]);

        foreach (range(1, 3) as $i) {
            $q = Question::factory()->create(['topic_id' => $this->topic->id, 'school_id' => $school->id, 'status' => 'active']);
            QuestionOption::create(['question_id' => $q->id, 'option_text' => 'A', 'is_correct' => true, 'sort_order' => 0]);
        }
    }

    public function test_a_learner_is_told_when_their_teacher_sends_practice_without_their_name_in_the_pop_up(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/v1/teacher/interventions/assign', [
            'learner_id' => $this->learner->id, 'topic_id' => $this->topic->id, 'question_count' => 3,
        ])->assertOk();

        $list = $this->actingAs($this->learner)->getJson('/api/v1/notifications')->assertOk();
        $this->assertSame([1, 0, AppNotification::KIND_PRACTICE_ASSIGNED, 'Your teacher sent you practice'], [
            $list->json('unread'), $list->json('reviews'), $list->json('data.0.kind'), $list->json('data.0.title'),
        ]);
        $this->assertStringContainsString('3 questions in Fractions', $list->json('data.0.body'));
        $this->assertSame('/dashboard#daily-review', $list->json('data.0.url'));
        $popUp = $list->json('latest.title').' '.$list->json('latest.body');
        $this->assertStringNotContainsString('Ada', $popUp);
        $this->assertStringNotContainsString('Fractions', $popUp);
    }

    public function test_people_read_only_their_own_notifications(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/v1/teacher/interventions/assign', ['learner_id' => $this->learner->id, 'topic_id' => $this->topic->id])->assertOk();
        $id = $this->learner->notifications()->value('id');

        // Someone else can't see or mark it.
        $this->actingAs($this->teacher)->getJson('/api/v1/notifications')->assertJsonCount(0, 'data');
        $this->actingAs($this->teacher)->postJson('/api/v1/notifications/read', ['ids' => [$id]])->assertOk();
        $this->assertSame(1, $this->learner->unreadNotifications()->count());

        $this->actingAs($this->learner)->postJson('/api/v1/notifications/read', ['ids' => [$id]])->assertJson(['unread' => 0]);
        $this->actingAs($this->learner)->getJson('/api/v1/notifications')->assertJsonPath('data.0.read', true);
    }

    public function test_every_page_brings_the_unread_count(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/v1/teacher/interventions/assign', ['learner_id' => $this->learner->id, 'topic_id' => $this->topic->id])->assertOk();

        $this->actingAs($this->learner)->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('notifications.unread', 1)->where('notifications.latest.title', 'New practice from your teacher'));
    }
}
