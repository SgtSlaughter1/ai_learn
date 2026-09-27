<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LearnerProgressResource extends JsonResource
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
            'user_id' => $this->user_id,
            'topic_id' => $this->topic_id,
            'questions_attempted' => (int) $this->questions_attempted,
            'questions_correct' => (int) $this->questions_correct,
            'mastery_score' => (int) $this->mastery_score,
            'ability_score' => (int) $this->ability_score,
            'last_attempted_at' => $this->last_attempted_at?->toIso8601String(),
            'topic' => new TopicResource($this->whenLoaded('topic')),
        ];
    }
}
