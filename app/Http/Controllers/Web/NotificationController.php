<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/** The bell: a person's own notifications, the unread count, and marking them read. */
class NotificationController extends Controller
{
    private const LIST_LIMIT = 30;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $user->notifications()->latest()->limit(self::LIST_LIMIT)->get()->map(fn (DatabaseNotification $n) => [
            'id' => $n->id,
            'kind' => $n->data['kind'] ?? null,
            'title' => $n->data['title'] ?? '',
            'body' => $n->data['body'] ?? '',
            'url' => $n->data['url'] ?? '/dashboard',
            'read' => $n->read_at !== null,
            'at' => $n->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $items] + self::summary($user));
    }

    /** Checked now and then while the app is open; one count and one row, so it stays cheap. */
    public function summaryJson(Request $request): JsonResponse
    {
        return response()->json(self::summary($request->user()));
    }

    public function read(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['nullable', 'array', 'max:100'],
            'ids.*' => ['uuid'],
        ]);
        $query = $request->user()->unreadNotifications();
        if (! empty($validated['ids'])) {
            $query->whereIn('id', $validated['ids']);
        }
        $query->update(['read_at' => now()]);

        return response()->json(self::summary($request->user()));
    }

    /**
     * Unread count, reported explanations still to check (the Question Bank badge), and the newest
     * unread one for a pop-up: its general pop-up text only, never names or scores.
     *
     * @return array{unread: int, reviews: int, latest: array<string, string|null>|null}
     */
    public static function summary(User $user): array
    {
        $unread = $user->unreadNotifications();
        $latest = (clone $unread)->latest()->first();

        return [
            'unread' => (clone $unread)->count(),
            'reviews' => $user->isLearner() ? 0 : (clone $unread)->where('data->kind', AppNotification::KIND_EXPLANATION_REPORTED)->count(),
            'latest' => $latest ? [
                'id' => $latest->id,
                'at' => $latest->created_at?->toIso8601String(),
                'title' => $latest->data['popup_title'] ?? 'New notification',
                'body' => $latest->data['popup_body'] ?? 'Open AceDrill to see it.',
                'url' => $latest->data['url'] ?? '/dashboard',
            ] : null,
        ];
    }
}
