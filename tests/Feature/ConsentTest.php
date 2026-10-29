<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Consent;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Terms and Privacy pages, the agree screen, the AI-improvement choice, and the consent form a
 * school records for each learner. Every answer is a new row, so the history is the proof.
 */
class ConsentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $learner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $school = School::create(['name' => 'School A', 'slug' => 'school-a', 'is_active' => true, 'admin_user_id' => $this->admin->id]);
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $this->learner->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
    }

    public function test_the_terms_and_privacy_policy_are_public(): void
    {
        $this->get('/terms')->assertOk()->assertInertia(fn ($page) => $page->component('Legal/Document')
            ->where('title', 'Terms of Use')->where('markdown', fn ($md) => str_contains($md, 'Using AceDrill fairly')));
        $this->get('/privacy')->assertOk()->assertInertia(fn ($page) => $page->component('Legal/Document')
            ->where('markdown', fn ($md) => str_contains($md, 'Nigeria Data Protection Act 2023')));

        $this->get('/privacy')->assertInertia(fn ($page) => $page->where('inReview', true));
        config(['legal.in_review' => false]);
        $this->get('/privacy')->assertInertia(fn ($page) => $page->where('inReview', false));

        // Company and contact come from config, so no blank to fill is ever shown.
        config(['legal.company' => 'AceDrill Ltd', 'legal.contact_email' => 'privacy@acedrill.test']);
        $this->get('/terms')->assertInertia(fn ($page) => $page->where('markdown', fn ($md) => str_contains($md, 'between you and AceDrill Ltd')
            && str_contains($md, 'privacy@acedrill.test') && ! preg_match('/\{\w+\}|\[[A-Z][^\]]*\](?!\()/', $md)));
    }

    public function test_when_required_people_agree_before_using_the_app_and_again_after_a_change(): void
    {
        config(['legal.require_acceptance' => true]);

        $this->actingAs($this->admin)->get('/dashboard')->assertRedirect('/consent');
        // Background calls (offline sync, data) are never stopped.
        $this->actingAs($this->admin)->getJson('/api/v1/ai/conversations')->assertOk();

        $this->actingAs($this->admin)->get('/consent')->assertInertia(fn ($page) => $page->where('isLearner', false)->where('returning', false));
        $this->actingAs($this->admin)->post('/consent')->assertRedirect('/dashboard');
        $this->assertTrue($this->admin->fresh()->hasAcceptedCurrentTerms());
        $this->actingAs($this->admin)->get('/profile')->assertOk();

        // A new version asks again, and says it changed.
        config(['legal.version' => '2027-01-01']);
        $this->flushSession();
        $this->actingAs($this->admin)->get('/profile')->assertRedirect('/consent');
        $this->actingAs($this->admin)->get('/consent')->assertInertia(fn ($page) => $page->where('returning', true));
        $this->assertSame(1, Consent::where('user_id', $this->admin->id)->count());
    }

    public function test_school_learners_see_the_short_summary_and_nothing_is_required_while_switched_off(): void
    {
        $this->actingAs($this->learner)->get('/dashboard')->assertOk();

        $this->actingAs($this->learner)->get('/consent')->assertInertia(fn ($page) => $page->where('isLearner', true)
            ->where('summary', fn ($md) => str_contains($md, 'What we keep')));
    }

    public function test_a_school_learners_ai_choice_comes_from_the_school_and_adults_choose_their_own(): void
    {
        $this->assertFalse($this->learner->allowsAiTraining());
        $this->actingAs($this->learner)->putJson('/api/v1/account/ai-training', ['allowed' => true])->assertForbidden();

        $this->actingAs($this->admin)->putJson('/api/v1/account/ai-training', ['allowed' => true])->assertOk();
        $this->actingAs($this->admin)->putJson('/api/v1/account/ai-training', ['allowed' => true])->assertOk();
        $this->assertTrue($this->admin->fresh()->allowsAiTraining());
        $this->assertSame(1, Consent::where('document', Consent::AI_TRAINING)->count(), 'An unchanged answer adds no row.');

        $this->actingAs($this->admin)->putJson('/api/v1/account/ai-training', ['allowed' => false])->assertOk();
        $this->assertFalse($this->admin->fresh()->allowsAiTraining());
    }

    public function test_the_school_records_a_learners_consent_form_and_another_school_cannot(): void
    {
        $this->actingAs($this->admin)->putJson("/api/v1/admin/learners/{$this->learner->id}/consent", ['parental' => true, 'ai_training' => false])
            ->assertOk();

        $rows = Consent::where('user_id', $this->learner->id)->orderBy('id')->get();
        $this->assertSame([Consent::PARENTAL, Consent::AI_TRAINING], $rows->pluck('document')->all());
        $this->assertSame([Consent::SOURCE_SCHOOL, $this->admin->id], [$rows[0]->source, $rows[0]->recorded_by]);

        $this->actingAs($this->admin)->getJson('/api/v1/admin/learners')
            ->assertOk()->assertJsonPath('data.0.parental_consent', fn ($v) => (bool) $v === true)->assertJsonPath('data.0.ai_training_consent', fn ($v) => (bool) $v === false);

        $otherAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        School::create(['name' => 'School B', 'slug' => 'school-b', 'is_active' => true, 'admin_user_id' => $otherAdmin->id]);
        $this->actingAs($otherAdmin)->putJson("/api/v1/admin/learners/{$this->learner->id}/consent", ['parental' => false, 'ai_training' => true])
            ->assertForbidden();
        $this->assertFalse($this->learner->fresh()->allowsAiTraining());
    }

    public function test_the_school_records_consent_forms_for_many_learners_at_once(): void
    {
        $second = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $second->id, 'school_id' => $this->learner->learnerProfile->school_id, 'grade_level' => 'SS1']);
        $ids = [$this->learner->id, $second->id];

        $this->actingAs($this->admin)->postJson('/api/v1/admin/learners/consent-forms', ['learner_ids' => $ids, 'parental' => true, 'ai_training' => true])
            ->assertOk()->assertJson(['learners' => 2, 'changed' => 4]);
        $this->assertTrue($second->fresh()->allowsAiTraining());
        $this->assertSame([$this->admin->id], Consent::distinct()->pluck('recorded_by')->all());

        // The same answers again change nothing; a later "no" for one family adds just that row.
        $this->actingAs($this->admin)->postJson('/api/v1/admin/learners/consent-forms', ['learner_ids' => $ids, 'parental' => true, 'ai_training' => true])
            ->assertJson(['changed' => 0]);
        $this->actingAs($this->admin)->putJson("/api/v1/admin/learners/{$second->id}/consent", ['parental' => true, 'ai_training' => false])->assertOk();
        $this->assertSame(5, Consent::count());
        $this->assertFalse($second->fresh()->allowsAiTraining());
    }

    public function test_a_bulk_save_with_a_learner_from_another_school_saves_nothing(): void
    {
        $otherAdmin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $otherSchool = School::create(['name' => 'School B', 'slug' => 'school-b', 'is_active' => true, 'admin_user_id' => $otherAdmin->id]);
        $outsider = User::factory()->create(['role' => UserRole::LEARNER]);
        LearnerProfile::create(['user_id' => $outsider->id, 'school_id' => $otherSchool->id, 'grade_level' => 'SS1']);

        $this->actingAs($this->admin)->postJson('/api/v1/admin/learners/consent-forms', [
            'learner_ids' => [$this->learner->id, $outsider->id], 'parental' => true, 'ai_training' => true,
        ])->assertForbidden();
        $this->assertSame(0, Consent::count());
    }

    public function test_signing_up_records_agreement_to_the_terms(): void
    {
        $this->post('/register', ['name' => 'Tobi Ade', 'email' => 'tobi@example.com', 'password' => 'Str0ng-pass-phrase', 'password_confirmation' => 'Str0ng-pass-phrase'])
            ->assertRedirect();

        $user = User::where('email', 'tobi@example.com')->firstOrFail();
        $this->assertTrue($user->hasAcceptedCurrentTerms());
        // No school, so they choose about AI improvement themselves.
        $this->assertTrue($user->givesOwnConsent());
    }
}
