<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Makes write requests safe to retry.
 *
 * The offline sync queue sends every write with an Idempotency-Key header and reuses
 * the same key on every retry. The first request runs normally and its response is
 * stored; any repeat with the same key replays that stored response instead of
 * writing again, so a lost response or two tabs syncing at once never duplicates rows.
 */
class EnsureIdempotentRequest
{
    private const HEADER = 'Idempotency-Key';

    // Responses that say "try again later" are not stored, so the retry runs for real.
    private const RETRYABLE_STATUSES = [401, 408, 419, 423, 429];

    // A request still marked processing after this long is assumed to have died mid-flight.
    private const STALE_PROCESSING_SECONDS = 120;

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header(self::HEADER);

        if (!$key || $request->isMethodSafe()) {
            return $next($request);
        }

        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        if (strlen($key) > 100 || !preg_match('/^[A-Za-z0-9_\-:.]+$/', $key)) {
            return response()->json([
                'message' => 'Invalid Idempotency-Key header.',
                'code' => 'invalid_idempotency_key',
            ], 400);
        }

        $requestHash = hash('sha256', $request->method() . '|' . $request->path() . '|' . $request->getContent());

        $claimed = $this->claim($user->id, $key, $requestHash);
        if ($claimed instanceof Response) {
            return $claimed;
        }

        try {
            $response = $next($request);
        } catch (Throwable $e) {
            $this->release($user->id, $key);
            throw $e;
        }

        $status = $response->getStatusCode();

        if ($status >= 500 || in_array($status, self::RETRYABLE_STATUSES, true)) {
            $this->release($user->id, $key);
            return $response;
        }

        DB::table('idempotency_keys')
            ->where('user_id', $user->id)
            ->where('idempotency_key', $key)
            ->update([
                'status' => 'completed',
                'response_status' => $status,
                'response_body' => $response->getContent() ?: null,
                'updated_at' => now(),
            ]);

        return $response;
    }

    /**
     * Reserve the key for this request. Returns a Response when the request must not run
     * (already completed, still in progress, or the key was reused for different data).
     */
    private function claim(string $userId, string $key, string $requestHash): ?Response
    {
        try {
            DB::table('idempotency_keys')->insert([
                'user_id' => $userId,
                'idempotency_key' => $key,
                'request_hash' => $requestHash,
                'status' => 'processing',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            return null;
        } catch (UniqueConstraintViolationException) {
            // Fall through: a request with this key has been seen before.
        }

        $existing = DB::table('idempotency_keys')
            ->where('user_id', $userId)
            ->where('idempotency_key', $key)
            ->first();

        if (!$existing) {
            // Released between our insert and select; let the client retry.
            return $this->inProgressResponse();
        }

        if ($existing->request_hash !== $requestHash) {
            return response()->json([
                'message' => 'This Idempotency-Key was already used for a different request.',
                'code' => 'idempotency_key_reused',
            ], 422);
        }

        if ($existing->status === 'completed') {
            return response($existing->response_body ?? '', $existing->response_status)
                ->header('Content-Type', 'application/json')
                ->header('Idempotent-Replayed', 'true');
        }

        $updatedAt = \Illuminate\Support\Carbon::parse($existing->updated_at);
        if ($updatedAt->lt(now()->subSeconds(self::STALE_PROCESSING_SECONDS))) {
            $this->release($userId, $key);
        }

        return $this->inProgressResponse();
    }

    private function release(string $userId, string $key): void
    {
        DB::table('idempotency_keys')
            ->where('user_id', $userId)
            ->where('idempotency_key', $key)
            ->where('status', 'processing')
            ->delete();
    }

    private function inProgressResponse(): Response
    {
        return response()->json([
            'message' => 'This request is already being processed. Retry shortly.',
            'code' => 'request_in_progress',
        ], 409)->header('Retry-After', '5');
    }
}
