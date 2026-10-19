<?php

namespace Tests\Feature;

use App\Enums\UserRole;
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
