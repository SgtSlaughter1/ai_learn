<?php

namespace Database\Seeders;

use App\Models\ClassModel;
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
        $school1 = School::where('slug', 'passpoint-academy')->first();
        $school2 = School::where('slug', 'greenwood-high-school')->first();

        $classSS1Science = ClassModel::where('slug', 'ss1-science')->first();
        $classSS2Science = ClassModel::where('slug', 'ss2-science')->first();
        $classSS3Science = ClassModel::where('slug', 'ss3-science')->first();

        $classSS1Business = ClassModel::where('slug', 'ss1-business')->first();
        $classSS2Business = ClassModel::where('slug', 'ss2-business')->first();
        $classSS3Business = ClassModel::where('slug', 'ss3-business')->first();

        $classSS1Humanities = ClassModel::where('slug', 'ss1-humanities')->first();
        $classSS2Humanities = ClassModel::where('slug', 'ss2-humanities')->first();
        $classSS3Humanities = ClassModel::where('slug', 'ss3-humanities')->first();

        $classGreenwoodSS1 = ClassModel::where('slug', 'ss1-greenwood-science')->first();
        $classGreenwoodSS2 = ClassModel::where('slug', 'ss2-greenwood-science')->first();

        // =========================================================================
        // 1. SS1 SCIENCE (PassPoint Academy)
        // =========================================================================

        // 1.1 Mathematics (SS1 Science)
        $mathSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-mathematics'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Science?->id,
                'name' => 'Mathematics',
                'description' => 'Algebra, Euclidean Geometry, Mensuration, and Set Theory.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $algebra = Topic::updateOrCreate(
            ['subject_id' => $mathSS1->id, 'slug' => 'algebraic-expressions'],
            [
                'name' => 'Algebraic Expressions & Equations',
                'level' => 'SS1',
                'description' => 'Linear equations, factorisation, quadratic expansions, and algebraic fractions.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $algebra,
            'Solve for $x$: $2x + 5 = 15$',
            'Subtract 5 from both sides: $2x = 10$. Divide by 2: $x = 5$.',
            ['$x = 5$' => true, '$x = 10$' => false, '$x = 15$' => false, '$x = 2$' => false],
            $school1?->id
        );

        $this->createQuestion(
            $algebra,
            'Simplify the algebraic expression: $3(x + 2) - 2(x - 1)$',
            'Expand the terms: $3x + 6 - 2x + 2 = (3x - 2x) + (6 + 2) = x + 8$.',
            ['$x + 8$' => true, '$x + 4$' => false, '$5x + 8$' => false, '$x + 6$' => false],
            $school1?->id
        );

        $this->createQuestion(
            $algebra,
            'Factorize completely: $x^2 - 5x + 6$',
            'Find two integers whose product is $6$ and sum is $-5$. They are $-2$ and $-3$: $(x - 2)(x - 3)$.',
            ['$(x - 2)(x - 3)$' => true, '$(x - 6)(x - 1)$' => false, '$(x + 2)(x + 3)$' => false, '$(x - 5)(x - 6)$' => false],
            $school1?->id
        );

        $geometry = Topic::updateOrCreate(
            ['subject_id' => $mathSS1->id, 'slug' => 'euclidean-geometry'],
            [
                'name' => 'Euclidean Geometry & Mensuration',
                'level' => 'SS1',
                'description' => 'Plane geometry, polygons, circle theorems, and Pythagorean calculations.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $this->createQuestion(
            $geometry,
            'What is the formula for the sum of interior angles in an $n$-sided convex polygon?',
            'The sum of interior angles of an $n$-gon is given by $(n - 2) \times 180^\circ$.',
            ['$(n - 2) \times 180^\circ$' => true, '$n \times 180^\circ$' => false, '$(n + 2) \times 180^\circ$' => false, '$(2n - 4) \times 90^\circ$' => false],
            $school1?->id
        );

        $this->createQuestion(
            $geometry,
            'What is the area of a circle with radius $r = 7\text{ cm}$? (Take $\pi = \frac{22}{7}$)',
            'Area $A = \pi r^2 = \frac{22}{7} \times 7 \times 7 = 154\text{ cm}^2$.',
            ['$154\text{ cm}^2$' => true, '$44\text{ cm}^2$' => false, '$196\text{ cm}^2$' => false, '$49\text{ cm}^2$' => false],
            $school1?->id
        );

        // 1.2 Biology (SS1 Science)
        $bioSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-biology'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Science?->id,
                'name' => 'Biology',
                'description' => 'Cell biology, classification of living things, nutrition, and respiration.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $cells = Topic::updateOrCreate(
            ['subject_id' => $bioSS1->id, 'slug' => 'cell-structure-function'],
            [
                'name' => 'Cell Structure & Function',
                'level' => 'SS1',
                'description' => 'Plant and animal cell organelles, membrane transport, and cellular respiration.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $cells,
            'Which organelle is referred to as the powerhouse of the eukaryotic cell?',
            'Mitochondria generate adenosine triphosphate (ATP) through cellular aerobic respiration.',
            ['Mitochondrion' => true, 'Nucleus' => false, 'Ribosome' => false, 'Chloroplast' => false],
            $school1?->id
        );

        $this->createQuestion(
            $cells,
            'Which cellular structure is present in plant cells but absent in animal cells?',
            'Plant cells possess a rigid outer cell wall composed of cellulose, whereas animal cells only have a plasma membrane.',
            ['Cell wall' => true, 'Cell membrane' => false, 'Mitochondrion' => false, 'Ribosome' => false],
            $school1?->id
        );

        // 1.3 Physics (SS1 Science)
        $physicsSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-physics'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Science?->id,
                'name' => 'Physics',
                'description' => 'Units, measurements, kinematics, and vectors in introductory physics.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        $unitsTopic = Topic::updateOrCreate(
            ['subject_id' => $physicsSS1->id, 'slug' => 'units-and-measurements'],
            [
                'name' => 'Units & Measurements',
                'level' => 'SS1',
                'description' => 'Fundamental and derived physical quantities and dimensions.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $unitsTopic,
            'Which of the following is a fundamental SI unit?',
            'Kilogram (kg) is a fundamental SI base unit of mass.',
            ['Kilogram' => true, 'Newton' => false, 'Joule' => false, 'Watt' => false],
            $school1?->id
        );

        // =========================================================================
        // 2. SS2 SCIENCE (PassPoint Academy)
        // =========================================================================
        $physicsSS2 = Subject::updateOrCreate(
            ['slug' => 'ss2-physics'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS2Science?->id,
                'name' => 'Physics',
                'description' => 'Mechanics, Newton\'s laws, projectile motion, and wave optics.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $mechanics = Topic::updateOrCreate(
            ['subject_id' => $physicsSS2->id, 'slug' => 'motion-forces'],
            [
                'name' => 'Kinematics & Newton\'s Laws of Motion',
                'level' => 'SS2',
                'description' => 'Linear motion equations, friction, momentum, and Newton\'s laws.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $mechanics,
            'According to Newton\'s Second Law of Motion, what is the formula relating Force ($F$), mass ($m$), and acceleration ($a$)?',
            'Force is directly proportional to the product of mass and acceleration: $F = ma$.',
            ['$F = ma$' => true, '$F = \frac{m}{a}$' => false, '$F = \frac{1}{2}ma^2$' => false, '$F = m + a$' => false],
            $school1?->id
        );

        $this->createQuestion(
            $mechanics,
            'Which equation of uniform linear motion relates final velocity ($v$), initial velocity ($u$), acceleration ($a$), and displacement ($s$)?',
            'The third equation of motion independent of time is $v^2 = u^2 + 2as$.',
            ['$v^2 = u^2 + 2as$' => true, '$v = u + \frac{1}{2}at^2$' => false, '$s = vt + \frac{1}{2}at$' => false, '$v^2 = u^2 - 2at$' => false],
            $school1?->id
        );

        // =========================================================================
        // 3. SS1 BUSINESS (PassPoint Academy)
        // =========================================================================
        $accountingSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-financial-accounting'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Business?->id,
                'name' => 'Financial Accounting',
                'description' => 'Principles of double entry, ledger posting, trial balance, and source documents.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $doubleEntry = Topic::updateOrCreate(
            ['subject_id' => $accountingSS1->id, 'slug' => 'double-entry-system'],
            [
                'name' => 'Double Entry Bookkeeping & Ledgers',
                'level' => 'SS1',
                'description' => 'Debit and credit conventions, cash book, and general ledger accounts.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $doubleEntry,
            'In the double entry bookkeeping system, an increase in assets is recorded as a:',
            'Assets increase on the debit side and decrease on the credit side.',
            ['Debit entry' => true, 'Credit entry' => false, 'Contra entry' => false, 'Journal adjustment' => false],
            $school1?->id
        );

        $this->createQuestion(
            $doubleEntry,
            'What is the primary accounting equation?',
            'Assets always equal Liabilities plus Owner\'s Equity (Capital).',
            ['$\text{Assets} = \text{Liabilities} + \text{Capital}$' => true, '$\text{Assets} = \text{Liabilities} - \text{Capital}$' => false, '$\text{Capital} = \text{Assets} + \text{Liabilities}$' => false, '$\text{Profit} = \text{Assets} + \text{Income}$' => false],
            $school1?->id
        );

        $commerceSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-commerce'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Business?->id,
                'name' => 'Commerce',
                'description' => 'Introduction to trade, aids to trade, production, and business organizations.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $tradeTopic = Topic::updateOrCreate(
            ['subject_id' => $commerceSS1->id, 'slug' => 'trade-and-production'],
            [
                'name' => 'Nature of Commerce & Aids to Trade',
                'level' => 'SS1',
                'description' => 'Home trade, foreign trade, banking, insurance, transportation, and warehousing.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $tradeTopic,
            'Which of the following functions as an aid to trade by providing compensation against potential financial loss?',
            'Insurance indemnifies businesses against unforeseen losses and risks.',
            ['Insurance' => true, 'Advertising' => false, 'Warehousing' => false, 'Transportation' => false],
            $school1?->id
        );

        // =========================================================================
        // 4. SS2 BUSINESS (PassPoint Academy)
        // =========================================================================
        $accountingSS2 = Subject::updateOrCreate(
            ['slug' => 'ss2-financial-accounting'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS2Business?->id,
                'name' => 'Financial Accounting',
                'description' => 'Bank reconciliation, final accounts of sole traders, and adjustment entries.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $bankRecon = Topic::updateOrCreate(
            ['subject_id' => $accountingSS2->id, 'slug' => 'bank-reconciliation'],
            [
                'name' => 'Bank Reconciliation Statements',
                'level' => 'SS2',
                'description' => 'Unpresented cheques, uncredited deposits, and adjusted cash book balances.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $bankRecon,
            'An unpresented cheque is a cheque that has been:',
            'Drawn and entered in the cash book but not yet presented to the bank for payment.',
            ['Issued to a creditor but not yet cleared by the bank' => true, 'Received from a debtor but not yet paid into bank' => false, 'Dishonoured by the bank' => false, 'Lost in transit' => false],
            $school1?->id
        );

        // =========================================================================
        // 5. SS1 HUMANITIES (PassPoint Academy)
        // =========================================================================
        $govSS1 = Subject::updateOrCreate(
            ['slug' => 'ss1-government'],
            [
                'school_id' => $school1?->id,
                'class_id' => $classSS1Humanities?->id,
                'name' => 'Government',
                'description' => 'Structure of government, basic concepts of democracy, and constitutional development.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $armsGov = Topic::updateOrCreate(
            ['subject_id' => $govSS1->id, 'slug' => 'arms-of-government'],
            [
                'name' => 'Arms of Government & Separation of Powers',
                'level' => 'SS1',
                'description' => 'Legislature, Executive, Judiciary, and the doctrine of checks and balances.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $armsGov,
            'Which arm of government is constitutionally empowered to interpret laws and administer justice?',
            'The Judiciary is responsible for interpreting laws, adjudicating disputes, and administering justice.',
            ['Judiciary' => true, 'Legislature' => false, 'Executive' => false, 'Electoral Commission' => false],
            $school1?->id
        );

        $this->createQuestion(
            $armsGov,
            'The principle of Separation of Powers was prominently propounded by which political philosopher?',
            'Baron de Montesquieu formulated the modern doctrine of separation of powers in 1748.',
            ['Baron de Montesquieu' => true, 'John Locke' => false, 'Thomas Hobbes' => false, 'Jean-Jacques Rousseau' => false],
            $school1?->id
        );

        // =========================================================================
        // 6. GENERAL KNOWLEDGE (Platform-Wide)
        // =========================================================================
        $tech = Subject::updateOrCreate(
            ['slug' => 'computer-studies'],
            [
                'school_id' => null, // General Knowledge platform-wide
                'class_id' => null,
                'name' => 'Computer Studies & AI',
                'description' => 'Digital literacy, algorithm design, data structures, and foundational artificial intelligence.',
                'status' => 'active',
                'sort_order' => 10,
            ]
        );

        $aiIntro = Topic::updateOrCreate(
            ['subject_id' => $tech->id, 'slug' => 'ai-foundations'],
            [
                'name' => 'AI & Digital Foundations',
                'level' => 'SS1',
                'description' => 'Artificial intelligence principles, machine learning concepts, and computational thinking.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        $this->createQuestion(
            $aiIntro,
            'What is the primary learning paradigm where an AI model learns patterns from labeled training data?',
            'Supervised learning trains models using input-output pairs where ground truth labels are provided.',
            ['Supervised Learning' => true, 'Unsupervised Learning' => false, 'Reinforcement Learning' => false, 'Heuristic Search' => false],
            null
        );

        $this->createQuestion(
            $aiIntro,
            'Which data structure operates on a First-In, First-Out (FIFO) principle?',
            'A Queue processes elements in the exact order they arrived (FIFO).',
            ['Queue' => true, 'Stack' => false, 'Binary Search Tree' => false, 'Hash Map' => false],
            null
        );

        $this->createQuestion(
            $aiIntro,
            'What is the time complexity of the optimal Merge Sort and Heap Sort comparison algorithms?',
            'Optimal comparison sorting achieves an average and worst-case time complexity of $\mathcal{O}(n \log n)$.',
            ['$\mathcal{O}(n \log n)$' => true, '$\mathcal{O}(n^2)$' => false, '$\mathcal{O}(n)$' => false, '$\mathcal{O}(1)$' => false],
            null
        );

        $this->command?->info("Subjects, Topics, and Questions seeded cleanly by class.");
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
