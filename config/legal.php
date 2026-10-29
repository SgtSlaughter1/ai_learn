<?php

return [

    // The version of the Terms of Use and Privacy Policy. Change it when either changes in a way
    // that matters: everyone is then asked to agree again at their next sign-in.
    'version' => env('LEGAL_VERSION', '2026-11-01'),

    // The version of the parental consent form schools send home.
    'consent_form_version' => env('LEGAL_CONSENT_FORM_VERSION', '2026-11-01'),

    // Who the documents name as "we", e.g. "AceDrill Ltd (RC 1234567)", and where people write
    // about their data. The address must be a mailbox someone reads.
    'company' => env('LEGAL_COMPANY', 'AceDrill'),
    'contact_email' => env('LEGAL_CONTACT_EMAIL') ?: 'privacy@'.(parse_url((string) env('APP_URL'), PHP_URL_HOST) ?: 'localhost'),

    // Shows a notice on the Terms, Privacy and agree pages that the documents are still being
    // reviewed. Switch it off once a lawyer has approved them.
    'in_review' => (bool) env('LEGAL_IN_REVIEW', true),

    // Ask everyone to agree before using the app. Off until the documents have had legal review;
    // the pages and records work either way.
    'require_acceptance' => (bool) env('LEGAL_REQUIRE_ACCEPTANCE', false),

];
