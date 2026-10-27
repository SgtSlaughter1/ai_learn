<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Recess\RecordRecessWinRequest;
use App\Services\Gamification\GamificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Recess: short game breaks a learner earns by finishing a quiz, flashcard deck or daily
 * review. The games run entirely on the device (they work offline); the server only pays
 * the small, capped XP for a win.
 */
class RecessController extends Controller
{
    public function __construct(private GamificationService $gamification) {}

    public function show(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }

        return Inertia::render('Recess/Index');
    }

    public function recordWin(RecordRecessWinRequest $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isLearner(), 403, 'Recess is for learners.');
        abort_unless($user->recessEnabled(), 403, 'Your school has switched Recess off.');

        $result = $this->gamification->processRecessWin(
            $user,
            $request->validated('game'),
            GamificationService::activityTime($request->validated('won_at')),
        );

        return response()->json($result);
    }
}
