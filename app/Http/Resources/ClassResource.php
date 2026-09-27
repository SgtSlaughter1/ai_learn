<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'school_id' => $this->school_id,
            'program_id' => $this->program_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'grade_level' => $this->grade_level,
            'arm' => $this->arm,
            'section' => $this->section,
            'description' => $this->description,
            'is_active' => (bool) $this->is_active,
            'school' => new SchoolResource($this->whenLoaded('school')),
            'learner_count' => $this->when(isset($this->learner_count), $this->learner_count),
        ];
    }
}
