<?php

namespace App\Console\Commands;

use App\Services\PastQuestions\AlocImportService;
use Illuminate\Console\Command;

class ImportPastQuestionsCommand extends Command
{
    protected $signature = 'past-questions:import 
                            {--exam=jamb : Examination code (jamb, waec, neco, post_utme)}
                            {--subject=mathematics : Subject name (mathematics, english, physics, chemistry, biology, economics, commerce, government, etc.)}
                            {--year= : Specific examination year (optional)}
                            {--pages=2 : Number of pagination pages to pull (10 questions per page)}
                            {--fresh : Start from page 1 instead of resuming from previous cursor}
                            {--ssce : Import SSCE questions (WAEC & NECO) across available subjects}
                            {--all : Efficiently pull standard batch across all supported exams and subjects}';

    protected $description = 'Import authentic past examination questions from ALOC Station API into the offline database with credit optimization';

    public function handle(AlocImportService $importService): int
    {
        $this->info('====================================================');
        $this->info('  AceDrill Past Questions Ingestion (ALOC Station)   ');
        $this->info('====================================================');

        if ($this->option('ssce')) {
            return $this->importSsceSuite($importService);
        }

        if ($this->option('all')) {
            return $this->importAllSuite($importService);
        }

        $exam = strtolower((string) $this->option('exam'));
        $subject = strtolower((string) $this->option('subject'));
        $year = $this->option('year') ? (int) $this->option('year') : null;
        $maxPages = max(1, (int) $this->option('pages'));
        $isFresh = $this->option('fresh');

        // Resume from saved cursor unless --fresh is specified
        $cursor = $isFresh ? null : $importService->getSavedCursor($exam, $subject);
        if ($cursor) {
            $this->comment("  [Info] Resuming from saved cursor for [{$exam}] {$subject} to save API credits.");
        }

        $this->info("Fetching past questions for [{$exam}] {$subject}" . ($year ? " (Year: {$year})" : "") . " (Pages: {$maxPages})...");

        $totalImported = 0;
        $totalUpdated = 0;
        $totalSkipped = 0;

        for ($page = 1; $page <= $maxPages; $page++) {
            $this->line("Fetching page {$page}/{$maxPages}...");
            $response = $this->fetchWithBackoff($importService, $subject, $exam, $year, $cursor);

            if (!$response['success']) {
                $this->error("Failed to fetch: " . ($response['error'] ?? 'Unknown error'));
                break;
            }

            $meta = $response['meta'] ?? [];
            $creditsLeft = $meta['creditsRemaining'] ?? 'unknown';
            $creditsUsed = $meta['creditsUsed'] ?? 1;

            $questions = $response['data'];
            $count = count($questions);
            if ($count === 0) {
                $this->line("No more questions returned on page {$page}. (Credits remaining: {$creditsLeft})");
                break;
            }

            $result = $importService->importQuestions($questions, $exam, $subject, $year);
            $totalImported += $result['imported'];
            $totalUpdated += $result['updated'];
            $totalSkipped += $result['skipped'];

            $this->info("  ✓ Page {$page}: +{$result['imported']} new, ~{$result['updated']} updated. (Credits left: {$creditsLeft})");

            $cursor = $response['next_cursor'] ?? null;
            $importService->saveCursor($exam, $subject, $cursor);

            if (!$cursor) {
                $this->line("Reached end of available records on ALOC.");
                break;
            }

            // Polite 1s delay
            sleep(1);
        }

        $this->info("----------------------------------------------------");
        $this->info("Import Summary for [{$exam}] {$subject}:");
        $this->line("  Total New Saved: {$totalImported}");
        $this->line("  Total Updated:   {$totalUpdated}");
        $this->line("  Total Skipped:   {$totalSkipped}");
        $this->info('✓ Ingestion complete.');

        return self::SUCCESS;
    }

    protected function importSsceSuite(AlocImportService $importService): int
    {
        $this->info("\n>>> Starting SSCE (WAEC & NECO) Senior Secondary Past Questions Ingestion <<<");

        $matrix = [
            'waec' => ['mathematics', 'economics', 'commerce', 'government'],
            'neco' => ['commerce', 'government'],
        ];

        $totalNew = 0;

        foreach ($matrix as $exam => $subjects) {
            $this->info("\n====================================================");
            $this->info("Exam: " . strtoupper($exam) . " (Senior Secondary)");
            $this->info("====================================================");

            foreach ($subjects as $subject) {
                $cursor = $importService->getSavedCursor($exam, $subject);
                $this->line("Pulling [{$exam}] {$subject}..." . ($cursor ? " [resuming from cursor]" : ""));

                $pagesFetched = 0;
                do {
                    $res = $this->fetchWithBackoff($importService, $subject, $exam, null, $cursor);
                    if (!$res['success'] || empty($res['data'])) {
                        $this->line("  -> No more records for [{$exam}] {$subject}.");
                        break;
                    }

                    $import = $importService->importQuestions($res['data'], $exam, $subject, null);
                    $totalNew += $import['imported'];
                    $pagesFetched++;

                    $meta = $res['meta'] ?? [];
                    $creditsLeft = $meta['creditsRemaining'] ?? 'N/A';
                    $this->info("  ✓ Page {$pagesFetched}: +{$import['imported']} new questions saved. (Credits remaining: {$creditsLeft})");

                    $cursor = $res['next_cursor'] ?? null;
                    $importService->saveCursor($exam, $subject, $cursor);

                    if (!$cursor) {
                        $this->line("  -> Reached end of {$exam} {$subject} records.");
                        break;
                    }

                    sleep(1); // Polite delay to protect rate limit
                } while ($cursor && $pagesFetched < 5);
            }
        }

        $this->info("\n====================================================");
        $this->info("SSCE Ingestion Complete! Total new SSCE questions saved: {$totalNew}");
        $this->info("====================================================");

        return self::SUCCESS;
    }

