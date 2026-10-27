<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureIdempotentRequest;
use App\Http\Requests\Sync\SyncBatchRequest;
use App\Http\Requests\Sync\SyncGamificationRequest;
use App\Http\Requests\Sync\SyncProgressRequest;
use App\Models\LearnerProgress;
use App\Services\Gamification\GamificationService;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Auth\Middleware\Authorize;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Pipeline;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class SyncController extends Controller
{
    public function __construct(private GamificationService $gamification) {}

    /**
     * Lightweight check the sync engine calls before draining its queue: says which user
     * owns the session (null when signed out) so the device never uploads another user's
     * offline work, and refreshes the XSRF cookie.
     */
    public function session(): JsonResponse
    {
        return response()->json(['user_id' => auth()->id()]);
    }

    /**
     * Retired as a write: topic progress is added on the server when each graded attempt syncs
     * (LearnerProgress::recordResults), so the device's totals are only a display cache. Writing
     * them double-counted honest devices and let a crafted request set any mastery. Kept so older
     * app versions stop retrying; returns the server's figures for that topic.
     */
    public function syncProgress(SyncProgressRequest $request): JsonResponse
    {
        $progress = LearnerProgress::where('user_id', auth()->id())
            ->where('topic_id', $request->validated('topic_id'))
            ->first(['topic_id', 'questions_attempted', 'questions_correct', 'mastery_score', 'ability_score']);

        return response()->json(['success' => true, 'progress' => $progress]);
    }

    /**
     * Retired: the client used to push an absolute XP total here, which double-counted XP
     * already awarded by quiz sync and let a device overwrite the server's figure.
     * XP is now only awarded by the server for graded events. Kept as a no-op so older
     * cached app versions stop retrying, and returns the authoritative server state.
     */
    public function syncGamification(SyncGamificationRequest $request): JsonResponse
    {
        $profile = $this->gamification->getProfile(auth()->user());

        return response()->json([
            'success' => true,
            'total_xp' => $profile->total_xp,
            'level' => $profile->level,
            'tier' => $profile->tier,
            'current_streak' => $profile->current_streak,
            'longest_streak' => $profile->longest_streak,
        ]);
    }

    /**
     * Endpoints the offline sync queue writes to, and therefore the only ones a batch
     * may contain.
     */
    private const BATCH_TIME_BUDGET_SECONDS = 8;

    private const BATCHABLE_PATHS = [
        '#^/api/v1/quizzes/attempts/[A-Za-z0-9-]+/sync$#',
        '#^/api/v1/progress/sync$#',
        '#^/api/v1/revision/(submit|complete-session)$#',
        '#^/api/v1/flashcards/complete$#',
        '#^/api/v1/past-questions/simulation/submit$#',
        '#^/api/v1/admin/(learners|teachers|classes|subjects|topics|questions|schools|school-admins)(/[A-Za-z0-9-]+)?$#',
        '#^/api/v1/admin/questions/bulk$#',
        '#^/api/v1/admin/question-contexts/\d+(/order)?$#',
        '#^/api/v1/admin/(users|schools)/[A-Za-z0-9_-]+/status$#',
        '#^/api/v1/admin/classes/\d+/(enroll|learners/[A-Za-z0-9-]+)$#',
        '#^/api/v1/teacher/(learners|interventions/assign|classes/\d+/enroll)$#',
    ];

    /**
     * Apply several queued changes in one request. Each item runs through its normal
     * route (validation, policies, idempotency key) exactly as if sent on its own, in
     * order. Processing stops at the first change that should be retried later, so a
     * later change never overtakes an earlier one; those that follow are "skipped".
     */
    public function batch(SyncBatchRequest $request): JsonResponse
    {
        $results = [];
        $halted = false;
        $started = microtime(true);

        foreach ($request->validated('items') as $item) {
            if ($halted) {
                $results[] = ['key' => $item['key'], 'status' => null, 'skipped' => true, 'reason' => 'halted'];

                continue;
            }
            // Keep every request short (well under proxy timeouts) and let devices take turns
            // under load: the device sends the rest straight away in its next batch.
            if (microtime(true) - $started > self::BATCH_TIME_BUDGET_SECONDS) {
                $results[] = ['key' => $item['key'], 'status' => null, 'skipped' => true, 'reason' => 'time_budget'];

                continue;
            }

            if (! collect(self::BATCHABLE_PATHS)->contains(fn ($pattern) => preg_match($pattern, $item['path']))) {
                $results[] = ['key' => $item['key'], 'status' => 422, 'body' => [
                    'message' => 'This change cannot be sent in a batch.',
                    'code' => 'not_batchable',
                ]];

                continue;
            }

            $response = $this->dispatchItem($request, $item);
            $status = $response->getStatusCode();
            $body = json_decode($response->getContent() ?: 'null', true);
            $results[] = ['key' => $item['key'], 'status' => $status, 'body' => $body];

            $retryLater = in_array($status, [401, 419, 429], true)
                || $status >= 500
                || ($status === 409 && ($body['code'] ?? null) === 'request_in_progress');
            if ($retryLater) {
                $halted = true;
            }
        }

        return response()->json(['results' => $results]);
    }

    /**
     * Middleware an item runs through: binding, sign-in, permission gates and the
     * idempotency key. Session, cookie, CSRF, Inertia and rate-limit middleware already
     * ran once for the batch request itself, so items share that work instead of
     * repeating it 25 times.
     */
    private const ITEM_MIDDLEWARE = [
        SubstituteBindings::class,
        Authenticate::class,
        Authorize::class,
        EnsureIdempotentRequest::class,
    ];

    /** Run one item through its route, as the batch's signed-in user. */
    private function dispatchItem(Request $parent, array $item): SymfonyResponse
    {
        $sub = Request::create($item['path'], $item['method'], [], [], [], $parent->server->all(), json_encode($item['body'] ?? new \stdClass));
        $sub->headers->add([
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'X-Requested-With' => 'XMLHttpRequest',
            'Idempotency-Key' => $item['key'],
        ]);
        $sub->setUserResolver($parent->getUserResolver());
        $sub->setLaravelSession($parent->session());

        $router = app('router');
        $previous = app('request');
        app()->instance('request', $sub);

        try {
            $route = $router->getRoutes()->match($sub);
            $sub->setRouteResolver(fn () => $route);

            $middleware = array_filter(
                $router->gatherRouteMiddleware($route),
                fn (string $m) => in_array(strtok($m, ':'), self::ITEM_MIDDLEWARE, true)
            );

            return (new Pipeline(app()))
                ->send($sub)
                ->through($middleware)
                ->then(fn (Request $request) => $router->prepareResponse($request, $route->run()));
        } catch (\Throwable $e) {
            // e.g. no route for the path: report it as this item's result.
            $handler = app(ExceptionHandler::class);
            $handler->report($e);

            return $handler->render($sub, $e);
        } finally {
            app()->instance('request', $previous);
        }
    }
}
