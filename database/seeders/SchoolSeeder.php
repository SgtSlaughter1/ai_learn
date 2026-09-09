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
        // 1. Get School Admins and Learners created by DatabaseSeeder
        $schoolAdmin1 = User::where('email', 'schooladmin@example.com')->first();
        $schoolAdmin2 = User::where('email', 'greenwood.admin@example.com')->first();
        $learner1 = User::where('email', 'learner@example.com')->first();
        $learner2 = User::where('email', 'ada.learner@example.com')->first();
        $learner3 = User::where('email', 'chidi.learner@example.com')->first();

        // 2. Create School 1: AILEARN Academy
        $school1 = School::updateOrCreate(
            ['slug' => 'ailearn-academy'],
            [
                'name' => 'AILEARN Academy',
                'admin_user_id' => $schoolAdmin1?->id,
                'address' => '12 Innovation Drive, Tech City',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'phone' => '+234 800 111 2222',
                'email' => 'admin@ailearnacademy.com',
                'description' => 'A premier secondary school focused on STEM, innovation, and AI-powered learning.',
                'is_active' => true,
            ]
        );

        // 3. Create School 2: Greenwood High School
        $school2 = School::updateOrCreate(
            ['slug' => 'greenwood-high-school'],
            [
                'name' => 'Greenwood High School',
                'admin_user_id' => $schoolAdmin2?->id,
                'address' => '45 Heritage Boulevard',
                'city' => 'Abuja',
                'state' => 'FCT',
                'phone' => '+234 800 333 4444',
                'email' => 'contact@greenwoodhigh.edu',
                'description' => 'Committed to academic excellence, leadership development, and comprehensive secondary curriculum.',
                'is_active' => true,
            ]
        );

        // 4. Create Learner Profiles
        if ($learner1) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner1->id],
                [
                    'school_id' => $school1->id,
                    'student_id' => 'STU-001',
                    'grade_level' => 'SS1',
                    'is_active' => true,
                ]
            );
        }

        if ($learner2) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner2->id],
                [
                    'school_id' => $school1->id,
                    'student_id' => 'STU-002',
                    'grade_level' => 'SS1',
                    'is_active' => true,
                ]
            );
        }

        if ($learner3) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner3->id],
                [
                    'school_id' => $school2->id,
                    'student_id' => 'GW-001',
                    'grade_level' => 'SS2',
                    'is_active' => true,
                ]
            );
        }

        // 5. Create Classes for School 1
        $class1A = ClassModel::updateOrCreate(
            ['slug' => 'ss1-mathematics-alpha'],
            [
                'school_id' => $school1->id,
                'name' => 'SS1 Mathematics Alpha',
                'grade_level' => 'SS1',
                'section' => 'Alpha',
                'description' => 'SS1 Mathematics — Algebraic expressions, Geometry, and Statistics.',
                'is_active' => true,
            ]
        );

        $class1B = ClassModel::updateOrCreate(
            ['slug' => 'ss1-science-beta'],
            [
                'school_id' => $school1->id,
                'name' => 'SS1 Science Beta',
                'grade_level' => 'SS1',
                'section' => 'Beta',
                'description' => 'SS1 Science — Introductory Biology, Chemistry, and Physics.',
                'is_active' => true,
            ]
        );

        $class1C = ClassModel::updateOrCreate(
            ['slug' => 'jss3-tech-pioneers'],
            [
                'school_id' => $school1->id,
                'name' => 'JSS3 Tech Pioneers',
                'grade_level' => 'JSS3',
                'section' => 'Pioneers',
                'description' => 'JSS3 Basic Science and Computational Thinking fundamentals.',
                'is_active' => true,
            ]
        );

        // 6. Create Classes for School 2
        $class2A = ClassModel::updateOrCreate(
            ['slug' => 'ss2-science-blue'],
            [
                'school_id' => $school2->id,
                'name' => 'SS2 Science Blue',
                'grade_level' => 'SS2',
                'section' => 'Blue',
                'description' => 'SS2 Senior Science track with laboratory practice.',
                'is_active' => true,
            ]
        );

        // 7. Enroll Learners into Classes
        if ($learner1) {
            ClassMembership::updateOrCreate(
                ['class_id' => $class1A->id, 'user_id' => $learner1->id],
                ['role' => 'learner', 'is_active' => true]
            );
            ClassMembership::updateOrCreate(
                ['class_id' => $class1B->id, 'user_id' => $learner1->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner2) {
            ClassMembership::updateOrCreate(
                ['class_id' => $class1A->id, 'user_id' => $learner2->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner3) {
            ClassMembership::updateOrCreate(
                ['class_id' => $class2A->id, 'user_id' => $learner3->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        $this->command?->info("✅ Schools seeded successfully:");
        $this->command?->info("   👑 Super Admin: superadmin@example.com / password");
        $this->command?->info("   🏫 School 1: {$school1->name} (Admin: schooladmin@example.com / password)");
        $this->command?->info("   🏫 School 2: {$school2->name} (Admin: greenwood.admin@example.com / password)");
        $this->command?->info("   🎓 Learners: learner@example.com, ada.learner@example.com, chidi.learner@example.com / password");
    }
}
