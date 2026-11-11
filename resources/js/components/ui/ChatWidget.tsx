import React, { useState, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { ArrowLeft, History, SquarePen, Trash2 } from 'lucide-react';
import { confirmAction } from '@/components/common/ConfirmModal';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { db } from '@/db/database';
import 'katex/dist/katex.min.css';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface SavedChat {
    id: number;
    title: string;
    last_message_at: string;
}

/** "Today", "Yesterday", or a short date, for the saved chats list. */
function chatDay(iso: string): string {
    const d = new Date(iso);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
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

async function generateOfflineResponse(message: string, isAdmin: boolean = false, history: Message[] = []): Promise<string> {
    const query = message.toLowerCase();

    // Find last model message in conversation history
    let lastModelMessage = '';
    if (history && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'model') {
                lastModelMessage = history[i].content;
                break;
            }
        }
    }

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
                    + `**Status:** Offline Study Library\n\n`
                    + `#### Curriculum Coverage\n`
                    + `* **Active Subjects:** ${totalSubjects}\n`
                    + `* **Total Syllabus Topics:** ${totalTopics}\n\n`
                    + `#### Available Subjects\n${subjectList || '* No subjects available yet.'}\n\n`
                    + `*Connect online to synchronize live student quiz scores and mastery averages.*`;
            }

            // 2. Student Support & Help Plan
            if (
                query.includes('support') ||
                query.includes('intervention') ||
                query.includes('remedial') ||
                query.includes('struggle') ||
                query.includes('help student') ||
                query.includes('extra help') ||
                query.includes('weak')
            ) {
                return `### Targeted Student Support Plan\n\n`
                    + `**Goal:** Help students understand difficult topics and achieve $\\ge 75\\%$ score.\n\n`
                    + `#### 3-Step Action Plan\n`
                    + `1. **Step 1: Quick Practice Check (Day 1)**\n`
                    + `   * Assign a 10-question practice test from the Question Bank.\n`
                    + `2. **Step 2: Concept Review & Practice Drills (Days 2-4)**\n`
                    + `   * Review key ideas using flashcards and daily 15-minute drills in the app.\n`
                    + `3. **Step 3: Progress Check (Day 5)**\n`
                    + `   * Re-test students to ensure they understand the topic before moving forward.\n\n`
                    + `*Ask me to draft exam questions for any specific subject or topic.*`;
            }

            // 3. Question Retrieval / Exam Practice from Question Bank
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

                // Fetch dynamic questions from Dexie (adminQuestions & quizzes)
                const adminQList = await db.adminQuestions.toArray().catch(() => []);
                const quizzes = await db.quizzes.toArray().catch(() => []);

                // Collect all questions with subject metadata
                const allOfflineQuestions: Array<{
                    topic_id: number;
                    subject_name: string;
                    topic_name: string;
                    question_text: string;
                    options: Array<{ option_text: string; is_correct: boolean }>;
                    explanation: string | null;
                }> = [];

                for (const q of adminQList) {
                    const top = topics.find(t => t.id === q.topic_id);
                    const sub = subjects.find(s => s.id === top?.subject_id);
                    const subName = sub?.name || q.topic?.subject?.name || 'General Knowledge';
                    allOfflineQuestions.push({
                        topic_id: q.topic_id,
                        subject_name: subName,
                        topic_name: top?.name || q.topic?.name || 'Curriculum Topic',
                        question_text: q.question_text,
                        options: (q.options || []).map(o => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) })),
                        explanation: q.explanation || null
                    });
                }

                for (const qz of quizzes) {
                    const sub = subjects.find(s => s.id === (qz as any).subject_id);
                    const subName = sub?.name || 'General Knowledge';
                    for (const q of (qz.questions || [])) {
                        const top = topics.find(t => t.id === q.topic_id);
                        if (!allOfflineQuestions.some(item => item.question_text === q.question_text)) {
                            allOfflineQuestions.push({
                                topic_id: q.topic_id,
                                subject_name: subName,
                                topic_name: top?.name || 'Curriculum Concept',
                                question_text: q.question_text,
                                options: (q.options || []).map(o => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) })),
                                explanation: q.explanation || null
                            });
                        }
                    }
                }

                // Filter by detectedSubject unless General Curriculum
                const filtered = detectedSubject === 'General Curriculum'
                    ? allOfflineQuestions
                    : allOfflineQuestions.filter(q => q.subject_name.toLowerCase().includes(detectedSubject.toLowerCase()) || detectedSubject.toLowerCase().includes(q.subject_name.toLowerCase()));

                if (filtered.length > 0) {
                    const count = Math.min(filtered.length, 5);
                    let out = `### Question Bank Practice: ${detectedSubject} (${count} Question${count > 1 ? 's' : ''})\n\n`
                        + `**Standard:** Senior Secondary Curriculum (Question Bank)\n\n`;

                    const selected = filtered.slice(0, 5);
                    selected.forEach((q, idx) => {
                        const qNum = idx + 1;
                        out += `**Question ${qNum} (${q.subject_name} - ${q.topic_name}):**\n`
                            + `${q.question_text}\n\n`;

                        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                        let correctText = '';
                        q.options.forEach((opt, oIdx) => {
                            const l = letters[oIdx] || String(oIdx + 1);
                            if (opt.is_correct) {
                                correctText = opt.option_text;
                                out += `* ${l}) ${opt.option_text} *(Correct)*\n`;
                            } else {
                                out += `* ${l}) ${opt.option_text}\n`;
                            }
                        });

                        out += `\n**Step-by-Step Solution:**\n`;
                        if (q.explanation) {
                            out += `${q.explanation}\n\n`;
                        } else {
                            out += `The correct answer is **${correctText}**. This follows standard rules of ${q.topic_name}.\n\n`;
                        }
                        out += `---\n\n`;
                    });

                    out += `> **Offline Mode Notice:** These practice questions were retrieved from your Question Bank. To generate brand-new, customized exam questions with AI, please connect to an active internet connection.`;
                    return out;
                }

                return `### Offline Notice: Dynamic Question Generation\n\n`
                    + `No active questions were found in your Question Bank for **${detectedSubject}**.\n\n`
                    + `**To draft or practice questions:**\n`
                    + `1. **Connect to the Internet:** When online, the AI will dynamically generate brand-new, customized questions with full solutions.\n`
                    + `2. **Add to Question Bank:** You can upload or create questions under **Question Bank -> Bulk Add** to make them accessible offline.`;
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

        // LEARNER OFFLINE CAPABILITIES

        // 0. CONVERSATIONAL ANSWER EVALUATION (If replying to a practice problem or question)
        if (lastModelMessage && (
            lastModelMessage.includes('Practice Problem') ||
            lastModelMessage.includes('Question') ||
            lastModelMessage.includes('Factorize') ||
            lastModelMessage.includes('Solve') ||
            lastModelMessage.includes('Calculate') ||
            lastModelMessage.includes('Simplify') ||
            lastModelMessage.includes('Try this out') ||
            lastModelMessage.includes('test your knowledge')
        )) {
            // A. Check if learner selected an option letter
            const letterMatch = query.match(/^\s*(?:option|answer|choice)?\s*[:=\-]?\s*([a-e])\b/i) || (['a', 'b', 'c', 'd', 'e'].includes(query) ? [null, query] : null);
            if (letterMatch) {
                const chosenLetter = letterMatch[1].toUpperCase();
                const quizzes = await db.quizzes.toArray().catch(() => []);
                const adminQList = await db.adminQuestions.toArray().catch(() => []);
                const allQ = [...adminQList, ...quizzes.flatMap(q => q.questions || [])];
                const matchedQ = allQ.find(q => q && lastModelMessage.includes(q.question_text));

                if (matchedQ && matchedQ.options) {
                    const letters = ['A', 'B', 'C', 'D', 'E'];
                    const correctIdx = matchedQ.options.findIndex((o: any) => o.is_correct);
                    const correctLetter = correctIdx >= 0 ? letters[correctIdx] : 'A';
                    const correctText = correctIdx >= 0 ? matchedQ.options[correctIdx].option_text : '';

                    if (chosenLetter === correctLetter) {
                        return `**Outstanding!** Option **${chosenLetter}** is completely correct!\n\n`
                            + (matchedQ.explanation ? `**Solution:**\n${matchedQ.explanation}\n\n` : '')
                            + `Would you like to try another practice problem?`;
                    } else {
                        return `Good effort! Option **${chosenLetter}** is not quite right.\n\n`
                            + `The correct answer is **Option ${correctLetter}** (${correctText}).\n\n`
                            + (matchedQ.explanation ? `**Solution:**\n${matchedQ.explanation}\n\n` : '')
                            + `Would you like to try another practice problem?`;
                    }
                }
            }

            // B. Direct Answer Matching or Question Bank Lookup
            const quizzes = await db.quizzes.toArray().catch(() => []);
            const adminQList = await db.adminQuestions.toArray().catch(() => []);
            const allQ = [...adminQList, ...quizzes.flatMap(q => q.questions || [])];
            const matchedQ = allQ.find(q => q && (lastModelMessage.includes(q.question_text) || (q.explanation && lastModelMessage.includes(q.explanation))));

            if (matchedQ) {
                const correctOption = (matchedQ.options || []).find((o: any) => o.is_correct);
                const correctText = (correctOption?.option_text || '').toLowerCase().trim();
                const cleanUserMsg = message.toLowerCase().trim();

                if (correctText && (cleanUserMsg.includes(correctText) || correctText.includes(cleanUserMsg))) {
                    return `**Spot on!** That is the correct answer!\n\n`
                        + (matchedQ.explanation ? `**Solution:**\n${matchedQ.explanation}\n\n` : '')
                        + `Would you like to try another practice question?`;
                }

                if (
                    query.includes('solution') ||
                    query.includes('answer') ||
                    query.includes('explain') ||
                    query.includes('hint') ||
                    query.includes('how to solve') ||
                    query.includes('show me')
                ) {
                    return `Here is the step-by-step solution from your Question Bank:\n\n`
                        + (correctOption ? `* **Correct Answer:** ${correctOption.option_text}\n\n` : '')
                        + (matchedQ.explanation ? `**Explanation:**\n${matchedQ.explanation}\n\n` : '')
                        + `Would you like to try another practice problem?`;
                }

                return `Good attempt! You answered: \`${message}\`.\n\n`
                    + (correctOption ? `* **Correct Answer in Question Bank:** ${correctOption.option_text}\n\n` : '')
                    + (matchedQ.explanation ? `**Step-by-Step Solution:**\n${matchedQ.explanation}\n\n` : '')
                    + `Would you like to try another practice problem?`;
            }

            // C. Fallback for math / answer attempts when question was generated online
            if (
                /[xX0-9\(\)\+\-\*\/\^=]/.test(message) ||
                query.includes('solution') ||
                query.includes('answer') ||
                query.includes('is it')
            ) {
                return `Good attempt! You submitted: \`${message}\`.\n\n`
                    .concat("Connect to an active internet connection to have AI dynamically verify and grade complex math steps in real time, or ask me for a practice problem from your offline Question Bank!");
            }
        }

        // 1. Suggest recommendations
        if (query.includes('recommend') || query.includes('what should i study') || query.includes('suggest') || query.includes('study next') || query.includes('todo')) {
            const progress = await db.learnerProgress.toArray();
            const subjects = await db.subjects.toArray();
            const topics = await db.topics.toArray();

            if (subjects.length === 0) {
                return "I don't see any subjects loaded in your study library yet. Connect to the internet to download your subjects and get personalized recommendations!";
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
                return "No subjects are currently available in your study library. Connect to the internet to load your curriculum!";
            }
            const uniqueSubjects = Array.from(new Map(subjects.map(s => [s.name, s])).values());
            const list = uniqueSubjects.map(s => `- **${s.name}**: ${s.description || 'No description available.'}`).join('\n');
            return `Here are the subjects available in your offline study library:\n\n${list}\n\nSelect a subject from the menu to start studying!`;
        }

        // 3. Search for specific topics
        const topics = await db.topics.toArray();
        const matchedTopic = topics.find(t => query.includes(t.name.toLowerCase()) || query.includes(t.slug.replace('-', ' ')));
        if (matchedTopic) {
            const subjects = await db.subjects.toArray();
            const sub = subjects.find(s => s.id === matchedTopic.subject_id);

            // Look for sample explanation in quizzes
            const quizzes = await db.quizzes.toArray();
            let keyConcept = '';
            for (const q of quizzes) {
                const found = q.questions?.find((item: any) => item.topic_id === matchedTopic.id && item.explanation);
                if (found?.explanation) {
                    keyConcept = found.explanation;
                    break;
                }
            }

            let response = `Here is what I found in your offline library about **${matchedTopic.name}** (Level: ${matchedTopic.level.toUpperCase()}):\n\n*${matchedTopic.description || 'No topic description available.'}*\n\nThis topic is part of your **${sub?.name || 'Curriculum'}** course.`;
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
            return `Here are the topics available in **${matchedSubject.name}**:\n\n${topicList || 'No topics available yet.'}\n\nAsk me about any of these topics or practice them in the Subjects menu!`;
        }

        // 5. Practice Question or Quiz Request for Learners
        if (
            query.includes('practice') ||
            query.includes('question') ||
            query.includes('problem') ||
            query.includes('quiz') ||
            query.includes('exam') ||
            query.includes('test me')
        ) {
            const detectedSubject = detectSubjectFromQuery(query);
            const quizzes = await db.quizzes.toArray().catch(() => []);
            const adminQList = await db.adminQuestions.toArray().catch(() => []);
            const subjects = await db.subjects.toArray().catch(() => []);
            const topics = await db.topics.toArray().catch(() => []);

            const allQuestions: Array<{
                subject_name: string;
                topic_name: string;
                question_text: string;
                options: Array<{ option_text: string; is_correct: boolean }>;
                explanation: string | null;
            }> = [];

            for (const qz of quizzes) {
                const sub = subjects.find(s => s.id === (qz as any).subject_id);
                for (const q of (qz.questions || [])) {
                    const top = topics.find(t => t.id === q.topic_id);
                    allQuestions.push({
                        subject_name: sub?.name || 'General Curriculum',
                        topic_name: top?.name || 'Practice Topic',
                        question_text: q.question_text,
                        options: (q.options || []).map((o: any) => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) })),
                        explanation: q.explanation || null
                    });
                }
            }

            for (const q of adminQList) {
                const top = topics.find(t => t.id === q.topic_id);
                const sub = subjects.find(s => s.id === top?.subject_id);
                if (!allQuestions.some(item => item.question_text === q.question_text)) {
                    allQuestions.push({
                        subject_name: sub?.name || 'General Curriculum',
                        topic_name: top?.name || 'Practice Topic',
                        question_text: q.question_text,
                        options: (q.options || []).map(o => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) })),
                        explanation: q.explanation || null
                    });
                }
            }

            // Filter by subject if specified
            const filtered = detectedSubject === 'General Curriculum'
                ? allQuestions
                : allQuestions.filter(q => q.subject_name.toLowerCase().includes(detectedSubject.toLowerCase()) || detectedSubject.toLowerCase().includes(q.subject_name.toLowerCase()));

            const pool = filtered.length > 0 ? filtered : allQuestions;

            // Detect requested count (default to 1)
            let count = 1;
            const countMatch = query.match(/\b(\d+)\s*(?:questions?|problems?|quizzes?|items?)\b/i);
            if (countMatch) {
                count = Math.max(1, Math.min(parseInt(countMatch[1], 10), 10));
            }

            if (pool.length > 0) {
                const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

                if (count === 1) {
                    const randomQ = pool[Math.floor(Math.random() * pool.length)];
                    let out = `### Practice Problem: ${randomQ.subject_name} (${randomQ.topic_name})\n\n`
                        + `${randomQ.question_text}\n\n`;

                    randomQ.options.forEach((opt, idx) => {
                        const l = letters[idx] || String(idx + 1);
                        out += `* ${l}) ${opt.option_text}\n`;
                    });

                    out += `\nCan you solve this? Reply with your chosen option (**A**, **B**, **C**, or **D**) to check if you're right, or ask me for the step-by-step explanation!\n\n`;
                    out += `> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice questions.`;
                    return out;
                } else {
                    const selected = pool.slice(0, count);
                    let out = `### Practice Questions: ${detectedSubject} (${selected.length} Questions)\n\n`;

                    selected.forEach((q, idx) => {
                        out += `**Question ${idx + 1} (${q.subject_name} - ${q.topic_name}):**\n`
                            + `${q.question_text}\n\n`;

                        q.options.forEach((opt, optIdx) => {
                            const l = letters[optIdx] || String(optIdx + 1);
                            out += `* ${l}) ${opt.option_text}\n`;
                        });
                        out += `\n---\n\n`;
                    });

                    out += `Try answering these questions! Reply with your chosen answers when you're ready.\n\n`;
                    out += `> **Offline Practice Notice:** Retrieved from your Question Bank. Connect to the internet to generate brand-new AI practice questions.`;
                    return out;
                }
            }

            return `### Offline Practice Notice\n\n`
                + `No practice questions were found in your Question Bank for **${detectedSubject}**.\n\n`
                + `1. **Connect to the Internet:** When online, the AI will dynamically generate customized practice problems with hints and solutions.\n`
                + `2. **Explore Topics:** You can review available study materials from the Subjects menu!`;
        }

        // 6. Concept & Question Bank Search across cached quizzes
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
        console.warn('AceDrill helper error:', e);
    }

    // 7. Default Dynamic Offline fallback message for learners (deduplicated)
    const cachedSubjects = await db.subjects.toArray().catch(() => []);
    const cachedTopics = await db.topics.toArray().catch(() => []);
    const uniqueSubjectNames = Array.from(new Set(cachedSubjects.map(s => s.name)));
    const subjectList = uniqueSubjectNames.length > 0 ? uniqueSubjectNames.join(', ') : 'all enrolled subjects';
    const sampleTopics = cachedTopics.slice(0, 3).map(t => `**${t.name}**`).join(', ');

    return `**AceDrill Tutor Mode**\n\nI am operating in offline mode using your local curriculum library for **${subjectList}**.\n\nWhile offline, I can help you with:\n1. **"Recommend what to study"**: I will analyze your local mastery and suggest topics.\n2. **"List subjects"**: View your offline curriculum and descriptions.\n3. Ask about any topic in your library (e.g. ${sampleTopics || 'your topics'}) to see concept notes.`;
}

