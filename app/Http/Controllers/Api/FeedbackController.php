<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FeedbackController extends Controller
{
    /**
     * Store incoming feedback from public visitor or authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:120',
            'email' => 'nullable|email|max:120',
            'role' => 'nullable|string|max:50',
            'category' => 'nullable|string|in:general_feedback,bug_report,feature_request,school_pilot,curriculum_inquiry,content_correction',
            'rating' => 'nullable|integer|between:1,5',
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|min:3|max:5000',
            'meta' => 'nullable|array',
        ]);

        $user = Auth::guard('sanctum')->user() ?? Auth::user();

        $feedback = Feedback::create([
            'user_id' => $user ? $user->id : null,
            'name' => $validated['name'] ?? ($user ? $user->name : null),
            'email' => $validated['email'] ?? ($user ? $user->email : null),
            'role' => $validated['role'] ?? ($user ? ($user->role ?? 'learner') : 'visitor'),
            'category' => $validated['category'] ?? 'general_feedback',
            'rating' => $validated['rating'] ?? null,
            'subject' => $validated['subject'] ?? null,
            'message' => $validated['message'],
            'status' => 'new',
            'meta' => array_merge($validated['meta'] ?? [], [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'submitted_at' => now()->toIso8601String(),
            ]),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Thank you! Your feedback has been received.',
            'data' => $feedback,
        ], 201);
    }

    /**
     * Admin: List all submitted feedbacks with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Feedback::with('user:id,name,email,role')
            ->latest();

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhere('message', 'like', "%{$search}%");
            });
        }

        $feedbacks = $query->paginate($request->integer('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $feedbacks,
        ]);
    }

    /**
     * Admin: Update feedback status (reviewed, resolved, new).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:new,reviewed,resolved',
        ]);

        $feedback = Feedback::findOrFail($id);
        $feedback->update(['status' => $validated['status']]);

        return response()->json([
            'status' => 'success',
            'message' => 'Feedback status updated successfully.',
            'data' => $feedback,
        ]);
    }
}
