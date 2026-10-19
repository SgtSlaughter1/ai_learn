<?php

namespace App\Support;

/**
 * Lets a learner's device grade and review questions offline without storing readable
 * answers: each question carries a hash of its correct option, and its explanation is
 * encrypted with a key that can only be derived once the correct option is known (the
 * device finds it by testing each option against the hash after the learner submits).
 *
 * This stops answers being read from device storage; it is not secrecy against someone
 * testing options in DevTools. The server still re-grades every attempt it receives.
 * Mirrors resources/js/services/AnswerKey.ts.
 */
class OfflineAnswerKey
{
    /** Quiz questions and past (CBT) questions live in different tables, so their ids get a scope. */
    public const QUIZ = 'q';

    public const PAST_QUESTION = 'pq';

    public static function hash(string $scope, int $questionId, int $optionId): string
    {
        return hash('sha256', "acedrill_salt_{$scope}_{$questionId}_opt_{$optionId}");
    }

    /** base64(iv[12] + ciphertext + tag[16]) with AES-256-GCM, or null when there's nothing to seal. */
    public static function sealExplanation(string $scope, int $questionId, int $correctOptionId, ?string $explanation): ?string
    {
        if ($explanation === null || $explanation === '') {
            return null;
        }

        $key = hash('sha256', "acedrill_exp_{$scope}_{$questionId}_{$correctOptionId}", true);
        $iv = random_bytes(12);
        $ciphertext = openssl_encrypt($explanation, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

        return $ciphertext === false ? null : base64_encode($iv.$ciphertext.$tag);
    }

    /**
     * The offline fields for one question: answer_hash and explanation_sealed.
     *
     * @return array{answer_hash: ?string, explanation_sealed: ?string}
     */
    public static function forQuestion(string $scope, int $questionId, ?int $correctOptionId, ?string $explanation): array
    {
        if ($correctOptionId === null) {
            return ['answer_hash' => null, 'explanation_sealed' => null];
        }

        return [
            'answer_hash' => self::hash($scope, $questionId, $correctOptionId),
            'explanation_sealed' => self::sealExplanation($scope, $questionId, $correctOptionId, $explanation),
        ];
    }
}
