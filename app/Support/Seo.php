<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Search (SEO) and answer-engine (AEO) metadata, rendered on the server.
 *
 * The app is a client-rendered Inertia SPA, and most AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot) read raw HTML without running JavaScript. So the title, description,
 * structured data and a plain-HTML copy of each public page's key content come from here,
 * in app.blade.php, and the React page shows the same content once it loads.
 */
class Seo
{
    public const NAME = 'AceDrill';

    public const DESCRIPTION = 'Practise WAEC, JAMB and NECO past questions and secondary school subjects offline, with step-by-step explanations, active recall flashcards and timed CBT practice.';

    /**
     * Public pages worth indexing: path => [title, description, sitemap priority].
     * Every other page (signed-in areas, auth forms) is marked noindex.
     */
    public const PUBLIC_PAGES = [
        '/' => [
            'AceDrill | Offline Past Questions and AI Tutor for WAEC, JAMB and NECO',
            self::DESCRIPTION,
            '1.0',
        ],
        '/past-questions' => [
            'WAEC, JAMB and NECO Past Questions with CBT Practice | AceDrill',
            'Practise authentic WAEC, JAMB, NECO and Post-UTME past questions by subject and year, with explanations and a timed CBT exam simulator that also works offline.',
            '0.9',
        ],
        '/register' => [
            'Create a Free Learner Account | AceDrill',
            'Sign up for a free AceDrill learner account to practise past questions, quizzes and flashcards, online or offline.',
            '0.6',
        ],
    ];

    /**
     * Shown on the home page and published as FAQPage structured data, so the visible
     * answers and the ones search and answer engines quote are always the same text.
     *
     * @return list<array{question: string, answer: string}>
     */
    public static function faqs(): array
    {
        return [
            [
                'question' => 'How does AceDrill work without an internet connection?',
                'answer' => 'AceDrill is built as a Progressive Web App. When you open the platform, lesson notes, flashcards, practice quizzes, and past questions are saved securely on your phone, tablet, or computer. You can practice and learn anywhere even in airplane mode.',
            ],
            [
                'question' => 'Can I practice actual WAEC, JAMB, and NECO past questions?',
                'answer' => 'Yes. AceDrill includes verified past questions organized by subject, year, and topic. Each question includes step by step explanations so you understand the concepts behind every answer.',
            ],
            [
                'question' => 'Does the AI tutor work when my data is turned off?',
                'answer' => 'Yes. AceDrill contains an offline explanation engine and formula guide that provides step by step math working and concept breakdowns without connecting to the internet.',
            ],
            [
                'question' => 'How do teachers and schools track student progress?',
                'answer' => 'Teachers and school administrators have dedicated portals with class mastery analytics, automated grading, and test reports. Student scores recorded offline automatically sync to school records when a connection is available.',
            ],
            [
                'question' => 'Is there any cost to get started?',
                'answer' => 'Students can sign up and start practicing core subjects, flashcards, and past questions for free. Schools and tutorial centres can request a pilot deployment for multi-class management and offline campus servers.',
            ],
        ];
    }

    /**
     * Absolute URL on the configured APP_URL, never the request's own scheme or host,
     * so canonicals stay https even where the host's proxy reports http.
     */
    public static function url(string $path = '/'): string
    {
        return rtrim((string) config('app.url'), '/').'/'.ltrim($path, '/');
    }

    public static function path(Request $request): string
    {
        return '/'.ltrim($request->path(), '/');
    }

    public static function isPublic(Request $request): bool
    {
        return isset(self::PUBLIC_PAGES[self::path($request)]);
    }

    /** Only the live site is indexed; staging and local copies are kept out of search. */
    public static function indexable(Request $request): bool
    {
        return app()->isProduction() && self::isPublic($request);
    }

    /**
     * @return array{title: string, description: string, canonical: string, robots: string, image: string, jsonLd: array<string, mixed>}
     */
    public static function forRequest(Request $request): array
    {
        $path = self::path($request);
        [$title, $description] = self::PUBLIC_PAGES[$path] ?? [self::NAME, self::DESCRIPTION];

        return [
            'title' => $title,
            'description' => $description,
            'canonical' => self::url($path),
            'robots' => self::indexable($request) ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
            'image' => self::url('images/screenshot-desktop.png'),
            'jsonLd' => self::jsonLd($path, $title, $description),
        ];
    }

