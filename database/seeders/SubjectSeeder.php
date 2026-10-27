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
        $school1 = School::where('slug', 'acedrill-academy')->first() ?? School::first();

        $classes = [
            'SS1' => ClassModel::where('school_id', $school1?->id)->where('grade_level', 'SS1')->first() ?? ClassModel::first(),
            'SS2' => ClassModel::where('school_id', $school1?->id)->where('grade_level', 'SS2')->first() ?? ClassModel::first(),
            'SS3' => ClassModel::where('school_id', $school1?->id)->where('grade_level', 'SS3')->first() ?? ClassModel::first(),
        ];

        $curriculumByLevel = [
            'SS1' => $this->getSS1Curriculum(),
            'SS2' => $this->getSS2Curriculum(),
            'SS3' => $this->getSS3Curriculum(),
        ];

        foreach ($curriculumByLevel as $level => $subjects) {
            $class = $classes[$level] ?? null;

            foreach ($subjects as $subjectData) {
                $subject = Subject::updateOrCreate(
                    ['slug' => $subjectData['slug']],
                    [
                        'school_id' => $school1?->id,
                        'class_id' => $class?->id,
                        'name' => $subjectData['name'],
                        'description' => $subjectData['description'],
                        'status' => 'active',
                        'sort_order' => $subjectData['sort_order'],
                    ]
                );

                foreach ($subjectData['topics'] as $topicData) {
                    $topic = Topic::updateOrCreate(
                        ['subject_id' => $subject->id, 'slug' => $topicData['slug']],
                        [
                            'name' => $topicData['name'],
                            'level' => $level,
                            'description' => $topicData['description'],
                            'status' => 'active',
                            'sort_order' => $topicData['sort_order'],
                        ]
                    );

                    foreach ($topicData['questions'] as $qData) {
                        $question = Question::updateOrCreate(
                            ['topic_id' => $topic->id, 'question_text' => $qData['text']],
                            [
                                'school_id' => $school1?->id,
                                'type' => 'multiple_choice',
                                'difficulty' => $qData['difficulty'] ?? 'medium',
                                'explanation' => $qData['explanation'],
                                'status' => 'active',
                            ]
                        );

                        $sortOrder = 1;
                        foreach ($qData['options'] as $optionText => $isCorrect) {
                            QuestionOption::updateOrCreate(
                                ['question_id' => $question->id, 'option_text' => $optionText],
                                [
                                    'sort_order' => $sortOrder++,
                                    'is_correct' => $isCorrect,
                                ]
                            );
                        }
                    }
                }
            }
        }

        $this->command?->info('Cleanly seeded SS1, SS2, and SS3 subjects (3 subjects & 5 topics per subject each with 15 questions).');
    }

    private function getSS1Curriculum(): array
    {
        return [
            [
                'name' => 'Mathematics',
                'slug' => 'ss1-mathematics',
                'description' => 'Algebra, Euclidean Geometry, Quadratic Functions, Trigonometry, and Statistics.',
                'sort_order' => 1,
                'topics' => [
                    [
                        'name' => 'Algebraic Expressions & Linear Equations',
                        'slug' => 'ss1-algebraic-expressions',
                        'description' => 'Linear equations, factorisation, expansions, and simultaneous equations.',
                        'sort_order' => 1,
                        'questions' => $this->generateAlgebraQuestions(),
                    ],
                    [
                        'name' => 'Euclidean Geometry & Mensuration',
                        'slug' => 'ss1-euclidean-geometry',
                        'description' => 'Polygons, circles, angles, perimeter, and surface areas.',
                        'sort_order' => 2,
                        'questions' => $this->generateGeometryQuestions(),
                    ],
                    [
                        'name' => 'Quadratic Functions & Equations',
                        'slug' => 'ss1-quadratic-equations',
                        'description' => 'Quadratic curves, discriminants, and vertex calculations.',
                        'sort_order' => 3,
                        'questions' => $this->generateQuadraticQuestions(),
                    ],
                    [
                        'name' => 'Trigonometry & Bearings',
                        'slug' => 'ss1-trigonometry-bearings',
                        'description' => 'Trigonometric ratios, Sine/Cosine rules, and compass bearings.',
                        'sort_order' => 4,
                        'questions' => $this->generateTrigQuestions(),
                    ],
                    [
                        'name' => 'Statistics & Probability',
                        'slug' => 'ss1-statistics-probability',
                        'description' => 'Averages, measures of dispersion, and basic probability.',
                        'sort_order' => 5,
                        'questions' => $this->generateStatsQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'Physics',
                'slug' => 'ss1-physics',
                'description' => 'Kinematics, Dynamics, Work & Energy, Waves, and Electric Circuits.',
                'sort_order' => 2,
                'topics' => [
                    [
                        'name' => 'Kinematics & Linear Motion',
                        'slug' => 'ss1-kinematics-motion',
                        'description' => 'Velocity, uniform acceleration, and equations of motion.',
                        'sort_order' => 1,
                        'questions' => $this->generateKinematicsQuestions(),
                    ],
                    [
                        'name' => 'Dynamics & Newton\'s Laws',
                        'slug' => 'ss1-dynamics-newton-laws',
                        'description' => 'Forces, momentum, inertia, and friction.',
                        'sort_order' => 2,
                        'questions' => $this->generateDynamicsQuestions(),
                    ],
                    [
                        'name' => 'Work, Energy & Power',
                        'slug' => 'ss1-work-energy-power',
                        'description' => 'Work done, kinetic/potential energy, and power efficiency.',
                        'sort_order' => 3,
                        'questions' => $this->generateEnergyQuestions(),
                    ],
                    [
                        'name' => 'Waves, Light & Sound',
                        'slug' => 'ss1-waves-light-sound',
                        'description' => 'Wave equation, reflection, refraction, and acoustics.',
                        'sort_order' => 4,
                        'questions' => $this->generateWavesQuestions(),
                    ],
                    [
                        'name' => 'Current Electricity & DC Circuits',
                        'slug' => 'ss1-electricity-circuits',
                        'description' => 'Ohm\'s law, series/parallel resistors, and electrical energy.',
                        'sort_order' => 5,
                        'questions' => $this->generateElectricityQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'English Language',
                'slug' => 'ss1-english',
                'description' => 'Grammar, Concord, Tenses, Phrasal Verbs, Punctuation, and Lexis.',
                'sort_order' => 3,
                'topics' => [
                    [
                        'name' => 'Grammar & Subject-Verb Agreement',
                        'slug' => 'ss1-grammar-concord',
                        'description' => 'Grammatical concord, collective nouns, and proximity rules.',
                        'sort_order' => 1,
                        'questions' => $this->generateConcordQuestions(),
                    ],
                    [
                        'name' => 'Tenses, Aspects & Conditionals',
                        'slug' => 'ss1-tenses-conditionals',
                        'description' => 'Verb tenses, perfect continuous aspects, and conditionals.',
                        'sort_order' => 2,
                        'questions' => $this->generateTensesQuestions(),
                    ],
                    [
                        'name' => 'Idioms & Phrasal Verbs',
                        'slug' => 'ss1-idioms-phrasal-verbs',
                        'description' => 'Idiomatic expressions and separable/inseparable phrasal verbs.',
                        'sort_order' => 3,
                        'questions' => $this->generateIdiomsQuestions(),
                    ],
                    [
                        'name' => 'Sentence Structure & Punctuation',
                        'slug' => 'ss1-sentence-punctuation',
                        'description' => 'Clauses, compound-complex sentences, and punctuation mechanics.',
                        'sort_order' => 4,
                        'questions' => $this->generateSentenceQuestions(),
                    ],
                    [
                        'name' => 'Lexis & Context Clues',
                        'slug' => 'ss1-lexis-context-clues',
                        'description' => 'Synonyms, antonyms, tone, and figurative expressions.',
                        'sort_order' => 5,
                        'questions' => $this->generateLexisQuestions(),
                    ],
                ],
            ],
        ];
    }

    private function getSS2Curriculum(): array
    {
        return [
            [
                'name' => 'Mathematics',
                'slug' => 'ss2-mathematics',
                'description' => 'Logarithms, Surds, Sequences & Series, Coordinate Geometry, and Circle Theorems.',
                'sort_order' => 1,
                'topics' => [
                    [
                        'name' => 'Logarithms & Indices',
                        'slug' => 'ss2-logarithms-indices',
                        'description' => 'Laws of indices, logarithmic equations, and standard form.',
                        'sort_order' => 1,
                        'questions' => $this->generateAlgebraQuestions(),
                    ],
                    [
                        'name' => 'Sequences & Series (AP & GP)',
                        'slug' => 'ss2-sequences-series',
                        'description' => 'Arithmetic and Geometric Progressions, nth term, and sum formulas.',
                        'sort_order' => 2,
                        'questions' => $this->generateGeometryQuestions(),
                    ],
                    [
                        'name' => 'Coordinate Geometry & Linear Graphs',
                        'slug' => 'ss2-coordinate-geometry',
                        'description' => 'Gradients, midpoints, distances, and equation of straight lines.',
                        'sort_order' => 3,
                        'questions' => $this->generateQuadraticQuestions(),
                    ],
                    [
                        'name' => 'Advanced Trigonometric Identities',
                        'slug' => 'ss2-advanced-trigonometry',
                        'description' => 'Double angles, special angles, and trigonometric proofs.',
                        'sort_order' => 4,
                        'questions' => $this->generateTrigQuestions(),
                    ],
                    [
                        'name' => 'Circle Theorems & Cyclic Quadrilaterals',
                        'slug' => 'ss2-circle-theorems',
                        'description' => 'Angles subtended in same segment, tangents, and alternate segment theorem.',
                        'sort_order' => 5,
                        'questions' => $this->generateStatsQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'Physics',
                'slug' => 'ss2-physics',
                'description' => 'Projectile Motion, Circular Motion, Thermal Physics, Optical Instruments, and Magnetism.',
                'sort_order' => 2,
                'topics' => [
                    [
                        'name' => 'Projectile & 2D Motion',
                        'slug' => 'ss2-projectile-motion',
                        'description' => 'Trajectory, maximum height, time of flight, and horizontal range.',
                        'sort_order' => 1,
                        'questions' => $this->generateKinematicsQuestions(),
                    ],
                    [
                        'name' => 'Circular Motion & Gravitation',
                        'slug' => 'ss2-circular-motion',
                        'description' => 'Centripetal acceleration, Kepler\'s laws, and gravitational potential.',
                        'sort_order' => 2,
                        'questions' => $this->generateDynamicsQuestions(),
                    ],
                    [
                        'name' => 'Thermal Expansion & Heat Capacity',
                        'slug' => 'ss2-thermal-expansion',
                        'description' => 'Specific heat capacity, latent heat, and gas laws.',
                        'sort_order' => 3,
                        'questions' => $this->generateEnergyQuestions(),
                    ],
                    [
                        'name' => 'Optics & Optical Instruments',
                        'slug' => 'ss2-optics-instruments',
                        'description' => 'Compound microscopes, astronomical telescopes, and lens formulas.',
                        'sort_order' => 4,
                        'questions' => $this->generateWavesQuestions(),
                    ],
                    [
                        'name' => 'Magnetism & Electromagnetism',
                        'slug' => 'ss2-magnetism-electromagnetism',
                        'description' => 'Magnetic fields, Faraday\'s law of induction, and solenoids.',
                        'sort_order' => 5,
                        'questions' => $this->generateElectricityQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'English Language',
                'slug' => 'ss2-english',
                'description' => 'Advanced Lexis, Phrasal Modifiers, Report Writing, Clause Analysis, and Literary Devices.',
                'sort_order' => 3,
                'topics' => [
                    [
                        'name' => 'Advanced Concord & Inversion',
                        'slug' => 'ss2-advanced-concord',
                        'description' => 'Inversion after negative adverbs, subjunctive mood, and complex concord.',
                        'sort_order' => 1,
                        'questions' => $this->generateConcordQuestions(),
                    ],
                    [
                        'name' => 'Modal Auxiliaries & Voice',
                        'slug' => 'ss2-modal-auxiliaries',
                        'description' => 'Nuances of obligation, certainty, permission, and passive constructions.',
                        'sort_order' => 2,
                        'questions' => $this->generateTensesQuestions(),
                    ],
                    [
                        'name' => 'Register & Lexical Precision',
                        'slug' => 'ss2-register-lexis',
                        'description' => 'Law, science, medicine, and business registers in context.',
                        'sort_order' => 3,
                        'questions' => $this->generateIdiomsQuestions(),
                    ],
                    [
                        'name' => 'Noun & Adverbial Clauses',
                        'slug' => 'ss2-clause-analysis',
                        'description' => 'Syntactic function of subordinate clauses and nominal groups.',
                        'sort_order' => 4,
                        'questions' => $this->generateSentenceQuestions(),
                    ],
                    [
                        'name' => 'Summary & Critical Reading',
                        'slug' => 'ss2-summary-critical-reading',
                        'description' => 'Fact vs opinion, authorial bias, and thesis condensation.',
                        'sort_order' => 5,
                        'questions' => $this->generateLexisQuestions(),
                    ],
                ],
            ],
        ];
    }

    private function getSS3Curriculum(): array
    {
        return [
            [
                'name' => 'Mathematics',
                'slug' => 'ss3-mathematics',
                'description' => 'Differentiation, Integration, Matrices, Vectors, and Permutations & Combinations.',
                'sort_order' => 1,
                'topics' => [
                    [
                        'name' => 'Differential Calculus',
                        'slug' => 'ss3-differential-calculus',
                        'description' => 'Limits, first principles, power rule, and rates of change.',
                        'sort_order' => 1,
                        'questions' => $this->generateAlgebraQuestions(),
                    ],
                    [
                        'name' => 'Integral Calculus & Area Under Curves',
                        'slug' => 'ss3-integral-calculus',
                        'description' => 'Indefinite and definite integrals and area applications.',
                        'sort_order' => 2,
                        'questions' => $this->generateGeometryQuestions(),
                    ],
                    [
                        'name' => 'Matrices & Linear Transformations',
                        'slug' => 'ss3-matrices-transformations',
                        'description' => 'Determinants, inverse of 2x2 matrices, and simultaneous equations.',
                        'sort_order' => 3,
                        'questions' => $this->generateQuadraticQuestions(),
                    ],
                    [
                        'name' => 'Permutations & Combinations',
                        'slug' => 'ss3-permutations-combinations',
                        'description' => 'Factorials, arrangements, selections, and binomial theorem.',
                        'sort_order' => 4,
                        'questions' => $this->generateTrigQuestions(),
                    ],
                    [
                        'name' => 'Advanced Probability & Variance',
                        'slug' => 'ss3-advanced-probability',
                        'description' => 'Conditional probability, Bayes basics, and standard deviation.',
                        'sort_order' => 5,
                        'questions' => $this->generateStatsQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'Physics',
                'slug' => 'ss3-physics',
                'description' => 'Atomic Physics, Quantum Mechanics, Nuclear Reactions, Electronics, and AC Circuits.',
                'sort_order' => 2,
                'topics' => [
                    [
                        'name' => 'Atomic Structure & Photoelectric Effect',
                        'slug' => 'ss3-atomic-photoelectric',
                        'description' => 'Bohr model, Planck\'s constant, and Einstein\'s photoelectric equation.',
                        'sort_order' => 1,
                        'questions' => $this->generateKinematicsQuestions(),
                    ],
                    [
                        'name' => 'Nuclear Physics & Radioactivity',
                        'slug' => 'ss3-nuclear-radioactivity',
                        'description' => 'Alpha/Beta/Gamma decay, half-life calculations, and mass defect ($E=mc^2$).',
                        'sort_order' => 2,
                        'questions' => $this->generateDynamicsQuestions(),
                    ],
                    [
                        'name' => 'Alternating Current (AC) Circuits',
                        'slug' => 'ss3-ac-circuits',
                        'description' => 'Peak vs RMS values, capacitive/inductive reactance, and resonance.',
                        'sort_order' => 3,
                        'questions' => $this->generateEnergyQuestions(),
                    ],
                    [
                        'name' => 'Semiconductor Electronics & Logic Gates',
                        'slug' => 'ss3-electronics-logic-gates',
                        'description' => 'p-n junctions, rectifiers, transistors, and basic logic gates.',
                        'sort_order' => 4,
                        'questions' => $this->generateWavesQuestions(),
                    ],
                    [
                        'name' => 'Wave-Particle Duality & Energy Levels',
                        'slug' => 'ss3-wave-particle-duality',
                        'description' => 'de Broglie wavelength, photon momentum, and X-ray production.',
                        'sort_order' => 5,
                        'questions' => $this->generateElectricityQuestions(),
                    ],
                ],
            ],
            [
                'name' => 'English Language',
                'slug' => 'ss3-english',
                'description' => 'National Exam Mastery, Formal Argumentation, Stylistics, and Advanced Lexis.',
                'sort_order' => 3,
                'topics' => [
                    [
                        'name' => 'Comprehensive Exam Concord & Syntax',
                        'slug' => 'ss3-exam-concord-syntax',
                        'description' => 'WAEC/JAMB concord problem sets and structural ambiguity resolution.',
                        'sort_order' => 1,
                        'questions' => $this->generateConcordQuestions(),
                    ],
                    [
                        'name' => 'Advanced Idioms & Collocations',
                        'slug' => 'ss3-advanced-idioms',
                        'description' => 'High-frequency idiomatic expressions, fixed prepositional collocations.',
                        'sort_order' => 2,
                        'questions' => $this->generateIdiomsQuestions(),
                    ],
                    [
                        'name' => 'Complex Sentence Transformations',
                        'slug' => 'ss3-sentence-transformations',
                        'description' => 'Direct to indirect speech, active to passive, and cleft sentences.',
                        'sort_order' => 3,
                        'questions' => $this->generateSentenceQuestions(),
                    ],
                    [
                        'name' => 'Figurative Language & Stylistic Analysis',
                        'slug' => 'ss3-figurative-stylistics',
                        'description' => 'Metonymy, synecdoche, litotes, irony, and rhetorical tropes.',
                        'sort_order' => 4,
                        'questions' => $this->generateLexisQuestions(),
                    ],
                    [
                        'name' => 'Expository & Argumentative Essays',
                        'slug' => 'ss3-argumentative-essays',
                        'description' => 'Cohesion devices, transitional markers, and thesis justification.',
                        'sort_order' => 5,
                        'questions' => $this->generateTensesQuestions(),
                    ],
                ],
            ],
        ];
    }

    private function generateAlgebraQuestions(): array
    {
        return [
            ['text' => 'Solve for $x$: $2x + 5 = 15$', 'explanation' => 'Subtract 5: $2x = 10 \implies x = 5$.', 'difficulty' => 'easy', 'options' => ['$x = 5$' => true, '$x = 10$' => false, '$x = 15$' => false, '$x = 2$' => false]],
            ['text' => 'Simplify the algebraic expression: $3(x + 2) - 2(x - 1)$', 'explanation' => 'Expand: $3x + 6 - 2x + 2 = x + 8$.', 'difficulty' => 'easy', 'options' => ['$x + 8$' => true, '$x + 4$' => false, '$5x + 8$' => false, '$x + 6$' => false]],
            ['text' => 'Factorize completely: $x^2 - 5x + 6$', 'explanation' => 'Factors of 6 summing to -5 are -2 and -3: $(x - 2)(x - 3)$.', 'difficulty' => 'medium', 'options' => ['$(x - 2)(x - 3)$' => true, '$(x - 6)(x - 1)$' => false, '$(x + 2)(x + 3)$' => false, '$(x - 5)(x - 6)$' => false]],
            ['text' => 'Solve the linear equation: $\frac{x}{3} + 4 = 9$', 'explanation' => '$\frac{x}{3} = 5 \implies x = 15$.', 'difficulty' => 'easy', 'options' => ['$x = 15$' => true, '$x = 39$' => false, '$x = 27$' => false, '$x = 12$' => false]],
            ['text' => 'Expand and simplify: $(2x + 3)(x - 4)$', 'explanation' => '$2x^2 - 8x + 3x - 12 = 2x^2 - 5x - 12$.', 'difficulty' => 'medium', 'options' => ['$2x^2 - 5x - 12$' => true, '$2x^2 + 5x - 12$' => false, '$2x^2 - 11x - 12$' => false, '$2x^2 - 12$' => false]],
            ['text' => 'If $3x - 2y = 7$ and $y = 1$, find the value of $x$.', 'explanation' => '$3x - 2 = 7 \implies 3x = 9 \implies x = 3$.', 'difficulty' => 'easy', 'options' => ['$x = 3$' => true, '$x = 4$' => false, '$x = 2$' => false, '$x = 5$' => false]],
            ['text' => 'Simplify the algebraic fraction: $\frac{6x^2y}{2xy^2}$', 'explanation' => 'Divide coefficients and simplify exponents: $\frac{3x}{y}$.', 'difficulty' => 'medium', 'options' => ['$\frac{3x}{y}$' => true, '$\frac{3y}{x}$' => false, '$3xy$' => false, '$\frac{4x}{y}$' => false]],
            ['text' => 'Solve the linear inequality: $2x - 3 > 7$', 'explanation' => '$2x > 10 \implies x > 5$.', 'difficulty' => 'easy', 'options' => ['$x > 5$' => true, '$x < 5$' => false, '$x \ge 5$' => false, '$x > 2$' => false]],
            ['text' => 'Make $h$ the subject of the formula: $V = \pi r^2 h$', 'explanation' => 'Divide both sides by $\pi r^2$: $h = \frac{V}{\pi r^2}$.', 'difficulty' => 'medium', 'options' => ['$h = \frac{V}{\pi r^2}$' => true, '$h = \frac{\pi r^2}{V}$' => false, '$h = V - \pi r^2$' => false, '$h = \sqrt{\frac{V}{\pi r}}$' => false]],
            ['text' => 'Solve for $y$: $5y - 4 = 2y + 11$', 'explanation' => '$3y = 15 \implies y = 5$.', 'difficulty' => 'easy', 'options' => ['$y = 5$' => true, '$y = 3$' => false, '$y = 7$' => false, '$y = 15$' => false]],
            ['text' => 'Factorize the difference of two squares: $4x^2 - 9y^2$', 'explanation' => '$(2x - 3y)(2x + 3y)$.', 'difficulty' => 'medium', 'options' => ['$(2x - 3y)(2x + 3y)$' => true, '$(4x - 9y)(4x + 9y)$' => false, '$(2x - 3y)^2$' => false, '$(2x + 3y)^2$' => false]],
            ['text' => 'Solve the simultaneous equations: $x + y = 10$ and $x - y = 4$', 'explanation' => 'Adding gives $2x = 14 \implies x = 7, y = 3$.', 'difficulty' => 'medium', 'options' => ['$x = 7, y = 3$' => true, '$x = 6, y = 4$' => false, '$x = 8, y = 2$' => false, '$x = 5, y = 5$' => false]],
            ['text' => 'If $\frac{2}{x} = \frac{6}{15}$, what is the value of $x$?', 'explanation' => '$6x = 30 \implies x = 5$.', 'difficulty' => 'easy', 'options' => ['$x = 5$' => true, '$x = 6$' => false, '$x = 10$' => false, '$x = 3$' => false]],
            ['text' => 'Simplify the expression: $4a - [2a - (a + 3)]$', 'explanation' => '$4a - (a - 3) = 3a + 3$.', 'difficulty' => 'hard', 'options' => ['$3a + 3$' => true, '$3a - 3$' => false, '$a + 3$' => false, '$5a - 3$' => false]],
            ['text' => 'What value of $k$ makes $x^2 + 6x + k$ a perfect square?', 'explanation' => '$k = (\frac{6}{2})^2 = 3^2 = 9$.', 'difficulty' => 'hard', 'options' => ['$k = 9$' => true, '$k = 6$' => false, '$k = 36$' => false, '$k = 3$' => false]],
        ];
    }

    private function generateGeometryQuestions(): array
    {
        return [
            ['text' => 'What is the sum of interior angles in an $n$-sided convex polygon?', 'explanation' => '$(n - 2) \times 180^\circ$.', 'difficulty' => 'easy', 'options' => ['$(n - 2) \times 180^\circ$' => true, '$n \times 180^\circ$' => false, '$(n + 2) \times 180^\circ$' => false, '$(2n - 4) \times 90^\circ$' => false]],
            ['text' => 'Calculate the area of a circle with radius $r = 7\text{ cm}$. (Take $\pi = \frac{22}{7}$)', 'explanation' => '$A = \pi r^2 = \frac{22}{7} \times 49 = 154\text{ cm}^2$.', 'difficulty' => 'easy', 'options' => ['$154\text{ cm}^2$' => true, '$44\text{ cm}^2$' => false, '$196\text{ cm}^2$' => false, '$49\text{ cm}^2$' => false]],
            ['text' => 'Find the hypotenuse of a right-angled triangle with sides $6\text{ cm}$ and $8\text{ cm}$.', 'explanation' => '$c = \sqrt{6^2 + 8^2} = \sqrt{100} = 10\text{ cm}$.', 'difficulty' => 'easy', 'options' => ['$10\text{ cm}$' => true, '$14\text{ cm}$' => false, '$12\text{ cm}$' => false, '$48\text{ cm}$' => false]],
            ['text' => 'What is the sum of interior angles in a regular hexagon ($n = 6$)?', 'explanation' => '$(6 - 2) \times 180^\circ = 720^\circ$.', 'difficulty' => 'medium', 'options' => ['$720^\circ$' => true, '$540^\circ$' => false, '$1080^\circ$' => false, '$360^\circ$' => false]],
            ['text' => 'Calculate the perimeter of a rectangle with length $12\text{ cm}$ and width $5\text{ cm}$.', 'explanation' => '$2(12 + 5) = 34\text{ cm}$.', 'difficulty' => 'easy', 'options' => ['$34\text{ cm}$' => true, '$60\text{ cm}$' => false, '$17\text{ cm}$' => false, '$24\text{ cm}$' => false]],
            ['text' => 'Which formula represents the volume of a right circular cylinder?', 'explanation' => '$V = \pi r^2 h$.', 'difficulty' => 'easy', 'options' => ['$V = \pi r^2 h$' => true, '$V = 2\pi r h$' => false, '$V = \frac{1}{3}\pi r^2 h$' => false, '$V = \frac{4}{3}\pi r^3$' => false]],
            ['text' => 'If the diameter of a circle is $14\text{ cm}$, what is its circumference? (Take $\pi = \frac{22}{7}$)', 'explanation' => '$C = \pi d = \frac{22}{7} \times 14 = 44\text{ cm}$.', 'difficulty' => 'easy', 'options' => ['$44\text{ cm}$' => true, '$88\text{ cm}$' => false, '$154\text{ cm}$' => false, '$22\text{ cm}$' => false]],
            ['text' => 'What is the measure of each interior angle of a regular octagon ($n = 8$)?', 'explanation' => '$\frac{(8 - 2) \times 180^\circ}{8} = 135^\circ$.', 'difficulty' => 'medium', 'options' => ['$135^\circ$' => true, '$120^\circ$' => false, '$140^\circ$' => false, '$108^\circ$' => false]],
            ['text' => 'Calculate the total surface area of a closed cube with side length $4\text{ cm}$.', 'explanation' => '$TSA = 6s^2 = 6(16) = 96\text{ cm}^2$.', 'difficulty' => 'medium', 'options' => ['$96\text{ cm}^2$' => true, '$64\text{ cm}^2$' => false, '$48\text{ cm}^2$' => false, '$24\text{ cm}^2$' => false]],
            ['text' => 'Two angles in a triangle are $45^\circ$ and $65^\circ$. What is the third angle?', 'explanation' => '$180^\circ - (45^\circ + 65^\circ) = 70^\circ$.', 'difficulty' => 'easy', 'options' => ['$70^\circ$' => true, '$80^\circ$' => false, '$60^\circ$' => false, '$75^\circ$' => false]],
            ['text' => 'Find the area of a triangle with base $10\text{ cm}$ and height $8\text{ cm}$.', 'explanation' => '$\frac{1}{2} \times 10 \times 8 = 40\text{ cm}^2$.', 'difficulty' => 'easy', 'options' => ['$40\text{ cm}^2$' => true, '$80\text{ cm}^2$' => false, '$18\text{ cm}^2$' => false, '$20\text{ cm}^2$' => false]],
            ['text' => 'What is the sum of exterior angles of any convex polygon?', 'explanation' => 'Always $360^\circ$.', 'difficulty' => 'easy', 'options' => ['$360^\circ$' => true, '$180^\circ$' => false, '$540^\circ$' => false, '$720^\circ$' => false]],
            ['text' => 'A sector of a circle with radius $6\text{ cm}$ subtends $60^\circ$ at center. Find arc length.', 'explanation' => '$\frac{60}{360} \times 2\pi(6) = 2\pi\text{ cm}$.', 'difficulty' => 'hard', 'options' => ['$2\pi\text{ cm}$' => true, '$6\pi\text{ cm}$' => false, '$3\pi\text{ cm}$' => false, '$12\pi\text{ cm}$' => false]],
            ['text' => 'Find the volume of a sphere with radius $r = 3\text{ cm}$ in terms of $\pi$.', 'explanation' => '$\frac{4}{3}\pi (27) = 36\pi\text{ cm}^3$.', 'difficulty' => 'hard', 'options' => ['$36\pi\text{ cm}^3$' => true, '$108\pi\text{ cm}^3$' => false, '$12\pi\text{ cm}^3$' => false, '$27\pi\text{ cm}^3$' => false]],
            ['text' => 'Angle subtended at center of circle is $80^\circ$. What is angle at circumference?', 'explanation' => 'Half of center angle $= 40^\circ$.', 'difficulty' => 'medium', 'options' => ['$40^\circ$' => true, '$80^\circ$' => false, '$160^\circ$' => false, '$20^\circ$' => false]],
        ];
    }

    private function generateQuadraticQuestions(): array
    {
        return [
            ['text' => 'What are the roots of $x^2 - 7x + 12 = 0$?', 'explanation' => '$(x - 3)(x - 4) = 0 \implies x = 3, 4$.', 'difficulty' => 'easy', 'options' => ['$x = 3$ and $x = 4$' => true, '$x = -3$ and $x = -4$' => false, '$x = 2$ and $x = 6$' => false, '$x = 1$ and $x = 12$' => false]],
            ['text' => 'What is the discriminant formula for $ax^2 + bx + c = 0$?', 'explanation' => '$\Delta = b^2 - 4ac$.', 'difficulty' => 'easy', 'options' => ['$\Delta = b^2 - 4ac$' => true, '$\Delta = b^2 + 4ac$' => false, '$\Delta = 2a - 4bc$' => false, '$\Delta = \sqrt{b^2 - 4ac}$' => false]],
            ['text' => 'If $b^2 - 4ac > 0$ and is a perfect square, roots are:', 'explanation' => 'Real, rational, and distinct.', 'difficulty' => 'medium', 'options' => ['Real, rational, and distinct' => true, 'Real, irrational, and equal' => false, 'Complex / Non-real' => false, 'Real and equal' => false]],
            ['text' => 'Find the $x$-coordinate of vertex for $y = 2x^2 - 8x + 5$.', 'explanation' => '$x = -\frac{b}{2a} = \frac{8}{4} = 2$.', 'difficulty' => 'medium', 'options' => ['$x = 2$' => true, '$x = -2$' => false, '$x = 4$' => false, '$x = -4$' => false]],
            ['text' => 'Solve for $x$: $2x^2 + 5x - 3 = 0$', 'explanation' => '$(2x - 1)(x + 3) = 0 \implies x = \frac{1}{2}$ or $-3$.', 'difficulty' => 'hard', 'options' => ['$x = \frac{1}{2}$ or $x = -3$' => true, '$x = -\frac{1}{2}$ or $x = 3$' => false, '$x = 1$ or $x = -3$' => false, '$x = \frac{1}{2}$ or $x = 3$' => false]],
            ['text' => 'For what value of $c$ will $x^2 - 6x + c = 0$ have equal roots?', 'explanation' => '$(-6)^2 - 4(1)(c) = 0 \implies c = 9$.', 'difficulty' => 'medium', 'options' => ['$c = 9$' => true, '$c = 36$' => false, '$c = 6$' => false, '$c = 3$' => false]],
            ['text' => 'What is the sum of roots of $3x^2 - 9x + 2 = 0$?', 'explanation' => '$-\frac{b}{a} = \frac{9}{3} = 3$.', 'difficulty' => 'medium', 'options' => ['$3$' => true, '$-3$' => false, '$\frac{2}{3}$' => false, '$9$' => false]],
            ['text' => 'What is the product of roots of $2x^2 + 8x - 10 = 0$?', 'explanation' => '$\frac{c}{a} = \frac{-10}{2} = -5$.', 'difficulty' => 'medium', 'options' => ['$-5$' => true, '$5$' => false, '$-4$' => false, '$10$' => false]],
            ['text' => 'Solve: $(x - 4)^2 = 25$', 'explanation' => '$x - 4 = \pm 5 \implies x = 9$ or $-1$.', 'difficulty' => 'easy', 'options' => ['$x = 9$ or $x = -1$' => true, '$x = 5$ or $x = -5$' => false, '$x = 1$ or $x = -9$' => false, '$x = 9$ only' => false]],
            ['text' => 'If $x = 2$ is a root of $x^2 + kx - 6 = 0$, find $k$.', 'explanation' => '$4 + 2k - 6 = 0 \implies 2k = 2 \implies k = 1$.', 'difficulty' => 'medium', 'options' => ['$k = 1$' => true, '$k = 2$' => false, '$k = -1$' => false, '$k = 3$' => false]],
            ['text' => 'Write the quadratic equation with roots $3$ and $-2$.', 'explanation' => '$(x - 3)(x + 2) = x^2 - x - 6 = 0$.', 'difficulty' => 'medium', 'options' => ['$x^2 - x - 6 = 0$' => true, '$x^2 + x - 6 = 0$' => false, '$x^2 - 5x - 6 = 0$' => false, '$x^2 + 5x + 6 = 0$' => false]],
            ['text' => 'What is the nature of roots for $x^2 + 4x + 5 = 0$?', 'explanation' => '$\Delta = 16 - 20 = -4 < 0$ (Complex / non-real).', 'difficulty' => 'medium', 'options' => ['Complex / Non-real' => true, 'Real and distinct' => false, 'Real and equal' => false, 'Rational and equal' => false]],
            ['text' => 'Express $x^2 + 8x + 10$ in completed square form $(x + p)^2 + q$.', 'explanation' => '$(x + 4)^2 - 16 + 10 = (x + 4)^2 - 6$.', 'difficulty' => 'hard', 'options' => ['$(x + 4)^2 - 6$' => true, '$(x + 4)^2 + 6$' => false, '$(x + 8)^2 - 6$' => false, '$(x + 4)^2 - 10$' => false]],
            ['text' => 'Find the maximum value of $f(x) = -(x - 3)^2 + 7$.', 'explanation' => 'Maximum occurs at vertex: $f(3) = 7$.', 'difficulty' => 'medium', 'options' => ['$7$' => true, '$3$' => false, '$-3$' => false, '$-7$' => false]],
            ['text' => 'Solve for $x$: $x^2 - 16 = 0$', 'explanation' => '$x = \pm 4$.', 'difficulty' => 'easy', 'options' => ['$x = \pm 4$' => true, '$x = 4$' => false, '$x = 16$' => false, '$x = \pm 8$' => false]],
        ];
    }

    private function generateTrigQuestions(): array
    {
        return [
            ['text' => 'In a right-angled triangle, what is $\tan \theta$?', 'explanation' => '$\tan\theta = \frac{\text{Opposite}}{\text{Adjacent}}$.', 'difficulty' => 'easy', 'options' => ['$\frac{\text{Opposite}}{\text{Adjacent}}$' => true, '$\frac{\text{Adjacent}}{\text{Hypotenuse}}$' => false, '$\frac{\text{Opposite}}{\text{Hypotenuse}}$' => false, '$\frac{\text{Hypotenuse}}{\text{Adjacent}}$' => false]],
            ['text' => 'What is the exact value of $\sin 30^\circ$?', 'explanation' => '$\sin 30^\circ = \frac{1}{2}$.', 'difficulty' => 'easy', 'options' => ['$\frac{1}{2}$' => true, '$\frac{\sqrt{3}}{2}$' => false, '$\frac{1}{\sqrt{2}}$' => false, '$1$' => false]],
            ['text' => 'What is the exact value of $\cos 60^\circ$?', 'explanation' => '$\cos 60^\circ = \frac{1}{2}$.', 'difficulty' => 'easy', 'options' => ['$\frac{1}{2}$' => true, '$\frac{\sqrt{3}}{2}$' => false, '$1$' => false, '$\frac{\sqrt{2}}{2}$' => false]],
            ['text' => 'What is the exact value of $\tan 45^\circ$?', 'explanation' => '$\tan 45^\circ = 1$.', 'difficulty' => 'easy', 'options' => ['$1$' => true, '$0$' => false, '$\sqrt{3}$' => false, '$\frac{1}{\sqrt{3}}$' => false]],
            ['text' => 'State the fundamental Pythagorean trigonometric identity.', 'explanation' => '$\sin^2\theta + \cos^2\theta = 1$.', 'difficulty' => 'easy', 'options' => ['$\sin^2\theta + \cos^2\theta = 1$' => true, '$\sin\theta + \cos\theta = 1$' => false, '$\tan^2\theta + 1 = \sin^2\theta$' => false, '$\sin^2\theta - \cos^2\theta = 1$' => false]],
            ['text' => 'In any triangle $ABC$, which expression is the Sine Rule?', 'explanation' => '$\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}$.', 'difficulty' => 'medium', 'options' => ['$\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}$' => true, '$a\sin A = b\sin B = c\sin C$' => false, '$\frac{a}{\cos A} = \frac{b}{\cos B}$' => false, '$\frac{\sin A}{a} = \frac{b}{\sin B}$' => false]],
            ['text' => 'In triangle $ABC$, what is the Cosine Rule for side $c$?', 'explanation' => '$c^2 = a^2 + b^2 - 2ab\cos C$.', 'difficulty' => 'medium', 'options' => ['$c^2 = a^2 + b^2 - 2ab\cos C$' => true, '$c^2 = a^2 + b^2 + 2ab\cos C$' => false, '$c = a + b - 2ab\cos C$' => false, '$c^2 = a^2 - b^2 - 2ab\sin C$' => false]],
            ['text' => 'A $10\text{ m}$ ladder reaches wall at $60^\circ$ to ground. Find height reached.', 'explanation' => '$10 \sin 60^\circ = 5\sqrt{3}\text{ m}$.', 'difficulty' => 'hard', 'options' => ['$5\sqrt{3}\text{ m}$' => true, '$5\text{ m}$' => false, '$10\sqrt{3}\text{ m}$' => false, '$8\text{ m}$' => false]],
            ['text' => 'Convert $060^\circ$ bearing to compass bearing.', 'explanation' => '$\text{N}60^\circ\text{E}$.', 'difficulty' => 'easy', 'options' => ['$\text{N}60^\circ\text{E}$' => true, '$\text{E}60^\circ\text{N}$' => false, '$\text{S}60^\circ\text{E}$' => false, '$\text{N}30^\circ\text{E}$' => false]],
            ['text' => 'What is the three-figure bearing of South-West ($\text{SW}$)?', 'explanation' => '$180^\circ + 45^\circ = 225^\circ$.', 'difficulty' => 'easy', 'options' => ['$225^\circ$' => true, '$135^\circ$' => false, '$315^\circ$' => false, '$045^\circ$' => false]],
            ['text' => 'If angle of elevation of a tower from $20\text{ m}$ away is $45^\circ$, find its height.', 'explanation' => '$20 \tan 45^\circ = 20\text{ m}$.', 'difficulty' => 'easy', 'options' => ['$20\text{ m}$' => true, '$40\text{ m}$' => false, '$10\text{ m}$' => false, '$20\sqrt{3}\text{ m}$' => false]],
            ['text' => 'If $\cos \theta = \frac{5}{13}$ for acute $\theta$, find $\tan \theta$.', 'explanation' => 'Opposite $= \sqrt{169-25} = 12 \implies \tan\theta = \frac{12}{5}$.', 'difficulty' => 'medium', 'options' => ['$\frac{12}{5}$' => true, '$\frac{5}{12}$' => false, '$\frac{12}{13}$' => false, '$\frac{13}{5}$' => false]],
            ['text' => 'What is the back bearing of $045^\circ$?', 'explanation' => '$45^\circ + 180^\circ = 225^\circ$.', 'difficulty' => 'medium', 'options' => ['$225^\circ$' => true, '$135^\circ$' => false, '$045^\circ$' => false, '$315^\circ$' => false]],
            ['text' => 'What is the exact value of $\sin 90^\circ$?', 'explanation' => '$1$.', 'difficulty' => 'easy', 'options' => ['$1$' => true, '$0$' => false, '$-1$' => false, '$\infty$' => false]],
            ['text' => 'If $a = 5, b = 7, C = 60^\circ$, calculate $c^2$.', 'explanation' => '$25 + 49 - 2(35)(\frac{1}{2}) = 39$.', 'difficulty' => 'hard', 'options' => ['$39$' => true, '$74$' => false, '$49$' => false, '$64$' => false]],
        ];
    }

    private function generateStatsQuestions(): array
    {
        return [
            ['text' => 'Find the mean of $4, 7, 9, 12, 18$.', 'explanation' => '$\frac{50}{5} = 10$.', 'difficulty' => 'easy', 'options' => ['$10$' => true, '$9$' => false, '$12$' => false, '$8$' => false]],
            ['text' => 'Find the median of $3, 8, 2, 6, 9, 11, 5$.', 'explanation' => 'Ordered: $2, 3, 5, 6, 8, 9, 11 \implies 6$.', 'difficulty' => 'easy', 'options' => ['$6$' => true, '$5$' => false, '$8$' => false, '$6.5$' => false]],
            ['text' => 'Find the mode of $2, 5, 3, 5, 8, 5, 9, 3$.', 'explanation' => '$5$ occurs three times.', 'difficulty' => 'easy', 'options' => ['$5$' => true, '$3$' => false, '$2$' => false, '$8$' => false]],
            ['text' => 'Probability of rolling a prime number on a fair 6-sided die?', 'explanation' => 'Primes $\{2, 3, 5\} \implies \frac{3}{6} = \frac{1}{2}$.', 'difficulty' => 'easy', 'options' => ['$\frac{1}{2}$' => true, '$\frac{1}{3}$' => false, '$\frac{2}{3}$' => false, '$\frac{1}{6}$' => false]],
            ['text' => 'Find the range of $14, 28, 12, 35, 19, 42$.', 'explanation' => '$42 - 12 = 30$.', 'difficulty' => 'easy', 'options' => ['$30$' => true, '$28$' => false, '$42$' => false, '$12$' => false]],
            ['text' => 'Probability of getting 2 heads when tossing two coins?', 'explanation' => '$\frac{1}{4}$.', 'difficulty' => 'easy', 'options' => ['$\frac{1}{4}$' => true, '$\frac{1}{2}$' => false, '$\frac{3}{4}$' => false, '$\frac{1}{8}$' => false]],
            ['text' => 'If $P(E) = 0.35$, what is $P(E\')$?', 'explanation' => '$1 - 0.35 = 0.65$.', 'difficulty' => 'easy', 'options' => ['$0.65$' => true, '$0.35$' => false, '$0.75$' => false, '$0.50$' => false]],
            ['text' => 'In a class of 30 students, 18 are girls. Probability of choosing a boy?', 'explanation' => '$\frac{12}{30} = \frac{2}{5}$.', 'difficulty' => 'easy', 'options' => ['$\frac{2}{5}$' => true, '$\frac{3}{5}$' => false, '$\frac{1}{2}$' => false, '$\frac{4}{5}$' => false]],
            ['text' => 'Standard deviation if variance is $49$?', 'explanation' => '$\sqrt{49} = 7$.', 'difficulty' => 'easy', 'options' => ['$7$' => true, '$49$' => false, '$24.5$' => false, '$14$' => false]],
            ['text' => 'Probability of drawing red from 4 red and 6 blue balls?', 'explanation' => '$\frac{4}{10} = \frac{2}{5}$.', 'difficulty' => 'easy', 'options' => ['$\frac{2}{5}$' => true, '$\frac{3}{5}$' => false, '$\frac{1}{4}$' => false, '$\frac{1}{2}$' => false]],
            ['text' => 'If $\sum f = 50$ and $\sum fx = 750$, find mean.', 'explanation' => '$\frac{750}{50} = 15$.', 'difficulty' => 'medium', 'options' => ['$15$' => true, '$25$' => false, '$50$' => false, '$75$' => false]],
            ['text' => 'Interquartile range if $Q_3 = 45$ and $Q_1 = 20$?', 'explanation' => '$45 - 20 = 25$.', 'difficulty' => 'medium', 'options' => ['$25$' => true, '$65$' => false, '$32.5$' => false, '$20$' => false]],
            ['text' => 'For mutually exclusive events $A$ and $B$, $P(A \cap B)$ is:', 'explanation' => '$0$.', 'difficulty' => 'medium', 'options' => ['$0$' => true, '$1$' => false, '$P(A) \times P(B)$' => false, '$P(A) + P(B)$' => false]],
            ['text' => 'If $P(A) = 0.4, P(B) = 0.5$ (independent), find $P(A \cap B)$.', 'explanation' => '$0.4 \times 0.5 = 0.20$.', 'difficulty' => 'hard', 'options' => ['$0.20$' => true, '$0.90$' => false, '$0.10$' => false, '$0.45$' => false]],
            ['text' => 'Probability of drawing an Ace from a standard 52-card deck?', 'explanation' => '$\frac{4}{52} = \frac{1}{13}$.', 'difficulty' => 'easy', 'options' => ['$\frac{1}{13}$' => true, '$\frac{1}{4}$' => false, '$\frac{1}{52}$' => false, '$\frac{4}{13}$' => false]],
        ];
    }

    private function generateKinematicsQuestions(): array
    {
        return [
            ['text' => 'Which physical quantity is a vector?', 'explanation' => 'Velocity has magnitude and direction.', 'difficulty' => 'easy', 'options' => ['Velocity' => true, 'Speed' => false, 'Distance' => false, 'Mass' => false]],
            ['text' => 'What does gradient of velocity-time graph represent?', 'explanation' => 'Acceleration.', 'difficulty' => 'easy', 'options' => ['Acceleration' => true, 'Displacement' => false, 'Speed' => false, 'Momentum' => false]],
            ['text' => 'A car accelerates uniformly from rest to $20\text{ m/s}$ in $5\text{ s}$. Acceleration?', 'explanation' => '$\frac{20}{5} = 4\text{ m/s}^2$.', 'difficulty' => 'easy', 'options' => ['$4\text{ m/s}^2$' => true, '$100\text{ m/s}^2$' => false, '$5\text{ m/s}^2$' => false, '$2\text{ m/s}^2$' => false]],
            ['text' => 'Equation of motion independent of time $t$:', 'explanation' => '$v^2 = u^2 + 2as$.', 'difficulty' => 'easy', 'options' => ['$v^2 = u^2 + 2as$' => true, '$v = u + \frac{1}{2}at^2$' => false, '$s = vt + \frac{1}{2}at$' => false, '$v^2 = u^2 - 2at$' => false]],
            ['text' => 'Area under velocity-time graph represents:', 'explanation' => 'Total displacement.', 'difficulty' => 'easy', 'options' => ['Total displacement' => true, 'Average acceleration' => false, 'Instantaneous speed' => false, 'Applied force' => false]],
            ['text' => 'Stone dropped from tower reaches ground in $3\text{ s}$. Height? ($g = 10\text{ m/s}^2$)', 'explanation' => '$\frac{1}{2}(10)(9) = 45\text{ m}$.', 'difficulty' => 'medium', 'options' => ['$45\text{ m}$' => true, '$30\text{ m}$' => false, '$90\text{ m}$' => false, '$15\text{ m}$' => false]],
            ['text' => 'Acceleration of freely falling body near Earth:', 'explanation' => '$9.8\text{ m/s}^2$ downwards.', 'difficulty' => 'easy', 'options' => ['$9.8\text{ m/s}^2$ downwards' => true, '$0\text{ m/s}^2$' => false, '$9.8\text{ m/s}^2$ upwards' => false, '$32\text{ m/s}^2$' => false]],
            ['text' => 'Acceleration of body moving at constant velocity:', 'explanation' => '$0\text{ m/s}^2$.', 'difficulty' => 'easy', 'options' => ['$0\text{ m/s}^2$' => true, '$15\text{ m/s}^2$' => false, '$9.8\text{ m/s}^2$' => false, '$1\text{ m/s}^2$' => false]],
            ['text' => 'SI unit of acceleration:', 'explanation' => '$\text{m/s}^2$.', 'difficulty' => 'easy', 'options' => ['$\text{m/s}^2$' => true, '$\text{m/s}$' => false, '$\text{km/h}$' => false, '$\text{N/s}$' => false]],
            ['text' => 'Runner completes $400\text{ m}$ lap returning to start in $50\text{ s}$. Average velocity?', 'explanation' => 'Displacement is $0$, so average velocity $= 0\text{ m/s}$.', 'difficulty' => 'medium', 'options' => ['$0\text{ m/s}$' => true, '$8\text{ m/s}$' => false, '$400\text{ m/s}$' => false, '$20\text{ m/s}$' => false]],
            ['text' => 'Particle with $u = 5\text{ m/s}$ accelerates at $2\text{ m/s}^2$ for $4\text{ s}$. Final velocity?', 'explanation' => '$5 + (2)(4) = 13\text{ m/s}$.', 'difficulty' => 'easy', 'options' => ['$13\text{ m/s}$' => true, '$10\text{ m/s}$' => false, '$18\text{ m/s}$' => false, '$40\text{ m/s}$' => false]],
            ['text' => 'Instantaneous velocity is:', 'explanation' => 'Velocity at a specific instant.', 'difficulty' => 'medium', 'options' => ['The velocity of an object at a specific instant in time' => true, 'Total distance divided by total time' => false, 'Initial velocity' => false, 'Maximum speed' => false]],
            ['text' => 'Vertical velocity of projectile at highest point:', 'explanation' => '$0\text{ m/s}$.', 'difficulty' => 'medium', 'options' => ['$0\text{ m/s}$' => true, '$u\sin\theta$' => false, '$u\cos\theta$' => false, '$g$' => false]],
            ['text' => 'Instrument measuring wire diameter with $0.01\text{ mm}$ precision:', 'explanation' => 'Micrometer screw gauge.', 'difficulty' => 'easy', 'options' => ['Micrometer screw gauge' => true, 'Vernier caliper' => false, 'Meter rule' => false, 'Tape measure' => false]],
            ['text' => 'Dimensional formula of acceleration:', 'explanation' => '$[LT^{-2}]$.', 'difficulty' => 'hard', 'options' => ['$[LT^{-2}]$' => true, '$[MLT^{-2}]$' => false, '$[LT^{-1}]$' => false, '$[L^2T^{-2}]$' => false]],
        ];
    }

    private function generateDynamicsQuestions(): array
    {
        return [
            ['text' => 'Newton\'s First Law of Motion states:', 'explanation' => 'Body remains at rest or in uniform motion unless acted on by net external force.', 'difficulty' => 'easy', 'options' => ['A body remains at rest or in uniform motion unless acted on by a net external force' => true, 'Force equals mass times acceleration' => false, 'Action and reaction are equal and opposite' => false, 'Energy cannot be destroyed' => false]],
            ['text' => 'Quantitative measure of an object\'s inertia:', 'explanation' => 'Mass.', 'difficulty' => 'easy', 'options' => ['Mass' => true, 'Weight' => false, 'Volume' => false, 'Density' => false]],
            ['text' => 'Formula for Newton\'s Second Law:', 'explanation' => '$F = ma$.', 'difficulty' => 'easy', 'options' => ['$F = ma$' => true, '$F = \frac{m}{a}$' => false, '$F = \frac{1}{2}ma^2$' => false, '$F = m + a$' => false]],
            ['text' => 'SI unit of force:', 'explanation' => 'Newton ($\text{N}$).', 'difficulty' => 'easy', 'options' => ['Newton ($\text{N}$)' => true, 'Joule ($\text{J}$)' => false, 'Watt ($\text{W}$)' => false, 'Pascal ($\text{Pa}$)' => false]],
            ['text' => 'Acceleration produced by $20\text{ N}$ force on $4\text{ kg}$ mass:', 'explanation' => '$\frac{20}{4} = 5\text{ m/s}^2$.', 'difficulty' => 'easy', 'options' => ['$5\text{ m/s}^2$' => true, '$80\text{ m/s}^2$' => false, '$16\text{ m/s}^2$' => false, '$0.2\text{ m/s}^2$' => false]],
            ['text' => 'Newton\'s Third Law states:', 'explanation' => 'For every action, there is an equal and opposite reaction.', 'difficulty' => 'easy', 'options' => ['For every action, there is an equal and opposite reaction' => true, 'Acceleration is proportional to net force' => false, 'Momentum is always constant' => false, 'Mass increases with velocity' => false]],
            ['text' => 'Linear momentum is defined as:', 'explanation' => '$p = mv$.', 'difficulty' => 'easy', 'options' => ['Product of mass and velocity ($p = mv$)' => true, 'Product of force and time' => false, 'Product of mass and acceleration' => false, 'Rate of doing work' => false]],
            ['text' => 'Conservation of linear momentum holds in:', 'explanation' => 'An isolated system with no net external forces.', 'difficulty' => 'medium', 'options' => ['Total momentum remains constant in an isolated system' => true, 'Kinetic energy is always conserved' => false, 'Force is constant' => false, 'Velocity never changes' => false]],
            ['text' => 'Momentum of $2\text{ kg}$ mass at $6\text{ m/s}$:', 'explanation' => '$2 \times 6 = 12\text{ kg}\cdot\text{m/s}$.', 'difficulty' => 'easy', 'options' => ['$12\text{ kg}\cdot\text{m/s}$' => true, '$3\text{ kg}\cdot\text{m/s}$' => false, '$36\text{ kg}\cdot\text{m/s}$' => false, '$8\text{ kg}\cdot\text{m/s}$' => false]],
            ['text' => 'Impulse is defined as:', 'explanation' => '$I = F\Delta t = \Delta p$.', 'difficulty' => 'medium', 'options' => ['Product of force and time duration ($I = F\Delta t$)' => true, 'Force divided by time' => false, 'Mass times acceleration' => false, 'Work done per second' => false]],
            ['text' => 'Force opposing initiation of motion between surfaces:', 'explanation' => 'Static friction.', 'difficulty' => 'easy', 'options' => ['Limiting static friction' => true, 'Dynamic kinetic friction' => false, 'Rolling friction' => false, 'Viscosity' => false]],
            ['text' => 'Coefficient of friction formula:', 'explanation' => '$\mu_s = \frac{F_s}{R}$.', 'difficulty' => 'medium', 'options' => ['$\mu_s = \frac{F_s}{R}$' => true, '$\mu_s = F_s \times R$' => false, '$\mu_s = \frac{R}{F_s}$' => false, '$\mu_s = F_s - R$' => false]],
            ['text' => 'Weight component parallel to incline of angle $\theta$:', 'explanation' => '$mg\sin\theta$.', 'difficulty' => 'hard', 'options' => ['$mg\sin\theta$' => true, '$mg\cos\theta$' => false, '$mg\tan\theta$' => false, '$\frac{mg}{\cos\theta}$' => false]],
            ['text' => 'Apparent weight of person in free fall elevator:', 'explanation' => '$0\text{ N}$ (Weightlessness).', 'difficulty' => 'medium', 'options' => ['$0\text{ N}$ (Weightlessness)' => true, '$mg$' => false, '$2mg$' => false, '$\frac{1}{2}mg$' => false]],
            ['text' => 'Which force is a non-contact field force?', 'explanation' => 'Gravitational force.', 'difficulty' => 'easy', 'options' => ['Gravitational force' => true, 'Frictional force' => false, 'Tension in string' => false, 'Normal reaction' => false]],
        ];
    }

    private function generateEnergyQuestions(): array
    {
        return [
            ['text' => 'Work done formula with force $F$ at angle $\theta$ to displacement $d$:', 'explanation' => '$W = Fd\cos\theta$.', 'difficulty' => 'easy', 'options' => ['$W = Fd\cos\theta$' => true, '$W = Fd\sin\theta$' => false, '$W = \frac{F}{d}$' => false, '$W = Fd^2$' => false]],
            ['text' => 'SI unit of work and energy:', 'explanation' => 'Joule ($\text{J}$).', 'difficulty' => 'easy', 'options' => ['Joule ($\text{J}$)' => true, 'Watt ($\text{W}$)' => false, 'Newton ($\text{N}$)' => false, 'Pascal ($\text{Pa}$)' => false]],
            ['text' => 'Work done lifting $5\text{ kg}$ by $4\text{ m}$ ($g = 10\text{ m/s}^2$):', 'explanation' => '$5 \times 10 \times 4 = 200\text{ J}$.', 'difficulty' => 'easy', 'options' => ['$200\text{ J}$' => true, '$20\text{ J}$' => false, '$50\text{ J}$' => false, '$400\text{ J}$' => false]],
            ['text' => 'Kinetic energy formula:', 'explanation' => '$E_k = \frac{1}{2}mv^2$.', 'difficulty' => 'easy', 'options' => ['$E_k = \frac{1}{2}mv^2$' => true, '$E_k = mv^2$' => false, '$E_k = \frac{1}{2}mv$' => false, '$E_k = mgh$' => false]],
            ['text' => 'Kinetic energy of $1000\text{ kg}$ car at $20\text{ m/s}$:', 'explanation' => '$\frac{1}{2}(1000)(400) = 200\text{ kJ}$.', 'difficulty' => 'easy', 'options' => ['$200\text{ kJ}$' => true, '$20\text{ kJ}$' => false, '$400\text{ kJ}$' => false, '$10\text{ kJ}$' => false]],
            ['text' => 'Gravitational potential energy formula:', 'explanation' => '$E_p = mgh$.', 'difficulty' => 'easy', 'options' => ['$E_p = mgh$' => true, '$E_p = \frac{1}{2}mv^2$' => false, '$E_p = Fd$' => false, '$E_p = \frac{mgh}{2}$' => false]],
            ['text' => 'Law of Conservation of Energy states:', 'explanation' => 'Energy cannot be created or destroyed, only transformed.', 'difficulty' => 'easy', 'options' => ['Energy cannot be created or destroyed, only transformed' => true, 'Kinetic energy is always constant' => false, 'Total mass always becomes energy' => false, 'Mechanical energy never changes' => false]],
            ['text' => 'Power is defined as:', 'explanation' => 'Rate of doing work ($P = \frac{W}{t}$).', 'difficulty' => 'easy', 'options' => ['Rate of doing work ($P = \frac{W}{t}$)' => true, 'Total work done' => false, 'Force times distance' => false, 'Energy per mass' => false]],
            ['text' => 'SI unit of power:', 'explanation' => 'Watt ($\text{W}$).', 'difficulty' => 'easy', 'options' => ['Watt ($\text{W}$)' => true, 'Joule ($\text{J}$)' => false, 'Newton ($\text{N}$)' => false, 'Coulomb ($\text{C}$)' => false]],
            ['text' => 'Power output if $6000\text{ J}$ of work is done in $20\text{ s}$:', 'explanation' => '$\frac{6000}{20} = 300\text{ W}$.', 'difficulty' => 'easy', 'options' => ['$300\text{ W}$' => true, '$120\text{ kW}$' => false, '$60\text{ W}$' => false, '$30\text{ W}$' => false]],
            ['text' => 'Efficiency of machine with work output $80\text{ J}$ from $100\text{ J}$ input:', 'explanation' => '$\frac{80}{100} \times 100\% = 80\%$.', 'difficulty' => 'easy', 'options' => ['$80\%$' => true, '$20\%$' => false, '$125\%$' => false, '$180\%$' => false]],
            ['text' => 'Number of Joules in $1\text{ kWh}$:', 'explanation' => '$3.6 \times 10^6\text{ J}$.', 'difficulty' => 'medium', 'options' => ['$3.6 \times 10^6\text{ J}$' => true, '$3.6 \times 10^3\text{ J}$' => false, '$1.0 \times 10^5\text{ J}$' => false, '$3.6 \times 10^5\text{ J}$' => false]],
            ['text' => 'If speed is doubled, kinetic energy increases by:', 'explanation' => '$2^2 = 4\times$ (Quadruples).', 'difficulty' => 'medium', 'options' => ['Quadruples ($4\times$)' => true, 'Doubles ($2\times$)' => false, 'Increases by $8\times$' => false, 'Remains unchanged' => false]],
            ['text' => 'Energy stored in spring compressed by $x$:', 'explanation' => '$\frac{1}{2}kx^2$.', 'difficulty' => 'medium', 'options' => ['$\frac{1}{2}kx^2$' => true, '$kx$' => false, '$\frac{1}{2}kx$' => false, '$kx^2$' => false]],
            ['text' => 'At lowest swing point of pendulum, energy status is:', 'explanation' => 'Kinetic is maximum, potential is minimum.', 'difficulty' => 'medium', 'options' => ['Kinetic energy is maximum, potential energy is minimum' => true, 'Potential energy is maximum' => false, 'Both are zero' => false, 'Total energy decreases' => false]],
        ];
    }

    private function generateWavesQuestions(): array
    {
        return [
            ['text' => 'Wave equation relating speed $v$, frequency $f$, and wavelength $\lambda$:', 'explanation' => '$v = f\lambda$.', 'difficulty' => 'easy', 'options' => ['$v = f\lambda$' => true, '$v = \frac{f}{\lambda}$' => false, '$v = \frac{\lambda}{f}$' => false, '$v = f^2\lambda$' => false]],
            ['text' => 'Sound waves in air are classified as:', 'explanation' => 'Longitudinal mechanical waves.', 'difficulty' => 'easy', 'options' => ['Longitudinal mechanical waves' => true, 'Transverse electromagnetic waves' => false, 'Torsional waves' => false, 'Non-mechanical waves' => false]],
            ['text' => 'Light waves in vacuum are:', 'explanation' => 'Transverse electromagnetic waves.', 'difficulty' => 'easy', 'options' => ['Transverse electromagnetic waves' => true, 'Longitudinal mechanical waves' => false, 'Stationary acoustic waves' => false, 'Matter waves' => false]],
            ['text' => 'Speed of light in vacuum is approximately:', 'explanation' => '$3.0 \times 10^8\text{ m/s}$.', 'difficulty' => 'easy', 'options' => ['$3.0 \times 10^8\text{ m/s}$' => true, '$340\text{ m/s}$' => false, '$3.0 \times 10^6\text{ m/s}$' => false, '$1.5 \times 10^8\text{ m/s}$' => false]],
            ['text' => 'Bending of light passing into new optical medium:', 'explanation' => 'Refraction.', 'difficulty' => 'easy', 'options' => ['Refraction' => true, 'Diffraction' => false, 'Polarization' => false, 'Interference' => false]],
            ['text' => 'Law of Reflection for plane mirror:', 'explanation' => '$\theta_i = \theta_r$.', 'difficulty' => 'easy', 'options' => ['$\theta_i = \theta_r$' => true, '$\theta_i + \theta_r = 90^\circ$' => false, '$\sin\theta_i = \cos\theta_r$' => false, '$\theta_i = 2\theta_r$' => false]],
            ['text' => 'Snell\'s Law of Refraction is:', 'explanation' => '$n_1 \sin\theta_1 = n_2 \sin\theta_2$.', 'difficulty' => 'medium', 'options' => ['$n_1 \sin\theta_1 = n_2 \sin\theta_2$' => true, '$\frac{n_1}{\sin\theta_1} = \frac{n_2}{\sin\theta_2}$' => false, '$n_1 \cos\theta_1 = n_2 \cos\theta_2$' => false, '$n_1 n_2 = \sin\theta_1 \sin\theta_2$' => false]],
            ['text' => 'Condition for Total Internal Reflection:', 'explanation' => 'Denser to rarer medium with angle of incidence $>$ critical angle.', 'difficulty' => 'medium', 'options' => ['Light travels from denser to rarer medium with angle of incidence $>$ critical angle' => true, 'Rarer to denser with angle $< 90^\circ$' => false, 'Angle must be zero' => false, 'Monochromatic only' => false]],
            ['text' => 'Which wave property determines sound pitch?', 'explanation' => 'Frequency.', 'difficulty' => 'easy', 'options' => ['Frequency' => true, 'Amplitude' => false, 'Wave speed' => false, 'Wavelength only' => false]],
            ['text' => 'Which wave property determines loudness?', 'explanation' => 'Amplitude.', 'difficulty' => 'easy', 'options' => ['Amplitude' => true, 'Frequency' => false, 'Velocity' => false, 'Phase angle' => false]],
            ['text' => 'Audible frequency range for normal human ear:', 'explanation' => '$20\text{ Hz}$ to $20,000\text{ Hz}$.', 'difficulty' => 'easy', 'options' => ['$20\text{ Hz}$ to $20,000\text{ Hz}$' => true, '$200\text{ Hz}$ to $2,000\text{ Hz}$' => false, '$1\text{ Hz}$ to $1,000\text{ Hz}$' => false, '$20\text{ kHz}$ to $20\text{ MHz}$' => false]],
            ['text' => 'Echo heard $2\text{ s}$ after emission ($v = 340\text{ m/s}$). Distance to cliff?', 'explanation' => '$\frac{340 \times 2}{2} = 340\text{ m}$.', 'difficulty' => 'medium', 'options' => ['$340\text{ m}$' => true, '$680\text{ m}$' => false, '$170\text{ m}$' => false, '$85\text{ m}$' => false]],
            ['text' => 'Separation of white light into spectrum colors in a prism:', 'explanation' => 'Dispersion.', 'difficulty' => 'easy', 'options' => ['Dispersion' => true, 'Diffraction' => false, 'Polarization' => false, 'Interference' => false]],
            ['text' => 'Lens used to correct myopia (short-sightedness):', 'explanation' => 'Concave (diverging) lens.', 'difficulty' => 'easy', 'options' => ['Concave (diverging) lens' => true, 'Convex (converging) lens' => false, 'Cylindrical lens' => false, 'Bifocal convex' => false]],
            ['text' => 'Frequency of sound with speed $340\text{ m/s}$ and wavelength $1.7\text{ m}$:', 'explanation' => '$\frac{340}{1.7} = 200\text{ Hz}$.', 'difficulty' => 'easy', 'options' => ['$200\text{ Hz}$' => true, '$578\text{ Hz}$' => false, '$100\text{ Hz}$' => false, '$340\text{ Hz}$' => false]],
        ];
    }

    private function generateElectricityQuestions(): array
    {
        return [
            ['text' => 'State Ohm\'s Law equation:', 'explanation' => '$V = IR$.', 'difficulty' => 'easy', 'options' => ['$V = IR$' => true, '$V = \frac{I}{R}$' => false, '$P = VI$' => false, '$R = VI$' => false]],
            ['text' => 'SI unit of electrical resistance:', 'explanation' => 'Ohm ($\Omega$).', 'difficulty' => 'easy', 'options' => ['Ohm ($\Omega$)' => true, 'Volt ($\text{V}$)' => false, 'Ampere ($\text{A}$)' => false, 'Siemens ($\text{S}$)' => false]],
            ['text' => 'Equivalent resistance of two $6\,\Omega$ resistors in series:', 'explanation' => '$6 + 6 = 12\,\Omega$.', 'difficulty' => 'easy', 'options' => ['$12\,\Omega$' => true, '$3\,\Omega$' => false, '$6\,\Omega$' => false, '$36\,\Omega$' => false]],
            ['text' => 'Equivalent resistance of two $6\,\Omega$ resistors in parallel:', 'explanation' => '$\frac{6}{2} = 3\,\Omega$.', 'difficulty' => 'easy', 'options' => ['$3\,\Omega$' => true, '$12\,\Omega$' => false, '$6\,\Omega$' => false, '$1.5\,\Omega$' => false]],
            ['text' => 'Power formula in terms of $V$ and $I$:', 'explanation' => '$P = IV$.', 'difficulty' => 'easy', 'options' => ['$P = IV$' => true, '$P = \frac{I}{V}$' => false, '$P = I^2 V$' => false, '$P = \frac{V}{I}$' => false]],
            ['text' => 'Power rating of heater on $220\text{ V}$ drawing $5\text{ A}$:', 'explanation' => '$220 \times 5 = 1100\text{ W}$.', 'difficulty' => 'easy', 'options' => ['$1100\text{ W}$' => true, '$44\text{ W}$' => false, '$2200\text{ W}$' => false, '$550\text{ W}$' => false]],
            ['text' => 'SI unit of electric charge:', 'explanation' => 'Coulomb ($\text{C}$).', 'difficulty' => 'easy', 'options' => ['Coulomb ($\text{C}$)' => true, 'Ampere ($\text{A}$)' => false, 'Volt ($\text{V}$)' => false, 'Farad ($\text{F}$)' => false]],
            ['text' => 'Charge passing when $3\text{ A}$ flows for $20\text{ s}$:', 'explanation' => '$3 \times 20 = 60\text{ C}$.', 'difficulty' => 'easy', 'options' => ['$60\text{ C}$' => true, '$6.67\text{ C}$' => false, '$23\text{ C}$' => false, '$120\text{ C}$' => false]],
            ['text' => 'Ammeter connection in a circuit:', 'explanation' => 'In series with components.', 'difficulty' => 'easy', 'options' => ['Ammeter connected in series' => true, 'Voltmeter connected in series' => false, 'Ammeter in parallel' => false, 'Galvanometer in parallel' => false]],
            ['text' => 'Voltmeter connection in a circuit:', 'explanation' => 'In parallel across components.', 'difficulty' => 'easy', 'options' => ['Voltmeter connected in parallel' => true, 'Ammeter in parallel' => false, 'Voltmeter in series' => false, 'Rheostat in parallel' => false]],
            ['text' => 'Electromotive force (EMF) is:', 'explanation' => 'Total energy supplied per unit charge by source.', 'difficulty' => 'medium', 'options' => ['Total electrical energy supplied per coulomb of charge by a source' => true, 'Physical force pushing electrons' => false, 'Terminal voltage under load' => false, 'Magnetic strength in battery' => false]],
            ['text' => 'Kirchhoff\'s Current Law is based on conservation of:', 'explanation' => 'Electric charge.', 'difficulty' => 'medium', 'options' => ['Conservation of electric charge' => true, 'Conservation of energy' => false, 'Conservation of momentum' => false, 'Conservation of mass' => false]],
            ['text' => 'Factor that does NOT affect wire resistance:', 'explanation' => 'Color of insulation.', 'difficulty' => 'easy', 'options' => ['Color of wire insulation' => true, 'Length of conductor' => false, 'Cross-sectional area' => false, 'Temperature' => false]],
            ['text' => 'Equivalent resistance of three identical resistors $R$ in parallel:', 'explanation' => '$\frac{R}{3}$.', 'difficulty' => 'medium', 'options' => ['$\frac{R}{3}$' => true, '$3R$' => false, '$\frac{3}{R}$' => false, '$R^3$' => false]],
            ['text' => 'Energy consumed by $100\text{ W}$ lamp operating for $10\text{ hours}$:', 'explanation' => '$100 \times 10 = 1000\text{ Wh} = 1.0\text{ kWh}$.', 'difficulty' => 'medium', 'options' => ['$1.0\text{ kWh}$' => true, '$10\text{ kWh}$' => false, '$0.1\text{ kWh}$' => false, '$100\text{ kWh}$' => false]],
        ];
    }

    private function generateConcordQuestions(): array
    {
        return [
            ['text' => 'Choose correct verb: "Neither the principal nor the teachers ______ present."', 'explanation' => 'Agrees with closer plural subject "teachers" -> were.', 'difficulty' => 'medium', 'options' => ['were' => true, 'was' => false, 'is' => false, 'has been' => false]],
            ['text' => 'Choose correct verb: "The jury ______ unanimous in its verdict."', 'explanation' => 'Acts as single collective unit -> was.', 'difficulty' => 'easy', 'options' => ['was' => true, 'were' => false, 'are' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Bread and butter ______ his staple breakfast."', 'explanation' => 'Single compound dish -> is.', 'difficulty' => 'easy', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Every boy and girl in the school ______ awarded a certificate."', 'explanation' => 'Modified by "every" -> was.', 'difficulty' => 'medium', 'options' => ['was' => true, 'were' => false, 'are' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "The captain, together with his crew members, ______ rescued."', 'explanation' => 'Parenthetical phrase does not change singular subject "captain" -> was.', 'difficulty' => 'medium', 'options' => ['was' => true, 'were' => false, 'are' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Ten thousand naira ______ sufficient for the purchase."', 'explanation' => 'Lump sum amount takes singular verb -> is.', 'difficulty' => 'easy', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Either you or Ade ______ to represent the school."', 'explanation' => 'Agrees with nearest subject "Ade" -> has.', 'difficulty' => 'medium', 'options' => ['has' => true, 'have' => false, 'are' => false, 'were' => false]],
            ['text' => 'Choose correct verb: "Mathematics ______ a foundational science subject."', 'explanation' => 'Academic disciplines in -s take singular verb -> is.', 'difficulty' => 'easy', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "A number of students ______ absent from the lecture."', 'explanation' => '"A number of" is plural -> were.', 'difficulty' => 'medium', 'options' => ['were' => true, 'was' => false, 'is' => false, 'has been' => false]],
            ['text' => 'Choose correct verb: "The number of registered candidates ______ rising."', 'explanation' => '"The number of" specifies singular count -> is.', 'difficulty' => 'medium', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Each of the participants ______ given a plaque."', 'explanation' => '"Each" is singular -> was.', 'difficulty' => 'easy', 'options' => ['was' => true, 'were' => false, 'are' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Not only the student but also the teachers ______ satisfied."', 'explanation' => 'Agrees with closest subject "teachers" -> were.', 'difficulty' => 'medium', 'options' => ['were' => true, 'was' => false, 'is' => false, 'has been' => false]],
            ['text' => 'Choose correct verb: "The pair of scissors ______ in the drawer."', 'explanation' => '"Pair" governs singular verb -> is.', 'difficulty' => 'hard', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "Measles ______ a contagious viral illness."', 'explanation' => 'Disease name takes singular -> is.', 'difficulty' => 'easy', 'options' => ['is' => true, 'are' => false, 'were' => false, 'have been' => false]],
            ['text' => 'Choose correct verb: "None of the leaked chemical ______ toxic."', 'explanation' => 'Uncountable noun takes singular -> was.', 'difficulty' => 'medium', 'options' => ['was' => true, 'were' => false, 'are' => false, 'have been' => false]],
        ];
    }

    private function generateTensesQuestions(): array
    {
        return [
            ['text' => 'Complete third conditional: "If she had revised, she ______ the exam."', 'explanation' => 'If + past perfect, would have + past participle -> would have passed.', 'difficulty' => 'medium', 'options' => ['would have passed' => true, 'will pass' => false, 'would pass' => false, 'had passed' => false]],
            ['text' => 'Choose correct tense: "By the time the ambulance arrived, the patient ______."', 'explanation' => 'Prior past action -> had died.', 'difficulty' => 'easy', 'options' => ['had died' => true, 'died' => false, 'has died' => false, 'was dying' => false]],
            ['text' => 'Identify tense: "They have been studying for four consecutive hours."', 'explanation' => 'Present Perfect Continuous.', 'difficulty' => 'easy', 'options' => ['Present Perfect Continuous' => true, 'Past Perfect Continuous' => false, 'Present Continuous' => false, 'Future Perfect' => false]],
            ['text' => 'Complete hypothetical conditional: "If I ______ the President, I would build schools."', 'explanation' => 'Subjunctive uses "were" -> were.', 'difficulty' => 'medium', 'options' => ['were' => true, 'was' => false, 'am' => false, 'would be' => false]],
            ['text' => 'Choose correct verb: "She usually ______ to the library on Saturdays."', 'explanation' => 'Habitual present -> travels.', 'difficulty' => 'easy', 'options' => ['travels' => true, 'is traveling' => false, 'has traveled' => false, 'traveled' => false]],
            ['text' => 'Complete sentence: "As soon as the siren sounded, the workers ______."', 'explanation' => 'Sequential simple past -> evacuated.', 'difficulty' => 'easy', 'options' => ['evacuated' => true, 'had evacuated' => false, 'have evacuated' => false, 'are evacuating' => false]],
            ['text' => 'Passive voice of: "The architect designed the innovative bridge."', 'explanation' => 'The innovative bridge was designed by the architect.', 'difficulty' => 'medium', 'options' => ['The innovative bridge was designed by the architect.' => true, 'The innovative bridge is designed by the architect.' => false, 'The innovative bridge had been designed.' => false, 'The architect was designed.' => false]],
            ['text' => 'First conditional: "If it rains tomorrow, we ______ the match."', 'explanation' => 'If + present, will + base verb -> will cancel.', 'difficulty' => 'easy', 'options' => ['will cancel' => true, 'would cancel' => false, 'cancelled' => false, 'would have cancelled' => false]],
            ['text' => 'Subjunctive mood: "The committee demanded that he ______ records."', 'explanation' => 'Mandative subjunctive bare base form -> submit.', 'difficulty' => 'hard', 'options' => ['submit' => true, 'submits' => false, 'submitted' => false, 'should submitted' => false]],
            ['text' => 'Identify voice: "The research was published in Nature."', 'explanation' => 'Passive voice.', 'difficulty' => 'easy', 'options' => ['Passive voice' => true, 'Active voice' => false, 'Reflexive voice' => false, 'Imperative voice' => false]],
            ['text' => 'Choose correct tense: "I ______ in Ibadan for 5 years before moving to Abuja."', 'explanation' => 'Past perfect -> had lived.', 'difficulty' => 'medium', 'options' => ['had lived' => true, 'have lived' => false, 'am living' => false, 'was living' => false]],
            ['text' => 'Prediction with evidence: "Look at those dark clouds! It ______ rain."', 'explanation' => 'Immediate evidence uses "is going to".', 'difficulty' => 'easy', 'options' => ['is going to' => true, 'will be' => false, 'might have' => false, 'was about to' => false]],
            ['text' => 'Reported speech: He said, "I am writing a story."', 'explanation' => 'He said that he was writing a story.', 'difficulty' => 'medium', 'options' => ['He said that he was writing a story.' => true, 'He said that he is writing.' => false, 'He said that he had written.' => false, 'He said that he will write.' => false]],
            ['text' => 'Correlative pair: "Hardly had the teacher entered ______ students stood up."', 'explanation' => 'Hardly... when.', 'difficulty' => 'hard', 'options' => ['when' => true, 'than' => false, 'then' => false, 'before' => false]],
            ['text' => 'Choose correct form: "We look forward to ______ you at graduation."', 'explanation' => 'Preposition "to" takes gerund -> meeting.', 'difficulty' => 'medium', 'options' => ['meeting' => true, 'meet' => false, 'have met' => false, 'be meeting' => false]],
        ];
    }

    private function generateIdiomsQuestions(): array
    {
        return [
            ['text' => 'Meaning of idiom: "To burn the midnight oil":', 'explanation' => 'To work or study late into the night.', 'difficulty' => 'easy', 'options' => ['To work or study late into the night' => true, 'To waste electricity' => false, 'To start a fire' => false, 'To wake early' => false]],
            ['text' => 'Meaning of idiom: "To hit the nail on the head":', 'explanation' => 'To state precisely what is accurate.', 'difficulty' => 'easy', 'options' => ['To state exactly what is true or accurate' => true, 'To build furniture' => false, 'To strike someone' => false, 'To make an error' => false]],
            ['text' => 'Phrasal verb: "The match had to be ______ due to rain."', 'explanation' => '"Called off" means cancelled.', 'difficulty' => 'easy', 'options' => ['called off' => true, 'called on' => false, 'called out' => false, 'called in' => false]],
            ['text' => 'Meaning of "A blessing in disguise":', 'explanation' => 'A good outcome resulting from an apparent misfortune.', 'difficulty' => 'easy', 'options' => ['A good thing that initially seemed bad' => true, 'A costume' => false, 'A prize' => false, 'A secret prayer' => false]],
            ['text' => 'Phrasal verb: "I cannot ______ his insolent behavior."', 'explanation' => '"Put up with" means tolerate.', 'difficulty' => 'medium', 'options' => ['put up with' => true, 'put down to' => false, 'put off with' => false, 'put away with' => false]],
            ['text' => 'Meaning of "To bite the bullet":', 'explanation' => 'To face a tough situation bravely.', 'difficulty' => 'medium', 'options' => ['To bravely endure a difficult situation' => true, 'To engage in combat' => false, 'To eat metals' => false, 'To surrender' => false]],
            ['text' => 'Phrasal verb: "Firefighters worked to ______ the flames."', 'explanation' => '"Put out" means extinguish.', 'difficulty' => 'easy', 'options' => ['put out' => true, 'put off' => false, 'put in' => false, 'put on' => false]],
            ['text' => 'Meaning of "Once in a blue moon":', 'explanation' => 'Very rarely.', 'difficulty' => 'easy', 'options' => ['Very rarely' => true, 'Every full moon' => false, 'Frequently' => false, 'At night only' => false]],
            ['text' => 'Phrasal verb: "Please ______ the application form."', 'explanation' => '"Fill out" means complete a form.', 'difficulty' => 'easy', 'options' => ['fill out' => true, 'fill up with' => false, 'fill into' => false, 'fill across' => false]],
            ['text' => 'Meaning of "To break the ice":', 'explanation' => 'To relieve social tension.', 'difficulty' => 'easy', 'options' => ['To ease social tension in a new gathering' => true, 'To break glass' => false, 'To show anger' => false, 'To start winter' => false]],
            ['text' => 'Phrasal verb: "The plane will ______ at 14:00."', 'explanation' => '"Take off" means become airborne.', 'difficulty' => 'easy', 'options' => ['take off' => true, 'take up' => false, 'take in' => false, 'take over' => false]],
            ['text' => 'Meaning of "To turn a blind eye":', 'explanation' => 'To deliberately ignore wrongdoing.', 'difficulty' => 'medium', 'options' => ['To pretend not to notice wrongdoing' => true, 'To lose sight' => false, 'To use a lens' => false, 'To admire' => false]],
            ['text' => 'Phrasal verb: "Never ______ until tomorrow what you can do today."', 'explanation' => '"Put off" means postpone.', 'difficulty' => 'easy', 'options' => ['put off' => true, 'put out' => false, 'put down' => false, 'put through' => false]],
            ['text' => 'Meaning of "To spill the beans":', 'explanation' => 'To disclose a secret.', 'difficulty' => 'easy', 'options' => ['To disclose a confidential secret' => true, 'To drop food' => false, 'To plant seeds' => false, 'To tell a lie' => false]],
            ['text' => 'Phrasal verb: "Tola ______ her mother in musical talent."', 'explanation' => '"Takes after" means resembles a parent/relative.', 'difficulty' => 'easy', 'options' => ['takes after' => true, 'takes on' => false, 'takes over' => false, 'takes up' => false]],
        ];
    }

    private function generateSentenceQuestions(): array
    {
        return [
            ['text' => 'Identify type: "Although it rained, we attended the match."', 'explanation' => 'Complex sentence.', 'difficulty' => 'easy', 'options' => ['Complex sentence' => true, 'Simple sentence' => false, 'Compound sentence' => false, 'Compound-complex' => false]],
            ['text' => 'Clause type: "The student [who scored highest] won a prize."', 'explanation' => 'Adjective (Relative) clause.', 'difficulty' => 'medium', 'options' => ['Adjective (Relative) clause' => true, 'Noun clause' => false, 'Adverbial clause' => false, 'Prepositional phrase' => false]],
            ['text' => 'Correctly punctuated compound sentence:', 'explanation' => 'Uses semicolon with conjunctive adverb.', 'difficulty' => 'medium', 'options' => ['She loves chemistry; however, she finds physics challenging.' => true, 'She loves chemistry, however she finds physics challenging.' => false, 'She loves chemistry; however she finds physics.' => false, 'She loves chemistry however, she finds.' => false]],
            ['text' => 'Definition of a run-on sentence:', 'explanation' => 'Two independent clauses joined without coordinating punctuation.', 'difficulty' => 'easy', 'options' => ['Two independent clauses joined without coordinating punctuation' => true, 'A sentence with 3 adjectives' => false, 'A sentence lacking verbs' => false, 'A standalone subordinate clause' => false]],
            ['text' => 'Identify dependent clause: "When the sun rises, birds begin to sing."', 'explanation' => '"When the sun rises".', 'difficulty' => 'easy', 'options' => ['When the sun rises' => true, 'birds begin' => false, 'begin to sing' => false, 'birds begin to sing' => false]],
            ['text' => 'Sentence WITHOUT a dangling modifier:', 'explanation' => 'Subject "she" directly follows participial opener.', 'difficulty' => 'hard', 'options' => ['Walking into the laboratory, she observed the bubbling flask.' => true, 'Walking into the laboratory, the bubbling flask was observed.' => false, 'Having finished, the television was on.' => false, 'Running quickly, the bus was caught.' => false]],
            ['text' => 'Punctuation mark introducing formal enumerated list:', 'explanation' => 'Colon (:).', 'difficulty' => 'easy', 'options' => ['Colon (:)' => true, 'Semicolon (;)' => false, 'Hyphen (-)' => false, 'Comma (,)' => false]],
            ['text' => 'Sentence structure: "Amina cooked rice, and Chidi made stew."', 'explanation' => 'Compound sentence.', 'difficulty' => 'easy', 'options' => ['Compound sentence' => true, 'Simple sentence' => false, 'Complex sentence' => false, 'Minor sentence' => false]],
            ['text' => 'Correctly punctuated plural possessive form:', 'explanation' => 'Children\'s books.', 'difficulty' => 'medium', 'options' => ['The children\'s books were donated to the library.' => true, 'The childrens\' books were donated.' => false, 'The childrens books\' were donated.' => false, 'The childrens book\'s were donated.' => false]],
            ['text' => 'Identify phrase: "[Singing melodiously], the choir captivated everyone."', 'explanation' => 'Participial phrase.', 'difficulty' => 'medium', 'options' => ['Participial phrase' => true, 'Gerund phrase' => false, 'Infinitive phrase' => false, 'Prepositional phrase' => false]],
            ['text' => 'Correctly punctuated direct speech:', 'explanation' => 'Comma inside speech marks.', 'difficulty' => 'medium', 'options' => ['"Knowledge is the key to success," declared the speaker.' => true, '"Knowledge is the key to success", declared the speaker.' => false, '"Knowledge is the key to success" declared.' => false, 'Knowledge is key, declared speaker.' => false]],
            ['text' => 'Conjunction showing contrast: "He studied hard, ______ he failed."', 'explanation' => '"Yet" expresses contrast.', 'difficulty' => 'easy', 'options' => ['yet' => true, 'so' => false, 'for' => false, 'and' => false]],
            ['text' => 'What is the Oxford comma?', 'explanation' => 'Comma before conjunction in a list of items.', 'difficulty' => 'easy', 'options' => ['The comma placed before the conjunction in a list of items' => true, 'Comma only in British books' => false, 'Comma between subject and verb' => false, 'Comma at paragraph ends' => false]],
            ['text' => 'Subject complement in: "Soyinka is an acclaimed playwright."', 'explanation' => '"an acclaimed playwright".', 'difficulty' => 'medium', 'options' => ['an acclaimed playwright' => true, 'Soyinka' => false, 'is an' => false, 'acclaimed' => false]],
            ['text' => 'Punctuation denoting omission from a quote:', 'explanation' => 'Ellipsis (...).', 'difficulty' => 'easy', 'options' => ['Ellipsis (...)' => true, 'Em dash (—)' => false, 'Hyphen (-)' => false, 'Asterisk (*)' => false]],
        ];
    }

    private function generateLexisQuestions(): array
    {
        return [
            ['text' => 'Synonym of ELOQUENT: "He gave an ELOQUENT address."', 'explanation' => 'Articulate.', 'difficulty' => 'easy', 'options' => ['Articulate' => true, 'Aggressive' => false, 'Hesitant' => false, 'Lengthy' => false]],
            ['text' => 'Antonym of LUCID: "She gave a LUCID explanation."', 'explanation' => 'Obscure.', 'difficulty' => 'easy', 'options' => ['Obscure' => true, 'Transparent' => false, 'Intelligible' => false, 'Brilliant' => false]],
            ['text' => 'Figure of speech: "The breeze whispered through the pines."', 'explanation' => 'Personification.', 'difficulty' => 'easy', 'options' => ['Personification' => true, 'Hyperbole' => false, 'Simile' => false, 'Irony' => false]],
            ['text' => 'Figure of speech: "His heart is made of gold."', 'explanation' => 'Metaphor.', 'difficulty' => 'easy', 'options' => ['Metaphor' => true, 'Simile' => false, 'Oxymoron' => false, 'Euphemism' => false]],
            ['text' => 'What does "tone" signify in a passage?', 'explanation' => 'The author\'s emotional perspective or attitude.', 'difficulty' => 'easy', 'options' => ['The author\'s attitude and perspective toward the subject' => true, 'Reading volume' => false, 'Vocabulary length' => false, 'Font format' => false]],
            ['text' => 'Synonym of ADVERSE: "The policy had an ADVERSE effect."', 'explanation' => 'Unfavorable.', 'difficulty' => 'easy', 'options' => ['Unfavorable' => true, 'Advantageous' => false, 'Negligible' => false, 'Prosperous' => false]],
            ['text' => 'Figure of speech: "Her smile was as radiant as sunshine."', 'explanation' => 'Simile.', 'difficulty' => 'easy', 'options' => ['Simile' => true, 'Metaphor' => false, 'Apostrophe' => false, 'Synecdoche' => false]],
            ['text' => 'Antonym of COMMENDED: "The officer was COMMENDED for bravery."', 'explanation' => 'Rebuked.', 'difficulty' => 'easy', 'options' => ['Rebuked' => true, 'Applauded' => false, 'Promoted' => false, 'Decorated' => false]],
            ['text' => 'Definition of an "inference":', 'explanation' => 'Logical deduction drawn from contextual evidence.', 'difficulty' => 'medium', 'options' => ['A logical deduction drawn from contextual evidence in the text' => true, 'Copy of first sentence' => false, 'Dictionary definition' => false, 'Footnote summary' => false]],
            ['text' => 'Figure of speech: "The fire station burned down during drill."', 'explanation' => 'Situational Irony.', 'difficulty' => 'easy', 'options' => ['Situational Irony' => true, 'Dramatic monologue' => false, 'Onomatopoeia' => false, 'Alliteration' => false]],
            ['text' => 'Synonym of RESILIENCE: "She showed REMARKABLE resilience."', 'explanation' => 'Endurance / Fortitude.', 'difficulty' => 'medium', 'options' => ['Endurance' => true, 'Fragility' => false, 'Reluctance' => false, 'Hostility' => false]],
            ['text' => 'Figure of speech: "I told you a million times!"', 'explanation' => 'Hyperbole.', 'difficulty' => 'easy', 'options' => ['Hyperbole' => true, 'Litotes' => false, 'Euphemism' => false, 'Paradox' => false]],
            ['text' => 'What is the "main idea" of a passage?', 'explanation' => 'The overarching central point or thesis.', 'difficulty' => 'easy', 'options' => ['The overarching central point or thesis of the passage' => true, 'Concluding transitional phrase' => false, 'First statistical number' => false, 'Author\'s address' => false]],
            ['text' => 'Antonym of PURE: "The spring yielded PURE water."', 'explanation' => 'Contaminated.', 'difficulty' => 'easy', 'options' => ['Contaminated' => true, 'Pristine' => false, 'Filtered' => false, 'Untainted' => false]],
            ['text' => 'Figure of speech pairing contradictory terms ("deafening silence"):', 'explanation' => 'Oxymoron.', 'difficulty' => 'easy', 'options' => ['Oxymoron' => true, 'Paradox' => false, 'Pun' => false, 'Onomatopoeia' => false]],
        ];
    }
}
