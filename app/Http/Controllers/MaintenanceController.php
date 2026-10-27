<?php

namespace App\Http\Controllers;

use App\Http\Middleware\EnsureMaintenanceToken;
use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Support\PhpSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

/**
 * Artisan over HTTP, for hosts without SSH (InfinityFree). Opening one of these URLs only shows a
 * confirmation page; the action runs when that page posts the token back (EnsureMaintenanceToken).
 * So pasting a link in a chat, where previews fetch it, never runs anything.
 */
class MaintenanceController extends Controller
{
    /** Path => what the confirmation page says it does. */
    public const ACTIONS = [
        'php-check' => 'Show the running PHP version and whether it has the October 2026 security fixes.',
        'clear-cache' => 'Clear the view, route, config and application caches.',
        'run-migrations' => 'Run any migrations that have not run yet.',
        'run-migrate-fresh-seed' => 'Drop EVERY table, then migrate and seed the test accounts. All data is lost.',
        'run-seed' => 'Add or refresh the test accounts and sample content (never deletes anything).',
        'run-past-questions-seed' => 'Run migrations, then seed the past-question bank.',
    ];

    /** The confirmation page. 404 while maintenance is disabled, so the routes stay invisible. */
    public function confirm(Request $request): View
    {
        abort_unless(EnsureMaintenanceToken::isConfigured(), 404);

        $action = $request->path();

        return view('maintenance.confirm', [
            'action' => $action,
            'description' => self::ACTIONS[$action] ?? '',
            'destructive' => $action === 'run-migrate-fresh-seed',
        ]);
    }

    /** The running PHP version and whether it has the October 2026 critical fixes (see PhpSecurity). */
    public function phpCheck(): JsonResponse
    {
        return response()->json(PhpSecurity::report());
    }

    public function clearCache(): string
    {
        foreach (['view:clear', 'route:clear', 'config:clear', 'cache:clear'] as $command) {
            Artisan::call($command);
        }

        return 'All caches cleared successfully!';
    }

