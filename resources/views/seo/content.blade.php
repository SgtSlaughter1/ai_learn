{{-- Plain-HTML copy of the public page for crawlers and answer engines that do not run
     JavaScript. Hidden (html.js) once scripts run; the React page shows the same content. --}}
@php($seo = \App\Support\Seo::forRequest(request()))
@php($path = \App\Support\Seo::path(request()))
<main id="seo-content">
    <h1>{{ $seo['title'] }}</h1>
    <p>{{ $seo['description'] }}</p>

    @if ($path === '/')
        <h2>What you can do with AceDrill</h2>
        <ul>
            <li>Practise authentic WAEC, JAMB (UTME), NECO and Post-UTME past questions by subject and year.</li>
            <li>Sit timed CBT exam simulations that feel like the real exam.</li>
            <li>See whether each answer is right or wrong straight away, with a step-by-step explanation, even offline.</li>
            <li>Review active recall flashcards and a short daily revision set.</li>
            <li>Study secondary school subjects topic by topic, with quizzes for each topic.</li>
            <li>Keep working without data: results sync to your school when you reconnect.</li>
            <li>Teachers and school administrators track class progress and mastery.</li>
        </ul>

        <h2>Frequently Asked Questions</h2>
        @foreach (\App\Support\Seo::faqs() as $faq)
            <h3>{{ $faq['question'] }}</h3>
            <p>{{ $faq['answer'] }}</p>
        @endforeach
    @elseif ($path === '/past-questions')
        <h2>Exams covered</h2>
        <ul>
            <li>WAEC (WASSCE) past questions</li>
            <li>JAMB (UTME) past questions</li>
            <li>NECO past questions</li>
            <li>Post-UTME past questions</li>
        </ul>
        <p>Pick a subject and year to practise, or start a timed CBT simulation. Each question shows the correct answer and an explanation after you choose.</p>
    @endif

    <nav>
        <a href="{{ \App\Support\Seo::url('/') }}">Home</a>
        <a href="{{ \App\Support\Seo::url('/past-questions') }}">Past questions and CBT practice</a>
        <a href="{{ \App\Support\Seo::url('/register') }}">Create a free account</a>
        <a href="{{ \App\Support\Seo::url('/login') }}">Sign in</a>
    </nav>
</main>
