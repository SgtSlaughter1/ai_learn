<?php

namespace App\Providers;

use App\Models\ClassModel;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Policies\ClassModelPolicy;
use App\Policies\QuestionPolicy;
use App\Policies\QuizPolicy;
use App\Policies\SchoolPolicy;
use App\Policies\SubjectPolicy;
use App\Policies\TopicPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        $this->registerAuthorization();
    }

    /**
     * Role-level gates guard whole route groups; policies decide per record, all through
     * User::canAccessSchool(). Controllers never compare roles themselves.
     */
    private function registerAuthorization(): void
    {
        Gate::define('access-admin', fn (User $user) => $user->isAdmin());
        Gate::define('access-teaching', fn (User $user) => $user->isAdmin() || $user->isTeacher());
        Gate::define('manage-platform', fn (User $user) => $user->isPlatformAdmin());

        Gate::policy(ClassModel::class, ClassModelPolicy::class);
        Gate::policy(Topic::class, TopicPolicy::class);
        Gate::policy(Subject::class, SubjectPolicy::class);
        Gate::policy(Question::class, QuestionPolicy::class);
        Gate::policy(Quiz::class, QuizPolicy::class);
        Gate::policy(School::class, SchoolPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
    }
}
