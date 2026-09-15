import React, { useState, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { db } from '@/db/database';
import 'katex/dist/katex.min.css';

interface Message {
    role: 'user' | 'model';
    content: string;
}

function detectSubjectFromQuery(query: string): string {
    const q = query.toLowerCase();
    if (/\b(math|maths|mathematics|algebra|calculus|arithmetic|geometry|equation)\b/.test(q)) {
        return 'Mathematics';
    }
    if (/\b(bio|biology|cellular|photosynthesis|genetics|ecology|organism)\b/.test(q)) {
        return 'Biology';
    }
    if (/\b(chem|chemistry|atomic|neutron|electron|proton|acid|base|periodic)\b/.test(q)) {
        return 'Chemistry';
    }
    if (/\b(phy|physics|kinematics|velocity|acceleration|force|motion|optics|electric)\b/.test(q)) {
        return 'Physics';
    }
    if (/\b(eng|english|grammar|lexis|synonym|antonym|comprehension|literature)\b/.test(q)) {
        return 'English';
    }
    if (/\b(econ|economics|demand|supply|inflation|market|gdp)\b/.test(q)) {
        return 'Economics';
    }
    return 'General Curriculum';
}

function generateSubjectQuestions(subject: string): string {
    switch (subject) {
        case 'Mathematics':
            return `### WAEC Practice Assessment: Mathematics (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Algebra - Linear Equations):**\n`
                + `Solve for $x$ in the equation: $3(x - 2) = 2x + 4$\n`
                + `* A) $x = 2$\n`
                + `* B) $x = 6$\n`
                + `* C) $x = 10$ *(Correct)*\n`
                + `* D) $x = 14$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `1. Expand brackets: $3x - 6 = 2x + 4$\n`
                + `2. Collect like terms: $3x - 2x = 4 + 6$\n`
                + `3. Therefore: $x = 10$\n\n`
                + `---\n\n`
                + `**Question 2 (Algebra - Quadratic Equations):**\n`
                + `Find the roots of the quadratic equation: $x^2 - 5x + 6 = 0$\n`
                + `* A) $x = -2\\text{ or }-3$\n`
                + `* B) $x = 2\\text{ or } 3$ *(Correct)*\n`
                + `* C) $x = 1\\text{ or } 6$\n`
                + `* D) $x = -1\\text{ or }-6$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `1. Factor the quadratic: $(x - 2)(x - 3) = 0$\n`
                + `2. Solve for $x$: $x = 2\\text{ or } x = 3$\n\n`
                + `---\n\n`
                + `**Question 3 (Indices & Logarithms):**\n`
                + `Solve for $x$ if $2^{x+1} = 16$\n`
                + `* A) $x = 2$\n`
                + `* B) $x = 3$ *(Correct)*\n`
                + `* C) $x = 4$\n`
                + `* D) $x = 5$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `1. Express 16 in base 2: $16 = 2^4$\n`
                + `2. Equate exponents: $x + 1 = 4 \\implies x = 3$\n\n`
                + `---\n\n`
                + `**Question 4 (Simultaneous Equations):**\n`
                + `If $2x + y = 7$ and $x - y = 2$, find the value of $x$.\n`
                + `* A) $x = 1$\n`
                + `* B) $x = 2$\n`
                + `* C) $x = 3$ *(Correct)*\n`
                + `* D) $x = 4$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `1. Add the two equations: $(2x + y) + (x - y) = 7 + 2 \\implies 3x = 9$\n`
                + `2. Divide by 3: $x = 3$\n\n`
                + `---\n\n`
                + `**Question 5 (Geometry & Trigonometry):**\n`
                + `In a right-angled triangle, the base is $6\\text{ cm}$ and the height is $8\\text{ cm}$. Calculate the length of the hypotenuse.\n`
                + `* A) $10\\text{ cm}$ *(Correct)*\n`
                + `* B) $12\\text{ cm}$\n`
                + `* C) $14\\text{ cm}$\n`
                + `* D) $16\\text{ cm}$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `1. By Pythagoras theorem: $c^2 = a^2 + b^2 = 6^2 + 8^2 = 36 + 64 = 100$\n`
                + `2. Therefore: $c = \\sqrt{100} = 10\\text{ cm}$\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;

        case 'Biology':
            return `### WAEC Practice Assessment: Biology (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Cellular Physiology):**\n`
                + `Which organelle is primarily responsible for synthesizing adenosine triphosphate (ATP) in eukaryotic cells?\n`
                + `* A) Ribosome\n`
                + `* B) Mitochondrion *(Correct)*\n`
                + `* C) Nucleus\n`
                + `* D) Golgi apparatus\n\n`
                + `**Explanation:** Mitochondria generate cellular energy via oxidative phosphorylation during aerobic cellular respiration.\n\n`
                + `---\n\n`
                + `**Question 2 (Photosynthesis):**\n`
                + `What is the primary light-absorbing pigment in green plants?\n`
                + `* A) Carotenoid\n`
                + `* B) Xanthophyll\n`
                + `* C) Chlorophyll a *(Correct)*\n`
                + `* D) Anthocyanin\n\n`
                + `**Explanation:** Chlorophyll a absorbs blue and red wavelengths of light for light-dependent photosynthetic reactions.\n\n`
                + `---\n\n`
                + `**Question 3 (Genetics):**\n`
                + `What is the expected genotypic ratio in a monohybrid cross between two heterozygous (Tt) pea plants?\n`
                + `* A) 3:1\n`
                + `* B) 1:2:1 *(Correct)*\n`
                + `* C) 1:1\n`
                + `* D) 9:3:3:1\n\n`
                + `**Explanation:** The cross $Tt \\times Tt$ yields $1\\text{ TT} : 2\\text{ Tt} : 1\\text{ tt}$.\n\n`
                + `---\n\n`
                + `**Question 4 (Circulatory System):**\n`
                + `Which blood vessel carries oxygenated blood from the lungs back to the left atrium of the heart?\n`
                + `* A) Pulmonary artery\n`
                + `* B) Pulmonary vein *(Correct)*\n`
                + `* C) Vena cava\n`
                + `* D) Aorta\n\n`
                + `**Explanation:** Pulmonary veins are unique veins that transport oxygen-rich blood from lungs into the heart.\n\n`
                + `---\n\n`
                + `**Question 5 (Ecology):**\n`
                + `In any terrestrial ecosystem, which trophic level contains the largest total amount of available energy?\n`
                + `* A) Primary producers *(Correct)*\n`
                + `* B) Primary consumers\n`
                + `* C) Secondary consumers\n`
                + `* D) Apex predators\n\n`
                + `**Explanation:** Due to the 10% ecological energy transfer rule, primary producers hold the maximum stored energy.\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;

        case 'Chemistry':
            return `### WAEC Practice Assessment: Chemistry (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Atomic Structure):**\n`
                + `An atom of sodium has atomic number 11 and mass number 23. What is the number of neutrons in its nucleus?\n`
                + `* A) 11\n`
                + `* B) 12 *(Correct)*\n`
                + `* C) 23\n`
                + `* D) 34\n\n`
                + `**Step-by-Step Solution:**\n`
                + `Number of neutrons = $\\text{Mass Number} - \\text{Atomic Number} = 23 - 11 = 12$.\n\n`
                + `---\n\n`
                + `**Question 2 (Periodic Table):**\n`
                + `Group 1 elements in the periodic table are collectively referred to as:\n`
                + `* A) Alkaline earth metals\n`
                + `* B) Halogens\n`
                + `* C) Alkali metals *(Correct)*\n`
                + `* D) Noble gases\n\n`
                + `**Explanation:** Group 1 elements (Li, Na, K, etc.) react with water to form alkaline hydroxides.\n\n`
                + `---\n\n`
                + `**Question 3 (Acids, Bases & Salts):**\n`
                + `What is the pH of a neutral aqueous solution at $25^\\circ\\text{C}$?\n`
                + `* A) 0\n`
                + `* B) 7.0 *(Correct)*\n`
                + `* C) 14.0\n`
                + `* D) 1.0\n\n`
                + `**Explanation:** At neutrality, $[\\text{H}^+] = [\\text{OH}^-] = 10^{-7}\\text{ mol/dm}^3$, giving $\\text{pH} = -\\log(10^{-7}) = 7$.\n\n`
                + `---\n\n`
                + `**Question 4 (Stoichiometry & Gas Laws):**\n`
                + `What is the volume occupied by 1 mole of any ideal gas at standard temperature and pressure (STP)?\n`
                + `* A) $11.2\\text{ dm}^3$\n`
                + `* B) $22.4\\text{ dm}^3$ *(Correct)*\n`
                + `* C) $24.0\\text{ dm}^3$\n`
                + `* D) $44.8\\text{ dm}^3$\n\n`
                + `**Explanation:** Avogadro's law states that 1 mole of an ideal gas occupies $22.4\\text{ dm}^3$ at STP.\n\n`
                + `---\n\n`
                + `**Question 5 (Chemical Bonding):**\n`
                + `Which type of bonding involves the complete transfer of electrons from a metal to a non-metal atom?\n`
                + `* A)标识 Electrovalent (Ionic) bonding *(Correct)*\n`
                + `* B) Covalent bonding\n`
                + `* C) Metallic bonding\n`
                + `* D) Hydrogen bonding\n\n`
                + `**Explanation:** Ionic bonding occurs through electrostatic attraction between oppositely charged ions formed by electron transfer.\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;

        case 'Physics':
            return `### WAEC Practice Assessment: Physics (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Kinematics & Motion):**\n`
                + `A vehicle accelerates uniformly from rest to a velocity of $20\\text{ m/s}$ in $5\\text{ seconds}$. Calculate its acceleration.\n`
                + `* A) $2\\text{ m/s}^2$\n`
                + `* B) $4\\text{ m/s}^2$ *(Correct)*\n`
                + `* C) $5\\text{ m/s}^2$\n`
                + `* D) $100\\text{ m/s}^2$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `Using the equation $v = u + at$:\n`
                + `$20 = 0 + a(5) \\implies a = \\frac{20}{5} = 4\\text{ m/s}^2$.\n\n`
                + `---\n\n`
                + `**Question 2 (Work, Energy & Power):**\n`
                + `Calculate the kinetic energy of an object of mass $4\\text{ kg}$ moving with a speed of $3\\text{ m/s}$.\n`
                + `* A) $6\\text{ J}$\n`
                + `* B) $12\\text{ J}$\n`
                + `* C) $18\\text{ J}$ *(Correct)*\n`
                + `* D) $36\\text{ J}$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `$\\text{K.E.} = \\frac{1}{2}mv^2 = \\frac{1}{2}(4)(3^2) = 2 \\times 9 = 18\\text{ J}$.\n\n`
                + `---\n\n`
                + `**Question 3 (Current Electricity):**\n`
                + `A resistor of $10\\,\\Omega$ is connected across a $12\\text{ V}$ battery. What is the electric current flowing through it?\n`
                + `* A) $0.83\\text{ A}$\n`
                + `* B) $1.2\\text{ A}$ *(Correct)*\n`
                + `* C) $120\\text{ A}$\n`
                + `* D) $22\\text{ A}$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `By Ohm's law: $I = \\frac{V}{R} = \\frac{12}{10} = 1.2\\text{ A}$.\n\n`
                + `---\n\n`
                + `**Question 4 (Wave Optics):**\n`
                + `What phenomenon describes the bending of light waves as they pass from air into glass?\n`
                + `* A) Reflection\n`
                + `* B) Refraction *(Correct)*\n`
                + `* C) Diffraction\n`
                + `* D) Polarization\n\n`
                + `**Explanation:** Refraction occurs due to the change in the speed of light when traveling across media of different optical densities.\n\n`
                + `---\n\n`
                + `**Question 5 (Thermal Physics):**\n`
                + `What is the SI unit of specific heat capacity?\n`
                + `* A) $\\text{J}/\\text{kg}$\n`
                + `* B) $\\text{J}/(\\text{kg}\\cdot\\text{K})$ *(Correct)*\n`
                + `* C) $\\text{W}/\\text{K}$\n`
                + `* D) $\\text{N}\\cdot\\text{m}$\n\n`
                + `**Explanation:** Specific heat capacity $c = \\frac{Q}{m\\Delta T}$, measured in $\\text{Joules per kilogram Kelvin } (\\text{J}\\cdot\\text{kg}^{-1}\\cdot\\text{K}^{-1})$.\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;

        case 'English':
            return `### WAEC Practice Assessment: English Language (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Lexis - Synonyms):**\n`
                + `Choose the option nearest in meaning to the highlighted word: *The principal delivered an **ephemeral** opening address.*\n`
                + `* A) Lengthy\n`
                + `* B) Inspiring\n`
                + `* C) Short-lived *(Correct)*\n`
                + `* D) Aggressive\n\n`
                + `**Explanation:** *Ephemeral* means lasting for a very brief period of time.\n\n`
                + `---\n\n`
                + `**Question 2 (Lexis - Antonyms):**\n`
                + `Choose the option opposite in meaning to the word in italics: *The new manager adopted a **stringent** policy on punctuality.*\n`
                + `* A) Severe\n`
                + `* B) Lenient *(Correct)*\n`
                + `* C) Rigid\n`
                + `* D) Efficient\n\n`
                + `**Explanation:** *Stringent* means strict and precise; its antonym is *lenient* (tolerant/flexible).\n\n`
                + `---\n\n`
                + `**Question 3 (Grammar - Subject-Verb Agreement):**\n`
                + `Select the correct word to complete the sentence: *Neither the teacher nor the students ______ present at the assembly.*\n`
                + `* A) was\n`
                + `* B) were *(Correct)*\n`
                + `* C) is\n`
                + `* D) has been\n\n`
                + `**Explanation:** In *neither...nor* constructions, the verb agrees with the closer subject (*students* is plural $\\implies$ *were*).\n\n`
                + `---\n\n`
                + `**Question 4 (Structure - Prepositions):**\n`
                + `Choose the correct preposition: *The committee congratulated him ______ his academic achievement.*\n`
                + `* A) for\n`
                + `* B) on *(Correct)*\n`
                + `* C) at\n`
                + `* D) with\n\n`
                + `**Explanation:** The verb *congratulate* correctly collocates with the preposition *on*.\n\n`
                + `---\n\n`
                + `**Question 5 (Oral English - Stress Pattern):**\n`
                + `Identify the syllable that carries the primary stress in the word: **PHO-TO-GRAPH-IC**\n`
                + `* A) First syllable (PHO-)\n`
                + `* B) Second syllable (-to-)\n`
                + `* C) Third syllable (-GRAPH-) *(Correct)*\n`
                + `* D) Fourth syllable (-ic)\n\n`
                + `**Explanation:** Words ending in *-ic* normally carry primary stress on the penultimate (second to last) syllable: photoGRAPHic.\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;

        default:
            return `### WAEC Practice Assessment: General Curriculum (5 Questions)\n\n`
                + `**Standard:** WAEC / NECO Senior Secondary Standard\n\n`
                + `**Question 1 (Mathematics - Linear Equations):**\n`
                + `Solve for $x$ in the equation: $3(x - 2) = 2x + 4$\n`
                + `* A) $x = 2$\n`
                + `* B) $x = 6$\n`
                + `* C) $x = 10$ *(Correct)*\n`
                + `* D) $x = 14$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `Expand brackets: $3x - 6 = 2x + 4 \\implies 3x - 2x = 4 + 6 \\implies x = 10$.\n\n`
                + `---\n\n`
                + `**Question 2 (Biology - Cellular Physiology):**\n`
                + `Which organelle is primarily responsible for synthesizing adenosine triphosphate (ATP) in eukaryotic cells?\n`
                + `* A) Ribosome\n`
                + `* B) Mitochondrion *(Correct)*\n`
                + `* C) Nucleus\n`
                + `* D) Golgi apparatus\n\n`
                + `**Explanation:** Mitochondria generate cellular chemical energy through oxidative phosphorylation and aerobic respiration.\n\n`
                + `---\n\n`
                + `**Question 3 (Chemistry - Atomic Structure):**\n`
                + `An atom of sodium has an atomic number of $11$ and a mass number of $23$. What is the total number of neutrons in its nucleus?\n`
                + `* A) $11$\n`
                + `* B) $12$ *(Correct)*\n`
                + `* C) $23$\n`
                + `* D) $34$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `$\\text{Neutrons} = \\text{Mass Number} - \\text{Atomic Number} = 23 - 11 = 12$.\n\n`
                + `---\n\n`
                + `**Question 4 (Physics - Kinematics):**\n`
                + `A vehicle accelerates uniformly from rest to a velocity of $20\\text{ m/s}$ in $5\\text{ seconds}$. Calculate its acceleration.\n`
                + `* A) $2\\text{ m/s}^2$\n`
                + `* B) $4\\text{ m/s}^2$ *(Correct)*\n`
                + `* C) $5\\text{ m/s}^2$\n`
                + `* D) $100\\text{ m/s}^2$\n\n`
                + `**Step-by-Step Solution:**\n`
                + `Using first equation of motion: $v = u + at \\implies 20 = 0 + a(5) \\implies a = \\frac{20}{5} = 4\\text{ m/s}^2$.\n\n`
                + `---\n\n`
                + `**Question 5 (English Language - Lexis & Structure):**\n`
                + `Choose the option nearest in meaning to the highlighted word: *The principal delivered an **ephemeral** opening address.*\n`
                + `* A) Lengthy\n`
                + `* B) Inspiring\n`
                + `* C) Short-lived *(Correct)*\n`
                + `* D) Aggressive\n\n`
                + `**Explanation:** *Ephemeral* denotes transitory or lasting for a very brief period of time.\n\n`
                + `*Tip: You can copy and paste these directly into the **Question Bank -> Bulk Add** modal!*`;
    }
}

