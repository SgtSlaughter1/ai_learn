<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Lang;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $token
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = url(route('password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], false));

        $name = trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? ''));
        if (empty($name)) {
            $name = $notifiable->name ?? 'Learner';
        }

        $expireMinutes = config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject(Lang::get('Reset Your Password — AILEARN'))
            ->view('emails.reset-password', [
                'name' => $name,
                'resetUrl' => $resetUrl,
                'expireMinutes' => $expireMinutes,
            ]);
    }
}
