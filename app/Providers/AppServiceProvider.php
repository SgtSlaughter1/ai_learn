<?php

namespace App\Providers;

use App\Models\ClassModel;
use App\Models\Question;
use App\Models\Subject;
use App\Models\Topic;
use App\Policies\ClassModelPolicy;
use App\Policies\QuestionPolicy;
use App\Policies\SubjectPolicy;
use App\Policies\TopicPolicy;
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

        Gate::policy(ClassModel::class, ClassModelPolicy::class);
        Gate::policy(Topic::class, TopicPolicy::class);
        Gate::policy(Subject::class, SubjectPolicy::class);
        Gate::policy(Question::class, QuestionPolicy::class);
    }
}
