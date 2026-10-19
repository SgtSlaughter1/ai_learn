<?php

namespace Tests\Unit;

use App\Support\OfflineAnswerKey;
use PHPUnit\Framework\TestCase;

class OfflineAnswerKeyTest extends TestCase
{
    private function open(string $sealed, string $scope, int $questionId, int $optionId): string|false
    {
        $bytes = base64_decode($sealed);
        $key = hash('sha256', "acedrill_exp_{$scope}_{$questionId}_{$optionId}", true);

        return openssl_decrypt(substr($bytes, 12, -16), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($bytes, 0, 12), substr($bytes, -16));
    }

    public function test_the_hash_format_is_stable(): void
    {
        $this->assertSame(hash('sha256', 'acedrill_salt_q_10_opt_3'), OfflineAnswerKey::hash(OfflineAnswerKey::QUIZ, 10, 3));
        $this->assertNotSame(OfflineAnswerKey::hash('q', 10, 3), OfflineAnswerKey::hash('pq', 10, 3));
    }

    public function test_a_sealed_explanation_opens_only_with_the_correct_option(): void
    {
        $sealed = OfflineAnswerKey::sealExplanation('q', 10, 3, 'Because the answer is 42.');

        $this->assertStringNotContainsString('42', (string) base64_decode($sealed));
        $this->assertSame('Because the answer is 42.', $this->open($sealed, 'q', 10, 3));
        $this->assertFalse($this->open($sealed, 'q', 10, 4));
    }

    public function test_questions_without_a_correct_option_get_no_key(): void
    {
        $this->assertSame(['answer_hash' => null, 'explanation_sealed' => null], OfflineAnswerKey::forQuestion('q', 10, null, 'text'));
        $this->assertNull(OfflineAnswerKey::sealExplanation('q', 10, 3, null));
    }
}
