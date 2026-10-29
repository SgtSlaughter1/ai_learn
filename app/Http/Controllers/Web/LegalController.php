<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureTermsAccepted;
use App\Models\Consent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Terms of Use and Privacy Policy (public), the agree screen, and a person's own choice about
 * AI improvement. The text lives in resources/legal so it can change without code changes.
 */
class LegalController extends Controller
{
    public function terms(): Response
    {
        return $this->document('Terms of Use', 'terms');
    }

    public function privacy(): Response
    {
        return $this->document('Privacy Policy', 'privacy');
    }

    /** The agree screen: staff and adults agree; learners read the short summary and continue. */
    public function consent(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user->hasAcceptedCurrentTerms()) {
            return redirect()->intended('/dashboard');
        }

        $schoolLearner = ! $user->givesOwnConsent();

        return Inertia::render('Legal/Consent', [
            'version' => Consent::currentVersion(Consent::TERMS),
            'isLearner' => $schoolLearner,
            'summary' => $schoolLearner ? $this->markdown('learner-summary') : null,
            'returning' => Consent::latestFor($user, Consent::TERMS) !== null,
            'inReview' => (bool) config('legal.in_review'),
        ]);
    }

    public function accept(Request $request): RedirectResponse
    {
        $user = $request->user();
        if (! $user->hasAcceptedCurrentTerms()) {
            Consent::record($user, Consent::TERMS, true, Consent::SOURCE_SELF);
        }
        EnsureTermsAccepted::remember($request);

        return redirect()->intended('/dashboard');
    }

    /** A person's own AI-improvement choice. A school learner's comes from their parent's form, via the school. */
    public function updateAiTraining(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->givesOwnConsent(), 403, 'Your school records this from your parent or guardian\'s consent form.');
        $allowed = $request->validate(['allowed' => ['required', 'boolean']])['allowed'];

        if ($user->allowsAiTraining() !== $allowed) {
            Consent::record($user, Consent::AI_TRAINING, $allowed, Consent::SOURCE_SELF);
        }

        return response()->json(['allowed' => $allowed]);
    }

    private function document(string $title, string $name): Response
    {
        return Inertia::render('Legal/Document', [
            'title' => $title,
            'version' => Consent::currentVersion(Consent::TERMS),
            'markdown' => $this->markdown($name),
            'inReview' => (bool) config('legal.in_review'),
        ]);
    }

    private function markdown(string $name): string
    {
        $path = resource_path("legal/{$name}.md");
        abort_unless(is_file($path), 404);

        return strtr((string) file_get_contents($path), [
            '{company}' => config('legal.company'),
            '{email}' => config('legal.contact_email'),
        ]);
    }
}
