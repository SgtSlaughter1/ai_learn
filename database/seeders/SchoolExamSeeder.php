<?php

namespace Database\Seeders;

use App\Models\ClassModel;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\SchoolExam;
use App\Models\SchoolExamAttempt;
use App\Models\SchoolExamQuestion;
use App\Models\Subject;
use App\Models\User;
use App\Services\SchoolExams\SchoolExamService;
use Illuminate\Database\Seeder;

/**
 * Two School CBT exams for SS1 Science at AceDrill Academy: one open now for learners to sit,
 * and one already sat, marked and released so the results screens have data.
 * Questions, attempts and marking all go through SchoolExamService, the same path as the app.
 */
class SchoolExamSeeder extends Seeder
{
    public function run(SchoolExamService $exams): void
    {
        $teacher = User::where('email', 'teacher@example.com')->first();
        $class = ClassModel::where('slug', 'ss1-science')->first();
        if (! $teacher || ! $class) {
            $this->command?->error('Users and classes must be seeded before running SchoolExamSeeder.');

            return;
        }

        // Open now: learners can sit it with the start code shown to the teacher.
        $this->seedExam($exams, $teacher, $class, 'ss1-mathematics', [
            'title' => 'SS1 Mathematics CA 1',
            'instructions' => 'Answer every question. Questions 16 to 20 carry 3 marks each.',
            'duration_minutes' => 30,
            'opens_at' => now()->subHour(),
            'closes_at' => now()->addWeek(),
            'pass_mark' => 50,
            'show_score_immediately' => true,
            'status' => SchoolExam::STATUS_PUBLISHED,
        ], questionCount: 20, heavyFrom: 16);

        // Already sat and released: both learners have marked attempts and corrections.
        $midterm = $this->seedExam($exams, $teacher, $class, 'ss1-physics', [
            'title' => 'SS1 Physics Mid-term',
            'instructions' => 'You have 40 minutes. A calculator is available on screen.',
            'duration_minutes' => 40,
            'opens_at' => now()->subDays(3)->setTime(9, 0),
            'closes_at' => now()->subDays(3)->setTime(12, 0),
            'pass_mark' => 50,
            'show_score_immediately' => false,
            'status' => SchoolExam::STATUS_CLOSED,
        ], questionCount: 15);

        if ($midterm && ! $midterm->resultsReleased()) {
            mt_srand(42); // the same answers on every fresh seed
            // How often each learner picks the right option, so the class results show a spread.
            $learners = ['learner@example.com' => 0.8, 'ada.learner@example.com' => 0.55];
            foreach (User::whereIn('email', array_keys($learners))->get(['id', 'email']) as $learner) {
                $this->sit($exams, $midterm, $learner, $learners[$learner->email]);
            }
            $exams->releaseResults($midterm);
        }

        $this->command?->info('School CBT exams seeded successfully.');
    }

    /**
     * Create or update one exam for the class, with questions from the subject's bank.
     * Questions are only set while nobody has sat it, since a sat paper is locked.
     */
    private function seedExam(SchoolExamService $exams, User $teacher, ClassModel $class, string $subjectSlug, array $attributes, int $questionCount, ?int $heavyFrom = null): ?SchoolExam
    {
        $subject = Subject::where('slug', $subjectSlug)->first(['id', 'school_id']);
        if (! $subject) {
            return null;
        }

        $exam = SchoolExam::firstOrNew(['school_id' => $class->school_id, 'title' => $attributes['title']]);
        $exam->fill($attributes + [
            'subject_id' => $subject->id,
            'created_by' => $teacher->id,
            'shuffle_questions' => true,
            'shuffle_options' => true,
        ]);
        $exam->access_code ??= SchoolExam::newAccessCode();
        $exam->save();
        $exam->classes()->syncWithoutDetaching([$class->id]);

        if ($exam->attempts()->doesntExist()) {
            $questionIds = Question::forUser($teacher)
                ->whereHas('topic', fn ($q) => $q->where('subject_id', $subject->id))
                ->where('status', 'active')
                ->whereIn('type', SchoolExam::QUESTION_TYPES)
                ->orderBy('questions.id')
                ->limit($questionCount)
                ->pluck('questions.id');

            $exams->syncQuestions($exam, $questionIds->values()->map(fn ($id, $i) => [
                'id' => $id,
                'marks' => $heavyFrom !== null && $i + 1 >= $heavyFrom ? 3 : 1,
            ])->all(), $teacher);
        }

        return $exam;
    }

    /** Start, answer and hand in a paper, getting roughly `$accuracy` of the questions right. */
    private function sit(SchoolExamService $exams, SchoolExam $exam, User $learner, float $accuracy): void
    {
        $attempt = $exams->start($exam, $learner);
        if (! $attempt->isInProgress()) {
            return;
        }

        $questionIds = SchoolExamQuestion::where('school_exam_id', $exam->id)->pluck('question_id', 'id');
        $correct = QuestionOption::whereIn('question_id', $questionIds)->where('is_correct', true)->pluck('id', 'question_id');

        $answers = [];
        foreach ($attempt->paper['o'] as $examQuestionId => $optionIds) {
            $right = $correct[$questionIds[$examQuestionId]] ?? null;
            $wrong = collect($optionIds)->first(fn ($id) => $id !== $right);
            $answers[$examQuestionId] = mt_rand() / mt_getrandmax() < $accuracy ? $right : $wrong;
        }

        $exams->saveAnswers($attempt, $answers, leftScreenCount: 0);
        $exams->finish($attempt->fresh(), SchoolExamAttempt::STATUS_SUBMITTED);

        // Date the attempt inside the exam window, as if sat on the day.
        $attempt->update([
            'started_at' => $exam->opens_at->copy()->addMinutes(5),
            'deadline_at' => $exam->opens_at->copy()->addMinutes(5 + $exam->duration_minutes),
            'submitted_at' => $exam->opens_at->copy()->addMinutes(5 + $exam->duration_minutes - 6),
        ]);
    }
}