    /** @return array<string, mixed> */
    private static function jsonLd(string $path, string $title, string $description): array
    {
        $home = self::url('/');
        $graph = [
            [
                '@type' => 'Organization',
                '@id' => $home.'#organization',
                'name' => self::NAME,
                'url' => $home,
                'logo' => self::url('images/icon-512x512.png'),
                'description' => self::DESCRIPTION,
            ],
            [
                '@type' => 'WebSite',
                '@id' => $home.'#website',
                'url' => $home,
                'name' => self::NAME,
                'inLanguage' => 'en-NG',
                'publisher' => ['@id' => $home.'#organization'],
            ],
            [
                '@type' => 'WebApplication',
                '@id' => $home.'#app',
                'name' => self::NAME,
                'url' => $home,
                'applicationCategory' => 'EducationalApplication',
                'operatingSystem' => 'Any (installable web app for Android, iOS, Windows and macOS)',
                'description' => self::DESCRIPTION,
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'NGN'],
                'featureList' => [
                    'Works fully offline after the first visit',
                    'WAEC, JAMB, NECO and Post-UTME past questions',
                    'Timed CBT exam simulation',
                    'Step-by-step explanations',
                    'Active recall flashcards and daily revision',
                    'Teacher and school progress tracking',
                ],
                'audience' => ['@type' => 'EducationalAudience', 'educationalRole' => 'student'],
            ],
            [
                '@type' => 'WebPage',
                '@id' => self::url($path).'#webpage',
                'url' => self::url($path),
                'name' => $title,
                'description' => $description,
                'isPartOf' => ['@id' => $home.'#website'],
                'about' => ['@id' => $home.'#app'],
            ],
        ];

        if ($path === '/') {
            $graph[] = [
                '@type' => 'FAQPage',
                '@id' => $home.'#faq',
                'mainEntity' => array_map(fn (array $faq) => [
                    '@type' => 'Question',
                    'name' => $faq['question'],
                    'acceptedAnswer' => ['@type' => 'Answer', 'text' => $faq['answer']],
                ], self::faqs()),
            ];
        }

        return ['@context' => 'https://schema.org', '@graph' => $graph];
    }

    public static function robotsTxt(): string
    {
        if (! app()->isProduction()) {
            return "User-agent: *\nDisallow: /\n";
        }

        // An allowlist: name only what may be crawled and block the rest, so the file never
        // lists private areas, API paths or maintenance routes for anyone reading it.
        $lines = ['User-agent: *'];
        foreach (array_keys(self::PUBLIC_PAGES) as $path) {
            $lines[] = 'Allow: '.($path === '/' ? '/$' : $path);
        }
        foreach (['/llms.txt', '/llms-full.txt', '/build/', '/images/', '/favicon.ico', '/manifest.webmanifest'] as $path) {
            $lines[] = "Allow: {$path}";
        }
        $lines[] = 'Disallow: /';
        $lines[] = '';
        $lines[] = 'Sitemap: '.self::url('/sitemap.xml');

        return implode("\n", $lines)."\n";
    }

    public static function sitemapXml(): string
    {
        $lastmod = date('Y-m-d', (int) filemtime(base_path('app/Support/Seo.php')));
        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach (self::PUBLIC_PAGES as $path => [, , $priority]) {
            $xml .= '  <url><loc>'.e(self::url($path))."</loc><lastmod>{$lastmod}</lastmod><priority>{$priority}</priority></url>\n";
        }

        return $xml.'</urlset>'."\n";
    }

    /** llms.txt (llmstxt.org): a short, link-rich summary for AI answer engines. */
    public static function llmsTxt(): string
    {
        $lines = [
            '# '.self::NAME,
            '',
            '> '.self::DESCRIPTION,
            '',
            'AceDrill is an installable web app for Nigerian secondary school students preparing for WAEC, NECO, JAMB (UTME) and Post-UTME. After the first visit it works fully offline: learners take quizzes, timed CBT simulations and flashcard reviews without data, see right or wrong answers with explanations straight away, and their scores sync to their school when they reconnect.',
            '',
            '## Pages',
        ];
        foreach (self::PUBLIC_PAGES as $path => [$title, $description]) {
            $lines[] = '- ['.$title.']('.self::url($path).'): '.$description;
        }
        $lines[] = '';
        $lines[] = '## Frequently asked questions';
        foreach (self::faqs() as $faq) {
            $lines[] = '';
            $lines[] = '### '.$faq['question'];
            $lines[] = $faq['answer'];
        }
        $lines[] = '';
        $lines[] = '## Optional';
        $lines[] = '- [Full platform description]('.self::url('/llms-full.txt').'): curriculum coverage, learning method and architecture.';

        return implode("\n", $lines)."\n";
    }
}
