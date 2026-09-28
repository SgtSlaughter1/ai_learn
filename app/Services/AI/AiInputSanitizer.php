<?php

namespace App\Services\AI;

/**
 * Centralized input sanitization for AI chat endpoints.
 *
 * Threat model:
 *  - SQL injection:          the AI layer never executes SQL from user text, but
 *                            dangerous payloads are stripped early (defense in depth)
 *                            so they can't leak into logs, prompts, or LIKE patterns.
 *  - Prompt injection:       instructions disguised as user text ("ignore your rules",
 *                            "dump the students table") are neutralized before the
 *                            message reaches the model.
 *  - XSS via AI output:      user text echoed back in Markdown responses is stripped
 *                            of HTML/script content.
 *  - Resource abuse:         oversized payloads and runaway histories are rejected.
 *
 * The AI chat is strictly READ-ONLY: it must never write to the database, and user
 * input must never be able to steer it into data-modifying behavior.
 */
class AiInputSanitizer
{
    /** Hard cap on a single chat message (characters). */
    public const MAX_MESSAGE_LENGTH = 2000;

    /** Max conversation turns (user+model pairs) accepted from the client. */
    public const MAX_HISTORY_TURNS = 20;

    /** Max characters per history message. */
    public const MAX_HISTORY_MESSAGE_LENGTH = 2000;

    /**
     * Prompt-injection patterns (case-insensitive, tolerant of separator games).
     * These are phrases whose only purpose is to override the assistant's rules.
     */
    protected array $injectionPatterns = [
        '/ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system|developer|your)\s+(instructions?|prompts?|rules?|guidelines?)/i',
        '/disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|system|your)\s+(instructions?|prompts?|rules?|guidelines?)/i',
        '/forget\s+(all\s+|any\s+|the\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|context)/i',
        '/you\s+are\s+now\s+(a|an|the)\s+/i',
        '/act\s+as\s+(a|an|the)\s+(?!student|learner|tutor)/i',
        '/pretend\s+(you\s+are|to\s+be)\s+(a|an|the)\s+/i',
        '/new\s+(system\s+)?(instructions?|prompt|rules?)\s*[:\-]/i',
        '/system\s*(prompt|message)\s*[:\-]/i',
        '/reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i',
        '/(show|print|repeat|output|display)\s+(me\s+)?(your|the)\s+(initial\s+|original\s+|system\s+)?(prompt|instructions?|rules?)/i',
        '/developer\s+mode\s*[:\-]?\s*(on|enabled|activated)/i',
        '/\bDAN\s+mode\b/i',
        '/jailbreak\b/i',
    ];

    /**
     * SQL / data-layer attack patterns. The chat cannot run SQL, but stripping
     * these early keeps payloads out of prompts, logs and LIKE clauses.
     */
    protected array $sqlPatterns = [
        '/(\bUNION\b[\s\S]{0,40}?\bSELECT\b)/i',
        '/(\bDROP\s+(TABLE|DATABASE|INDEX|VIEW)\s+(IF\s+EXISTS\s+)?[\w\.`]+)/i',
        '/(\bDELETE\s+FROM\s+[\w\.`]+)/i',
        '/(\bINSERT\s+INTO\s+[\w\.`]+)/i',
        '/(\bUPDATE\s+[\w\.`]+\s+SET\b)/i',
        '/(\bALTER\s+TABLE\s+[\w\.`]+)/i',
        '/(\bTRUNCATE\s+(TABLE\s+)?[\w\.`]+)/i',
        '/(\bCREATE\s+(TABLE|DATABASE|USER|INDEX|VIEW)\s+[\w\.`]+)/i',
        '/(\bGRANT\b[\s\S]{0,30}?\b(TO|ON)\b)/i',
        '/(\bEXEC(UTE)?\s*\()/i',
        '/(\b xp_\w+ \b)/i',
        '/(\'\s*(OR|AND)\s+[\'"]?\w+[\'"]?\s*=\s*[\'"]?\w+)/i', // ' OR 1=1
        '/(\bOR\b\s+1\s*=\s*1\b)/i',
        '/(\bSLEEP\s*\()/i',
        '/(\bBENCHMARK\s*\()/i',
        '/(\bLOAD_FILE\s*\()/i',
        '/(\bINTO\s+(OUTFILE|DUMPFILE)\b)/i',
        '/(--\s*$|\/\*|\*\/)/m', // SQL comment markers
    ];