async function generateOfflineResponse(message: string, isAdmin: boolean = false): Promise<string> {
    const query = message.toLowerCase();

    try {
        // ADMIN OFFLINE CAPABILITIES
        if (isAdmin) {
            const subjects = await db.subjects.toArray().catch(() => []);
            const topics = await db.topics.toArray().catch(() => []);

            // 1. Performance / Diagnostics / Summary
            if (
                query.includes('summary') ||
                query.includes('performance') ||
                query.includes('stats') ||
                query.includes('overview') ||
                query.includes('mastery') ||
                query.includes('struggling') ||
                query.includes('health')
            ) {
                const totalSubjects = subjects.length;
                const totalTopics = topics.length;
                const subjectList = subjects.map(s => `* **${s.name}**`).join('\n');

                return `### Executive Academic Summary\n\n`
                    + `**System Status:** Operating on local cached database.\n\n`
                    + `#### Curriculum Coverage\n`
                    + `* **Active Subjects:** ${totalSubjects}\n`
                    + `* **Total Syllabus Topics:** ${totalTopics}\n\n`
                    + `#### Available Subjects\n${subjectList || '* No subjects cached yet.'}\n\n`
                    + `*Connect online to synchronize live student quiz scores and mastery averages.*`;
            }

            // 2. Intervention & Remedial Plan
            if (
                query.includes('intervention') ||
                query.includes('remedial') ||
                query.includes('struggle') ||
                query.includes('help student') ||
                query.includes('weak')
            ) {
                return `### Targeted Remedial Intervention Strategy\n\n`
                    + `**Objective:** Boost student pass rates on weak topics to $\\ge 75\\%$.\n\n`
                    + `#### 3-Phase Action Plan\n`
                    + `1. **Phase 1: Formative Diagnostic (Day 1)**\n`
                    + `   * Assign a 10-question practice test from the Question Bank.\n`
                    + `2. **Phase 2: Active Recall & Concept Drill (Days 2-4)**\n`
                    + `   * Deploy micro-lessons and flashcards in the app for daily 15-minute drills.\n`
                    + `3. **Phase 3: Mastery Check (Day 5)**\n`
                    + `   * Re-test cohort. Ensure learners achieve $\\ge 80\\%$ mastery before progressing.\n\n`
                    + `*Ask me to draft exam questions for any specific subject or topic.*`;
            }

            // 3. Question Generation / Drafting (5 WAEC Standard Questions tailored to subject)
            if (
                query.includes('question') ||
                query.includes('quiz') ||
                query.includes('test') ||
                query.includes('exam') ||
                query.includes('draft') ||
                query.includes('generate') ||
                query.includes('waec') ||
                query.includes('neco')
            ) {
                const detectedSubject = detectSubjectFromQuery(query);
                return generateSubjectQuestions(detectedSubject);
            }

            // 4. Lesson Plan Outline
            if (
                query.includes('lesson') ||
                query.includes('scheme') ||
                query.includes('syllabus') ||
                query.includes('curriculum') ||
                query.includes('outline')
            ) {
                return `### Secondary Curriculum Lesson Outline (40 Minutes)\n\n`
                    + `#### 1. Performance Objectives\n`
                    + `* Define the core principle accurately.\n`
                    + `* Apply relevant formula to solve 2 worked problems.\n`
                    + `* Identify and avoid common calculation misconceptions.\n\n`
                    + `#### 2. Instructional Timeline\n`
                    + `* **0-5 min:** Prerequisite check & real-world relevance.\n`
                    + `* **5-25 min:** Direct instruction & step-by-step board examples.\n`
                    + `* **25-35 min:** Guided student practice in the app.\n`
                    + `* **35-40 min:** Exit ticket evaluation.\n\n`
                    + `*Need specific quiz questions or homework tasks? Ask me to generate them.*`;
            }

            // Default Admin Offline Greeting
            return `### AI School Copilot\n\n`
                + `I am ready to assist you with curriculum planning, academic analytics, and assessment generation.\n\n`
                + `You can ask me to:\n`
                + `1. **"Draft exam questions"**: Generate multiple-choice questions with answers and step-by-step solutions.\n`
                + `2. **"Intervention plan"**: Generate a structured 3-phase remedial plan for struggling students.\n`
                + `3. **"Curriculum outline"**: Generate 40-minute lesson plans and schemes of work.\n`
                + `4. **"Performance summary"**: Review school subjects and student mastery trends.`;
        }

        // LEARNER OFFLINE CAPABILITIES (100% Preserved)
        // 1. Suggest recommendations
        if (query.includes('recommend') || query.includes('what should i study') || query.includes('suggest') || query.includes('study next') || query.includes('todo')) {
            const progress = await db.learnerProgress.toArray();
            const subjects = await db.subjects.toArray();
            const topics = await db.topics.toArray();

            if (subjects.length === 0) {
                return "I don't see any cached subjects in your database yet. Connect to the internet to download and suggest topics for you!";
            }

            // Find topics with progress < 80% or unattempted
            const lowProgressTopics = topics.filter(t => {
                const p = progress.find(pr => pr.topic_id === t.id);
                return !p || (p.mastery_score ?? 0) < 80;
            });

            if (lowProgressTopics.length === 0) {
                return "Excellent work! You have mastered all topics. You can review your flashcards or take standard quizzes to maintain your score.";
            }

            const recommendations = lowProgressTopics.slice(0, 3).map(t => {
                const sub = subjects.find(s => s.id === t.subject_id);
                const p = progress.find(pr => pr.topic_id === t.id);
                const scoreText = p ? `(Current Mastery: ${p.mastery_score}%)` : '(Not started yet)';
                return `- **${t.name}** in *${sub?.name || 'Curriculum'}* ${scoreText}`;
            }).join('\n');

            return `Here are the top topics you should focus on next to achieve mastery:\n\n${recommendations}\n\nWould you like to study one of these?`;
        }

        // 2. List subjects
        if (query.includes('subject') || query.includes('curriculum') || query.includes('list') || query.includes('course')) {
            const subjects = await db.subjects.toArray();
            if (subjects.length === 0) {
                return "No subjects are cached locally yet. Log in while online to preload your curriculum!";
            }
            const list = subjects.map(s => `- **${s.name}**: ${s.description || 'No description available.'}`).join('\n');
            return `Here are the subjects available in your offline study library:\n\n${list}\n\nSelect a subject from the menu to start studying!`;
        }

        // 3. Search for specific topics
        const topics = await db.topics.toArray();
        const matchedTopic = topics.find(t => query.includes(t.name.toLowerCase()) || query.includes(t.slug.replace('-', ' ')));
        if (matchedTopic) {
            const subjects = await db.subjects.toArray();
            const sub = subjects.find(s => s.id === matchedTopic.subject_id);

            // Look for sample explanation in cached quizzes
            const quizzes = await db.quizzes.toArray();
            let keyConcept = '';
            for (const q of quizzes) {
                const found = q.questions?.find((item: any) => item.topic_id === matchedTopic.id && item.explanation);
                if (found?.explanation) {
                    keyConcept = found.explanation;
                    break;
                }
            }

            let response = `Here is what I found in your offline library about **${matchedTopic.name}** (Level: ${matchedTopic.level.toUpperCase()}):\n\n*${matchedTopic.description || 'No description cached.'}*\n\nThis topic is part of your **${sub?.name || 'Curriculum'}** course.`;
            if (keyConcept) {
                response += `\n\n**Key Concept:**\n${keyConcept}`;
            }
            response += `\n\nYou can practice this topic by taking the quiz for ${sub?.name || 'this subject'}!`;
            return response;
        }

        // 4. Search for specific subjects
        const subjects = await db.subjects.toArray();
        const matchedSubject = subjects.find(s => query.includes(s.name.toLowerCase()) || query.includes(s.slug));
        if (matchedSubject) {
            const subTopics = topics.filter(t => t.subject_id === matchedSubject.id);
            const topicList = subTopics.map(t => `- **${t.name}** (Level: ${t.level.toUpperCase()})`).join('\n');
            return `Here are the topics available in **${matchedSubject.name}**:\n\n${topicList || 'No topics cached yet.'}\n\nAsk me about any of these topics or practice them in the Subjects menu!`;
        }

        // 5. Concept & Question Bank Search across cached quizzes
        const cleanWords = query.replace(/[^\w\s]/g, '').split(' ').filter(w => w.length >= 4);
        if (cleanWords.length > 0) {
            const quizzes = await db.quizzes.toArray();
            for (const q of quizzes) {
                const qn = q.questions?.find((item: any) =>
                    cleanWords.some(w => item.question_text?.toLowerCase().includes(w) || item.explanation?.toLowerCase().includes(w))
                );
                if (qn) {
                    const sub = subjects.find(s => s.id === (q as any).subject_id);
                    const t = topics.find(tp => tp.id === qn.topic_id);
                    return `Here is what your offline curriculum notes say:\n\n* **${sub?.name || 'Curriculum'}** → **${t?.name || 'Concept'}**\n\n**Explanation:**\n${qn.explanation || qn.question_text}\n\nWould you like to practice more on this topic?`;
                }
            }
        }
    } catch (e) {
        console.warn('AILEARN helper error:', e);
    }

    // 6. Default Dynamic Offline fallback message for learners
    const cachedSubjects = await db.subjects.toArray().catch(() => []);
    const cachedTopics = await db.topics.toArray().catch(() => []);
    const subjectList = cachedSubjects.length > 0 ? cachedSubjects.map(s => s.name).join(', ') : 'all enrolled subjects';
    const sampleTopics = cachedTopics.slice(0, 3).map(t => `**${t.name}**`).join(', ');

    return `**AILEARN Tutor Mode**\n\nI am operating in offline mode using your local curriculum library for **${subjectList}**.\n\nWhile offline, I can help you with:\n1. **"Recommend what to study"**: I will analyze your local mastery and suggest topics.\n2. **"List subjects"**: View your offline curriculum and descriptions.\n3. Ask about any topic in your library (e.g. ${sampleTopics || 'your topics'}) to see concept notes.`;
}

