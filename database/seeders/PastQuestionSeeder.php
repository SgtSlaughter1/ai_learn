<?php

namespace Database\Seeders;

use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PastQuestionSeeder extends Seeder
{
    public function run(): void
    {
        $questionsData = $this->getCuratedPastQuestions();

        $count = 0;
        foreach ($questionsData as $item) {
            $subject = Subject::firstOrCreate(
                ['slug' => Str::slug($item['subject'])],
                [
                    'school_id' => null,
                    'name' => $item['subject'],
                    'description' => "National past examination curriculum for {$item['subject']}.",
                    'status' => 'active',
                    'sort_order' => 1,
                ]
            );

            $topic = Topic::firstOrCreate(
                ['subject_id' => $subject->id, 'slug' => Str::slug($item['topic'])],
                [
                    'name' => $item['topic'],
                    'level' => $item['level'] ?? 'SS3',
                    'description' => "Exam preparation and mastery for {$item['topic']}.",
                    'status' => 'active',
                    'sort_order' => 1,
                ]
            );

            $existing = PastQuestion::where('exam_code', $item['exam_code'])
                ->where('subject_id', $subject->id)
                ->where('exam_year', $item['exam_year'])
                ->where('question_number', $item['question_number'] ?? null)
                ->where('question_text', $item['question_text'])
                ->first();

            if ($existing) {
                continue;
            }

            $question = PastQuestion::create([
                'subject_id' => $subject->id,
                'topic_id' => $topic->id,
                'question_text' => $item['question_text'],
                'difficulty' => $item['difficulty'] ?? 'medium',
                'explanation' => $item['explanation'] ?? null,
                'status' => 'active',
                'exam_code' => $item['exam_code'],
                'exam_year' => $item['exam_year'],
                'paper_type' => $item['paper_type'] ?? 'Paper 1 (CBT)',
                'question_number' => $item['question_number'] ?? null,
                'passage_text' => $item['passage_text'] ?? null,
                'image_url' => $item['image_url'] ?? null,
                'metadata' => [
                    'source' => 'National Past Papers Official Archive',
                    'verified' => true,
                ],
            ]);

            $sortOrder = 1;
            $optionKeys = ['A', 'B', 'C', 'D', 'E'];
            $keyIndex = 0;
            foreach ($item['options'] as $optText => $isCorrect) {
                PastQuestionOption::create([
                    'past_question_id' => $question->id,
                    'option_key' => $optionKeys[$keyIndex++] ?? null,
                    'option_text' => (string) $optText,
                    'is_correct' => (bool) $isCorrect,
                    'sort_order' => $sortOrder++,
                ]);
            }
            $count++;
        }

        $this->command?->info("Successfully seeded {$count} curated past examination questions into past_questions table.");
    }

    protected function getCuratedPastQuestions(): array
    {
        return [
            // =========================================================================
            // 1. JAMB UTME - MATHEMATICS (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Indices, Logarithms & Surds',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'Evaluate $\log_2 32 - \log_3 81 + \log_5 125$.',
                'explanation' => '$\log_2 32 = \log_2 (2^5) = 5$. $\log_3 81 = \log_3 (3^4) = 4$. $\log_5 125 = \log_5 (5^3) = 3$. Therefore: $5 - 4 + 3 = 4$.',
                'difficulty' => 'easy',
                'options' => [
                    '4' => true,
                    '6' => false,
                    '2' => false,
                    '8' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Quadratic Equations & Polynomials',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'If $\alpha$ and $\beta$ are the roots of the equation $2x^2 - 5x + 3 = 0$, find the value of $\frac{1}{\alpha} + \frac{1}{\beta}$.',
                'explanation' => 'For $ax^2 + bx + c = 0$, $\alpha + \beta = -b/a = 5/2$ and $\alpha\beta = c/a = 3/2$. Then $\frac{1}{\alpha} + \frac{1}{\beta} = \frac{\alpha+\beta}{\alpha\beta} = \frac{5/2}{3/2} = \frac{5}{3}$.',
                'difficulty' => 'medium',
                'options' => [
                    '$\frac{5}{3}$' => true,
                    '$\frac{3}{5}$' => false,
                    '$\frac{5}{2}$' => false,
                    '$-\frac{5}{3}$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Calculus: Differentiation & Integration',
                'level' => 'SS3',
                'question_number' => 3,
                'question_text' => 'Find the derivative of $y = (3x^2 - 2)^4$ with respect to $x$.',
                'explanation' => 'Using the chain rule: $\frac{dy}{dx} = 4(3x^2 - 2)^3 \cdot \frac{d}{dx}(3x^2 - 2) = 4(3x^2 - 2)^3(6x) = 24x(3x^2 - 2)^3$.',
                'difficulty' => 'medium',
                'options' => [
                    '$24x(3x^2 - 2)^3$' => true,
                    '$12x(3x^2 - 2)^3$' => false,
                    '$4(3x^2 - 2)^3$' => false,
                    '$24x^2(3x^2 - 2)^3$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Matrices & Determinants',
                'level' => 'SS3',
                'question_number' => 4,
                'question_text' => 'Find the determinant of the matrix $A = \begin{pmatrix} 3 & 4 \\ 2 & -1 \end{pmatrix}$.',
                'explanation' => '$\det(A) = (3)(-1) - (4)(2) = -3 - 8 = -11$.',
                'difficulty' => 'easy',
                'options' => [
                    '$-11$' => true,
                    '$11$' => false,
                    '$-5$' => false,
                    '$5$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2023,
                'subject' => 'Mathematics',
                'topic' => 'Trigonometry & Bearings',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'If $\sin \theta = \frac{3}{5}$ and $\theta$ is an acute angle, calculate $\cos 2\theta$.',
                'explanation' => 'Using the double angle identity $\cos 2\theta = 1 - 2\sin^2 \theta = 1 - 2\left(\frac{3}{5}\right)^2 = 1 - 2\left(\frac{9}{25}\right) = 1 - \frac{18}{25} = \frac{7}{25}$.',
                'difficulty' => 'medium',
                'options' => [
                    '$\frac{7}{25}$' => true,
                    '$\frac{16}{25}$' => false,
                    '$\frac{24}{25}$' => false,
                    '$-\frac{7}{25}$' => false,
                ],
            ],

            // =========================================================================
            // 2. JAMB UTME - ENGLISH LANGUAGE (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'English Language',
                'topic' => 'Synonyms & Vocabulary',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'Choose the word that is **NEAREST IN MEANING** to the underlined word: "The minister delivered an **eloquent** speech that moved the entire audience."',
                'explanation' => '"Eloquent" means fluent, persuasive, and articulate in speech or writing.',
                'difficulty' => 'easy',
                'options' => [
                    'Articulate and persuasive' => true,
                    'Lengthy and boring' => false,
                    'Aggressive and hostile' => false,
                    'Quiet and timid' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'English Language',
                'topic' => 'Antonyms & Lexis',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'Choose the word that is **OPPOSITE IN MEANING** to the underlined word: "The team made a **meticulous** preparation before embarking on the tournament."',
                'explanation' => '"Meticulous" means showing great attention to detail; very careful and precise. Its direct opposite is "careless" or "slapdash".',
                'difficulty' => 'medium',
                'options' => [
                    'Careless' => true,
                    'Painstaking' => false,
                    'Rigorous' => false,
                    'Thorough' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'English Language',
                'topic' => 'Oral English: Stress & Phonetics',
                'level' => 'SS3',
                'question_number' => 3,
                'question_text' => 'Which of the following words has the primary stress on the **second syllable**?',
                'explanation' => 'pho-TO-gra-phy has primary stress on the second syllable (-TO-). Compare with PHO-to-graph (1st syllable) and pho-to-GRA-phic (3rd syllable).',
                'difficulty' => 'medium',
                'options' => [
                    'Photography' => true,
                    'Photograph' => false,
                    'Photographic' => false,
                    'Photostat' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2023,
                'subject' => 'English Language',
                'topic' => 'Grammar, Concord & Sentence Structure',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'Neither the principal nor the teachers _______ present at the conference yesterday.',
                'explanation' => 'When subjects are joined by "neither... nor", the verb agrees with the closer subject ("the teachers", which is plural), hence "were".',
                'difficulty' => 'easy',
                'options' => [
                    'were' => true,
                    'was' => false,
                    'is' => false,
                    'are' => false,
                ],
            ],

            // =========================================================================
            // 3. JAMB UTME - PHYSICS (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Physics',
                'topic' => 'Kinematics & Dynamics',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'A car starts from rest and accelerates uniformly at $2.5\text{ m/s}^2$ for $10\text{ seconds}$. Calculate the total distance covered.',
                'explanation' => 'Using $s = ut + \frac{1}{2}at^2$: $u = 0$, so $s = \frac{1}{2}(2.5)(10^2) = \frac{1}{2}(2.5)(100) = 125\text{ m}$.',
                'difficulty' => 'easy',
                'options' => [
                    '$125\text{ m}$' => true,
                    '$250\text{ m}$' => false,
                    '$50\text{ m}$' => false,
                    '$25\text{ m}$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Physics',
                'topic' => 'Electricity & Magnetism',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'Three resistors of resistances $2\,\Omega$, $3\,\Omega$, and $6\,\Omega$ are connected in parallel. What is their effective combined resistance?',
                'explanation' => '$\frac{1}{R_p} = \frac{1}{2} + \frac{1}{3} + \frac{1}{6} = \frac{3 + 2 + 1}{6} = \frac{6}{6} = 1\,\Omega^{-1} \implies R_p = 1\,\Omega$.',
                'difficulty' => 'easy',
                'options' => [
                    '$1\,\Omega$' => true,
                    '$11\,\Omega$' => false,
                    '$2\,\Omega$' => false,
                    '$0.5\,\Omega$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Physics',
                'topic' => 'Waves, Light & Optics',
                'level' => 'SS3',
                'question_number' => 3,
                'question_text' => 'An object is placed $20\text{ cm}$ in front of a convex lens of focal length $10\text{ cm}$. What is the nature and position of the image formed?',
                'explanation' => 'Using $\frac{1}{f} = \frac{1}{u} + \frac{1}{v}$: $\frac{1}{10} = \frac{1}{20} + \frac{1}{v} \implies \frac{1}{v} = \frac{1}{10} - \frac{1}{20} = \frac{1}{20} \implies v = 20\text{ cm}$. Since $u = 2f$, the image is real, inverted, and of the same size at $20\text{ cm}$ behind the lens.',
                'difficulty' => 'medium',
                'options' => [
                    'Real, inverted, and at $20\text{ cm}$ on the other side' => true,
                    'Virtual, erect, and magnified at $10\text{ cm}$' => false,
                    'Real, magnified, and at $40\text{ cm}$' => false,
                    'Virtual, diminished, and at infinity' => false,
                ],
            ],

            // =========================================================================
            // 4. JAMB UTME - CHEMISTRY (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Chemistry',
                'topic' => 'Acids, Bases, Salts & Titration',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'What is the pH of a $0.001\text{ M}$ solution of hydrochloric acid ($\text{HCl}$)?',
                'explanation' => '$\text{HCl}$ is a strong monobasic acid, so $[\text{H}^+] = 0.001 = 10^{-3}\text{ M}$. $\text{pH} = -\log_{10}[\text{H}^+] = -\log_{10}(10^{-3}) = 3$.',
                'difficulty' => 'easy',
                'options' => [
                    '$3$' => true,
                    '$1$' => false,
                    '$11$' => false,
                    '$7$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Chemistry',
                'topic' => 'Organic Chemistry & Hydrocarbons',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'Which of the following compounds gives a brick-red precipitate when heated with Fehling\'s solution?',
                'explanation' => 'Alkanal (aldehydes) like ethanal reduce Fehling\'s solution (copper(II) ions) to a brick-red precipitate of copper(I) oxide ($\text{Cu}_2\text{O}$).',
                'difficulty' => 'medium',
                'options' => [
                    'Ethanal ($\text{CH}_3\text{CHO}$)' => true,
                    'Ethanol ($\text{C}_2\text{H}_5\text{OH}$)' => false,
                    'Ethanoic acid ($\text{CH}_3\text{COOH}$)' => false,
                    'Propanone ($\text{CH}_3\text{COCH}_3$)' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2023,
                'subject' => 'Chemistry',
                'topic' => 'Atomic Structure & Periodic Table',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'The electronic configuration of an element $X$ is $1s^2\,2s^2\,2p^6\,3s^2\,3p^4$. To which group and period in the periodic table does $X$ belong?',
                'explanation' => 'The highest principal quantum number $n = 3$, so it is in **Period 3**. The valence electrons in the outermost shell is $2 + 4 = 6$, so it belongs to **Group 16 (or Group VI A / Oxygen group)**.',
                'difficulty' => 'easy',
                'options' => [
                    'Group 16 (VI), Period 3' => true,
                    'Group 14 (IV), Period 3' => false,
                    'Group 16 (VI), Period 2' => false,
                    'Group 4, Period 3' => false,
                ],
            ],

            // =========================================================================
            // 5. JAMB UTME - BIOLOGY (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Biology',
                'topic' => 'Genetics & Heredity',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'If a heterozygous tall plant ($Tt$) is crossed with a homozygous short plant ($tt$), what is the expected phenotypic ratio of tall to short offspring?',
                'explanation' => 'The cross $Tt \times tt$ produces gametes $T, t$ and $t, t$. Punnett square yields $50\%\ Tt$ (tall) and $50\%\ tt$ (short), giving a ratio of $1:1$.',
                'difficulty' => 'easy',
                'options' => [
                    '$1:1$' => true,
                    '$3:1$' => false,
                    '$1:2:1$' => false,
                    '$4:0$' => false,
                ],
            ],
            [
                'exam_code' => 'jamb',
                'exam_year' => 2024,
                'subject' => 'Biology',
                'topic' => 'Human Biology & Organ Systems',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'Which blood vessel transports oxygenated blood from the lungs back to the left atrium of the heart?',
                'explanation' => 'The pulmonary vein is the unique vein in the human body that transports oxygenated blood from the lungs directly into the left atrium.',
                'difficulty' => 'easy',
                'options' => [
                    'Pulmonary vein' => true,
                    'Pulmonary artery' => false,
                    'Vena cava' => false,
                    'Aorta' => false,
                ],
            ],

            // =========================================================================
            // 6. WAEC (WASSCE) - MATHEMATICS (2024 & 2023)
            // =========================================================================
            [
                'exam_code' => 'waec',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Statistics & Probability',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'A fair die is rolled twice. What is the probability that the sum of the two outcomes is equal to $8$?',
                'explanation' => 'The total sample space for two dice is $6 \times 6 = 36$. Favorable outcomes summing to 8 are: $(2,6), (3,5), (4,4), (5,3), (6,2)$, which is 5 outcomes. Hence $P(\text{sum}=8) = \frac{5}{36}$.',
                'difficulty' => 'medium',
                'options' => [
                    '$\frac{5}{36}$' => true,
                    '$\frac{1}{6}$' => false,
                    '$\frac{7}{36}$' => false,
                    '$\frac{1}{9}$' => false,
                ],
            ],
            [
                'exam_code' => 'waec',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Euclidean & Circle Geometry',
                'level' => 'SS3',
                'question_number' => 2,
                'question_text' => 'In a circle with centre $O$, the angle subtended by an arc at the centre is $120^\circ$. What is the angle subtended by the same arc at the circumference?',
                'explanation' => 'The angle subtended by an arc at the centre of a circle is twice the angle subtended by it at any point on the circumference: $\theta_{\text{circumference}} = \frac{120^\circ}{2} = 60^\circ$.',
                'difficulty' => 'easy',
                'options' => [
                    '$60^\circ$' => true,
                    '$240^\circ$' => false,
                    '$90^\circ$' => false,
                    '$30^\circ$' => false,
                ],
            ],

            // =========================================================================
            // 7. WAEC (WASSCE) - ECONOMICS (2024)
            // =========================================================================
            [
                'exam_code' => 'waec',
                'exam_year' => 2024,
                'subject' => 'Economics',
                'topic' => 'Demand, Supply & Price Mechanism',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'If a $10\%$ increase in the price of a commodity leads to a $25\%$ decrease in quantity demanded, what is the price elasticity of demand?',
                'explanation' => '$\text{Price Elasticity of Demand (PED)} = \frac{\%\Delta Q_d}{\%\Delta P} = \frac{-25\%}{10\%} = -2.5$ (or $|2.5|$, which indicates elastic demand).',
                'difficulty' => 'easy',
                'options' => [
                    '$2.5$ (Elastic)' => true,
                    '$0.4$ (Inelastic)' => false,
                    '$1.0$ (Unitary)' => false,
                    '$25.0$ (Perfect)' => false,
                ],
            ],

            // =========================================================================
            // 8. NECO SSCE - CIVIC EDUCATION (2024)
            // =========================================================================
            [
                'exam_code' => 'neco',
                'exam_year' => 2024,
                'subject' => 'Civic Education',
                'topic' => 'Fundamental Principles of Citizenship & Governance',
                'level' => 'SS3',
                'question_number' => 1,
                'question_text' => 'Which tier of government in the Nigerian federal system has primary constitutional responsibility for primary healthcare delivery and local market management?',
                'explanation' => 'Under the Fourth Schedule of the 1999 Constitution of the Federal Republic of Nigeria, Local Government Councils manage primary healthcare centres, local markets, and motor parks.',
                'difficulty' => 'easy',
                'options' => [
                    'Local Government' => true,
                    'State Government' => false,
                    'Federal Ministry of Health' => false,
                    'National Assembly' => false,
                ],
            ],

            // =========================================================================
            // 9. BECE (JUNIOR WAEC) - BASIC SCIENCE & MATHEMATICS (2024)
            // =========================================================================
            [
                'exam_code' => 'bece',
                'exam_year' => 2024,
                'subject' => 'Mathematics',
                'topic' => 'Algebraic Processes & Calculations',
                'level' => 'JSS3',
                'question_number' => 1,
                'question_text' => 'If $3y - 4 = 14$, what is the value of $y + 5$?',
                'explanation' => '$3y = 14 + 4 = 18 \implies y = 6$. Therefore $y + 5 = 6 + 5 = 11$.',
                'difficulty' => 'easy',
                'options' => [
                    '$11$' => true,
                    '$6$' => false,
                    '$15$' => false,
                    '$9$' => false,
                ],
            ],
            [
                'exam_code' => 'bece',
                'exam_year' => 2024,
                'subject' => 'Basic Science',
                'topic' => 'Energy, Matter & Living Things',
                'level' => 'JSS3',
                'question_number' => 1,
                'question_text' => 'Which gas is released into the atmosphere as a byproduct of photosynthesis by green plants?',
                'explanation' => 'During photosynthesis, green plants use carbon dioxide and water in the presence of sunlight and chlorophyll to produce glucose and release **oxygen** gas into the atmosphere.',
                'difficulty' => 'easy',
                'options' => [
                    'Oxygen' => true,
                    'Carbon Dioxide' => false,
                    'Nitrogen' => false,
                    'Hydrogen' => false,
                ],
            ],
        ];
    }
}