export default function ChatWidget() {
    const { auth } = usePage<any>().props;
    const user = auth?.user;
    const isTeacher = user?.role === 'teacher';
    const isSuperAdmin = user?.role === 'platform_admin';
    const isAdmin = user?.role === 'school_admin';
    const isSchoolAdmin = isAdmin;
    const isStaffOrEducator = isSuperAdmin || isAdmin || isTeacher;

    const defaultGreeting = isSuperAdmin
        ? `Hello ${user?.name || 'Super Admin'}! I am your AI Platform Copilot. Ask me about system-wide school metrics, question banks, curriculum coverage, or administrative assistance.`
        : isAdmin
        ? `Hello ${user?.name || 'Admin'}! I am your AI School Administrator Copilot. Ask me to summarize student scores, suggest student support plans, draft exam questions, or create lesson outlines.`
        : isTeacher
        ? `Hello ${user?.name || 'Teacher'}! I am your AI Educator Copilot. Ask me to draft exam questions, plan revision lessons, create lesson outlines, or check class scores.`
        : "Hi! I'm your AI Study Companion. Ask me to recommend what to study, explain a topic, or plan your schedule!";

    const [chatOpen, setChatOpen] = useState<boolean>(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: defaultGreeting }
    ]);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatLoading, setChatLoading] = useState<boolean>(false);
    // The saved chat being continued (null: a new one, saved when the first reply comes back).
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [savedChats, setSavedChats] = useState<SavedChat[] | null>(null);
    const [savedError, setSavedError] = useState<string | null>(null);
    const restoredRef = useRef(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Update greeting if auth changes
    useEffect(() => {
        setMessages([{ role: 'model', content: defaultGreeting }]);
        setConversationId(null);
        restoredRef.current = false;
    }, [isStaffOrEducator, isTeacher, user?.name]);

    const loadSavedChats = async (): Promise<SavedChat[]> => {
        setSavedError(null);
        try {
            const res = await fetch('/api/v1/ai/conversations', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(String(res.status));
            const list: SavedChat[] = (await res.json()).data ?? [];
            setSavedChats(list);
            return list;
        } catch {
            setSavedError(navigator.onLine ? "Your saved chats couldn't be loaded. Try again in a moment." : 'Your saved chats need an internet connection.');
            return [];
        }
    };

    const openSavedChat = async (id: number) => {
        try {
            const res = await fetch(`/api/v1/ai/conversations/${id}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(String(res.status));
            const chat = await res.json();
            setMessages(chat.messages.map((m: Message) => ({ role: m.role, content: m.content })));
            setConversationId(chat.id);
            setView('chat');
        } catch {
            setSavedError("That chat couldn't be opened. Try again in a moment.");
        }
    };

    const startNewChat = () => {
        setMessages([{ role: 'model', content: defaultGreeting }]);
        setConversationId(null);
        setView('chat');
    };

    const deleteSavedChat = async (chat: SavedChat) => {
        if (!(await confirmAction({ title: 'Delete this chat?', message: `"${chat.title}" will be deleted for good.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
        try {
            const res = await fetch(`/api/v1/ai/conversations/${chat.id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken()) },
            });
            if (!res.ok) throw new Error(String(res.status));
            setSavedChats((list) => (list ?? []).filter((c) => c.id !== chat.id));
            if (conversationId === chat.id) startNewChat();
        } catch {
            setSavedError("That chat couldn't be deleted. Try again in a moment.");
        }
    };

    // The first time the panel opens, pick up the most recent chat where the user left it.
    useEffect(() => {
        if (!chatOpen || restoredRef.current || !navigator.onLine) return;
        restoredRef.current = true;
        loadSavedChats().then((list) => {
            if (list[0] && conversationId === null && messages.length <= 1) openSavedChat(list[0].id);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatOpen]);

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
                const response = await generateOfflineResponse(textToSend, isStaffOrEducator, messages);
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
                    // A saved chat's history is read on the server; the local turns cover a chat not saved yet.
                    conversation_id: conversationId,
                    history: conversationId ? [] : messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 2000) }))
                })
            });

            if (!res.ok) throw new Error('Failed to send message');
            const data = await res.json();

            setMessages((prev) => [...prev, { role: 'model', content: data.response }]);
            if (data.conversation_id) setConversationId(data.conversation_id);
        } catch (error) {
            console.error('AI chat online request failed, falling back to local heuristic:', error);
            // Fallback to local response generator if network fails
            const response = await generateOfflineResponse(textToSend, isStaffOrEducator, messages);
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
        "Summarize school scores",
        "Support plan for struggling students",
        "Draft 5 WAEC exam questions",
        "Lesson plan outline"
    ];

    const teacherQuickPrompts = [
        "Draft 5 exam questions",
        "Extra help plan for my class",
        "Lesson plan outline",
        "Summarize class scores"
    ];

    const quickPrompts = isSchoolAdmin
        ? adminQuickPrompts
        : isTeacher
        ? teacherQuickPrompts
        : [
            "Explain this topic simply",
            "Show me a practice question",
            "Give me a formula summary",
            "How do I solve this?",
        ];

    const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

    // Auto-hide floating bubble on mobile when full-screen practice/editing modals are active (Casey protection)
    useEffect(() => {
        const checkModal = () => {
            const hasModal = Boolean(
                document.querySelector('.fixed.inset-0.z-50') ||
                document.querySelector('[role="dialog"]') ||
                document.querySelector('[aria-modal="true"]') ||
                document.querySelector('.fixed.inset-0')
            );
            setIsAnyModalOpen(hasModal);
        };

        checkModal();
        const observer = new MutationObserver(checkModal);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    return (
        <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex-col items-end transition-all ${isAnyModalOpen ? 'hidden md:flex' : 'flex'}`}>
            {/* Chat Panel Box */}
            {chatOpen && (
                <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[480px] md:w-[500px] max-h-[calc(100vh-6.5rem)] sm:max-h-[85vh] h-[560px] bg-[var(--color-surface)]/98 border border-[var(--color-border)] rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fade-in transition-all">
                    {/* Header */}
                    <div className="p-4 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-60 animate-ping motion-reduce:hidden" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]" />
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-[var(--color-text)] tracking-tight">
                                    {isSchoolAdmin ? 'AI School Copilot' : isTeacher ? 'AI Educator Copilot' : 'AI Study Companion'}
                                </h4>
                                <span className="text-[10px] text-[var(--color-muted)] block font-semibold">
                                    {isSchoolAdmin ? 'Academic & School Intelligence' : isTeacher ? 'Teaching & Lesson Assistant' : 'Online/Offline Hybrid'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                if (view === 'history') {
                                    setView('chat');
                                } else {
                                    setView('history');
                                    loadSavedChats();
                                }
                            }}
                            className="inline-flex items-center gap-1 px-2 text-[11px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)] rounded-lg transition-colors cursor-pointer min-h-[32px]"
                            aria-pressed={view === 'history'}
                        >
                            {view === 'history' ? <ArrowLeft className="w-4 h-4" aria-hidden /> : <History className="w-4 h-4" aria-hidden />}
                            {view === 'history' ? 'Back' : 'History'}
                        </button>
                        <button
                            type="button"
                            onClick={startNewChat}
                            className="inline-flex items-center gap-1 px-2 text-[11px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)] rounded-lg transition-colors cursor-pointer min-h-[32px]"
                        >
                            <SquarePen className="w-4 h-4" aria-hidden /> New
                        </button>
                        <button
                            onClick={() => setChatOpen(false)}
                            className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-5)] rounded-lg transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                            aria-label="Close Chat"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        </div>
                    </div>

                    {view === 'history' && (
                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                            <p className="px-1 pb-1 text-[11px] text-[var(--color-muted)]">Your past chats, saved so you can read an answer again. Only you can see them.</p>
                            {savedError && <p role="alert" className="px-1 text-xs font-semibold text-[var(--color-error)]">{savedError}</p>}
                            {savedChats === null && !savedError && <p className="px-1 text-xs text-[var(--color-muted)]">Loading…</p>}
                            {savedChats?.length === 0 && <p className="px-1 text-xs text-[var(--color-muted)]">No saved chats yet. Ask a question and it will appear here.</p>}
                            {savedChats?.map((chat) => (
                                <div key={chat.id} className={`flex items-center gap-1 rounded-xl border ${chat.id === conversationId ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary-5)]' : 'border-[var(--color-border)]'}`}>
                                    <button type="button" onClick={() => openSavedChat(chat.id)} className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer">
                                        <span className="block truncate text-xs font-bold text-[var(--color-text)]">{chat.title}</span>
                                        <span className="block text-[11px] text-[var(--color-muted)]">{chatDay(chat.last_message_at)}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteSavedChat(chat)}
                                        aria-label={`Delete chat: ${chat.title}`}
                                        className="shrink-0 mr-1 w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick Suggestion Chips (shown when few messages) */}
                    {view === 'chat' && conversationId === null && messages.length <= 2 && (
                        <div className="px-3.5 py-2.5 bg-[var(--color-background)]/50 border-b border-[var(--color-border)] flex flex-wrap gap-1.5">
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
                    <div className={`flex-1 p-4 overflow-y-auto space-y-4 ${view === 'chat' ? '' : 'hidden'}`}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={msg.role === 'user' ? 'chat-bubble-user font-medium p-3.5 text-xs leading-relaxed max-w-[90%] break-words' : 'bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs leading-relaxed max-w-[92%] font-medium break-words overflow-x-auto min-w-0 shadow-xs'}>
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
                                <div className="bg-[var(--color-surface-hover)] text-[var(--color-muted)] border border-[var(--color-border)] rounded-2xl rounded-tl-none p-3.5 text-xs animate-pulse font-semibold">
                                    {isStaffOrEducator ? 'AI Copilot is analyzing...' : 'Tutor is thinking...'}
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleFormSubmit} className={`p-3 bg-[var(--color-surface-hover)] border-t border-[var(--color-border)] flex gap-2 ${view === 'chat' ? '' : 'hidden'}`}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={isStaffOrEducator ? "Ask AI Copilot about lesson plans, mastery, questions..." : "Ask AI anything..."}
                            disabled={chatLoading}
                            className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-10)] min-h-[38px] transition-all"
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all min-h-[38px] flex items-center justify-center cursor-pointer shadow-sm"
                        >
                            Send
                        </button>
                    </form>
                    <p className={`px-3 pb-2.5 pt-1 bg-[var(--color-surface-hover)] text-[10px] leading-snug text-[var(--color-muted)] text-center ${view === 'chat' ? '' : 'hidden'}`}>
                        {isStaffOrEducator
                            ? 'AI can make mistakes. Check figures, answers and lesson content before you use them.'
                            : 'AI can make mistakes. Check important answers with your teacher or textbook.'}
                    </p>
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                onClick={() => setChatOpen(!chatOpen)}
                className="group h-14 w-14 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(24,59,43,0.35)] dark:shadow-[0_8px_24px_rgba(46,125,82,0.4)] hover:shadow-[0_12px_28px_rgba(24,59,43,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 motion-reduce:transform-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-20)]"
                title={isStaffOrEducator ? (isSuperAdmin ? "Open AI Platform Copilot" : isTeacher ? "Open AI Educator Copilot" : "Open AI School Copilot") : "Open AI Study Companion"}
                aria-label="Toggle AI Study Assistant"
            >
                {chatOpen ? (
                    <svg className="w-6 h-6 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
