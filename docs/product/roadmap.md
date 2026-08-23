# Product Roadmap

This document outlines the planned developmental phases for the platform.

---

## Phase 1: Scaffolding & Bootstrap (Current)
* [x] Establish unified Laravel backend + React Inertia frontend codebase.
* [x] Configure database, Tailwind CSS v4, PWA shell caching, and Dexie DB entry.
* [x] Establish backend service namespaces.

## Phase 2: Domain Schema & Local DB Design
* [ ] Define Eloquent models and migrations for Users, Roles, Subjects, Topics, and Questions on Laravel.
* [ ] Design matching Dexie schemas for local IndexedDB storage.
* [ ] Implement basic database seeding.

## Phase 3: Offline Content Packaging & Sync Engine
* [ ] Build content packaging utilities (bundling subjects, topics, and questions into downloadable JSON packages).
* [ ] Implement backend content API.
* [ ] Build front-end package downloading, storage in IndexedDB, and synchronization log queue.

## Phase 4: Frontend Quiz & Adaptive engines
* [ ] Implement clientside Quiz engine rendering and grading of attempts.
* [ ] Integrate client-side recommendation engine evaluating student topic masteries.

## Phase 5: Authentication & Dashboards
* [ ] Configure Laravel Sanctum for API token authentication.
* [ ] Build roles/middleware authorization.
* [ ] Design Learner, Teacher, and Admin dashboards.

## Phase 6: AI Integration
* [ ] Abstract and implement backend AIService wrapper (connecting to Gemini API).
* [ ] Implement AI questions generation and topic tutoring explanations.
