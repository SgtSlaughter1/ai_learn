<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Every role against every protected action, on records of the actor's own school,
 * another school, and global content. "allow" means the request gets past authorization
 * (not 401/403); "deny" means 403; "hidden" means 404 (the record isn't visible through
 * that route at all). No case may produce a server error.
 */
class PermissionMatrixTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, mixed> */
    private array $f = [];

    /**
     * [method, uri, payload, [actor => allowed]]. Placeholders like {classA} resolve to
     * fixture ids; payloads: 'person:<user>', 'class', 'named', 'question:<topic>', 'enrol:<user>'.
     */
    private const MATRIX = [
        // ── Accounts ──
        'update own-school learner' => ['PATCH', '/api/v1/admin/learners/{learnerA}', 'person:learnerA', ['platform' => true, 'schoolAdmin' => true, 'orphanAdmin' => false, 'teacher' => false, 'learner' => false]],
        'update other-school learner' => ['PATCH', '/api/v1/admin/learners/{learnerB}', 'person:learnerB', ['platform' => true, 'schoolAdmin' => false]],
        'delete other-school learner' => ['DELETE', '/api/v1/admin/learners/{learnerB}', null, ['schoolAdmin' => false]],
        'update own-school teacher' => ['PATCH', '/api/v1/admin/teachers/{teacherA}', 'person:teacherA', ['platform' => true, 'schoolAdmin' => true, 'teacher' => false]],
        'delete other-school teacher' => ['DELETE', '/api/v1/admin/teachers/{teacherB}', null, ['platform' => true, 'schoolAdmin' => false]],
        'update a school admin' => ['PATCH', '/api/v1/admin/school-admins/{adminB}', 'person:adminB', ['platform' => true, 'schoolAdmin' => false]],
        'update a platform admin via school-admin route' => ['PATCH', '/api/v1/admin/school-admins/{platform}', 'person:platform', ['platform' => 'hidden']],
        'update own school record' => ['PATCH', '/api/v1/admin/schools/{schoolA}', 'named', ['platform' => true, 'schoolAdmin' => false]],
        'delete another school' => ['DELETE', '/api/v1/admin/schools/{schoolB}', null, ['platform' => true, 'schoolAdmin' => false]],
        'read feedback inbox' => ['GET', '/api/v1/admin/feedbacks', null, ['platform' => true, 'schoolAdmin' => false, 'teacher' => false]],

        // ── Classes and rosters ──
        'update own-school class' => ['PATCH', '/api/v1/admin/classes/{classA}', 'class', ['platform' => true, 'schoolAdmin' => true, 'orphanAdmin' => false, 'teacher' => false]],
        'delete other-school class' => ['DELETE', '/api/v1/admin/classes/{classB}', null, ['platform' => true, 'schoolAdmin' => false]],
        'view own-school roster (admin)' => ['GET', '/api/v1/admin/classes/{classA}/learners', null, ['schoolAdmin' => true, 'orphanAdmin' => false, 'teacher' => false]],
        'enrol other-school learner' => ['POST', '/api/v1/admin/classes/{classA}/enroll', 'enrol:learnerB', ['platform' => true, 'schoolAdmin' => false]],
        'enrol self-registered learner' => ['POST', '/api/v1/admin/classes/{classA}/enroll', 'enrol:learnerFree', ['schoolAdmin' => true]],
        'view taught class roster' => ['GET', '/api/v1/teacher/classes/{classA}/learners', null, ['teacher' => true, 'schoolAdmin' => true, 'learner' => false]],
        'view other-school class roster' => ['GET', '/api/v1/teacher/classes/{classB}/learners', null, ['teacher' => false, 'schoolAdmin' => false]],
        'view other-school class diagnostics' => ['GET', '/api/v1/teacher/classes/{classB}/diagnostics', null, ['teacher' => false, 'schoolAdmin' => false]],
        'teacher stats for taught class' => ['GET', '/api/v1/teacher/stats?class_id={classA}', null, ['teacher' => true]],
        'teacher stats for other-school class' => ['GET', '/api/v1/teacher/stats?class_id={classB}', null, ['teacher' => false]],

        // ── Curriculum ──
        'update own-school subject' => ['PATCH', '/api/v1/admin/subjects/{subjectA}', 'named', ['platform' => true, 'schoolAdmin' => true, 'teacher' => false]],
        'update global subject' => ['PATCH', '/api/v1/admin/subjects/{subjectGlobal}', 'named', ['platform' => true, 'schoolAdmin' => false]],
        'delete other-school subject' => ['DELETE', '/api/v1/admin/subjects/{subjectB}', null, ['schoolAdmin' => false]],
        'update own-school topic' => ['PATCH', '/api/v1/admin/topics/{topicA}', 'named', ['schoolAdmin' => true, 'teacher' => false]],
        'delete global topic' => ['DELETE', '/api/v1/admin/topics/{topicGlobal}', null, ['platform' => true, 'schoolAdmin' => false]],

        // ── Question bank ──
        'add question to taught topic' => ['POST', '/api/v1/admin/questions', 'question:topicA', ['teacher' => true, 'schoolAdmin' => true, 'learner' => false]],
        'add question to other-school topic' => ['POST', '/api/v1/admin/questions', 'question:topicB', ['teacher' => false, 'schoolAdmin' => false]],
        'add question to global topic' => ['POST', '/api/v1/admin/questions', 'question:topicGlobal', ['platform' => true, 'teacher' => false, 'schoolAdmin' => false]],
        'delete question in taught topic' => ['DELETE', '/api/v1/admin/questions/{questionA}', null, ['teacher' => true]],
        'delete other-school question' => ['DELETE', '/api/v1/admin/questions/{questionB}', null, ['teacher' => false, 'schoolAdmin' => false]],
        'delete global question' => ['DELETE', '/api/v1/admin/questions/{questionGlobal}', null, ['schoolAdmin' => false, 'platform' => true]],

        // ── Learner content ──
        'view own-school subject' => ['GET', '/api/v1/subjects/{subjectA.slug}', null, ['learner' => true]],
        'view global subject' => ['GET', '/api/v1/subjects/{subjectGlobal.slug}', null, ['learner' => true]],
        'view other-school subject' => ['GET', '/api/v1/subjects/{subjectB.slug}', null, ['learner' => false]],
    ];

    public static function cases(): iterable
    {
        foreach (self::MATRIX as $name => [$method, $uri, $payload, $expectations]) {
            foreach ($expectations as $actor => $allowed) {
                yield "{$actor}: {$name}" => [$actor, $method, $uri, $payload, $allowed];
            }
        }
    }

    #[DataProvider('cases')]
    public function test_permission(string $actor, string $method, string $uri, ?string $payload, bool|string $allowed): void
    {
        $this->buildFixtures();

        $response = $this->actingAs($this->f[$actor])
            ->json($method, $this->resolveUri($uri), $this->payload($payload));

        $status = $response->getStatusCode();
        $this->assertLessThan(500, $status, "Server error: " . $response->getContent());
        if ($allowed === 'hidden') {
            $this->assertSame(404, $status, "Expected the record to be hidden from {$actor}, got {$status}");
        } elseif ($allowed) {
            $this->assertNotContains($status, [401, 403], "Expected {$actor} to be allowed, got {$status}: " . $response->getContent());
        } else {
            $this->assertSame(403, $status, "Expected {$actor} to be denied, got {$status}: " . $response->getContent());
        }
    }

    private function buildFixtures(): void
    {
        $user = fn (UserRole $role) => User::factory()->create(['role' => $role]);

        $this->f['platform'] = $user(UserRole::PLATFORM_ADMIN);
        $this->f['schoolAdmin'] = $user(UserRole::SCHOOL_ADMIN);
        $this->f['adminB'] = $user(UserRole::SCHOOL_ADMIN);
        $this->f['orphanAdmin'] = $user(UserRole::SCHOOL_ADMIN); // administers no school

        $this->f['schoolA'] = School::create(['name' => 'School A', 'slug' => 'school-a', 'category' => 'SECONDARY', 'is_active' => true, 'admin_user_id' => $this->f['schoolAdmin']->id]);
        $this->f['schoolB'] = School::create(['name' => 'School B', 'slug' => 'school-b', 'category' => 'SECONDARY', 'is_active' => true, 'admin_user_id' => $this->f['adminB']->id]);

        $class = fn (School $school, string $slug) => ClassModel::create(['school_id' => $school->id, 'name' => strtoupper($slug), 'slug' => $slug, 'grade_level' => 'SS1', 'is_active' => true]);
        $this->f['classA'] = $class($this->f['schoolA'], 'ss1-a');
        $this->f['classB'] = $class($this->f['schoolB'], 'ss1-b');

        $teacher = function (School $school) use ($user): User {
            $t = $user(UserRole::TEACHER);
            TeacherProfile::create(['user_id' => $t->id, 'school_id' => $school->id]);
            return $t;
        };
        $this->f['teacher'] = $teacher($this->f['schoolA']);
        $this->f['teacherA'] = $teacher($this->f['schoolA']);
        $this->f['teacherB'] = $teacher($this->f['schoolB']);
        ClassMembership::create(['class_id' => $this->f['classA']->id, 'user_id' => $this->f['teacher']->id, 'role' => 'teacher', 'is_active' => true]);

        $learner = function (?School $school, ?ClassModel $inClass = null) use ($user): User {
            $l = $user(UserRole::LEARNER);
            if ($school) {
                LearnerProfile::create(['user_id' => $l->id, 'school_id' => $school->id, 'grade_level' => 'SS1']);
            }
            if ($inClass) {
                ClassMembership::create(['class_id' => $inClass->id, 'user_id' => $l->id, 'role' => 'learner', 'is_active' => true]);
            }
            return $l;
        };
        $this->f['learner'] = $learner($this->f['schoolA'], $this->f['classA']);
        $this->f['learnerA'] = $learner($this->f['schoolA'], $this->f['classA']);
        $this->f['learnerB'] = $learner($this->f['schoolB'], $this->f['classB']);
        $this->f['learnerFree'] = $learner(null);

        $subject = fn (?School $school, ?ClassModel $c, string $slug) => Subject::factory()->create([
            'school_id' => $school?->id, 'class_id' => $c?->id, 'slug' => $slug, 'status' => 'active',
        ]);
        $this->f['subjectA'] = $subject($this->f['schoolA'], $this->f['classA'], 'maths-a');
        $this->f['subjectB'] = $subject($this->f['schoolB'], $this->f['classB'], 'maths-b');
        $this->f['subjectGlobal'] = $subject(null, null, 'maths-global');

        foreach (['A' => 'subjectA', 'B' => 'subjectB', 'Global' => 'subjectGlobal'] as $suffix => $subjectKey) {
            $topic = Topic::factory()->create(['subject_id' => $this->f[$subjectKey]->id, 'level' => 'SS1', 'status' => 'active']);
            $question = Question::factory()->create(['topic_id' => $topic->id, 'school_id' => $this->f[$subjectKey]->school_id, 'status' => 'active']);
            QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
            $this->f["topic{$suffix}"] = $topic;
            $this->f["question{$suffix}"] = $question;
        }
    }

    private function resolveUri(string $uri): string
    {
        return preg_replace_callback('/\{(\w+)(?:\.(\w+))?\}/', function ($m) {
            $record = $this->f[$m[1]];
            return (string) (isset($m[2]) ? $record->{$m[2]} : $record->getKey());
        }, $uri);
    }

    private function payload(?string $spec): array
    {
        if ($spec === null) {
            return [];
        }
        [$kind, $key] = array_pad(explode(':', $spec, 2), 2, null);

        return match ($kind) {
            'person' => ['name' => 'Renamed Person', 'email' => $this->f[$key]->email],
            'class' => ['name' => 'Renamed Class', 'grade_level' => 'SS1'],
            'named' => ['name' => 'Renamed'],
            'enrol' => ['email' => $this->f[$key]->email],
            'question' => [
                'topic_id' => $this->f[$key]->id,
                'question_text' => 'What is 2 + 2?',
                'options' => [['option_text' => '4', 'is_correct' => true], ['option_text' => '5', 'is_correct' => false]],
            ],
        };
    }
}
