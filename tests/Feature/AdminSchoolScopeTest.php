<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\Feedback;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * School admins may only manage learners and classes of their own school;
 * platform admins may manage any. The feedback inbox is platform-admin only.
 */
class AdminSchoolScopeTest extends TestCase
{
    use RefreshDatabase;

    protected User $platformAdmin;

    protected User $schoolAdmin;

    protected User $ownLearner;

    protected User $otherLearner;

    protected ClassModel $ownClass;

    protected ClassModel $otherClass;

    protected function setUp(): void
    {
        parent::setUp();

        $this->platformAdmin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $this->schoolAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);

        $ownSchool = School::create(['name' => 'Own School', 'slug' => 'own-school', 'is_active' => true, 'admin_user_id' => $this->schoolAdmin->id]);
        $otherSchool = School::create(['name' => 'Other School', 'slug' => 'other-school', 'is_active' => true]);

        $this->ownClass = ClassModel::create(['school_id' => $ownSchool->id, 'name' => 'SS1 Own', 'slug' => 'ss1-own', 'grade_level' => 'SS1', 'is_active' => true]);
        $this->otherClass = ClassModel::create(['school_id' => $otherSchool->id, 'name' => 'SS1 Other', 'slug' => 'ss1-other', 'grade_level' => 'SS1', 'is_active' => true]);