export default function ChatWidget() {
    const { auth } = usePage<any>().props;
    const user = auth?.user;
    const isAdmin = user?.role === 'school_admin' || user?.role === 'platform_admin';

    const defaultGreeting = isAdmin
        ? `Hello ${user?.name || 'Admin'}! I am your AI School Administrator Copilot. Ask me to summarize student performance, recommend remedial interventions, draft exam questions, or create lesson outlines.`
        : "Hi! I'm your AI Study Companion. Ask me to recommend what to study, explain a topic, or plan your schedule!";

    const [chatOpen, setChatOpen] = useState<boolean>(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: defaultGreeting }
    ]);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatLoading, setChatLoading] = useState<boolean>(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Update greeting if auth changes
    useEffect(() => {
        setMessages([{ role: 'model', content: defaultGreeting }]);
    }, [isAdmin, user?.name]);

    // Scroll chat to bottom on new message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, chatOpen]);

    const getCsrfToken = () => {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] || '';
    };

    const handleSendMessage = async (customMessage?: string) => {
        const textToSend = (customMessage || chatInput).trim();
        if (!textToSend || chatLoading) return;

        if (!customMessage) setChatInput('');
        setMessages((prev) => [...prev, { role: 'user', content: textToSend }]);
        setChatLoading(true);

        // If offline, use the local AI response generator
        if (!navigator.onLine) {
            setTimeout(async () => {
                const response = await generateOfflineResponse(textToSend, isAdmin);
                setMessages((prev) => [...prev, { role: 'model', content: response }]);
                setChatLoading(false);
            }, 600);
            return;
        }

        try {
            const res = await fetch('/api/v1/ai/chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken())
                },
                body: JSON.stringify({
                    message: textToSend,
                    history: messages
                })
            });

            if (!res.ok) throw new Error('Failed to send message');
            const data = await res.json();

            setMessages((prev) => [...prev, { role: 'model', content: data.response }]);
        } catch (error) {
            console.error('AI chat online request failed, falling back to local heuristic:', error);
            // Fallback to local response generator if network fails
            const response = await generateOfflineResponse(textToSend, isAdmin);
            setMessages((prev) => [...prev, { role: 'model', content: response }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage();
    };

    const adminQuickPrompts = [
        "Summarize school mastery",
        "Remedial plan for struggling students",
        "Draft 5 WAEC exam questions",
        "Curriculum lesson outline"
    ];

    const learnerQuickPrompts = [
        "What should I study next?",
        "Explain a difficult concept",
        "Give me a practice problem"
    ];

    const quickPrompts = isAdmin ? adminQuickPrompts : learnerQuickPrompts;

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
            {/* Chat Panel Box */}
            {chatOpen && (
                <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[480px] md:w-[500px] max-h-[85vh] h-[580px] bg-[var(--color-surface)]/95 border border-[var(--color-border)] rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="p-4 bg-[var(--color-background)]/60 border-b border-[var(--color-border)] flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <div>
                                <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                                    {isAdmin ? 'AI School Copilot' : 'AI Study Companion'}
                                </h4>
                                <span className="text-[10px] text-[var(--color-muted)] block font-semibold">
                                    {isAdmin ? 'Academic & School Intelligence' : 'Online/Offline Hybrid'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setChatOpen(false)}
                            className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)] rounded-lg transition-colors cursor-pointer min-h-[32px] flex items-center justify-center"
                            aria-label="Close Chat"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Quick Suggestion Chips (shown when few messages) */}
                    {messages.length <= 2 && (
                        <div className="px-3.5 py-2.5 bg-[var(--color-background)]/40 border-b border-[var(--color-border)] flex flex-wrap gap-1.5">
                            {quickPrompts.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSendMessage(prompt)}
                                    disabled={chatLoading}
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-text)] border border-[var(--color-border)] transition-all cursor-pointer font-medium disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Message log */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={msg.role === 'user' ? 'chat-bubble-user font-medium p-3.5 text-xs leading-relaxed max-w-[90%] break-words' : 'bg-[var(--color-background)]/60 text-[var(--color-text)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs leading-relaxed max-w-[92%] font-medium break-words overflow-x-auto min-w-0'}>
                                    <Markdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ children }) => <div className="mb-2 last:mb-0 break-words leading-relaxed overflow-x-auto py-0.5">{children}</div>,
                                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 break-words">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 break-words">{children}</ol>,
                                            li: ({ children }) => <li className="mb-0.5 break-words">{children}</li>,
                                            h3: ({ children }) => <h3 className="font-bold text-sm text-[var(--color-text)] mb-1.5 mt-2 border-b border-[var(--color-border)] pb-1">{children}</h3>,
                                            h4: ({ children }) => <h4 className="font-semibold text-xs text-[var(--color-primary)] mb-1 mt-1.5">{children}</h4>,
                                            strong: ({ children }) => <strong className="font-bold text-[var(--color-text)]">{children}</strong>,
                                            hr: () => <hr className="my-2.5 border-[var(--color-border)]" />,
                                            a: ({ href, children }) => <a href={href} className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                                        }}
                                    >
                                        {msg.content}
                                    </Markdown>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[var(--color-background)]/50 text-[var(--color-muted)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs animate-pulse font-semibold">
                                    {isAdmin ? 'AI Copilot is analyzing...' : 'Tutor is thinking...'}
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleFormSubmit} className="p-3 bg-[var(--color-background)]/40 border-t border-[var(--color-border)] flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={isAdmin ? "Ask AI Copilot about mastery, interventions, questions..." : "Ask AI anything..."}
                            disabled={chatLoading}
                            className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-teal-500 min-h-[38px]"
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all min-h-[38px] flex items-center justify-center cursor-pointer"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                onClick={() => setChatOpen(!chatOpen)}
                className="h-14 w-14 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white flex items-center justify-center shadow-lg hover:shadow-teal-500/20 shadow-teal-600/30 transition-transform active:scale-95 cursor-pointer focus:outline-none"
                title={isAdmin ? "Open AI School Copilot" : "Open AI Study Companion"}
            >
                {chatOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
