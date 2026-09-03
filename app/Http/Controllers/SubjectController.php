<?php

namespace App\Http\Controllers;

use App\Models\ClassModel;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(Request $request): JsonResponse
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
            ->select(['id', 'name', 'slug', 'description', 'status', 'sort_order'])
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
}
