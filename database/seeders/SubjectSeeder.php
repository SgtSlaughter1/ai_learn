<?php

namespace Database\Seeders;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Mathematics (20 Questions total)
        $math = Subject::updateOrCreate(
            ['slug' => 'mathematics'],
            [
                'name' => 'Mathematics',
                'description' => 'Core high school mathematics curriculum covering Algebra, Geometry, Trigonometry, and Calculus.',
                'status' => 'active',
                'sort_order' => 1,
            ]
        );

        // SS1 Algebra (5 Questions)
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

        $this->createQuestion($algebra, 'What is the value of x if 2x + 5 = 15?', 'Solve the simple linear equation by subtracting 5 and dividing by 2.', ['5' => true, '10' => false, '15' => false, '2' => false]);
        $this->createQuestion($algebra, 'Simplify: 3(x + 2) - 2x', 'Distribute 3 to x and 2, then combine like terms: 3x + 6 - 2x = x + 6.', ['x + 6' => true, 'x + 2' => false, '5x + 6' => false, 'x + 5' => false]);
        $this->createQuestion($algebra, 'Factorize completely: x^2 - 5x + 6', 'Find two numbers that multiply to 6 and add to -5. They are -2 and -3.', ['(x - 2)(x - 3)' => true, '(x - 6)(x - 1)' => false, '(x + 2)(x + 3)' => false, '(x - 5)(x - 6)' => false]);
        $this->createQuestion($algebra, 'If 3x - 7 = 5x + 9, find x.', 'Subtract 3x from both sides: -7 = 2x + 9. Subtract 9: -16 = 2x. Divide by 2: x = -8.', ['-8' => true, '8' => false, '-1' => false, '2' => false]);
        $this->createQuestion($algebra, 'Solve for y: (y/3) + 4 = 10', 'Subtract 4 from both sides: y/3 = 6. Multiply by 3: y = 18.', ['18' => true, '14' => false, '6' => false, '12' => false]);

        // SS1 Geometry (5 Questions)
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

        $this->createQuestion($geometry, 'What is the sum of angles in a triangle?', 'By Euclidean theorem, the sum of internal angles of any triangle is always 180 degrees.', ['180°' => true, '90°' => false, '360°' => false, '270°' => false]);
        $this->createQuestion($geometry, 'What is the sum of interior angles of a regular hexagon?', 'Use the formula (n - 2) * 180. For a hexagon, (6 - 2) * 180 = 720 degrees.', ['720°' => true, '540°' => false, '360°' => false, '180°' => false]);
        $this->createQuestion($geometry, 'An isosceles triangle has two equal angles of 50° each. What is the measure of the third angle?', 'The sum is 180°. 180° - 50° - 50° = 80°.', ['80°' => true, '50°' => false, '90°' => false, '100°' => false]);
        $this->createQuestion($geometry, 'What is the area of a circle with radius 7 cm? (Use pi = 22/7)', 'Area = pi * r^2. (22/7) * 7 * 7 = 154 cm².', ['154 cm²' => true, '44 cm²' => false, '196 cm²' => false, '49 cm²' => false]);
        $this->createQuestion($geometry, 'Find the perimeter of a rectangle with length 10 cm and width 6 cm.', 'Perimeter = 2 * (length + width) = 2 * (10 + 6) = 32 cm.', ['32 cm' => true, '60 cm' => false, '16 cm' => false, '20 cm' => false]);

        // SS2 Trigonometry (5 Questions)
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

        $this->createQuestion($trig, 'In a right-angled triangle, if the opposite side is 3 and the adjacent side is 4, what is the sine of the angle?', 'Sine is Opposite/Hypotenuse. First, find hypotenuse using Pythagoras: sqrt(3^2 + 4^2) = 5. So, sin = 3/5.', ['3/5' => true, '4/5' => false, '3/4' => false, '5/3' => false]);
        $this->createQuestion($trig, 'What is the value of cos(90°)?', 'From the trigonometric unit circle, cosine of 90 degrees is exactly 0.', ['0' => true, '1' => false, '0.5' => false, '-1' => false]);
        $this->createQuestion($trig, 'What is the value of sin(30°)?', 'Sine of 30 degrees is exactly 0.5 (or 1/2).', ['0.5' => true, '1' => false, '0.866' => false, '0.707' => false]);
        $this->createQuestion($trig, 'Which trigonometric identity is correct?', 'By definition, the sum of the squares of sine and cosine of an angle is 1.', ['sin²(x) + cos²(x) = 1' => true, 'sin²(x) - cos²(x) = 1' => false, 'sec²(x) + tan²(x) = 1' => false, 'cosec²(x) + cot²(x) = 1' => false]);
        $this->createQuestion($trig, 'What is the value of tan(45°)?', 'Tan of 45 degrees is sin(45°)/cos(45°) = 1.', ['1' => true, '0' => false, '0.5' => false, 'Infinity' => false]);

        // SS3 Calculus (5 Questions)
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

        $this->createQuestion($calculus, 'What is the derivative of x^2 with respect to x?', 'Using the power rule of differentiation: d/dx (x^n) = n * x^(n-1). For x^2, it is 2x.', ['2x' => true, 'x' => false, '2' => false, 'x^3 / 3' => false]);
        $this->createQuestion($calculus, 'Find the limit of (x^2 - 4)/(x - 2) as x approaches 2.', 'Factor the numerator: (x - 2)(x + 2). Cancel (x - 2), leaving (x + 2). Sub x = 2 to get 4.', ['4' => true, '2' => false, '0' => false, 'Undefined' => false]);
        $this->createQuestion($calculus, 'What is the derivative of 5x + 3 with respect to x?', 'The derivative of a linear term mx is m, and the derivative of a constant is 0. So it is 5.', ['5' => true, '3' => false, '5x' => false, '0' => false]);
        $this->createQuestion($calculus, 'Integrate: 2x dx', 'The integral is x^2 + C, where C is the constant of integration.', ['x² + C' => true, '2x² + C' => false, 'x²' => false, '2 + C' => false]);
        $this->createQuestion($calculus, 'Evaluate the limit as x approaches 0 of sin(x)/x.', 'By L\'Hopital\'s rule or standard calculus limits, the limit is 1.', ['1' => true, '0' => false, 'Undefined' => false, '0.5' => false]);


        // 2. English Language (20 Questions total)
        $english = Subject::updateOrCreate(
            ['slug' => 'english'],
            [
                'name' => 'English Language',
                'description' => 'Grammar, concord rules, comprehension, and structural syntax.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        // SS1 Verb Tenses (7 Questions)
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

        $this->createQuestion($tenses, 'Which sentence is in the present perfect tense?', 'The present perfect tense is formed with subject + have/has + past participle.', ['She has written three essays.' => true, 'She wrote three essays.' => false, 'She is writing three essays.' => false, 'She will write three essays.' => false]);
        $this->createQuestion($tenses, 'Complete the sentence: "By this time next year, they ______ the project."', 'The future perfect tense (will have + past participle) represents an action completed before a future time.', ['will have completed' => true, 'will complete' => false, 'have completed' => false, 'would complete' => false]);
        $this->createQuestion($tenses, 'Identify the tense: "He was running when I saw him."', 'The sentence represents an action that was ongoing in the past, which is Past Continuous.', ['Past continuous' => true, 'Past perfect' => false, 'Simple past' => false, 'Present continuous' => false]);
        $this->createQuestion($tenses, 'Choose the correct form: "She ______ to school every day."', 'For simple present singular subjects, append -s or -es to the base verb.', ['goes' => true, 'go' => false, 'going' => false, 'gone' => false]);
        $this->createQuestion($tenses, 'Choose the correct form: "Yesterday, I ______ my wallet."', 'The action occurred in the past, so we use the simple past form "lost".', ['lost' => true, 'lose' => false, 'losing' => false, 'have lost' => false]);
        $this->createQuestion($tenses, 'Complete: "If I ______ the answer, I would have told you."', 'Third conditional sentences use "had + past participle" in the if-clause.', ['had known' => true, 'know' => false, 'knew' => false, 'have known' => false]);
        $this->createQuestion($tenses, 'Identify: "They have been studying for three hours."', 'The sentence describes an action started in the past and continuing now, which is Present Perfect Continuous.', ['Present perfect continuous' => true, 'Present perfect' => false, 'Present continuous' => false, 'Past perfect continuous' => false]);

        // SS2 Concord / Subject-Verb Agreement (7 Questions)
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

        $this->createQuestion($concord, 'Choose the correct verb: "The committee ______ submitted its report."', 'A collective noun acting as a single unit takes a singular verb.', ['has' => true, 'have' => false, 'are' => false, 'were' => false]);
        $this->createQuestion($concord, 'Choose the correct verb: "Either the teacher or the students ______ to present today."', 'When subjects are joined by either/or, the verb agrees with the closer subject ("students" is plural).', ['are' => true, 'is' => false, 'was' => false, 'has' => false]);
        $this->createQuestion($concord, 'Choose the correct verb: "A number of students ______ present today."', '"A number of" takes a plural verb, whereas "the number of" takes a singular verb.', ['are' => true, 'is' => false, 'was' => false, 'has' => false]);
        $this->createQuestion($concord, 'Choose the correct verb: "Bread and butter ______ my favorite breakfast."', 'When two singular nouns refer to a single compound concept/unit, they take a singular verb.', ['is' => true, 'are' => false, 'were' => false, 'have been' => false]);
        $this->createQuestion($concord, 'Choose: "Ten miles ______ a long distance to walk."', 'Plural expressions of distance or money acting as a single quantity take singular verbs.', ['is' => true, 'are' => false, 'were' => false, 'have been' => false]);
        $this->createQuestion($concord, 'Choose: "One of the boys ______ stolen the pen."', '"One of the..." takes a singular verb because the subject is "One".', ['has' => true, 'have' => false, 'are' => false, 'were' => false]);
        $this->createQuestion($concord, 'Choose: "Every student and teacher ______ expected to attend."', 'Subjects preceded by "every" or "each" take singular verbs.', ['is' => true, 'are' => false, 'were' => false, 'have been' => false]);

        // SS3 Figures of Speech (6 Questions)
        $speech = Topic::updateOrCreate(
            ['subject_id' => $english->id, 'slug' => 'figures-of-speech'],
            [
                'name' => 'Figures of Speech',
                'level' => 'ss3',
                'description' => 'Identification and analysis of literary devices and figurative expressions.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        $this->createQuestion($speech, 'Identify the figure of speech: "The wind whispered through the dark trees."', 'Giving human qualities (whispering) to non-human entities (wind) is personification.', ['Personification' => true, 'Metaphor' => false, 'Simile' => false, 'Irony' => false]);
        $this->createQuestion($speech, 'Identify the figure of speech: "He was a lion in the battlefield."', 'A direct comparison between two unlike things without using "like" or "as" is a metaphor.', ['Metaphor' => true, 'Simile' => false, 'Oxymoron' => false, 'Hyperbole' => false]);
        $this->createQuestion($speech, 'Identify the figure of speech: "My backpack weighs a ton!"', 'An extreme exaggeration used to make a point is hyperbole.', ['Hyperbole' => true, 'Oxymoron' => false, 'Irony' => false, 'Metaphor' => false]);
        $this->createQuestion($speech, 'Identify the figure of speech: "Parting is such sweet sorrow."', 'Combining two contradictory terms (sweet, sorrow) side-by-side is an oxymoron.', ['Oxymoron' => true, 'Metaphor' => false, 'Pun' => false, 'Personification' => false]);
        $this->createQuestion($speech, 'Identify: "The classroom was as quiet as a graveyard."', 'A comparison using "as" or "like" is a simile.', ['Simile' => true, 'Metaphor' => false, 'Personification' => false, 'Onomatopoeia' => false]);
        $this->createQuestion($speech, 'Identify: "He was not unhappy with the results."', 'Using an understated negative statement to express a positive assertion is litotes.', ['Litotes' => true, 'Sarcasm' => false, 'Metonymy' => false, 'Euphemism' => false]);


        // 3. Biology (20 Questions total)
        $biology = Subject::updateOrCreate(
            ['slug' => 'biology'],
            [
                'name' => 'Biology',
                'description' => 'Study of life processes, nutrition, genetics, and structural ecology.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        // SS1 Cells (7 Questions)
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

        $this->createQuestion($cells, 'Which organelle is known as the powerhouse of the cell?', 'Mitochondria perform cellular respiration to produce ATP, the cell\'s energy currency.', ['Mitochondrion' => true, 'Nucleus' => false, 'Ribosome' => false, 'Chloroplast' => false]);
        $this->createQuestion($cells, 'Which organelle contains chlorophyll and is the site of photosynthesis?', 'Chloroplasts capture light energy to produce sugars via photosynthesis in plant cells.', ['Chloroplast' => true, 'Mitochondrion' => false, 'Vacuole' => false, 'Cell Wall' => false]);
        $this->createQuestion($cells, 'What is the primary function of the ribosomes?', 'Ribosomes serve as the cellular machinery for protein synthesis.', ['Protein synthesis' => true, 'Energy production' => false, 'Lipid storage' => false, 'Cellular division' => false]);
        $this->createQuestion($cells, 'Which structure is present in plant cells but absent in animal cells?', 'Plant cells possess rigid outer cell walls, whereas animal cells do not.', ['Cell wall' => true, 'Cell membrane' => false, 'Mitochondrion' => false, 'Nucleus' => false]);
        $this->createQuestion($cells, 'What is the control center of the cell containing genetic material?', 'The nucleus houses the chromosomes and DNA, controlling cellular processes.', ['Nucleus' => true, 'Cytoplasm' => false, 'Lysosome' => false, 'Ribosome' => false]);
        $this->createQuestion($cells, 'Which organelle acts as the packaging and distribution center of the cell?', 'The Golgi apparatus modifies, sorts, and packages macromolecules for delivery.', ['Golgi apparatus' => true, 'Endoplasmic reticulum' => false, 'Mitochondrion' => false, 'Centriole' => false]);
        $this->createQuestion($cells, 'What is the jelly-like substance inside the cell membrane?', 'The cytoplasm is the viscous medium filling the internal space of cells.', ['Cytoplasm' => true, 'Nucleus' => false, 'Cell sap' => false, 'Nucleoplasm' => false]);

        // SS2 Nutrition (7 Questions)
        $nutrition = Topic::updateOrCreate(
            ['subject_id' => $biology->id, 'slug' => 'digestive-system'],
            [
                'name' => 'Nutrition and Digestion',
                'level' => 'ss2',
                'description' => 'Alimentary canal, digestive enzymes, and food absorption mechanisms.',
                'status' => 'active',
                'sort_order' => 2,
            ]
        );

        $this->createQuestion($nutrition, 'Which enzyme in saliva starts the digestion of cooked starch in the mouth?', 'Salivary amylase (ptyalin) breaks down starches into simpler sugars like maltose.', ['Amylase' => true, 'Pepsin' => false, 'Lipase' => false, 'Trypsin' => false]);
        $this->createQuestion($nutrition, 'Where is bile produced in the human body?', 'Bile is produced by the liver and stored in the gall bladder for lipid emulsification.', ['Liver' => true, 'Gall Bladder' => false, 'Pancreas' => false, 'Stomach' => false]);
        $this->createQuestion($nutrition, 'Which enzyme is responsible for the digestion of proteins in the stomach?', 'Pepsin is the primary protein-digesting enzyme in the acidic environment of the stomach.', ['Pepsin' => true, 'Amylase' => false, 'Lipase' => false, 'Ptyalin' => false]);
        $this->createQuestion($nutrition, 'In which part of the human digestive system does most absorption take place?', 'The small intestine is long and lined with villi, optimizing nutrient absorption.', ['Small intestine' => true, 'Stomach' => false, 'Large intestine' => false, 'Esophagus' => false]);
        $this->createQuestion($nutrition, 'What is the finger-like projection in the small intestine that increases absorption area?', 'Villi are tiny, finger-like projections that increase surface area for food absorption.', ['Villus' => true, 'Cilia' => false, 'Alveolus' => false, 'Flagella' => false]);
        $this->createQuestion($nutrition, 'Which food class is primarily digested by lipase?', 'Lipases catalyze the breakdown of lipids (fats and oils) into fatty acids and glycerol.', ['Lipids (Fats)' => true, 'Proteins' => false, 'Carbohydrates' => false, 'Vitamins' => false]);
        $this->createQuestion($nutrition, 'What is the main function of the large intestine?', 'The large intestine primarily absorbs water and mineral salts from undigested food.', ['Absorption of water' => true, 'Digestion of proteins' => false, 'Emulsification of fats' => false, 'Production of enzymes' => false]);

        // SS3 Genetics (6 Questions)
        $genetics = Topic::updateOrCreate(
            ['subject_id' => $biology->id, 'slug' => 'genetics-heredity'],
            [
                'name' => 'Genetics & Heredity',
                'level' => 'ss3',
                'description' => 'Mendel\'s laws, inheritance patterns, chromosomes, and DNA transcription.',
                'status' => 'active',
                'sort_order' => 3,
            ]
        );

        $this->createQuestion($genetics, 'What is the genotypic ratio of a monohybrid cross between two heterozygous parents (F2 generation)?', 'Heterozygous cross (Tt x Tt) yields a genotypic ratio of 1 TT : 2 Tt : 1 tt (1:2:1).', ['1:2:1' => true, '3:1' => false, '9:3:3:1' => false, '1:1' => false]);
        $this->createQuestion($genetics, 'Which nitrogenous base is present in RNA but absent in DNA?', 'RNA utilizes Uracil instead of Thymine to pair with Adenine.', ['Uracil' => true, 'Thymine' => false, 'Cytosine' => false, 'Adenine' => false]);
        $this->createQuestion($genetics, 'What is the physical or observable expression of a gene called?', 'The phenotype is the physical manifestation of an organism\'s genotype combined with environmental factors.', ['Phenotype' => true, 'Genotype' => false, 'Allele' => false, 'Heredity' => false]);
        $this->createQuestion($genetics, 'Who is widely recognized as the father of modern genetics?', 'Gregor Mendel studied inheritance patterns in pea plants and established key heredity laws.', ['Gregor Mendel' => true, 'Charles Darwin' => false, 'Louis Pasteur' => false, 'Robert Hooke' => false]);
        $this->createQuestion($genetics, 'How many chromosomes are in a normal human somatic cell?', 'Normal human somatic cells contain 23 pairs of chromosomes, which is 46 total.', ['46' => true, '23' => false, '48' => false, '44' => false]);
        $this->createQuestion($genetics, 'Which term describes having two identical alleles for a particular gene?', 'Homozygous means possessing two matching alleles (e.g. AA or aa) for a genetic locus.', ['Homozygous' => true, 'Heterozygous' => false, 'Recessive' => false, 'Dominant' => false]);
    }

    private function createQuestion(Topic $topic, string $text, string $explanation, array $optionsData): Question
    {
        $question = Question::updateOrCreate(
            ['topic_id' => $topic->id, 'question_text' => $text],
            [
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