    protected function importAllSuite(AlocImportService $importService): int
    {
        $pagesPerSubject = max(1, (int) ($this->option('pages') ?: 5));

        $this->info("Fetching live subjects catalogue from ALOC Station API...");
        $alocSubjects = $importService->fetchAvailableSubjects();

        if (empty($alocSubjects)) {
            $this->error("Failed to retrieve subjects catalogue from ALOC.");
            return self::FAILURE;
        }

        $this->info("Found " . count($alocSubjects) . " official subjects hosted on ALOC.");

        $totalNew = 0;
        $totalCreditsUsed = 0;

        foreach ($alocSubjects as $subjectItem) {
            $subjectSlug = $subjectItem['name'];
            $subjectName = $subjectItem['displayName'] ?? ucfirst($subjectSlug);
            $supportedExams = $subjectItem['examTypes'] ?? $subjectItem['supportedExams'] ?? ['jamb'];
            $totalAvailable = $subjectItem['questionCount'] ?? 'unknown';
            $yearRange = $subjectItem['yearRange'] ?? [];
            $yearStr = !empty($yearRange) ? " (Years: {$yearRange['min']}-{$yearRange['max']})" : "";

            $this->info("\n====================================================");
            $this->info("Subject: {$subjectName} (Pool: {$totalAvailable} Qs){$yearStr}");
            $this->info("Supported Exams: " . implode(', ', array_map('strtoupper', $supportedExams)));
            $this->info("====================================================");

            foreach ($supportedExams as $exam) {
                $cursor = $importService->getSavedCursor($exam, $subjectSlug);
                $this->line("Fetching [{$exam}] {$subjectName} (Target: {$pagesPerSubject} pages)..." . ($cursor ? " [resuming cursor]" : ""));

                for ($p = 1; $p <= $pagesPerSubject; $p++) {
                    $res = $this->fetchWithBackoff($importService, $subjectSlug, $exam, null, $cursor);

                    if (!$res['success']) {
                        $this->line("  -> Notice: [{$exam}] {$subjectSlug} returned: " . ($res['error'] ?? 'Unknown'));
                        break;
                    }

                    if (empty($res['data'])) {
                        $this->line("  -> No more records for [{$exam}] {$subjectSlug}.");
                        break;
                    }

                    $import = $importService->importQuestions($res['data'], $exam, $subjectSlug, null);
                    $totalNew += $import['imported'];
                    $totalCreditsUsed++;

                    $meta = $res['meta'] ?? [];
                    $creditsLeft = $meta['creditsRemaining'] ?? 'N/A';
                    $this->info("  ✓ Page {$p}: +{$import['imported']} new questions (Total new so far: {$totalNew}, ALOC Credits left: {$creditsLeft})");

                    $cursor = $res['next_cursor'] ?? null;
                    $importService->saveCursor($exam, $subjectSlug, $cursor);

                    if (!$cursor) {
                        $this->line("  -> Reached end of ALOC records for [{$exam}] {$subjectSlug}.");
                        break;
                    }

                    sleep(1); // Protect rate limits
                }
            }
        }

        $this->info("\n====================================================");
        $this->info("Dynamic Ingestion Completed!");
        $this->info("  Total New Questions Saved: {$totalNew}");
        $this->info("  Approximate Credits Used:  {$totalCreditsUsed}");
        $this->info("====================================================");

        return self::SUCCESS;
    }

    protected function fetchWithBackoff(
        AlocImportService $importService,
        string $subject,
        string $exam,
        ?int $year = null,
        ?string $cursor = null,
        int $maxRetries = 2
    ): array {
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            $res = $importService->fetchFromAloc($subject, $exam, $year, $cursor);
            if ($res['status'] === 429) {
                $this->warn("  ALOC rate limit hit. Waiting 10s before retry (attempt {$attempt}/{$maxRetries})...");
                sleep(10);
                continue;
            }
            return $res;
        }

        return $res;
    }
}
