<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnAccountTest extends TestCase
{
    use RefreshDatabase;

    private function user(UserRole $role = UserRole::LEARNER): User
    {
        return User::factory()->create(['role' => $role, 'password' => 'secret-pass']);
    }

    public function test_every_signed_in_user_has_a_profile_page(): void
    {
        $this->actingAs($this->user())->get('/profile')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Profile')->has('profile'));
        auth()->logout();
        $this->get('/profile')->assertRedirect(); // guests are sent to sign in
    }

    public function test_a_learners_profile_shows_their_school_and_classes(): void
    {
        $school = School::create(['name' => 'Hill School', 'slug' => 'hill-school', 'city' => 'Ibadan', 'phone' => '0800', 'is_active' => true]);
        $learner = $this->user();
        LearnerProfile::create(['user_id' => $learner->id, 'school_id' => $school->id, 'grade_level' => 'SS1', 'student_id' => 'HS-001']);
        $teacher = $this->user(UserRole::TEACHER);
        $class = ClassModel::create(['school_id' => $school->id, 'name' => 'SS1 Gold', 'slug' => 'ss1-gold', 'grade_level' => 'SS1', 'is_active' => true]);
        ClassMembership::create(['class_id' => $class->id, 'user_id' => $learner->id, 'role' => 'learner']);
        ClassMembership::create(['class_id' => $class->id, 'user_id' => $teacher->id, 'role' => 'teacher']);

        $this->actingAs($learner)->get('/profile')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Profile')
                ->where('profile.school.name', 'Hill School')
                ->where('profile.school.address', 'Ibadan')
                ->where('profile.learner.student_id', 'HS-001')
                ->where('profile.classes.0.name', 'SS1 Gold')
                ->where('profile.classes.0.teachers', [$teacher->name]));
    }

    public function test_admins_see_their_schools_classes_or_every_school(): void
    {
        $admin = $this->user(UserRole::SCHOOL_ADMIN);
        $school = School::create(['name' => 'Hill School', 'slug' => 'hill-school', 'is_active' => true, 'admin_user_id' => $admin->id]);
        School::create(['name' => 'Vale School', 'slug' => 'vale-school', 'is_active' => true]);
        ClassModel::create(['school_id' => $school->id, 'name' => 'JSS1 Blue', 'slug' => 'jss1-blue', 'grade_level' => 'JSS1', 'is_active' => true]);

        $this->actingAs($admin)->get('/profile')
            ->assertInertia(fn ($page) => $page->where('profile.school.name', 'Hill School')
                ->where('profile.classes.0.name', 'JSS1 Blue')
                ->where('profile.classes.0.learners', 0)
                ->where('profile.school_counts.classes', 1)
                ->where('profile.schools', []));

        $this->actingAs($this->user(UserRole::PLATFORM_ADMIN))->get('/profile')
            ->assertInertia(fn ($page) => $page->has('profile.schools', 2)
                ->where('profile.schools.0.name', 'Hill School')
                ->where('profile.schools.0.admin', $admin->name)
                ->where('profile.schools.0.classes', 1));
    }

    public function test_the_wrong_password_changes_nothing(): void
    {
        $user = $this->user();

        $this->actingAs($user)->postJson('/api/v1/account/deactivate', ['password' => 'wrong'])->assertUnprocessable();
        $this->actingAs($user)->deleteJson('/api/v1/account', ['password' => 'wrong'])->assertUnprocessable();

        $this->assertTrue((bool) $user->fresh()->is_active);
        $this->assertNull($user->fresh()->deleted_at);
    }

    public function test_a_user_can_deactivate_their_own_account(): void
    {
        $user = $this->user();

        $this->actingAs($user)->postJson('/api/v1/account/deactivate', ['password' => 'secret-pass'])->assertOk();

        $this->assertFalse($user->fresh()->is_active);
        $this->assertGuest();
        $this->postJson('/login', ['email' => $user->email, 'password' => 'secret-pass'])->assertForbidden();
    }

    public function test_a_user_can_delete_their_own_account(): void
    {
        $user = $this->user(UserRole::TEACHER);

        $this->actingAs($user)->deleteJson('/api/v1/account', ['password' => 'secret-pass'])->assertOk();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertGuest();
        $this->postJson('/login', ['email' => $user->email, 'password' => 'secret-pass'])->assertUnauthorized();
    }

    public function test_the_last_platform_admin_cannot_remove_themselves(): void
    {
        $admin = $this->user(UserRole::PLATFORM_ADMIN);

        $this->actingAs($admin)->postJson('/api/v1/account/deactivate', ['password' => 'secret-pass'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->actingAs($admin)->deleteJson('/api/v1/account', ['password' => 'secret-pass'])->assertUnprocessable();
        $this->assertTrue((bool) $admin->fresh()->is_active);

        // With another active platform admin it is allowed.
        $this->user(UserRole::PLATFORM_ADMIN);
        $this->actingAs($admin)->postJson('/api/v1/account/deactivate', ['password' => 'secret-pass'])->assertOk();
    }
}
