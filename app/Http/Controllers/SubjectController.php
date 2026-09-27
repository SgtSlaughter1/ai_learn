<?php

namespace App\Http\Controllers;

use App\Models\ClassModel;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    /**
     * Get list of active subjects filtered optionally by class and grade level.
     */
    public function getSubjectsList(Request $request): JsonResponse
    {
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');
        if ($classId && !$gradeLevel) {
            $class = ClassModel::find($classId);
            if ($class && $class->grade_level) {
                $gradeLevel = $class->grade_level;
            }
        }
        $level = $gradeLevel ? strtolower($gradeLevel) : null;

        // Explicit projection selects only columns required by the client to prevent over-fetching
        $subjects = Subject::query()
            ->select(['id', 'name', 'code', 'slug', 'description', 'status', 'sort_order', 'school_id'])
            ->withCount('topics')
            ->where('status', 'active')
            ->when($level, function ($query) use ($level) {
                $query->whereHas('topics', function ($q) use ($level) {
                    $q->where('level', $level)->where('status', 'active');
                });
            })
            ->orderBy('sort_order')
            ->get();

        return response()->json($subjects);
    }

    /**
     * Backward-compatible alias for getSubjectsList.
     */
    public function index(Request $request): JsonResponse
    {
        return $this->getSubjectsList($request);
    }
}
