# 🧠 AILEARN — Autonomous Personal Learning & Assessment Platform

> **An offline-first, AI-powered digital learning ecosystem engineered for schools, teachers, and learners. Combines curriculum-aligned learning, authentic Nigerian CBT exam simulations (WAEC, JAMB, NECO), and the scientifically proven SuperMemo SM-2 Spaced Repetition memory engine.**

---

## 💡 Why AILEARN? (The Problem & The Solution)

### The Problem with Traditional Learning & Standard CBT Apps
1. **The Cram-and-Forget Trap**: Students study for tests and forget 70%+ of what they learned within a week.
2. **"Dumb" Practice Tests**: Standard apps just score students (*"12/20 - Failed"*) without diagnosing misconceptions or helping them master the failed concept.
3. **Overworked Classrooms**: Teachers with 50+ students cannot personalize homework for every student's individual weak spots.
4. **Internet & Data Cost Barriers**: Expensive data plans and spotty internet make streaming video lessons impossible for millions of families.

### How AILEARN Solves This
* **5-Minute Daily Memory Engine**: AILEARN tells the learner what to review each day using the **SuperMemo SM-2 Spaced Repetition Algorithm** so they never forget previous lessons.
* **Class & Programme Scoped**: Sourced strictly from the student's exact class (`SS1`) and academic programme track (`Science` vs `Business` vs `Arts`).
* **Socratic AI Tutor**: An intelligent 24/7 personal tutor that guides students through mistakes step-by-step.
* **100% Zero-Data Offline Continuity**: The entire curriculum, question bank, and memory engine lives in the browser / device with zero data usage.

---

## 👥 Value for Every Stakeholder

| Stakeholder | Key Benefits |
| :--- | :--- |
| **👨‍🎓 Learners** | 5-minute daily recall, no more exam panic, instant 24/7 AI tutor, gamified XP and streak rewards. |
| **👩‍🏫 Teachers** | Automated diagnostic grading, weakness heatmaps per topic, instant quiz authoring with LaTeX math. |
| **👨‍👩‍👧 Parents** | Peace of mind knowing children are revising their actual school lessons daily, saves money on private lesson tutors, zero internet data cost. |
| **🏫 School Owners** | Boosts WAEC, JAMB, and NECO pass rates, equips computer labs with modern CBT tech, works with zero internet. |

---

## 🌟 Core Features & Modules

### 1. ⚡ 5-Minute Daily Spaced Repetition (SRS)
* **Intelligent Queue**: Schedules 6 quick questions daily based on individual memory decay rates.
* **Mistake Auto-Enrollment**: Wrong answers in quizzes or revision are immediately scheduled for spaced recall.
* **Mastery Graduation**: Questions graduate to long-term memory after 5 consecutive correct reviews or 60-day retention intervals.

### 2. 📚 School Curriculum LMS
* Full Nigerian curriculum hierarchy: **School $\to$ Programme $\to$ Class $\to$ Subject $\to$ Topic $\to$ Notes & Quizzes**.
* Interactive diagnostic quizzes with rich KaTeX LaTeX mathematical formulas, literature passages, and instant explanations.

### 3. 🎯 Authentic CBT Exam Simulation
* Authentic Past Questions for **WAEC (WASSCE)**, **JAMB (UTME)**, and **NECO**.
* Real exam countdown timers, question bookmarking/flagging, calculator widgets, and topic-level weakness analytics.

### 4. 🤖 Socratic AI Tutoring Assistant
* Resolves misconceptions with step-by-step reasoning without giving away answers immediately.
* Hybrid operation: Instant offline rule-based explanations with cloud Google Gemini AI enhancements when connected.

### 5. 🎮 Gamification & Retention Engine
* **XP System**: Earn XP for quizzes, daily recall, and CBT exams.
* **Level Progression**: Dynamic quadratic progression curve ($\text{Level} = \lfloor \sqrt{\text{XP}} / 10 \rfloor + 1$).
* **Daily Streaks**: Maintained with a rolling 36-hour grace window.
* **Badges & Achievements**: 10+ unlockable milestones across accuracy, consistency, and mastery.

### 6. 🔌 100% Offline-First Architecture
* Powered by **Dexie.js (IndexedDB)** and **Workbox Service Workers**.
* Curriculum and question banks are pre-cached locally for instant access in zero-connectivity environments.
* Background bidirectional sync with conflict resolution when network reconnects.

---

## 📐 Mathematical & Algorithmic Formulas

### 1. SuperMemo SM-2 Spaced Repetition
$$I(n) = \begin{cases} 
1 \text{ day} & \text{if } n = 1 \text{ or mistake} \\
3 \text{ days} & \text{if } n = 2 \\
7 \text{ days} & \text{if } n = 3 \\
14 \text{ days} & \text{if } n = 4 \\
\text{round}(I(n-1) \times EF) & \text{if } n \ge 5 
\end{cases}$$

$$\text{Ease Factor } (EF') = \max(1.30, \min(3.00, EF + \Delta EF))$$
* Mistake: $-0.20$ | Hard: $-0.15$ | Good: $+0.00$ | Easy: $+0.15$

### 2. Gamification Level Curve
$$\text{Level} = \left\lfloor \frac{\sqrt{\text{Total XP}}}{10} \right\rfloor + 1 \quad \iff \quad \text{XP required for Level } L = ((L - 1) \times 10)^2$$

### 3. Topic Mastery Score
$$\text{Mastery Score} = \text{round}\left( \frac{\text{Questions Correct}}{\text{Questions Attempted}} \times 100 \right)$$
* **Weak Topic**: $< 75\%$ (Prioritized in daily revision)
* **Mastered**: $\ge 75\%$

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | PHP 8.3, Laravel 11, Eloquent ORM, SQLite / MySQL, REST API v1 |
| **Frontend (SSR/Inertia)** | React 18, TypeScript, Inertia.js, Tailwind CSS, Lucide Icons, KaTeX |
| **Frontend (SPA/PWA)** | Vite 6, React 18, TypeScript, React Router, Workbox PWA |
| **Offline Client DB** | Dexie.js (IndexedDB) |
| **AI Inference** | Google Gemini API (Cloud) + Local Socratic Misconception Engine (Edge) |

---

## 🚀 Quick Setup & Installation

```bash
# 1. Clone repo & install PHP dependencies
git clone https://github.com/your-org/offline-ai-learning.git
cd offline-ai-learning
composer install

# 2. Install JavaScript dependencies
npm install

# 3. Environment setup & key generation
cp .env.example .env
php artisan key:generate

# 4. Database migration & sample curriculum seeding
php artisan migrate:fresh --seed

# 5. Build frontend assets
npm run build

# 6. Start server
php artisan serve
```

Visit `http://127.0.0.1:8000` in your browser.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
