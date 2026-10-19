<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountStatusTest extends TestCase
{
    use RefreshDatabase;

    protected User $platformAdmin;
    protected User $schoolAdmin;
    protected School $school;
    protected School $otherSchool;

    protected function setUp(): void
    {
        parent::setUp();
        $this->platformAdmin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $this->schoolAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $this->school = School::create(['name' => 'Own School', 'slug' => 'own-school', 'category' => 'senior', 'is_active' => true, 'admin_user_id' => $this->schoolAdmin->id]);
        $this->otherSchool = School::create(['name' => 'Other School', 'slug' => 'other-school', 'category' => 'senior', 'is_active' => true]);
    }

    private function learnerAt(School $school): User
    {
        $learner = User::factory()->create(['role' => UserRole::LEARNER, 'password' => 'secret-pass']);
        LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $school->id]);

        return $learner;
    }

    private function teacherAt(School $school): User
    {
        $teacher = User::factory()->create(['role' => UserRole::TEACHER, 'password' => 'secret-pass']);
        TeacherProfile::create(['user_id' => $teacher->id, 'school_id' => $school->id]);

        return $teacher;
    }

    private function signIn(User $user, string $password = 'secret-pass')
    {
        return $this->postJson('/login', ['email' => $user->email, 'password' => $password]);
    }

    public function test_a_deactivated_account_cannot_sign_in(): void
    {
        $learner = $this->learnerAt($this->school);
        $learner->forceFill(['is_active' => false])->save();

        $this->signIn($learner)->assertForbidden()->assertJson(['code' => 'account_inactive']);
        $this->assertGuest();
    }

    public function test_nobody_in_a_deactivated_school_can_sign_in(): void
    {
        $learner = $this->learnerAt($this->school);
        $teacher = $this->teacherAt($this->school);
        $this->schoolAdmin->forceFill(['password' => 'secret-pass'])->save();
        $this->school->update(['is_active' => false]);

        foreach ([$learner, $teacher, $this->schoolAdmin] as $user) {
            $this->signIn($user)->assertForbidden()->assertJsonFragment(['code' => 'account_inactive']);
            $this->assertGuest();
        }

        // Other schools and platform admins are unaffected.
        $this->signIn($this->learnerAt($this->otherSchool))->assertOk();
        auth()->logout();
        $this->platformAdmin->forceFill(['password' => 'secret-pass'])->save();
        $this->signIn($this->platformAdmin)->assertOk();
    }

    public function test_deactivating_signs_the_user_out_on_their_next_request(): void
    {
        $learner = $this->learnerAt($this->school);
        $this->actingAs($learner)->getJson('/api/v1/sync/session')->assertOk()->assertJson(['user_id' => $learner->id]);

        $learner->forceFill(['is_active' => false])->save();

        // Re-checked at most once a minute per session (sign-in itself is checked every time).
        $this->getJson('/api/v1/dashboard/stats')->assertOk();
        $this->travel(61)->seconds();
        $this->getJson('/api/v1/dashboard/stats')->assertUnauthorized()->assertJson(['code' => 'account_inactive']);
        $this->assertGuest();
    }

    public function test_a_school_admin_can_deactivate_and_reactivate_their_own_users(): void
    {
        $learner = $this->learnerAt($this->school);

        $this->actingAs($this->schoolAdmin)->patchJson("/api/v1/admin/users/{$learner->id}/status", ['is_active' => false])->assertOk();
        $this->assertFalse($learner->fresh()->is_active);

        $this->actingAs($this->schoolAdmin)->patchJson("/api/v1/admin/users/{$learner->id}/status", ['is_active' => true])->assertOk();
        $this->assertTrue($learner->fresh()->is_active);
    }

    public function test_a_school_admin_cannot_change_other_schools_or_themselves(): void
    {
        $other = $this->learnerAt($this->otherSchool);

        $this->actingAs($this->schoolAdmin)->patchJson("/api/v1/admin/users/{$other->id}/status", ['is_active' => false])->assertForbidden();
        $this->actingAs($this->schoolAdmin)->patchJson("/api/v1/admin/users/{$this->schoolAdmin->id}/status", ['is_active' => false])->assertForbidden();
        // Nobody can deactivate themselves (the policy already refuses it; the controller double-checks).
        $this->actingAs($this->platformAdmin)->patchJson("/api/v1/admin/users/{$this->platformAdmin->id}/status", ['is_active' => false])->assertForbidden();
        $this->actingAs($this->schoolAdmin)->patchJson("/api/v1/admin/schools/{$this->school->id}/status", ['is_active' => false])->assertForbidden();

        $this->assertTrue($other->fresh()->is_active);
        $this->assertTrue((bool) $this->school->fresh()->is_active);
    }

    public function test_a_platform_admin_can_deactivate_a_school(): void
    {
        $this->actingAs($this->platformAdmin)->patchJson("/api/v1/admin/schools/{$this->school->id}/status", ['is_active' => false])->assertOk();

        $this->assertFalse((bool) $this->school->fresh()->is_active);
    }

    public function test_deleting_an_account_is_always_a_soft_delete(): void
    {
        $learner = $this->learnerAt($this->school); // no quiz history: previously erased for good

        $this->actingAs($this->schoolAdmin)->deleteJson("/api/v1/admin/learners/{$learner->id}")->assertOk();

        $archived = User::withTrashed()->find($learner->id);
        $this->assertNotNull($archived);
        $this->assertNotNull($archived->deleted_at);
        $this->assertSame($learner->email, $archived->archived_email);
        auth()->logout();
        $this->signIn($learner)->assertStatus(401); // the account no longer exists for sign-in
    }
}
