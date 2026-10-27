<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_screen_can_be_rendered(): void
    {
        $response = $this->get('/forgot-password');

        $response->assertStatus(200);
    }

    public function test_reset_password_link_can_be_requested(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => Hash::make('old-password'),
        ]);

        $response = $this->post('/forgot-password', [
            'email' => 'ada@example.com',
        ]);

        $response->assertSessionHas('status');
        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_reset_password_screen_can_be_rendered(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => Hash::make('old-password'),
        ]);

        $token = Password::broker()->createToken($user);

        $response = $this->get('/reset-password/'.$token.'?email='.urlencode($user->email));

        $response->assertStatus(200);
    }

    public function test_password_can_be_reset_with_valid_token(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => Hash::make('old-password'),
        ]);

        $token = Password::broker()->createToken($user);

        $response = $this->post('/reset-password', [
            'token' => $token,
            'email' => 'ada@example.com',
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ]);

        $response->assertRedirect('/login');
        $this->assertTrue(Hash::check('new-secure-password', $user->fresh()->password));
    }
}
