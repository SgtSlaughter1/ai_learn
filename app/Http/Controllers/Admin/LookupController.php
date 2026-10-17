<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Program;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LookupController extends Controller
{
    public function categories(Request $request): JsonResponse
    {

        $categories = Category::orderBy('id')->get()->values()->all();

        return response()->json([
            'categories' => $categories,
            'data' => $categories,
        ]);
    }

    public function programs(Request $request): JsonResponse
    {

        $programs = Program::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'slug', 'description'])
            ->values()
            ->all();

        return response()->json(['programs' => $programs, 'data' => $programs]);
    }
}
