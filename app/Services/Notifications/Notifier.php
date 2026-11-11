<?php

namespace App\Services\Notifications;

use App\Enums\UserRole;
use App\Models\AiExplanation;
use App\Models\PastQuestion;
use App\Models\Question;
use App\Models\School;
use App\Models\Topic;
use App\Models\User;
use App\Notifications\AppNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Who hears about what. Each event writes its notifications once, when it happens, so
 * checking for new ones is a single count and nothing has to be worked out on every check.
 */
class Notifier
{
    /** A learner reported an AI explanation: the staff who manage the question are told. */
    public function explanationReported(AiExplanation $explanation): void
    {
        $question = $explanation->sourceQuestion();
        if ($question === null) {
            return;
        }
        $key = "explanation:{$explanation->id}";
        $count = $explanation->open_reports;
        $hidden = $explanation->isHidden();
        $title = $count === 1 ? 'A learner reported an AI explanation' : "{$count} learners reported an AI explanation";
        $body = '“'.$this->snippet($question->question_text).'”'
            .($hidden ? ' It is hidden from learners until someone checks it.' : ' Approve, correct or hide it.');

        foreach ($this->managersOf($question) as $user) {
            $this->upsert($user, new AppNotification(
                AppNotification::KIND_EXPLANATION_REPORTED,
                $key,
                $title,
                $body,
                $this->questionBankUrl($user),
                'An AI explanation was reported',
                'Open the Question Bank to check it.',
            ));
        }
    }

    /**
     * Someone reviewed a reported explanation: their alerts about it are cleared, and the
     * other staff who manage the question (the class teacher, when an admin did it) are told.
     */
    public function explanationReviewed(AiExplanation $explanation, User $reviewer): void
    {
        $key = "explanation:{$explanation->id}";
        $this->clear($key, AppNotification::KIND_EXPLANATION_REPORTED);

        $question = $explanation->sourceQuestion();
        if ($question === null) {
            return;
        }
        $done = match ($explanation->review_status) {
            AiExplanation::STATUS_APPROVED => 'approved',
            AiExplanation::STATUS_CORRECTED => 'corrected',
            default => 'hid',
        };
        $who = $reviewer->isTeacher() ? 'A teacher' : ($reviewer->isPlatformAdmin() ? 'A platform admin' : 'Your school admin');

        foreach ($this->managersOf($question)->reject(fn (User $u) => $u->is($reviewer)) as $user) {
            $this->upsert($user, new AppNotification(
                AppNotification::KIND_EXPLANATION_REVIEWED,
                $key,
                "{$who} {$done} an AI explanation",
                '“'.$this->snippet($question->question_text).'”'.($done === 'hid' ? ' Learners now get the offline explanation.' : ' Learners now see it as checked.'),
                $this->questionBankUrl($user),
                'An AI explanation was checked',
                'Open AceDrill to see it.',
            ));
        }
    }

    /** A teacher sent a learner targeted practice. */
    public function practiceAssigned(User $learner, Topic $topic, int $count): void
    {
        $learner->notify(new AppNotification(
            AppNotification::KIND_PRACTICE_ASSIGNED,
            "practice:{$topic->id}:".Str::lower(Str::random(6)),
            'Your teacher sent you practice',
            "{$count} questions in {$topic->name} are waiting in your daily review.",
            '/dashboard#daily-review',
            'New practice from your teacher',
            'Open AceDrill to start.',
        ));
    }

    /** The staff who can edit the question: its school's admin and the teachers of its class, or platform admins for shared and past questions. */
    public function managersOf(Question|PastQuestion $question): Collection
    {
        $schoolId = $question instanceof Question ? $question->topic?->subject?->school_id : null;
        if ($schoolId === null) {
            return User::where('role', UserRole::PLATFORM_ADMIN)->get();
        }

        return User::query()
            ->where(fn ($q) => $q->whereIn('id', School::whereKey($schoolId)->whereNotNull('admin_user_id')->select('admin_user_id'))
                ->orWhereHas('teacherProfile', fn ($t) => $t->where('school_id', $schoolId)))
            ->get()
            ->filter(fn (User $user) => $user->can('update', $question))
            ->values();
    }

    /** An unread notification about the same thing is brought up to date instead of repeated. */
    private function upsert(User $user, AppNotification $notification): void
    {
        $existing = $user->unreadNotifications()
            ->where('data->key', $notification->key)
            ->where('data->kind', $notification->kind)
            ->first();
        if ($existing) {
            $existing->forceFill(['data' => $notification->toArray($user), 'created_at' => now(), 'updated_at' => now()])->save();

            return;
        }
        $user->notify($notification);
    }

    private function clear(string $key, string $kind): void
    {
        DatabaseNotification::whereNull('read_at')
            ->where('data->key', $key)
            ->where('data->kind', $kind)
            ->update(['read_at' => now()]);
    }

    private function questionBankUrl(User $user): string
    {
        return match (true) {
            $user->isTeacher() => '/teacher/dashboard?tab=questions',
            $user->isPlatformAdmin() => '/super-admin/dashboard?tab=questions',
            default => '/admin/dashboard?tab=questions',
        };
    }

    private function snippet(string $text): string
    {
        // Plain text: no HTML, and maths without its $ … $ markers.
        return Str::limit(trim(preg_replace('/\s+/', ' ', str_replace('$', '', strip_tags($text)))), 80);
    }
}
