<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\LearnerProfile;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LearnerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_page_is_accessible_to_guests(): void
    {
        $response = $this->get('/register');
        $response->assertStatus(200);

        $signupAlias = $this->get('/signup');
        $signupAlias->assertStatus(200);
    }

    public function test_learner_can_register_with_null_school_id_and_auto_login(): void
    {
        $response = $this->post('/register', [
            'name' => 'Chioma Okeke',
            'email' => 'chioma.okeke@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        $user = User::where('email', 'chioma.okeke@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->isLearner());
        $this->assertFalse($user->hasSchoolAccess());

        $profile = LearnerProfile::where('user_id', $user->id)->first();
        $this->assertNotNull($profile);
        $this->assertNull($profile->school_id);
        $this->assertTrue($profile->is_active);

        $gamification = UserGamification::where('user_id', $user->id)->first();
        $this->assertNotNull($gamification);
        $this->assertEquals(0, $gamification->total_xp);
        $this->assertEquals(1, $gamification->level);
    }

    public function test_api_auth_register_returns_structured_json(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Tunde Bakare',
            'email' => 'tunde.bakare@example.com',
            'password' => 'securepass',
            'password_confirmation' => 'securepass',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('user.role', 'learner')
            ->assertJsonPath('user.has_school_access', false)
            ->assertJsonPath('redirect', '/dashboard');

        $this->assertAuthenticated();
    }

    public function test_independent_learner_is_redirected_from_school_curriculum_page(): void
    {
        $user = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create([
            'user_id' => $user->id,
            'school_id' => null,
            'is_active' => true,
        ]);

        $this->actingAs($user);

        $response = $this->get('/subjects');
        $response->assertRedirect('/general-knowledge');

        $generalResponse = $this->get('/general-knowledge');
        $generalResponse->assertStatus(200);
    }
}
