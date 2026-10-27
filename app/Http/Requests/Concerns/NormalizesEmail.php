<?php

namespace App\Http\Requests\Concerns;

/**
 * Account emails are stored and compared in lower case, so "Ada@School.ng" signs in, resets and
 * is found the same as "ada@school.ng" whatever the database collation.
 */
trait NormalizesEmail
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }
}