        $this->ownLearner = $this->learnerAt($ownSchool);
        $this->otherLearner = $this->learnerAt($otherSchool);
    }

    private function learnerAt(?School $school): User
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        if ($school) {
            LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $school->id]);
        }

        return $learner;
    }

    private function learnerPayload(User $learner): array
    {
        return ['name' => 'Renamed Learner', 'email' => $learner->email];
    }

    // ── Learners ──

    public function test_school_admin_cannot_update_or_delete_another_schools_learner(): void
    {
        $this->actingAs($this->schoolAdmin)
            ->putJson("/api/v1/admin/learners/{$this->otherLearner->id}", $this->learnerPayload($this->otherLearner))
            ->assertForbidden();

        $this->actingAs($this->schoolAdmin)
            ->deleteJson("/api/v1/admin/learners/{$this->otherLearner->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $this->otherLearner->id, 'deleted_at' => null]);
    }

    public function test_school_admin_can_manage_own_learner(): void
    {
        $this->actingAs($this->schoolAdmin)
            ->putJson("/api/v1/admin/learners/{$this->ownLearner->id}", $this->learnerPayload($this->ownLearner))
            ->assertOk();

        $this->actingAs($this->schoolAdmin)
            ->deleteJson("/api/v1/admin/learners/{$this->ownLearner->id}")
            ->assertOk();
    }

    public function test_platform_admin_can_manage_any_learner(): void
    {
        $this->actingAs($this->platformAdmin)
            ->putJson("/api/v1/admin/learners/{$this->otherLearner->id}", $this->learnerPayload($this->otherLearner))
            ->assertOk();

        $this->actingAs($this->platformAdmin)
            ->deleteJson("/api/v1/admin/learners/{$this->otherLearner->id}")
            ->assertOk();
    }

    // ── Classes ──

    public function test_school_admin_cannot_touch_another_schools_class(): void
    {
        $this->actingAs($this->schoolAdmin)
            ->getJson("/api/v1/admin/classes/{$this->otherClass->id}/learners")
            ->assertForbidden();

        $this->actingAs($this->schoolAdmin)
            ->putJson("/api/v1/admin/classes/{$this->otherClass->id}", ['name' => 'Taken over', 'grade_level' => 'SS1'])
            ->assertForbidden();

        $this->actingAs($this->schoolAdmin)
            ->postJson("/api/v1/admin/classes/{$this->otherClass->id}/enroll", ['email' => $this->ownLearner->email])
            ->assertForbidden();

        $this->actingAs($this->schoolAdmin)
            ->deleteJson("/api/v1/admin/classes/{$this->otherClass->id}/learners/{$this->otherLearner->id}")
            ->assertForbidden();

        $this->actingAs($this->schoolAdmin)
            ->deleteJson("/api/v1/admin/classes/{$this->otherClass->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('classes', ['id' => $this->otherClass->id, 'name' => 'SS1 Other']);
    }

    public function test_school_admin_cannot_move_own_class_to_another_school(): void
    {
        $otherSchoolId = $this->otherClass->school_id;

        $this->actingAs($this->schoolAdmin)
            ->putJson("/api/v1/admin/classes/{$this->ownClass->id}", ['name' => 'SS1 Own', 'grade_level' => 'SS1', 'school_id' => $otherSchoolId])
            ->assertOk();

        $this->assertNotEquals($otherSchoolId, $this->ownClass->fresh()->school_id);
    }

    public function test_enrolment_into_own_class_is_limited_to_own_or_unaffiliated_learners(): void
    {
        // A learner of another school can't be pulled in…
        $this->actingAs($this->schoolAdmin)
            ->postJson("/api/v1/admin/classes/{$this->ownClass->id}/enroll", ['email' => $this->otherLearner->email])
            ->assertForbidden();

        // …but the school's own learners and self-registered learners without a school can.
        $selfRegistered = $this->learnerAt(null);
        foreach ([$this->ownLearner, $selfRegistered] as $learner) {
            $this->actingAs($this->schoolAdmin)
                ->postJson("/api/v1/admin/classes/{$this->ownClass->id}/enroll", ['email' => $learner->email])
                ->assertOk();
        }

        $this->assertSame(2, ClassMembership::where('class_id', $this->ownClass->id)->count());
    }

    public function test_platform_admin_can_manage_any_class(): void
    {
        $this->actingAs($this->platformAdmin)
            ->getJson("/api/v1/admin/classes/{$this->otherClass->id}/learners")
            ->assertOk();

        $this->actingAs($this->platformAdmin)
            ->postJson("/api/v1/admin/classes/{$this->otherClass->id}/enroll", ['email' => $this->otherLearner->email])
            ->assertOk();

        $this->actingAs($this->platformAdmin)
            ->deleteJson("/api/v1/admin/classes/{$this->otherClass->id}")
            ->assertOk();
    }

    // ── Feedback inbox ──

    public function test_feedback_inbox_is_platform_admin_only(): void
    {
        $feedback = Feedback::create(['message' => 'Private message', 'email' => 'visitor@example.com', 'status' => 'new']);
        $learner = $this->ownLearner;

        $this->actingAs($learner)->getJson('/api/v1/admin/feedbacks')->assertForbidden();
        $this->actingAs($this->schoolAdmin)->getJson('/api/v1/admin/feedbacks')->assertForbidden();
        $this->actingAs($learner)->putJson("/api/v1/admin/feedbacks/{$feedback->id}/status", ['status' => 'resolved'])->assertForbidden();

        $this->actingAs($this->platformAdmin)->getJson('/api/v1/admin/feedbacks')->assertOk();
    }

    public function test_feedback_inbox_requires_sign_in(): void
    {
        $this->getJson('/api/v1/admin/feedbacks')->assertUnauthorized();
    }

    public function test_school_categories_are_stored_and_filtered_by_category_ids(): void
    {
        $this->actingAs($this->platformAdmin)
            ->postJson('/api/v1/admin/schools', ['name' => 'Hilltop College', 'category_ids' => [3, 2, 3]])
            ->assertCreated()
            ->assertJsonPath('school.category_ids', [2, 3])
            ->assertJsonPath('school.category_type_label', 'Combined (Junior & Senior)');

        $names = fn (string $category) => collect($this->getJson("/api/v1/admin/schools?category={$category}")->json('schools'))->pluck('name')->all();
        $this->assertSame(['Hilltop College'], $names('junior'));
        $this->assertSame(['Hilltop College'], $names('combined'));
        $this->assertSame([], $names('primary'));

        // A school saved without categories counts as senior secondary.
        $this->postJson('/api/v1/admin/schools', ['name' => 'Plain School'])->assertJsonPath('school.category_ids', [3]);
    }
}
