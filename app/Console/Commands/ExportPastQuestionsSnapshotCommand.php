<?php

namespace App\Console\Commands;

use App\Models\PastQuestion;
use Illuminate\Console\Command;

class ExportPastQuestionsSnapshotCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'past-questions:snapshot {--path= : Custom file path to save snapshot JSON}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Export all authentic past questions and options into a local snapshot JSON fixture for zero-credit database seeding and deployment.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $customPath = $this->option('path');
        $filePath = $customPath ?: database_path('seeders/data/past_questions_snapshot.json');
        $dir = dirname($filePath);

        if (! file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->info('Gathering past questions and options from database...');

        $questions = PastQuestion::with(['options', 'subject', 'topic'])->get()->map(function ($q) {
            return [
                'subject_slug' => $q->subject?->slug,
                'subject_name' => $q->subject?->name,
                'topic_slug' => $q->topic?->slug,
                'topic_name' => $q->topic?->name,
                'exam_code' => $q->exam_code,
                'exam_year' => $q->exam_year,
                'paper_type' => $q->paper_type,
                'question_number' => $q->question_number,
                'question_text' => $q->question_text,
                'passage_text' => $q->passage_text,
                'image_url' => $q->image_url,
                'difficulty' => $q->difficulty,
                'explanation' => $q->explanation,
                'status' => $q->status,
                'metadata' => $q->metadata,
                'options' => $q->options->map(function ($opt) {
                    return [
                        'option_key' => $opt->option_key,
                        'option_text' => $opt->option_text,
                        'is_correct' => $opt->is_correct,
                        'sort_order' => $opt->sort_order,
                    ];
                })->toArray(),
            ];
        });

        $count = count($questions);
        if ($count === 0) {
            $this->warn('No past questions found in database.');

            return 1;
        }

        file_put_contents(
            $filePath,
            json_encode($questions, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );

        $sizeMb = round(filesize($filePath) / 1024 / 1024, 2);
        $this->info("✓ Successfully exported {$count} past questions to: {$filePath} ({$sizeMb} MB)");
        $this->line("Running 'php artisan migrate:fresh --seed' will now automatically restore all {$count} questions offline in seconds.");

        return 0;
    }
}