    /**
     * HTML/script payloads that must never pass into prompts or be echoed in
     * Markdown-rendered AI responses (XSS defense).
     */
    protected array $xssPatterns = [
        '/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/i',
        '/<\s*\/?\s*(iframe|object|embed|link|meta|form|input|button|svg|img|video|audio|style)\b[^>]*>/i',
        '/\bon\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', // inline JS event handlers
        '/javascript\s*:/i',
        '/data\s*:\s*text\/html/i',
        '/vbscript\s*:/i',
    ];

    /**
     * Sanitize a chat message. Returns a clean string safe to embed in prompts
     * or echo in Markdown output. May return an empty string if the payload is
     * purely malicious — callers should treat that as "nothing useful to ask".
     */
    public function sanitizeMessage(string $message): string
    {
        // 1. Normalize and cap length
        $text = mb_substr(trim($message), 0, self::MAX_MESSAGE_LENGTH);

        // 2. Neutralize control characters (except newline & tab)
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';

        // 3. Strip HTML/script payloads
        $text = $this->stripPatterns($text, $this->xssPatterns);

        // 4. Strip SQL attack payloads
        $text = $this->stripPatterns($text, $this->sqlPatterns);

        // 5. Strip prompt-injection instructions
        $text = $this->stripPatterns($text, $this->injectionPatterns);

        // 6. Collapse whitespace runs left behind by removals
        $text = preg_replace('/[ \t]{2,}/', ' ', $text) ?? '';
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? '';

        $text = trim($text);

        // 7. Reject payloads left with no meaningful content (e.g. "'; ;" after
        //    stripping "DROP TABLE users"). Messages must retain at least one
        //    letter or digit to be worth sending to the model.
        if (preg_match('/[\p{L}\p{N}]/u', $text) !== 1) {
            return '';
        }

        return $text;
    }

    /**
     * Sanitize the client-supplied conversation history: only whitelisted roles
     * and structure survive, each entry is length-capped and sanitized.
     *
     * @return array<int, array{role: string, content: string}>
     */
    public function sanitizeHistory(array $history): array
    {
        $clean = [];

        foreach ($history as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $role = strtolower(trim((string) ($entry['role'] ?? '')));
            if (! in_array($role, ['user', 'model', 'assistant'], true)) {
                continue; // Drop unknown/spoofed roles (e.g. someone injecting "system")
            }

            $content = $this->sanitizeMessage((string) ($entry['content'] ?? ''));
            if ($content === '') {
                continue;
            }

            $clean[] = [
                'role' => $role === 'assistant' ? 'model' : $role,
                'content' => $content,
            ];

            if (count($clean) >= self::MAX_HISTORY_TURNS) {
                break;
            }
        }

        return $clean;
    }

    /**
     * Lightweight risk scoring for logging/rate-limiting decisions.
     * Does NOT block by itself — sanitization already removed the payload.
     */
    public function riskScore(string $message): int
    {
        $score = 0;
        foreach ([$this->sqlPatterns, $this->xssPatterns, $this->injectionPatterns] as $group) {
            foreach ($group as $pattern) {
                if (@preg_match($pattern, $message)) {
                    $score++;
                }
            }
        }

        return $score;
    }

    protected function stripPatterns(string $text, array $patterns): string
    {
        foreach ($patterns as $pattern) {
            $text = @preg_replace($pattern, ' ', $text) ?? $text;
        }

        return $text;
    }
}
