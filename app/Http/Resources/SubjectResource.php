<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubjectResource extends JsonResource
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
            'code' => $this->code,
            'slug' => $this->slug,
            'category' => $this->category,
            'description' => $this->description,
            'icon' => $this->icon,
            'status' => $this->status,
            'topics_count' => $this->whenCounted('topics'),
            'topics' => TopicResource::collection($this->whenLoaded('topics')),
        ];
    }
}
