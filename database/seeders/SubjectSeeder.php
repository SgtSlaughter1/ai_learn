<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $school1 = School::where('slug', 'ailearn-academy')->first();
        $school2 = School::where('slug', 'greenwood-high-school')->first();

        // 1. Mathematics (School 1: AILEARN Academy)
        $math = Subject::updateOrCreate(
            ['slug' => 'mathematics'],
            [
                'school_id' => $school1?->id,
                'name' => 'Mathematics',
                'description' => 'Core secondary school mathematics curriculum covering Algebra, Geometry, Trigonometry, and Calculus.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        // SS1 Algebra
        $algebra = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'algebraic-expressions'],
            [
                'name' => 'Algebraic Expressions',
                'level' => 'ss1',
                'description' => 'Introduction to algebraic terms, expressions, and linear equations.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($algebra, 'What is the value of x if 2x + 5 = 15?', 'Solve the simple linear equation by subtracting 5 and dividing by 2.', ['5' => true, '10' => false, '15' => false, '2' => false], $school1?->id);
        $this->createQuestion($algebra, 'Simplify: 3(x + 2) - 2x', 'Distribute 3 to x and 2, then combine like terms: 3x + 6 - 2x = x + 6.', ['x + 6' => true, 'x + 2' => false, '5x + 6' => false, 'x + 5' => false], $school1?->id);
        $this->createQuestion($algebra, 'Factorize completely: x^2 - 5x + 6', 'Find two numbers that multiply to 6 and add to -5. They are -2 and -3.', ['(x - 2)(x - 3)' => true, '(x - 6)(x - 1)' => false, '(x + 2)(x + 3)' => false, '(x - 5)(x - 6)' => false], $school1?->id);
        $this->createQuestion($algebra, 'If 3x - 7 = 5x + 9, find x.', 'Subtract 3x from both sides: -7 = 2x + 9. Subtract 9: -16 = 2x. Divide by 2: x = -8.', ['-8' => true, '8' => false, '-1' => false, '2' => false], $school1?->id);
        $this->createQuestion($algebra, 'Solve for y: (y/3) + 4 = 10', 'Subtract 4 from both sides: y/3 = 6. Multiply by 3: y = 18.', ['18' => true, '14' => false, '6' => false, '12' => false], $school1?->id);

        // SS1 Geometry
        $geometry = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'euclidean-geometry'],
            [
                'name' => 'Euclidean Geometry',
                'level' => 'ss1',
                'description' => 'Introduction to plane shapes, lines, angles, and proofs.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $this->createQuestion($geometry, 'What is the sum of angles in a triangle?', 'By Euclidean theorem, the sum of internal angles of any triangle is always 180 degrees.', ['180°' => true, '90°' => false, '360°' => false, '270°' => false], $school1?->id);
        $this->createQuestion($geometry, 'What is the sum of interior angles of a regular hexagon?', 'Use the formula (n - 2) * 180. For a hexagon, (6 - 2) * 180 = 720 degrees.', ['720°' => true, '540°' => false, '360°' => false, '180°' => false], $school1?->id);
        $this->createQuestion($geometry, 'An isosceles triangle has two equal angles of 50° each. What is the measure of the third angle?', 'The sum is 180°. 180° - 50° - 50° = 80°.', ['80°' => true, '50°' => false, '90°' => false, '100°' => false], $school1?->id);
        $this->createQuestion($geometry, 'What is the area of a circle with radius 7 cm? (Use pi = 22/7)', 'Area = pi * r^2. (22/7) * 7 * 7 = 154 cm².', ['154 cm²' => true, '44 cm²' => false, '196 cm²' => false, '49 cm²' => false], $school1?->id);
        $this->createQuestion($geometry, 'Find the perimeter of a rectangle with length 10 cm and width 6 cm.', 'Perimeter = 2 * (length + width) = 2 * (10 + 6) = 32 cm.', ['32 cm' => true, '60 cm' => false, '16 cm' => false, '20 cm' => false], $school1?->id);

        // SS2 Trigonometry
        $trig = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'trigonometry'],
            [
                'name' => 'Trigonometry',
                'level' => 'ss2',
                'description' => 'Trigonometric ratios, identities, sine and cosine rules, and graphs.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        $this->createQuestion($trig, 'In a right-angled triangle, if the opposite side is 3 and the adjacent side is 4, what is the sine of the angle?', 'Sine is Opposite/Hypotenuse. First, find hypotenuse using Pythagoras: sqrt(3^2 + 4^2) = 5. So, sin = 3/5.', ['3/5' => true, '4/5' => false, '3/4' => false, '5/3' => false], $school1?->id);
        $this->createQuestion($trig, 'What is the value of cos(90°)?', 'From the trigonometric unit circle, cosine of 90 degrees is exactly 0.', ['0' => true, '1' => false, '0.5' => false, '-1' => false], $school1?->id);
        $this->createQuestion($trig, 'What is the value of sin(30°)?', 'Sine of 30 degrees is exactly 0.5 (or 1/2).', ['0.5' => true, '1' => false, '0.866' => false, '0.707' => false], $school1?->id);
        $this->createQuestion($trig, 'Which trigonometric identity is correct?', 'By definition, the sum of the squares of sine and cosine of an angle is 1.', ['sin²(x) + cos²(x) = 1' => true, 'sin²(x) - cos²(x) = 1' => false, 'sec²(x) + tan²(x) = 1' => false, 'cosec²(x) + cot²(x) = 1' => false], $school1?->id);
        $this->createQuestion($trig, 'What is the value of tan(45°)?', 'Tan of 45 degrees is sin(45°)/cos(45°) = 1.', ['1' => true, '0' => false, '0.5' => false, 'Infinity' => false], $school1?->id);

        // SS3 Calculus
        $calculus = Topic::updateOrCreate(
            ['subject_id' => $math->id, 'slug' => 'calculus-intro'],
            [
                'name' => 'Introduction to Calculus',
                'level' => 'ss3',
                'description' => 'Basic limits, differentiation from first principles, and simple integration.',
                'status' => 'active',
                'sort_order' => 4,
            ]
        );

        $this->createQuestion($calculus, 'What is the derivative of x^2 with respect to x?', 'Using the power rule of differentiation: d/dx (x^n) = n * x^(n-1). For x^2, it is 2x.', ['2x' => true, 'x' => false, '2' => false, 'x^3 / 3' => false], $school1?->id);
        $this->createQuestion($calculus, 'Find the limit of (x^2 - 4)/(x - 2) as x approaches 2.', 'Factor the numerator: (x - 2)(x + 2). Cancel (x - 2), leaving (x + 2). Sub x = 2 to get 4.', ['4' => true, '2' => false, '0' => false, 'Undefined' => false], $school1?->id);
        $this->createQuestion($calculus, 'What is the derivative of 5x + 3 with respect to x?', 'The derivative of a linear term mx is m, and the derivative of a constant is 0. So it is 5.', ['5' => true, '3' => false, '5x' => false, '0' => false], $school1?->id);
        $this->createQuestion($calculus, 'Integrate: 2x dx', 'The integral is x^2 + C, where C is the constant of integration.', ['x² + C' => true, '2x² + C' => false, 'x²' => false, '2 + C' => false], $school1?->id);
        $this->createQuestion($calculus, 'Evaluate the limit as x approaches 0 of sin(x)/x.', 'By L\'Hopital\'s rule or standard calculus limits, the limit is 1.', ['1' => true, '0' => false, 'Undefined' => false, '0.5' => false], $school1?->id);


        // 2. English Language (School 1: AILEARN Academy)
        $english = Subject::updateOrCreate(
            ['slug' => 'english'],
            [
                'school_id' => $school1?->id,
                'name' => 'English Language',
                'description' => 'Grammar, concord rules, comprehension, and structural syntax.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        // SS1 Verb Tenses
        $tenses = Topic::updateOrCreate(
            ['subject_id' => $english->id, 'slug' => 'verb-tenses'],
            [
                'name' => 'Verb Tenses',
                'level' => 'ss1',
                'description' => 'Mastery of present, past, and future perfect tense structures.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($tenses, 'Which sentence is in the present perfect tense?', 'The present perfect tense is formed with subject + have/has + past participle.', ['She has written three essays.' => true, 'She wrote three essays.' => false, 'She is writing three essays.' => false, 'She will write three essays.' => false], $school1?->id);
        $this->createQuestion($tenses, 'Complete the sentence: "By this time next year, they ______ the project."', 'The future perfect tense (will have + past participle) represents an action completed before a future time.', ['will have completed' => true, 'will complete' => false, 'have completed' => false, 'would complete' => false], $school1?->id);
        $this->createQuestion($tenses, 'Identify the tense: "He was running when I saw him."', 'The sentence represents an action that was ongoing in the past, which is Past Continuous.', ['Past continuous' => true, 'Past perfect' => false, 'Simple past' => false, 'Present continuous' => false], $school1?->id);
        $this->createQuestion($tenses, 'Choose the correct form: "She ______ to school every day."', 'For simple present singular subjects, append -s or -es to the base verb.', ['goes' => true, 'go' => false, 'going' => false, 'gone' => false], $school1?->id);
        $this->createQuestion($tenses, 'Choose the correct form: "Yesterday, I ______ my wallet."', 'The action occurred in the past, so we use the simple past form "lost".', ['lost' => true, 'lose' => false, 'losing' => false, 'have lost' => false], $school1?->id);

        // SS2 Concord
        $concord = Topic::updateOrCreate(
            ['subject_id' => $english->id, 'slug' => 'concord-rules'],
            [
                'name' => 'Concord Rules',
                'level' => 'ss2',
                'description' => 'Mastery of subject-verb agreement under complex conditions.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $this->createQuestion($concord, 'Choose the correct verb: "The committee ______ submitted its report."', 'A collective noun acting as a single unit takes a singular verb.', ['has' => true, 'have' => false, 'are' => false, 'were' => false], $school1?->id);
        $this->createQuestion($concord, 'Choose the correct verb: "Either the teacher or the students ______ to present today."', 'When subjects are joined by either/or, the verb agrees with the closer subject ("students" is plural).', ['are' => true, 'is' => false, 'was' => false, 'has' => false], $school1?->id);
        $this->createQuestion($concord, 'Choose the correct verb: "Bread and butter ______ my favorite breakfast."', 'When two singular nouns refer to a single compound concept/unit, they take a singular verb.', ['is' => true, 'are' => false, 'were' => false, 'have been' => false], $school1?->id);


        // 3. Biology (School 1: AILEARN Academy)
        $biology = Subject::updateOrCreate(
            ['slug' => 'biology'],
            [
                'school_id' => $school1?->id,
                'name' => 'Biology',
                'description' => 'Study of life processes, nutrition, genetics, and structural ecology.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        // SS1 Cells
        $cells = Topic::updateOrCreate(
            ['subject_id' => $biology->id, 'slug' => 'cell-structure'],
            [
                'name' => 'Cell Structure & Function',
                'level' => 'ss1',
                'description' => 'Understanding plant and animal cells, organelles, and respiration.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($cells, 'Which organelle is known as the powerhouse of the cell?', 'Mitochondria perform cellular respiration to produce ATP, the cell\'s energy currency.', ['Mitochondrion' => true, 'Nucleus' => false, 'Ribosome' => false, 'Chloroplast' => false], $school1?->id);
        $this->createQuestion($cells, 'Which organelle contains chlorophyll and is the site of photosynthesis?', 'Chloroplasts capture light energy to produce sugars via photosynthesis in plant cells.', ['Chloroplast' => true, 'Mitochondrion' => false, 'Vacuole' => false, 'Cell Wall' => false], $school1?->id);
        $this->createQuestion($cells, 'What is the primary function of the ribosomes?', 'Ribosomes serve as the cellular machinery for protein synthesis.', ['Protein synthesis' => true, 'Energy production' => false, 'Lipid storage' => false, 'Cellular division' => false], $school1?->id);
        $this->createQuestion($cells, 'Which structure is present in plant cells but absent in animal cells?', 'Plant cells possess rigid outer cell walls, whereas animal cells do not.', ['Cell wall' => true, 'Cell membrane' => false, 'Mitochondrion' => false, 'Nucleus' => false], $school1?->id);


        // 4. Chemistry (School 2: Greenwood High School)
        $chemistry = Subject::updateOrCreate(
            ['slug' => 'chemistry'],
            [
                'school_id' => $school2?->id,
                'name' => 'Chemistry',
                'description' => 'Matter, chemical bonding, atomic structure, and reactions.',
                'status' => 'active',
                'sort_order' => 4,
            ]
        );

        $bonding = Topic::updateOrCreate(
            ['subject_id' => $chemistry->id, 'slug' => 'chemical-bonding'],
            [
                'name' => 'Chemical Bonding & Structure',
                'level' => 'ss2',
                'description' => 'Ionic, covalent, metallic bonding, and molecular geometries.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($bonding, 'What type of bond is formed by the transfer of electrons from a metal to a non-metal?', 'Electrovalent (ionic) bonding involves complete transfer of electrons.', ['Ionic bond' => true, 'Covalent bond' => false, 'Metallic bond' => false, 'Hydrogen bond' => false], $school2?->id);
        $this->createQuestion($bonding, 'What is the atomic number of Carbon?', 'Carbon has 6 protons, giving it an atomic number of 6.', ['6' => true, '12' => false, '14' => false, '8' => false], $school2?->id);
        $this->createQuestion($bonding, 'What is the pH value of pure water at 25°C?', 'Pure neutral water has a pH of 7.', ['7' => true, '0' => false, '14' => false, '1' => false], $school2?->id);


        // 5. Physics (School 2: Greenwood High School)
        $physics = Subject::updateOrCreate(
            ['slug' => 'physics'],
            [
                'school_id' => $school2?->id,
                'name' => 'Physics',
                'description' => 'Mechanics, energy, wave motion, electricity, and modern physics.',
                'status' => 'active',
                'sort_order' => 5,
            ]
        );

        $mechanics = Topic::updateOrCreate(
            ['subject_id' => $physics->id, 'slug' => 'motion-forces'],
            [
                'name' => 'Motion & Newton\'s Laws',
                'level' => 'ss2',
                'description' => 'Kinematics, dynamics, friction, and Newton\'s laws of motion.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($mechanics, 'What is the SI unit of Force?', 'Force is measured in Newtons (N = kg m/s²).', ['Newton' => true, 'Joule' => false, 'Watt' => false, 'Pascal' => false], $school2?->id);
        $this->createQuestion($mechanics, 'According to Newton\'s Second Law, Force is equal to:', 'Force is mass multiplied by acceleration (F = ma).', ['Mass × Acceleration' => true, 'Mass / Acceleration' => false, 'Velocity × Time' => false, 'Work / Distance' => false], $school2?->id);


        // 6. Computer Studies & AI (General Knowledge - Available across all schools & platforms)
        $tech = Subject::updateOrCreate(
            ['slug' => 'computer-studies'],
            [
                'school_id' => null, // General Knowledge
                'name' => 'Computer Studies & AI',
                'description' => 'Foundational digital literacy, computational algorithms, and artificial intelligence concepts.',
                'status' => 'active',
                'sort_order' => 6,
            ]
        );

        $aiIntro = Topic::updateOrCreate(
            ['subject_id' => $tech->id, 'slug' => 'ai-foundations'],
            [
                'name' => 'AI & Digital Foundations',
                'level' => 'ss1',
                'description' => 'Introduction to artificial intelligence, neural concepts, and digital literacy.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion($aiIntro, 'What does AI stand for in modern computing?', 'AI stands for Artificial Intelligence.', ['Artificial Intelligence' => true, 'Automated Internet' => false, 'Applied Informatics' => false, 'Advanced Integration' => false], null);
        $this->createQuestion($aiIntro, 'What is the primary function of a Central Processing Unit (CPU)?', 'The CPU executes program instructions and processes data.', ['Execute program instructions' => true, 'Store files permanently' => false, 'Display images on screen' => false, 'Supply electrical power' => false], null);
        $this->createQuestion($aiIntro, 'Which data structure follows the First-In, First-Out (FIFO) principle?', 'A Queue processes items in the exact order they arrive (FIFO).', ['Queue' => true, 'Stack' => false, 'Binary Tree' => false, 'Array' => false], null);
    }

    private function createQuestion(Topic $topic, string $text, string $explanation, array $optionsData, ?int $schoolId = null): Question
    {
        $question = Question::updateOrCreate(
            ['topic_id' => $topic->id, 'question_text' => $text],
            [
                'school_id' => $schoolId,
                'type' => 'multiple_choice',
                'difficulty' => 'medium',
                'explanation' => $explanation,
                'status' => 'active',
            ]
        );

        $sortOrder = 1;
        foreach ($optionsData as $optionText => $isCorrect) {
            QuestionOption::updateOrCreate(
                ['question_id' => $question->id, 'option_text' => $optionText],
                [
                    'sort_order' => $sortOrder++,
                    'is_correct' => $isCorrect,
                ]
            );
        }

        return $question;
    }
}
