<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SpacedRepetitionItemResource extends JsonResource
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
            'item_type' => $this->item_type,
            'question_id' => $this->question_id,
            'past_question_id' => $this->past_question_id,
            'subject_id' => $this->subject_id,
            'topic_id' => $this->topic_id,
            'repetition_level' => (int) $this->repetition_level,
            'ease_factor' => (float) $this->ease_factor,
            'interval_days' => (int) $this->interval_days,
            'consecutive_correct' => (int) $this->consecutive_correct,
            'total_reviews' => (int) $this->total_reviews,
            'total_mistakes' => (int) $this->total_mistakes,
            'last_reviewed_at' => $this->last_reviewed_at?->toIso8601String(),
            'next_review_at' => $this->next_review_at?->toIso8601String(),
            'last_result' => $this->last_result,
            'reason_tag' => $this->reason_tag,
            'status' => $this->status,
            'question' => new QuestionResource($this->whenLoaded('question')),
        ];
    }
}
