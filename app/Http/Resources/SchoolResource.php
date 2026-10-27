<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SchoolResource extends JsonResource
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
            'name' => $this->name,
            'slug' => $this->slug,
            'code' => $this->code,
            'category_ids' => $this->category_ids ?? [],
            'allowed_grade_levels' => $this->allowed_grade_levels,
            'address' => $this->address,
            'city' => $this->city,
            'state' => $this->state,
            'is_active' => (bool) $this->is_active,
        ];
    }
}
