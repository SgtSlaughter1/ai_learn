<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_via_json_api(): void
    {
        $user = User::factory()->create([
            'email' => 'student@test.com',
            'password' => Hash::make('secret123'),
            'role' => UserRole::LEARNER,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'student@test.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'token',
            'user' => ['id', 'name', 'email', 'role'],
            'redirect',
        ]);
        $response->assertJson([
            'status' => 'success',
            'user' => [
                'email' => 'student@test.com',
                'role' => 'learner',
            ],
            'redirect' => '/dashboard',
        ]);
    }

    public function test_authenticated_user_can_refresh_token(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::LEARNER,
        ]);

        $this->actingAs($user);

        $response = $this->postJson('/api/v1/auth/refresh');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'token',
            'user' => ['id', 'name', 'email', 'role'],
        ]);
        $response->assertJson([
            'status' => 'success',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'role' => 'learner',
            ],
        ]);
    }

    public function test_unauthenticated_user_cannot_refresh_token(): void
    {
        $response = $this->postJson('/api/v1/auth/refresh');
        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::PLATFORM_ADMIN,
        ]);

        $this->actingAs($user);

        $response = $this->getJson('/api/v1/auth/user');
        $response->assertStatus(200);
        $response->assertJson([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'role' => 'platform_admin',
            ],
        ]);
    }

    public function test_user_can_logout_via_api(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson('/api/v1/auth/logout');
        $response->assertStatus(200);
        $response->assertJson(['status' => 'logged_out']);
    }
}