    public function runMigrations(): JsonResponse
    {
        try {
            Artisan::call('migrate', ['--force' => true]);

            return response()->json([
                'status' => 'success',
                'message' => 'Migrations ran successfully!',
                'output' => Artisan::output(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to run migrations: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * migrate:fresh --seed. Drops every table individually (shared-hosting MySQL users often can't
     * drop the database or run `db:wipe`), then re-runs migrations and seeds. The response includes a
     * diagnostic report so privilege problems are visible instead of showing up as a confusing
     * "table already exists" error.
     */
    public function migrateFreshSeed(): JsonResponse
    {
        if (app()->isProduction() && ! config('app.allow_destructive_maintenance')) {
            abort(403, 'Wiping the database is disabled in production.');
        }

        // Best-effort: long drop + migrate + seed jobs can outlive PHP defaults
        @set_time_limit(300);
        @ini_set('memory_limit', '256M');

        $report = [
            'database' => DB::getDatabaseName(),
            'driver' => DB::getDriverName(),
        ];

        try {
            // What privileges this MySQL user has. Only shown with APP_DEBUG on: it names
            // the database user and host.
            if (config('app.debug')) {
                try {
                    $report['grants'] = array_map(fn ($row) => array_values((array) $row)[0], DB::select('SHOW GRANTS'));
                } catch (\Throwable $e) {
                    $report['grants'] = 'Unable to read grants: '.$e->getMessage();
                }
            }

            $report['purged_stale_migration_files'] = $this->purgeStaleMigrationFiles();
            $report['migration_files_on_disk'] = array_map(fn ($p) => basename($p, '.php'), glob(database_path('migrations/*.php')) ?: []);

            // 1. Every table that exists right now
            $report['tables_before'] = $tablesBefore = $this->baseTables();

            // 2. Drop each table on its own, so one denied DROP can't abort the wipe
            $drop = ['dropped' => [], 'failed' => []];
            Schema::disableForeignKeyConstraints();
            foreach ($tablesBefore as $table) {
                try {
                    DB::statement("DROP TABLE IF EXISTS `{$table}`");
                    $drop['dropped'][] = $table;
                } catch (\Throwable $e) {
                    $drop['failed'][$table] = $e->getMessage();
                }
            }
            Schema::enableForeignKeyConstraints();
            $report['drop_results'] = $drop;

            // 3. Verify the wipe actually happened.
            $report['tables_remaining_after_drop'] = $this->baseTables();

            // 4. Rebuild the schema, then 5. seed
            $report['migrate'] = $this->artisanStep('migrate', ['--force' => true]);
            $report['seed'] = $this->artisanStep('db:seed', ['--force' => true]);

            $status = match (true) {
                count($report['tables_remaining_after_drop']) > 0 => 'error',
                $report['migrate']['status'] !== 'success' => 'error',
                $report['seed']['status'] !== 'success' => 'partial',
                default => 'success',
            };

            return response()->json(array_merge(['status' => $status], $report), $status === 'success' ? 200 : 500);
        } catch (\Throwable $e) {
            Schema::enableForeignKeyConstraints();

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to run migrate:fresh --seed: '.$e->getMessage(),
                'report' => $report,
            ], 500);
        }
    }

    /**
     * Seeders only. Every seeder is idempotent (updateOrCreate; past questions skip once present),
     * so this only adds or refreshes the test accounts and sample content; it never wipes anything.
     */
    public function runSeed(): JsonResponse
    {
        @set_time_limit(300);
        @ini_set('memory_limit', '256M');

        try {
            Artisan::call('db:seed', ['--force' => true]);

            return response()->json([
                'status' => 'success',
                'message' => 'Database seeded successfully!',
                'output' => Artisan::output(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to run seeders: '.$e->getMessage(),
            ], 500);
        }
    }

    /** Past-question migration and seed only (convenient for incremental setup). */
    public function runPastQuestionsSeed(): JsonResponse
    {
        @set_time_limit(300);
        @ini_set('memory_limit', '256M');

        try {
            Artisan::call('migrate', ['--force' => true]);
            Artisan::call('db:seed', ['--class' => 'PastQuestionSeeder', '--force' => true]);

            return response()->json([
                'status' => 'success',
                'message' => 'Past questions migrated and seeded successfully!',
                'questions_count' => PastQuestion::count(),
                'options_count' => PastQuestionOption::count(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to seed past questions: '.$e->getMessage(),
            ], 500);
        }
    }

    /** @return array{status: string, output?: string, error?: string} */
    private function artisanStep(string $command, array $options): array
    {
        try {
            Artisan::call($command, $options);

            return ['status' => 'success', 'output' => Artisan::output()];
        } catch (\Throwable $e) {
            return ['status' => 'error', 'error' => $e->getMessage()];
        }
    }

    /** @return array<int, string> */
    private function baseTables(): array
    {
        return array_map(
            fn ($table) => array_values((array) $table)[0],
            DB::select('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE'])
        );
    }

    /**
     * Old migration files that were merged into their create migrations; if an old deploy left them
     * on the server they would run again after the wipe, so they are removed first.
     *
     * @return array<int, string>
     */
    private function purgeStaleMigrationFiles(): array
    {
        $stale = [
            '2026_08_23_000001_create_schools_table',
            '2026_08_24_000002_create_categories_table_and_update_schools',
            '2026_08_24_000003_add_exam_fields_to_questions_table',
            '2026_10_15_000002_add_archiving_and_sync_constraints',
            '2026_10_15_000003_add_client_ids_for_offline_sync',
            '2026_10_15_000004_add_xp_awarded_at_to_quiz_attempts',
        ];

        $purged = [];
        foreach ($stale as $base) {
            $path = database_path("migrations/{$base}.php");
            if (file_exists($path)) {
                @unlink($path);
                $purged[] = $base;
            }
        }

        return $purged;
    }
}
