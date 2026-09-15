<?php

namespace Database\Seeders;

use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use Illuminate\Database\Seeder;

class SchoolSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Retrieve Seeded Users
        $schoolAdmin1 = User::where('email', 'schooladmin@example.com')->first();
        $schoolAdmin2 = User::where('email', 'greenwood.admin@example.com')->first();

        $learner1 = User::where('email', 'learner@example.com')->first();
        $learner2 = User::where('email', 'ada.learner@example.com')->first();
        $learner3 = User::where('email', 'kemi.learner@example.com')->first();
        $learner4 = User::where('email', 'chidi.learner@example.com')->first();
        $learner5 = User::where('email', 'amina.learner@example.com')->first();

        // 2. Create School 1: AILEARN Academy
        $school1 = School::updateOrCreate(
            ['slug' => 'ailearn-academy'],
            [
                'name' => 'AILEARN Academy',
                'category' => 'senior',
                'admin_user_id' => $schoolAdmin1?->id,
                'address' => '12 Innovation Drive, Tech City',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'phone' => '+234 800 111 2222',
                'email' => 'admin@ailearnacademy.com',
                'description' => 'A premier senior secondary school focused on STEM, commercial, humanities, and secondary academic excellence.',
                'is_active' => true,
            ]
        );

        // 3. Create School 2: Greenwood High School
        $school2 = School::updateOrCreate(
            ['slug' => 'greenwood-high-school'],
            [
                'name' => 'Greenwood High School',
                'category' => 'senior',
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
                    'school_id' => $school1->id,
                    'student_id' => 'STU-003',
                    'grade_level' => 'SS1',
                    'is_active' => true,
                ]
            );
        }

        if ($learner4) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner4->id],
                [
                    'school_id' => $school2->id,
                    'student_id' => 'GW-001',
                    'grade_level' => 'SS2',
                    'is_active' => true,
                ]
            );
        }

        if ($learner5) {
            LearnerProfile::updateOrCreate(
                ['user_id' => $learner5->id],
                [
                    'school_id' => $school2->id,
                    'student_id' => 'GW-002',
                    'grade_level' => 'SS3',
                    'is_active' => true,
                ]
            );
        }

        $this->command?->info("Schools and Learner Profiles seeded successfully.");
    }
}
