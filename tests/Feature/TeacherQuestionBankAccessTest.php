<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassModel;
use App\Models\Question;
use App\Models\School;
use App\Models\Subject;
use App\Models\TeacherProfile;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherQuestionBankAccessTest extends TestCase
{
    use RefreshDatabase;

    protected School $school;

    protected User $teacherUser;

    protected ClassModel $class;

    protected Subject $subject;

    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::create([
            'name' => 'Springfield High',
            'slug' => 'springfield-high',
            'is_active' => true,
        ]);

        $this->teacherUser = User::factory()->create([
            'role' => UserRole::TEACHER,
            'name' => 'Sarah Teacher',
            'email' => 'sarah.teacher@example.com',
        ]);

        TeacherProfile::create([
            'user_id' => $this->teacherUser->id,
            'school_id' => $this->school->id,
            'employee_id' => 'TCH-001',
        ]);

        $this->class = ClassModel::create([
            'school_id' => $this->school->id,
            'name' => 'JSS 1 Gold',
            'slug' => 'jss-1-gold',
            'grade_level' => 'JSS1',
            'is_active' => true,
        ]);

        $this->teacherUser->classes()->attach($this->class->id, ['role' => 'teacher']);

        $this->subject = Subject::factory()->create([
            'name' => 'Basic Science',
            'slug' => 'basic-science',
            'school_id' => $this->school->id,
            'class_id' => $this->class->id,
        ]);

        $this->topic = Topic::factory()->create([
            'subject_id' => $this->subject->id,
            'name' => 'Living Things',
            'slug' => 'living-things',
            'level' => 'JSS 1',
        ]);
    }

    public function test_teacher_can_fetch_questions_for_assigned_classes_and_school(): void
    {
        Question::factory()->create([
            'topic_id' => $this->topic->id,
            'school_id' => $this->school->id,
            'question_text' => 'Which of these is a characteristic of living things?',
        ]);

        $response = $this->actingAs($this->teacherUser)
            ->getJson('/api/v1/admin/questions');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);

        $data = $response->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals('Which of these is a characteristic of living things?', $data[0]['question_text']);
    }

    public function test_teacher_can_create_single_question(): void
    {
        $payload = [
            'topic_id' => $this->topic->id,
            'question_text' => 'What is the powerhouse of the cell?',
            'type' => 'multiple_choice',
            'difficulty' => 'easy',
            'explanation' => 'Mitochondria produce ATP.',
            'options' => [
                ['option_text' => 'Nucleus', 'is_correct' => false],
                ['option_text' => 'Mitochondria', 'is_correct' => true],
                ['option_text' => 'Ribosome', 'is_correct' => false],
                ['option_text' => 'Vacuole', 'is_correct' => false],
            ],
        ];

        $response = $this->actingAs($this->teacherUser)
            ->postJson('/api/v1/admin/questions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Question created successfully',
            ]);

        $this->assertDatabaseHas('questions', [
            'question_text' => 'What is the powerhouse of the cell?',
            'school_id' => $this->school->id,
        ]);
    }

    public function test_teacher_can_use_ai_extract_and_bulk_save_questions(): void
    {
        $extractPayload = [
            'raw_text' => "1. What is H2O?\nA) Water\nB) Oxygen\nAnswer: A\nExplanation: H2O is chemical formula of water.",
            'subject_id' => $this->subject->id,
            'topic_id' => $this->topic->id,
        ];

        $extractRes = $this->actingAs($this->teacherUser)
            ->postJson('/api/v1/admin/questions/ai-extract', $extractPayload);

        $extractRes->assertStatus(200)
            ->assertJsonStructure(['questions']);

        $bulkPayload = [
            'topic_id' => $this->topic->id,
            'questions' => [
                [
                    'question_text' => 'What is H2O?',
                    'type' => 'multiple_choice',
                    'difficulty' => 'easy',
                    'explanation' => 'H2O is water.',
                    'options' => [
                        ['option_text' => 'Water', 'is_correct' => true],
                        ['option_text' => 'Oxygen', 'is_correct' => false],
                    ],
                ],
            ],
        ];

        $bulkRes = $this->actingAs($this->teacherUser)
            ->postJson('/api/v1/admin/questions/bulk', $bulkPayload);

        $bulkRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'count' => 1,
            ]);

        $this->assertDatabaseHas('questions', [
            'question_text' => 'What is H2O?',
            'school_id' => $this->school->id,
        ]);
    }

    public function test_teacher_can_fetch_subjects_topics_and_classes(): void
    {
        $resSubjects = $this->actingAs($this->teacherUser)->getJson('/api/v1/admin/subjects');
        $resSubjects->assertStatus(200)->assertJsonStructure(['subjects']);

        $resTopics = $this->actingAs($this->teacherUser)->getJson('/api/v1/admin/topics');
        $resTopics->assertStatus(200)->assertJsonStructure(['topics']);

        $resClasses = $this->actingAs($this->teacherUser)->getJson('/api/v1/admin/classes');
        $resClasses->assertStatus(200)->assertJsonStructure(['classes']);
    }
}
