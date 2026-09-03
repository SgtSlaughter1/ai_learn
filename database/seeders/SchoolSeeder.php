<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Database\Seeder;

class SchoolSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create the school
        $school = School::updateOrCreate(
            ['slug' => 'ailearn-academy'],
            [
                'name' => 'AILEARN Academy',
                'address' => '12 Innovation Drive, Tech City',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'phone' => '+234 800 000 0000',
                'email' => 'admin@ailearnacademy.com',
                'description' => 'A modern secondary school focused on STEM and AI-powered learning.',
                'is_active' => true,
            ]
        );

        // 2. Get existing users (created by DatabaseSeeder)
        $teacher = User::where('email', 'teacher@example.com')->first();
        $learner = User::where('email', 'learner@example.com')->first();
        $admin = User::where('email', 'admin@example.com')->first();

        // Link school admin
        if ($admin) {
            $school->update(['admin_user_id' => $admin->id]);
        }

        // 3. Create teacher profiles (teacher + admin)
        if ($teacher) {
            TeacherProfile::updateOrCreate(
                ['user_id' => $teacher->id, 'school_id' => $school->id],
                [
                    'employee_id' => 'TCH-001',
                    'department' => 'Mathematics & Science',
                    'bio' => 'Experienced mathematics teacher with 10+ years in secondary education.',
                    'is_active' => true,
                ]
            );
        }



        // 4. Create learner profile
        if ($learner) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner->id, 'school_id' => $school->id],
                [
                    'student_id' => 'STU-001',
                    'grade_level' => 'SS1',
                    'is_active' => true,
                ]
            );
        }

        // 5. Create a second learner for variety
        $learner2 = User::updateOrCreate(
            ['email' => 'ada.learner@example.com'],
            [
                'name' => 'Ada Learner',
                'password' => \Illuminate\Support\Facades\Hash::make('password'),
                'role' => UserRole::LEARNER,
                'email_verified_at' => now(),
            ]
        );

        LearnerProfile::updateOrCreate(
            ['user_id' => $learner2->id, 'school_id' => $school->id],
            [
                'student_id' => 'STU-002',
                'grade_level' => 'SS1',
                'is_active' => true,
            ]
        );

        // 6. Create classes
        $jss3Blue = ClassModel::updateOrCreate(
            ['slug' => 'ss1-mathematics-blue'],
            [
                'school_id' => $school->id,
                'name' => 'SS1 Mathematics',
                'grade_level' => 'SS1',
                'section' => 'Blue',
                'description' => 'SS1 Mathematics class — Algebra, Geometry, and Statistics.',
                'is_active' => true,
            ]
        );

        $jss3Green = ClassModel::updateOrCreate(
            ['slug' => 'ss1-science-green'],
            [
                'school_id' => $school->id,
                'name' => 'SS1 Science',
                'grade_level' => 'SS1',
                'section' => 'Green',
                'description' => 'SS1 Science class — Biology, Chemistry, and Physics.',
                'is_active' => true,
            ]
        );

        // 7. Assign teacher and admin to both classes
        if ($teacher) {
            ClassMembership::updateOrCreate(
                ['class_id' => $jss3Blue->id, 'user_id' => $teacher->id],
                ['role' => 'teacher', 'is_active' => true]
            );

            ClassMembership::updateOrCreate(
                ['class_id' => $jss3Green->id, 'user_id' => $teacher->id],
                ['role' => 'teacher', 'is_active' => true]
            );
        }



        // 8. Enroll learners into classes
        if ($learner) {
            ClassMembership::updateOrCreate(
                ['class_id' => $jss3Blue->id, 'user_id' => $learner->id],
                ['role' => 'learner', 'is_active' => true]
            );

            ClassMembership::updateOrCreate(
                ['class_id' => $jss3Green->id, 'user_id' => $learner->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        ClassMembership::updateOrCreate(
            ['class_id' => $jss3Blue->id, 'user_id' => $learner2->id],
            ['role' => 'learner', 'is_active' => true]
        );

        $this->command->info("✅ School seeded: {$school->name}");
        $this->command->info("   📧 Teacher: teacher@example.com / password");
        $this->command->info("   📧 Learner 1: learner@example.com / password");
        $this->command->info("   📧 Learner 2: ada.learner@example.com / password");
        $this->command->info("   🏫 Classes: {$jss3Blue->name}, {$jss3Green->name}");
    }
}
