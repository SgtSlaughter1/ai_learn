<?php

namespace App\Http\Controllers;

use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(): JsonResponse
    {
        // Explicit projection selects only columns required by the client to prevent over-fetching
        $subjects = Subject::query()
            ->select(['id', 'name', 'slug', 'description', 'status', 'sort_order'])
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->get();

        return response()->json($subjects);
    }
}
