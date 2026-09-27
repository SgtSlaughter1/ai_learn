<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TopicResource extends JsonResource
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
            'subject_id' => $this->subject_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'level' => $this->level,
            'sequence_order' => $this->sequence_order,
            'description' => $this->description,
            'learning_objectives' => $this->learning_objectives,
            'status' => $this->status,
            'questions_count' => $this->whenCounted('questions'),
            'subject' => new SubjectResource($this->whenLoaded('subject')),
        ];
    }
}
