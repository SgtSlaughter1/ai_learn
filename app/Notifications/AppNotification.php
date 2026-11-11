<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * One in-app notification, listed under the bell. Sent straight away (not queued: the host
 * runs no queue worker). The pop-up text is kept general, because a phone can be shared:
 * it never names a learner or shows a score.
 */
class AppNotification extends Notification
{
    public const KIND_EXPLANATION_REPORTED = 'explanation_reported';

    public const KIND_EXPLANATION_REVIEWED = 'explanation_reviewed';

    public const KIND_PRACTICE_ASSIGNED = 'practice_assigned';

    /**
     * @param  string  $key  What it is about (e.g. "explanation:12"), so a later event updates
     *                       or clears it instead of adding another.
     */
    public function __construct(
        public string $kind,
        public string $key,
        public string $title,
        public string $body,
        public string $url,
        public string $popupTitle,
        public string $popupBody,
        public array $meta = [],
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'key' => $this->key,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'popup_title' => $this->popupTitle,
            'popup_body' => $this->popupBody,
        ] + $this->meta;
    }
}
