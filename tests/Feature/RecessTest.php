<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Recess: earned game breaks. The games run on the device; the server pays a small, capped
 * XP for a win, only after real learning that day, and a school can switch it off.
 */
class RecessTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private User $learner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->school = School::create(['name' => 'Recess School', 'slug' => 'recess-school', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $this->learner->id, 'school_id' => $this->school->id, 'grade_level' => 'SS1']);
    }

    private function learnSomethingToday(): void
    {
        XpTransaction::create(['user_id' => $this->learner->id, 'amount' => 5, 'source' => 'quiz_complete', 'description' => 'Completed a quiz']);
    }

    private function win(string $game = 'make_24')
    {
        return $this->actingAs($this->learner)->postJson('/api/v1/recess/wins', ['game' => $game, 'won_at' => now()->toIso8601String()]);
    }

    public function test_a_win_pays_nothing_until_the_learner_has_learned_today(): void
    {
        $this->win()->assertOk()->assertJsonPath('xp_earned', 0);

        $this->learnSomethingToday();
        $this->win()->assertOk()->assertJsonPath('xp_earned', 5);
    }

    public function test_recess_pays_once_a_day_across_all_games(): void
    {
        $this->learnSomethingToday();

        $this->win('word_search')->assertJsonPath('xp_earned', 5);
        $this->win('word_search')->assertJsonPath('xp_earned', 0);
        $this->win('connect_four')->assertJsonPath('xp_earned', 0);
        $this->win('make_24')->assertJsonPath('xp_earned', 0);

        $this->assertSame(5, (int) XpTransaction::where('user_id', $this->learner->id)->where('source', 'recess_win')->sum('amount'));
    }

    public function test_a_win_never_counts_as_a_day_of_study_for_the_streak(): void
    {
        $this->learnSomethingToday();
        $this->win()->assertOk();

        $this->assertSame(0, (int) UserGamification::where('user_id', $this->learner->id)->value('current_streak'));
    }

    public function test_only_known_games_from_learners_in_schools_that_allow_recess(): void
    {
        $this->win('poker')->assertUnprocessable();

        $teacher = User::factory()->create(['role' => UserRole::TEACHER]);
        $this->actingAs($teacher)->postJson('/api/v1/recess/wins', ['game' => 'make_24'])->assertForbidden();

        $this->school->update(['recess_enabled' => false]);
        $this->win()->assertForbidden();
    }

    public function test_the_page_and_the_school_switch_reach_the_learner(): void
    {
        $this->actingAs($this->learner)->get('/recess')
            ->assertInertia(fn ($page) => $page->component('Recess/Index')->where('auth.user.recess_enabled', true));

        $this->school->update(['recess_enabled' => false]);
        $this->actingAs($this->learner->fresh())->get('/recess')
            ->assertInertia(fn ($page) => $page->where('auth.user.recess_enabled', false));
    }

    public function test_only_the_schools_own_admin_or_the_platform_can_switch_recess(): void
    {
        $admin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $this->school->update(['admin_user_id' => $admin->id]);
        $otherAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        School::create(['name' => 'Other', 'slug' => 'other', 'is_active' => true, 'admin_user_id' => $otherAdmin->id]);

        $this->actingAs($otherAdmin)->patchJson("/api/v1/admin/schools/{$this->school->id}/recess", ['enabled' => false])->assertForbidden();
        $this->actingAs($admin)->patchJson("/api/v1/admin/schools/{$this->school->id}/recess", ['enabled' => false])
            ->assertOk()->assertJsonPath('recess_enabled', false);
        $this->assertFalse($this->school->fresh()->recess_enabled);

        $platform = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $this->actingAs($platform)->patchJson("/api/v1/admin/schools/{$this->school->id}/recess", ['enabled' => true])->assertOk();
    }
}
