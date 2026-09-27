<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserGamificationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->user_id,
            'total_xp' => (int) $this->total_xp,
            'level' => (int) $this->level,
            'tier' => $this->tier,
            'current_streak' => (int) $this->current_streak,
            'longest_streak' => (int) $this->longest_streak,
            'last_activity_date' => $this->last_activity_date,
        ];
    }
}
