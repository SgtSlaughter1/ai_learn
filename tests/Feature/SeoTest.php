<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Seo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app['env'] = 'production';
        config(['app.url' => 'https://ailearn.example']);
    }

    public function test_the_home_page_is_readable_without_javascript(): void
    {
        $html = $this->get('/')->assertOk()->getContent();

        $this->assertStringContainsString('<title inertia>AceDrill | Offline Past Questions', $html);
        $this->assertStringContainsString('<meta name="robots" content="index, follow', $html);
        $this->assertStringContainsString('<link rel="canonical" href="https://ailearn.example/">', $html);
        // The FAQ is in the HTML itself and as FAQPage structured data, with the same text.
        $faq = Seo::faqs()[0];
        $this->assertStringContainsString('<main id="seo-content">', $html);
        $this->assertStringContainsString(e($faq['question']), $html);
        $this->assertStringContainsString('"@type":"FAQPage"', $html);
        $this->assertStringContainsString(json_encode($faq['answer'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), $html);
    }

    public function test_the_home_page_shows_the_same_faqs(): void
    {
        $this->get('/')->assertInertia(fn ($page) => $page->component('Welcome')->where('faqs', Seo::faqs()));
    }

    public function test_signed_in_and_auth_pages_are_not_indexed(): void
    {
        $this->get('/login')->assertSee('noindex, nofollow', false)->assertDontSee('id="seo-content"', false);

        $user = User::factory()->create();
        $html = $this->actingAs($user)->get('/profile')->getContent();
        $this->assertStringContainsString('noindex, nofollow', $html);
        $this->assertStringNotContainsString('FAQPage', $html);
    }

    public function test_robots_sitemap_and_llms_use_the_live_domain(): void
    {
        $this->get('/robots.txt')->assertOk()
            ->assertHeader('Content-Type', 'text/plain; charset=utf-8')
            ->assertSee('Sitemap: https://ailearn.example/sitemap.xml')
            ->assertSee('Allow: /past-questions')
            ->assertSee("Disallow: /\n", false)
            // An allowlist: private areas and maintenance routes are never named.
            ->assertDontSee('/admin')->assertDontSee('/api')->assertDontSee('/run-')->assertDontSee('/clear-cache');

        $sitemap = $this->get('/sitemap.xml')->assertOk()->getContent();
        $this->assertStringContainsString('<loc>https://ailearn.example/past-questions</loc>', $sitemap);
        $this->assertStringNotContainsString('/subjects', $sitemap); // signed-in only
        $this->assertNotFalse(simplexml_load_string($sitemap));

        $this->get('/llms.txt')->assertOk()->assertSee('https://ailearn.example/past-questions')->assertDontSee('acedrill.app');
        $this->get('/llms-full.txt')->assertOk();
    }

    public function test_public_files_and_pages_do_not_describe_the_stack(): void
    {
        $stack = ['Laravel', 'Inertia', 'Dexie', 'IndexedDB', 'Gemini', 'MySQL', 'InfinityFree', 'SyncService', 'sw.js', 'platform_admin', 'X-Powered-By'];
        $home = $this->get('/');
        $this->assertFalse($home->headers->has('X-Powered-By'));
        $public = [
            $this->get('/llms.txt')->getContent(),
            $this->get('/llms-full.txt')->getContent(),
            $this->get('/robots.txt')->getContent(),
            // The page source minus the Inertia page JSON and the Vite tags.
            preg_replace('#<script data-page.*?</script>|<script type="module".*?</script>#s', '', $home->getContent()),
        ];
        foreach ($public as $i => $text) {
            // The page itself must keep Inertia's <title inertia> and the /sw.js registration.
            foreach ($i === 3 ? array_diff($stack, ['Inertia', 'sw.js']) : $stack as $word) {
                $this->assertStringNotContainsStringIgnoringCase($word, $text);
            }
            $this->assertStringNotContainsString('<!--', $text);
        }
    }

    public function test_non_production_copies_stay_out_of_search(): void
    {
        $this->app['env'] = 'local';

        $this->get('/robots.txt')->assertSee("Disallow: /\n", false);
        $this->get('/')->assertSee('noindex, nofollow', false);
    }
}
