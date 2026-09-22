<?php

namespace App\Services\PastQuestions;

use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AlocImportService
{
    protected string $baseUrl;
    protected ?string $apiKey;

    public function __construct()
    {
        $this->baseUrl = config('services.aloc.api_url', env('ALOC_API_URL', 'https://dev.aloc.com.ng/api/v1'));
        $this->apiKey = config('services.aloc.api_key', env('ALOC_API_KEY', ''));
    }

    /**
     * Map common aliases to ALOC subject slugs.
     */
    public static function normalizeSubjectSlug(string $subject): string
    {
        $subject = strtolower(trim($subject));
        return match ($subject) {
            'math', 'maths', 'mathematics', 'general mathematics' => 'mathematics',
            'furthermaths', 'further maths', 'further-maths', 'further mathematics', 'further-mathematics' => 'further-mathematics',
            'english', 'english language', 'use of english', 'english-language' => 'english-language',
            'french', 'french language', 'french-language' => 'french',
            'physic', 'physics' => 'physics',
            'chem', 'chemistry' => 'chemistry',
            'bio', 'biology' => 'biology',
            'agric', 'agriculture', 'agricultural science', 'agricultural-science' => 'agricultural-science',
            'econ', 'economics' => 'economics',
            'gov', 'govt', 'government' => 'government',
            'lit', 'literature', 'literature-in-english' => 'literature-in-english',
            'crk', 'crs', 'christian religious knowledge', 'christian-religious-studies' => 'christian-religious-studies',
            'irs', 'irk', 'islamic studies', 'islamic religious knowledge', 'islamic-religious-studies' => 'islamic-religious-studies',
            'comm', 'commerce' => 'commerce',
            'acct', 'accounting', 'financial accounting' => 'accounting',
            'geo', 'geography' => 'geography',
            'civic', 'civic education', 'civic-education' => 'civic-education',
            'history' => 'history',
            'insurance' => 'insurance',
            'computer', 'computer studies', 'computer-studies', 'data processing', 'data-processing' => 'computer-studies',
            'hausa', 'hausa language' => 'hausa',
            'yoruba', 'yoruba language' => 'yoruba',
            'igbo', 'igbo language' => 'igbo',
            default => $subject,
        };
    }

    /**
     * Map common exam code aliases to ALOC exam types.
     */
    public static function normalizeExamType(string $exam): string
    {
        $exam = strtolower(trim($exam));
        return match ($exam) {
            'jamb', 'utme' => 'jamb',
            'waec', 'wassce' => 'waec',
            'neco' => 'neco',
            'bece', 'junior_waec', 'state' => 'state',
            'post-utme', 'post_utme', 'postutme' => 'post_utme',
            default => $exam,
        };
    }

    /**
     * Retrieve the last pagination cursor for an exam and subject.
     */
    public function getSavedCursor(string $exam, string $subject): ?string
    {
        $path = storage_path('app/aloc_cursors.json');
        if (!file_exists($path)) return null;
        $state = json_decode(file_get_contents($path), true) ?? [];
        $key = strtolower("{$exam}_{$subject}");
        return $state[$key] ?? null;
    }

    /**
     * Save or advance the pagination cursor.
     */
    public function saveCursor(string $exam, string $subject, ?string $cursor): void
    {
        $path = storage_path('app/aloc_cursors.json');
        $state = [];
        if (file_exists($path)) {
            $state = json_decode(file_get_contents($path), true) ?? [];
        }
        $key = strtolower("{$exam}_{$subject}");
        if ($cursor) {
            $state[$key] = $cursor;
        } else {
            unset($state[$key]);
        }
        @file_put_contents($path, json_encode($state, JSON_PRETTY_PRINT));
    }

    /**
     * Dynamically fetch all supported subjects and their metadata from ALOC API.
     */
    public function fetchAvailableSubjects(): array
    {
        $endpoint = "{$this->baseUrl}/subjects";

        try {
            $headers = ['Accept' => 'application/json'];
            if (!empty($this->apiKey)) {
                $headers['X-API-Key'] = $this->apiKey;
                $headers['AccessToken'] = $this->apiKey;
                $headers['Authorization'] = 'Bearer ' . $this->apiKey;
            }

            $response = Http::timeout(20)->withHeaders($headers)->get($endpoint);
            if ($response->successful()) {
                return $response->json()['data'] ?? [];
            }
        } catch (\Throwable $e) {
            Log::error("Failed to fetch ALOC subjects: " . $e->getMessage());
        }

        return [];
    }

    /**
     * Fetch questions from ALOC API.
     */
    public function fetchFromAloc(string $subject, string $examType = 'jamb', ?int $year = null, ?string $cursor = null): array
    {
        $alocSubject = self::normalizeSubjectSlug($subject);
        $alocType = self::normalizeExamType($examType);

        // Modern ALOC Station endpoint
        $endpoint = "{$this->baseUrl}/questions";

        $params = [
            'subject' => $alocSubject,
            'examType' => $alocType,
        ];

        if ($year) {
            $params['year'] = (string) $year;
        }

        if ($cursor) {
            $params['cursor'] = $cursor;
        }

        try {
            $headers = [
                'Accept' => 'application/json',
            ];
            if (!empty($this->apiKey)) {
                $headers['X-API-Key'] = $this->apiKey;
                $headers['AccessToken'] = $this->apiKey;
                $headers['Authorization'] = 'Bearer ' . $this->apiKey;
            }

            $response = Http::timeout(25)->withHeaders($headers)->get($endpoint, $params);

            if ($response->status() === 429) {
                return [
                    'success' => false,
                    'status' => 429,
                    'error' => 'Rate limit reached on ALOC API (cooling down).',
                    'data' => [],
                    'next_cursor' => null,
                ];
            }

            if (!$response->successful()) {
                Log::warning("ALOC API request failed [{$response->status()}]: " . $response->body());
                return [
                    'success' => false,
                    'status' => $response->status(),
                    'error' => $response->body(),
                    'data' => [],
                    'next_cursor' => null,
                ];
            }

            $json = $response->json();
            $data = $json['data'] ?? [];
            $nextCursor = $json['pagination']['nextCursor'] ?? null;

            // If ALOC returned a single question object instead of an array
            if (isset($data['question']) && !isset($data[0])) {
                $data = [$data];
            }

            return [
                'success' => true,
                'status' => 200,
                'count' => count($data),
                'data' => $data,
                'next_cursor' => $nextCursor,
                'meta' => $json['meta'] ?? [],
            ];
        } catch (\Throwable $e) {
            Log::error("ALOC API Exception: " . $e->getMessage());
            return [
                'success' => false,
                'status' => 500,
                'error' => $e->getMessage(),
                'data' => [],
                'next_cursor' => null,
            ];
        }
    }

    /**
     * Import an array of raw ALOC questions into the dedicated past_questions table.
     */
    public function importQuestions(
        array $rawQuestions,
        string $examCode,
        string $subjectName,
        ?int $examYear = null,
        ?int $schoolId = null
    ): array {
        $examCode = strtolower(trim($examCode));
        if ($examCode === 'utme') $examCode = 'jamb';
        if ($examCode === 'wassce') $examCode = 'waec';

        $subject = $this->resolveOrCreateSubject($subjectName, $schoolId);
        $importedCount = 0;
        $updatedCount = 0;
        $skippedCount = 0;
        $errors = [];

        foreach ($rawQuestions as $index => $raw) {
            try {
                $questionText = trim($raw['text'] ?? $raw['question'] ?? $raw['question_text'] ?? '');
                if (empty($questionText)) {
                    $skippedCount++;
                    continue;
                }

                $year = $raw['year'] ?? $raw['examyear'] ?? $examYear;
                if ($year) {
                    $year = (int) $year;
                }

                $explanation = $raw['section'] ?? $raw['solution'] ?? $raw['explanation'] ?? null;
                $passageText = $raw['passage'] ?? null;
                $imageUrl = $raw['imageUrl'] ?? $raw['image'] ?? $raw['image_url'] ?? null;
                $questionNumber = $raw['questionNumber'] ?? $raw['question_num'] ?? ($index + 1);
                $rawMeta = $raw['metadata'] ?? [];

                // Smart match to national curriculum topic
                $topic = $this->smartMatchTopic($subject, $questionText, (string) $explanation, $rawMeta);

                // Check if past question already exists in past_questions table
                $existing = PastQuestion::where('exam_code', $examCode)
                    ->where('subject_id', $subject->id)
                    ->where(function ($q) use ($year) {
                        if ($year) {
                            $q->where('exam_year', $year);
                        }
                    })
                    ->where('question_text', $questionText)
                    ->first();

                $mergedMeta = array_merge($rawMeta, [
                    'aloc_id' => $raw['id'] ?? null,
                    'exam_type' => $raw['examType'] ?? $examCode,
                    'education_level' => $raw['educationLevel'] ?? null,
                    'curriculum_alignment' => $rawMeta['curriculumAlignment'] ?? null,
                    'learning_objectives' => $rawMeta['learningObjectives'] ?? [],
                    'tags' => $rawMeta['tags'] ?? [],
                    'imported_at' => now()->toIso8601String(),
                ]);

                if ($existing) {
                    $existing->update([
                        'subject_id' => $subject->id,
                        'topic_id' => $topic->id,
                        'paper_type' => $raw['paper_type'] ?? 'Paper 1 (CBT)',
                        'question_number' => $questionNumber,
                        'passage_text' => $passageText,
                        'image_url' => $imageUrl,
                        'explanation' => $explanation,
                        'metadata' => array_merge($existing->metadata ?? [], $mergedMeta),
                    ]);

                    $this->syncOptions($existing, $raw);
                    $updatedCount++;
                    continue;
                }

                $question = PastQuestion::create([
                    'subject_id' => $subject->id,
                    'topic_id' => $topic->id,
                    'question_text' => $questionText,
                    'difficulty' => $raw['difficulty'] ?? (isset($rawMeta['difficultyScore']) && $rawMeta['difficultyScore'] > 3 ? 'hard' : 'medium'),
                    'explanation' => $explanation,
                    'status' => 'active',
                    'exam_code' => $examCode,
                    'exam_year' => $year,
                    'paper_type' => $raw['paper_type'] ?? 'Paper 1 (CBT)',
                    'question_number' => $questionNumber,
                    'passage_text' => $passageText,
                    'image_url' => $imageUrl,
                    'metadata' => $mergedMeta,
                ]);

                $this->syncOptions($question, $raw);
                $importedCount++;
            } catch (\Throwable $e) {
                $errors[] = "Row {$index}: " . $e->getMessage();
                Log::error("Error importing past question row: " . $e->getMessage());
            }
        }

        return [
            'exam_code' => $examCode,
            'subject' => $subject->name,
            'imported' => $importedCount,
            'updated' => $updatedCount,
            'skipped' => $skippedCount,
            'errors' => $errors,
        ];
    }

    /**
     * Synchronize multiple choice options for a past question.
     */
    protected function syncOptions(PastQuestion $question, array $raw): void
    {
        $rawOptions = $raw['options'] ?? $raw['option'] ?? [];
        $correctKey = strtoupper(trim((string) ($raw['correctAnswer'] ?? $raw['answer'] ?? $raw['correct_answer'] ?? '')));

        // Delete existing options before creating fresh ones
        $question->options()->delete();

        $sortOrder = 1;
        foreach (['A', 'B', 'C', 'D', 'E'] as $key) {
            $optText = null;
            if (is_array($rawOptions)) {
                $optText = $rawOptions[$key] ?? $rawOptions[strtolower($key)] ?? null;
            }

            if (!empty($optText)) {
                $isCorrect = ($correctKey === $key || $correctKey === strtolower($key) || trim((string) $optText) === $correctKey);
                PastQuestionOption::create([
                    'past_question_id' => $question->id,
                    'option_key' => $key,
                    'option_text' => trim((string) $optText),
                    'is_correct' => $isCorrect,
                    'sort_order' => $sortOrder++,
                ]);
            }
        }
    }

    /**
     * Resolve existing subject or create standard subject for the curriculum.
     */
    protected function resolveOrCreateSubject(string $subjectName, ?int $schoolId = null): Subject
    {
        $slug = Str::slug($subjectName);
        $subject = Subject::where('slug', $slug)
            ->orWhere('name', 'LIKE', $subjectName)
            ->first();

        if ($subject) {
            return $subject;
        }

        return Subject::create([
            'school_id' => $schoolId,
            'name' => ucwords($subjectName),
            'slug' => $slug,
            'description' => "National past examination questions for {$subjectName}.",
            'status' => 'active',
            'sort_order' => 1,
        ]);
    }

    /**
     * Smartly match a past question to a curriculum topic based on ALOC metadata and keyword analysis.
     */
    protected function smartMatchTopic(Subject $subject, string $questionText, string $explanation, array $rawMeta = []): Topic
    {
        // 1. If ALOC provided high-confidence topic/subtopic metadata
        $metaTopic = $rawMeta['subtopic'] ?? $rawMeta['topic'] ?? null;
        if (!empty($metaTopic) && is_string($metaTopic) && $metaTopic !== $subject->slug && $metaTopic !== 'others') {
            $formattedMetaTopic = ucwords(str_replace(['-', '_'], ' ', $metaTopic));
            return Topic::firstOrCreate(
                ['subject_id' => $subject->id, 'slug' => Str::slug($formattedMetaTopic)],
                [
                    'name' => $formattedMetaTopic,
                    'level' => 'SS3',
                    'description' => "Curriculum topics covering {$formattedMetaTopic} in {$subject->name}.",
                    'status' => 'active',
                    'sort_order' => 5,
                ]
            );
        }

        $combinedText = strtolower($questionText . ' ' . $explanation);

        // 2. Fetch existing topics for this subject
        $topics = Topic::where('subject_id', $subject->id)->get();

        foreach ($topics as $topic) {
            $topicWords = explode(' ', strtolower($topic->name));
            foreach ($topicWords as $word) {
                if (strlen($word) > 4 && str_contains($combinedText, $word)) {
                    return $topic;
                }
            }
        }

        // 3. Domain-specific keyword heuristics for standard Nigerian subjects
        $heuristicTopic = $this->resolveHeuristicTopic($subject->name, $combinedText);
        if ($heuristicTopic) {
            return Topic::firstOrCreate(
                ['subject_id' => $subject->id, 'slug' => Str::slug($heuristicTopic)],
                [
                    'name' => $heuristicTopic,
                    'level' => 'SS3',
                    'description' => "Curriculum topics covering {$heuristicTopic} in {$subject->name}.",
                    'status' => 'active',
                    'sort_order' => 10,
                ]
            );
        }

        // 4. Default generic topic if no match
        $defaultName = "General {$subject->name} Past Questions";
        return Topic::firstOrCreate(
            ['subject_id' => $subject->id, 'slug' => Str::slug($defaultName)],
            [
                'name' => $defaultName,
                'level' => 'SS3',
                'description' => "Curriculum mastery and past questions for {$subject->name}.",
                'status' => 'active',
                'sort_order' => 99,
            ]
        );
    }

    /**
     * Heuristic topic resolver based on exam question content.
     */
    protected function resolveHeuristicTopic(string $subjectName, string $text): ?string
    {
        $s = strtolower($subjectName);

        if (str_contains($s, 'math')) {
            if (str_contains($text, 'quadratic') || str_contains($text, 'factorise') || str_contains($text, 'polynomial')) return 'Quadratic Equations & Polynomials';
            if (str_contains($text, 'logarithm') || str_contains($text, 'indices') || str_contains($text, 'surds')) return 'Indices, Logarithms & Surds';
            if (str_contains($text, 'trigonometr') || str_contains($text, 'sine') || str_contains($text, 'cosine') || str_contains($text, 'tangent')) return 'Trigonometry & Bearings';
            if (str_contains($text, 'differentiat') || str_contains($text, 'integrat') || str_contains($text, 'calculus') || str_contains($text, 'dy/dx')) return 'Calculus: Differentiation & Integration';
            if (str_contains($text, 'probability') || str_contains($text, 'permutation') || str_contains($text, 'combination') || str_contains($text, 'mean') || str_contains($text, 'median')) return 'Statistics & Probability';
            if (str_contains($text, 'matrix') || str_contains($text, 'determinant')) return 'Matrices & Determinants';
            if (str_contains($text, 'circle') || str_contains($text, 'polygon') || str_contains($text, 'geometry') || str_contains($text, 'angle')) return 'Euclidean & Circle Geometry';
            return 'Algebraic Processes & Calculations';
        }

        if (str_contains($s, 'english')) {
            if (str_contains($text, 'nearest in meaning') || str_contains($text, 'synonym')) return 'Synonyms & Vocabulary';
            if (str_contains($text, 'opposite in meaning') || str_contains($text, 'antonym')) return 'Antonyms & Lexis';
            if (str_contains($text, 'stress') || str_contains($text, 'vowel') || str_contains($text, 'consonant') || str_contains($text, 'rhyme')) return 'Oral English: Stress & Phonetics';
            if (str_contains($text, 'passage') || str_contains($text, 'author') || str_contains($text, 'comprehension')) return 'Reading Comprehension & Interpretation';
            return 'Grammar, Concord & Sentence Structure';
        }

        if (str_contains($s, 'physic')) {
            if (str_contains($text, 'velocity') || str_contains($text, 'acceleration') || str_contains($text, 'force') || str_contains($text, 'momentum')) return 'Kinematics & Dynamics';
            if (str_contains($text, 'electric') || str_contains($text, 'resistor') || str_contains($text, 'current') || str_contains($text, 'voltage') || str_contains($text, 'capacit')) return 'Electricity & Magnetism';
            if (str_contains($text, 'wave') || str_contains($text, 'sound') || str_contains($text, 'optics') || str_contains($text, 'refract') || str_contains($text, 'lens')) return 'Waves, Light & Optics';
            if (str_contains($text, 'heat') || str_contains($text, 'temperature') || str_contains($text, 'thermal') || str_contains($text, 'gas law')) return 'Thermal Physics & Thermodynamics';
            if (str_contains($text, 'radioactiv') || str_contains($text, 'nuclear') || str_contains($text, 'atom') || str_contains($text, 'half-life')) return 'Atomic & Nuclear Physics';
            return 'General Mechanics & Measurements';
        }

        if (str_contains($s, 'chem')) {
            if (str_contains($text, 'periodic') || str_contains($text, 'atomic') || str_contains($text, 'electron') || str_contains($text, 'orbital')) return 'Atomic Structure & Periodic Table';
            if (str_contains($text, 'organic') || str_contains($text, 'alkane') || str_contains($text, 'alkene') || str_contains($text, 'alcohol') || str_contains($text, 'ester')) return 'Organic Chemistry & Hydrocarbons';
            if (str_contains($text, 'acid') || str_contains($text, 'base') || str_contains($text, 'ph') || str_contains($text, 'titration') || str_contains($text, 'salt')) return 'Acids, Bases, Salts & Titration';
            if (str_contains($text, 'redox') || str_contains($text, 'electrolysis') || str_contains($text, 'anode') || str_contains($text, 'cathode')) return 'Electrochemistry & Redox Reactions';
            return 'Chemical Bonding & Stoichiometry';
        }

        if (str_contains($s, 'bio')) {
            if (str_contains($text, 'cell') || str_contains($text, 'mitosis') || str_contains($text, 'meiosis') || str_contains($text, 'membrane')) return 'Cell Biology & Cell Division';
            if (str_contains($text, 'gene') || str_contains($text, 'heredity') || str_contains($text, 'chromosome') || str_contains($text, 'dna') || str_contains($text, 'allele')) return 'Genetics & Heredity';
            if (str_contains($text, 'photosynthesis') || str_contains($text, 'plant') || str_contains($text, 'xylem') || str_contains($text, 'phloem') || str_contains($text, 'transpiration')) return 'Plant Physiology & Photosynthesis';
            if (str_contains($text, 'ecosystem') || str_contains($text, 'food chain') || str_contains($text, 'habitat') || str_contains($text, 'ecology')) return 'Ecology & Environmental Biology';
            if (str_contains($text, 'heart') || str_contains($text, 'blood') || str_contains($text, 'circulat') || str_contains($text, 'digest') || str_contains($text, 'hormone')) return 'Human Biology & Organ Systems';
            return 'Classification & Diversity of Living Organisms';
        }

        if (str_contains($s, 'econ')) {
            if (str_contains($text, 'demand') || str_contains($text, 'supply') || str_contains($text, 'elasticity') || str_contains($text, 'price')) return 'Demand, Supply & Price Mechanism';
            if (str_contains($text, 'inflation') || str_contains($text, 'gdp') || str_contains($text, 'national income') || str_contains($text, 'fiscal') || str_contains($text, 'monetary')) return 'Macroeconomics: National Income & Fiscal Policy';
            if (str_contains($text, 'market') || str_contains($text, 'monopoly') || str_contains($text, 'oligopoly') || str_contains($text, 'competition')) return 'Market Structures & Theory of the Firm';
            if (str_contains($text, 'bank') || str_contains($text, 'money') || str_contains($text, 'interest rate') || str_contains($text, 'cbn')) return 'Money, Banking & Financial Institutions';
            return 'Fundamental Principles of Economics';
        }

        return null;
    }
}
