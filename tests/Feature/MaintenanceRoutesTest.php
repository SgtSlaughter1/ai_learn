<?php

namespace Tests\Feature;

use App\Support\PhpSecurity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class MaintenanceRoutesTest extends TestCase
{
    use RefreshDatabase;

    private const ROUTES = ['/php-check', '/clear-cache', '/run-migrations', '/run-migrate-fresh-seed', '/run-seed', '/run-past-questions-seed'];

    private const TOKEN = 'a3f1c9e07b5d4c2a8e6f1b3d5c7a9e0f2b4d6c8a';

    public function test_routes_do_not_exist_without_a_configured_token(): void
    {
        config(['app.maintenance_token' => null]);
        Artisan::shouldReceive('call')->never();

        foreach (self::ROUTES as $route) {
            $this->get($route)->assertNotFound();
            $this->post($route, ['token' => 'x'])->assertNotFound();
        }
    }

    public function test_a_short_token_does_not_enable_the_routes(): void
    {
        config(['app.maintenance_token' => 'short']);
        Artisan::shouldReceive('call')->never();

        $this->get('/run-migrations')->assertNotFound();
        $this->post('/run-migrations', ['token' => 'short'])->assertNotFound();
    }

    public function test_a_wrong_token_is_refused(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);
        Artisan::shouldReceive('call')->never();

        foreach (self::ROUTES as $route) {
            $this->post($route, ['token' => 'wrong'])->assertNotFound();
        }
    }

    public function test_opening_a_link_only_shows_the_confirmation_page(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);
        Artisan::shouldReceive('call')->never();

        foreach (self::ROUTES as $route) {
            // Even with the token in the URL (as old bookmarks have it), a GET never runs anything.
            $this->get("{$route}?token=".self::TOKEN)->assertOk()->assertSee('Maintenance token');
        }
    }

    public function test_the_token_in_the_query_string_is_not_accepted(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);
        Artisan::shouldReceive('call')->never();

        $this->post('/run-migrations?token='.self::TOKEN)->assertNotFound();
    }

    public function test_the_php_check_reports_the_running_version_with_the_token(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);

        $this->post('/php-check', [], ['X-Maintenance-Token' => self::TOKEN])->assertOk()
            ->assertJsonPath('php_version', PHP_VERSION)
            ->assertJsonPath('patched', PhpSecurity::isPatched());
    }

    public function test_the_confirmation_form_runs_migrations(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);
        Artisan::shouldReceive('call')->once()->with('migrate', ['--force' => true])->andReturn(0);
        Artisan::shouldReceive('output')->andReturn('');

        $this->post('/run-migrations', ['token' => self::TOKEN])->assertOk();
    }

    public function test_wiping_is_refused_in_production(): void
    {
        config(['app.maintenance_token' => self::TOKEN, 'app.allow_destructive_maintenance' => false]);
        $this->app['env'] = 'production';
        Artisan::shouldReceive('call')->never();

        $this->post('/run-migrate-fresh-seed', [], ['X-Maintenance-Token' => self::TOKEN])->assertForbidden();
    }

    public function test_test_accounts_can_be_seeded_in_production(): void
    {
        config(['app.maintenance_token' => self::TOKEN, 'app.allow_destructive_maintenance' => false]);
        $this->app['env'] = 'production';
        Artisan::shouldReceive('call')->once()->with('db:seed', ['--force' => true])->andReturn(0);
        Artisan::shouldReceive('output')->andReturn('');

        $this->post('/run-seed', [], ['X-Maintenance-Token' => self::TOKEN])->assertOk();
    }

    public function test_repeated_attempts_are_throttled(): void
    {
        config(['app.maintenance_token' => self::TOKEN]);

        for ($i = 0; $i < 10; $i++) {
            $this->post('/php-check', [], ['X-Maintenance-Token' => self::TOKEN])->assertOk();
        }
        $this->post('/php-check', [], ['X-Maintenance-Token' => self::TOKEN])->assertStatus(429);
    }
}
