<?php

namespace Database\Seeders;

use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\Program;
use App\Models\School;
use App\Models\User;
use Illuminate\Database\Seeder;

class ClassSeeder extends Seeder
{
    public function run(): void
    {
        $school1 = School::where('slug', 'ailearn-academy')->first();
        $school2 = School::where('slug', 'greenwood-high-school')->first();

        $progScience = Program::where('slug', 'science')->first();
        $progHumanities = Program::where('slug', 'humanities')->first();
        $progBusiness = Program::where('slug', 'business')->first();

        $teacher1 = User::where('email', 'teacher@example.com')->first();
        $teacher2 = User::where('email', 'emeka.teacher@example.com')->first();
        $teacher3 = User::where('email', 'fatima.teacher@example.com')->first();

        $learner1 = User::where('email', 'learner@example.com')->first();
        $learner2 = User::where('email', 'ada.learner@example.com')->first();
        $learner3 = User::where('email', 'kemi.learner@example.com')->first();
        $learner4 = User::where('email', 'chidi.learner@example.com')->first();
        $learner5 = User::where('email', 'amina.learner@example.com')->first();

        if (!$school1 || !$school2) {
            $this->command?->error("Schools must be seeded before running ClassSeeder.");
            return;
        }

        // ==========================================
        // School 1: AILEARN Academy (Senior Secondary)
        // ==========================================

        // 1. Senior Secondary - Science Track (SS1 - SS3)
        $ss1Science = ClassModel::updateOrCreate(
            ['slug' => 'ss1-science'],
            [
                'school_id' => $school1->id,
                'program_id' => $progScience?->id,
                'name' => 'SS1 Science',
                'grade_level' => 'SS1',
                'arm' => null,
                'section' => null,
                'description' => 'SS1 Science track — Mathematics, Physics, Chemistry, and Biology.',
                'is_active' => true,
            ]
        );

        $ss2Science = ClassModel::updateOrCreate(
            ['slug' => 'ss2-science'],
            [
                'school_id' => $school1->id,
                'program_id' => $progScience?->id,
                'name' => 'SS2 Science',
                'grade_level' => 'SS2',
                'arm' => null,
                'section' => null,
                'description' => 'SS2 Science track — Advanced Science modules and practicals.',
                'is_active' => true,
            ]
        );

        $ss3Science = ClassModel::updateOrCreate(
            ['slug' => 'ss3-science'],
            [
                'school_id' => $school1->id,
                'program_id' => $progScience?->id,
                'name' => 'SS3 Science',
                'grade_level' => 'SS3',
                'arm' => null,
                'section' => null,
                'description' => 'SS3 Science track — WAEC/JAMB/NECO revision and mastery.',
                'is_active' => true,
            ]
        );

        // 2. Senior Secondary - Business Track (SS1 - SS3)
        $ss1Business = ClassModel::updateOrCreate(
            ['slug' => 'ss1-business'],
            [
                'school_id' => $school1->id,
                'program_id' => $progBusiness?->id,
                'name' => 'SS1 Business',
                'grade_level' => 'SS1',
                'arm' => null,
                'section' => null,
                'description' => 'SS1 Business track — Financial Accounting, Commerce, and Economics.',
                'is_active' => true,
            ]
        );

        $ss2Business = ClassModel::updateOrCreate(
            ['slug' => 'ss2-business'],
            [
                'school_id' => $school1->id,
                'program_id' => $progBusiness?->id,
                'name' => 'SS2 Business',
                'grade_level' => 'SS2',
                'arm' => null,
                'section' => null,
                'description' => 'SS2 Business track — Cost Accounting, Business Studies, and Commerce.',
                'is_active' => true,
            ]
        );

        $ss3Business = ClassModel::updateOrCreate(
            ['slug' => 'ss3-business'],
            [
                'school_id' => $school1->id,
                'program_id' => $progBusiness?->id,
                'name' => 'SS3 Business',
                'grade_level' => 'SS3',
                'arm' => null,
                'section' => null,
                'description' => 'SS3 Business track — WAEC/JAMB/NECO Commercial examination mastery.',
                'is_active' => true,
            ]
        );

        // 3. Senior Secondary - Humanities Track (SS1 - SS3)
        $ss1Humanities = ClassModel::updateOrCreate(
            ['slug' => 'ss1-humanities'],
            [
                'school_id' => $school1->id,
                'program_id' => $progHumanities?->id,
                'name' => 'SS1 Humanities',
                'grade_level' => 'SS1',
                'arm' => null,
                'section' => null,
                'description' => 'SS1 Humanities track — Literature-in-English, Government, and History.',
                'is_active' => true,
            ]
        );

        $ss2Humanities = ClassModel::updateOrCreate(
            ['slug' => 'ss2-humanities'],
            [
                'school_id' => $school1->id,
                'program_id' => $progHumanities?->id,
                'name' => 'SS2 Humanities',
                'grade_level' => 'SS2',
                'arm' => null,
                'section' => null,
                'description' => 'SS2 Humanities track — Comparative Literature and Civic Studies.',
                'is_active' => true,
            ]
        );

        $ss3Humanities = ClassModel::updateOrCreate(
            ['slug' => 'ss3-humanities'],
            [
                'school_id' => $school1->id,
                'program_id' => $progHumanities?->id,
                'name' => 'SS3 Humanities',
                'grade_level' => 'SS3',
                'arm' => null,
                'section' => null,
                'description' => 'SS3 Humanities track — WAEC/JAMB/NECO Arts & Humanities mastery.',
                'is_active' => true,
            ]
        );

        // ==========================================
        // School 2: Greenwood High School Classes
        // ==========================================
        $gwSS1Science = ClassModel::updateOrCreate(
            ['slug' => 'ss1-greenwood-science'],
            [
                'school_id' => $school2->id,
                'program_id' => $progScience?->id,
                'name' => 'SS1 Science',
                'grade_level' => 'SS1',
                'arm' => null,
                'section' => null,
                'description' => 'SS1 Science curriculum for Greenwood High.',
                'is_active' => true,
            ]
        );

        $gwSS2Science = ClassModel::updateOrCreate(
            ['slug' => 'ss2-greenwood-science'],
            [
                'school_id' => $school2->id,
                'program_id' => $progScience?->id,
                'name' => 'SS2 Science',
                'grade_level' => 'SS2',
                'arm' => null,
                'section' => null,
                'description' => 'SS2 Science curriculum for Greenwood High.',
                'is_active' => true,
            ]
        );

        $gwSS3Science = ClassModel::updateOrCreate(
            ['slug' => 'ss3-greenwood-science'],
            [
                'school_id' => $school2->id,
                'program_id' => $progScience?->id,
                'name' => 'SS3 Science',
                'grade_level' => 'SS3',
                'arm' => null,
                'section' => null,
                'description' => 'SS3 Science curriculum for Greenwood High.',
                'is_active' => true,
            ]
        );

        // ==========================================
        // Assign Teachers to Classes
        // ==========================================
        if ($teacher1) {
            // Sarah Teacher teaches Senior Science (SS1, SS2, SS3)
            foreach ([$ss1Science, $ss2Science, $ss3Science] as $cls) {
                ClassMembership::updateOrCreate(
                    ['class_id' => $cls->id, 'user_id' => $teacher1->id],
                    ['role' => 'teacher', 'is_active' => true]
                );
            }
        }

        if ($teacher2) {
            // Emeka Okafor teaches Senior Business (SS1, SS2, SS3)
            foreach ([$ss1Business, $ss2Business, $ss3Business] as $cls) {
                ClassMembership::updateOrCreate(
                    ['class_id' => $cls->id, 'user_id' => $teacher2->id],
                    ['role' => 'teacher', 'is_active' => true]
                );
            }
        }

        if ($teacher3) {
            // Fatima Sanusi teaches Greenwood Science (SS1, SS2, SS3)
            foreach ([$gwSS1Science, $gwSS2Science, $gwSS3Science] as $cls) {
                ClassMembership::updateOrCreate(
                    ['class_id' => $cls->id, 'user_id' => $teacher3->id],
                    ['role' => 'teacher', 'is_active' => true]
                );
            }
        }

        // ==========================================
        // Enroll Learners into Classes
        // ==========================================
        if ($learner1) {
            ClassMembership::updateOrCreate(
                ['class_id' => $ss1Science->id, 'user_id' => $learner1->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner2) {
            ClassMembership::updateOrCreate(
                ['class_id' => $ss1Science->id, 'user_id' => $learner2->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner3) {
            ClassMembership::updateOrCreate(
                ['class_id' => $ss1Business->id, 'user_id' => $learner3->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner4) {
            ClassMembership::updateOrCreate(
                ['class_id' => $gwSS2Science->id, 'user_id' => $learner4->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        if ($learner5) {
            ClassMembership::updateOrCreate(
                ['class_id' => $gwSS3Science->id, 'user_id' => $learner5->id],
                ['role' => 'learner', 'is_active' => true]
            );
        }

        $this->command?->info("Clean Grade Ladder Classes seeded successfully.");
    }
}
