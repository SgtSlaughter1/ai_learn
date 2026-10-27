<?php

namespace App\Http\Controllers;

use App\Models\PastQuestion;
use App\Models\Subject;
use App\Support\Seo;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** The public landing page and its platform counters. */
class HomeController extends Controller
{
    /** How long the public counters are reused: they ran three counting queries on every visit. */
    private const STATS_TTL_SECONDS = 600;

    public function show(): Response
    {
        return Inertia::render('Welcome', [
            // Shared subjects only: the public page must not list schools' private subjects.
            'subjects' => Subject::where('status', 'active')
                ->whereNull('school_id')
                ->withCount('topics')
                ->orderBy('sort_order')
                ->get(['id', 'name', 'slug', 'description', 'school_id']),
            'faqs' => Seo::faqs(),
            'stats' => $this->platformStats(),
        ]);
    }

    public function stats(): JsonResponse
    {
        return response()->json($this->platformStats());
    }

    /** @return array{total_subjects: int, total_past_questions: int, exam_counts: array<string, int>} */
    private function platformStats(): array
    {
        return Cache::remember('public-stats', self::STATS_TTL_SECONDS, fn () => [
            'total_subjects' => Subject::where('status', 'active')->count(),
            'total_past_questions' => PastQuestion::count(),
            'exam_counts' => PastQuestion::select('exam_code', DB::raw('count(*) as count'))
                ->groupBy('exam_code')
                ->pluck('count', 'exam_code')
                ->map(fn ($n) => (int) $n)
                ->all(),
        ]);
    }
}
