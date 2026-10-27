<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'aloc' => [
        'api_key' => env('ALOC_API_KEY'),
        'api_url' => env('ALOC_API_URL', 'https://dev.aloc.com.ng/api/v1'),
    ],

    // Read through config so the keys still work after `php artisan config:cache`.
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY') ?: env('AI_API_KEY'),
        'model' => env('MODEL_NAME', 'gemini-3.1-flash-lite'),
        'fallback_model' => env('GEMINI_FALLBACK_MODEL', 'gemini-flash-lite-latest'),
    ],

    // Groq (OpenAI-compatible API). The fallback model has its own rate limits, so it
    // doubles the free daily capacity; Gemini comes after both.
    'groq' => [
        'api_key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
        'fallback_model' => env('GROQ_FALLBACK_MODEL', 'openai/gpt-oss-20b'),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    ],

    // groq | gemini | local. Unset: Groq when its key is set, else Gemini, else local.
    'ai' => [
        'provider' => env('AI_PROVIDER'),
        // Seconds one AI request may spend across every provider and model before the offline
        // answer is used. Keep it well under PHP's max_execution_time (often 30 s on shared hosts).
        'time_budget' => (int) env('AI_TIME_BUDGET', 20),
    ],

];
