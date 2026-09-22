<?php

namespace Database\Seeders;

use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PastQuestionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Prevent duplicate insertions if past questions already exist
        if (PastQuestion::count() > 0) {
            $this->command?->info('Past questions table already populated (' . PastQuestion::count() . ' questions). Skipping snapshot restore.');
            return;
        }

        $snapshotPath = database_path('seeders/data/past_questions_snapshot.json');

        if (file_exists($snapshotPath)) {
            $this->seedFromSnapshot($snapshotPath);
            return;
        }

        $this->command?->warn('No past questions snapshot found at ' . $snapshotPath);
    }

    /**
     * Restore all authentic past questions & options from JSON snapshot in fast database chunks.
     */
    protected function seedFromSnapshot(string $snapshotPath): void
    {
        $json = file_get_contents($snapshotPath);
        $questions = json_decode($json, true);

        if (empty($questions)) {
            $this->command?->warn('Snapshot file is empty.');
            return;
        }

        $total = count($questions);
        $this->command?->info("Restoring {$total} authentic past questions from snapshot...");

        // Preload existing subjects & topics to minimize DB queries
        $subjectCache = Subject::all()->keyBy('slug');
        $topicCache = Topic::all()->groupBy('subject_id');

        $now = now();
        $importedCount = 0;
        $chunks = array_chunk($questions, 200);

        foreach ($chunks as $chunk) {
            DB::transaction(function () use ($chunk, &$subjectCache, &$topicCache, &$importedCount, $now) {
                foreach ($chunk as $item) {
                    $subjectSlug = $item['subject_slug'] ?: Str::slug($item['subject_name'] ?? 'General');
                    $subjectName = $item['subject_name'] ?: 'General Subject';

                    if (!isset($subjectCache[$subjectSlug])) {
                        $subject = Subject::create([
                            'slug' => $subjectSlug,
                            'name' => $subjectName,
                            'description' => "National past examination curriculum for {$subjectName}.",
                            'status' => 'active',
                            'sort_order' => 1,
                        ]);
                        $subjectCache[$subjectSlug] = $subject;
                    }
                    $subject = $subjectCache[$subjectSlug];

                    // Match or create topic
                    $topicId = null;
                    if (!empty($item['topic_name'])) {
                        $topicSlug = $item['topic_slug'] ?: Str::slug($item['topic_name']);
                        $subjectTopics = $topicCache->get($subject->id, collect());
                        $topic = $subjectTopics->firstWhere('slug', $topicSlug);

                        if (!$topic) {
                            $topic = Topic::create([
                                'subject_id' => $subject->id,
                                'slug' => $topicSlug,
                                'name' => $item['topic_name'],
                                'level' => 'SS3',
                                'description' => "Exam preparation and mastery for {$item['topic_name']}.",
                                'status' => 'active',
                                'sort_order' => 1,
                            ]);
                            $topicCache->put($subject->id, $subjectTopics->push($topic));
                        }
                        $topicId = $topic->id;
                    }

                    // Create Past Question
                    $pastQuestionId = DB::table('past_questions')->insertGetId([
                        'subject_id' => $subject->id,
                        'topic_id' => $topicId,
                        'exam_code' => $item['exam_code'],
                        'exam_year' => $item['exam_year'],
                        'paper_type' => $item['paper_type'] ?? 'Paper 1 (CBT)',
                        'question_number' => $item['question_number'] ?? null,
                        'question_text' => $item['question_text'],
                        'passage_text' => $item['passage_text'] ?? null,
                        'image_url' => $item['image_url'] ?? null,
                        'difficulty' => $item['difficulty'] ?? 'medium',
                        'explanation' => $item['explanation'] ?? null,
                        'status' => $item['status'] ?? 'active',
                        'metadata' => isset($item['metadata']) ? json_encode($item['metadata']) : null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    // Bulk insert options
                    if (!empty($item['options'])) {
                        $optionsToInsert = [];
                        foreach ($item['options'] as $opt) {
                            $optionsToInsert[] = [
                                'past_question_id' => $pastQuestionId,
                                'option_key' => $opt['option_key'] ?? null,
                                'option_text' => (string) ($opt['option_text'] ?? ''),
                                'is_correct' => (bool) ($opt['is_correct'] ?? false),
                                'sort_order' => (int) ($opt['sort_order'] ?? 1),
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                        }
                        DB::table('past_question_options')->insert($optionsToInsert);
                    }

                    $importedCount++;
                }
            });
        }

        $this->command?->info("Successfully restored {$importedCount} authentic past questions and all options into database.");
    }
}
