# Architectural Overview

This document describes the design, components, and technology stack of the Offline AI Learning Platform.

## System Topology

The platform integrates a traditional server-side backend database system with an offline-capable client-side architecture:

```text
                    Laravel Application (API/Web)
              ┌───────────────────────────────────────┐
              │                                       │
              │ Laravel Controllers & Services        │
              │                                       │
              │             Inertia.js                │
              │                  │                    │
              │                  ▼                    │
              │          React Frontend               │
              │                                       │
              └──────────────┬────────────────────────┘
                             │
                             ▼
                           MySQL


                  LEARNER DEVICE / OFFLINE
              ┌───────────────────────────────┐
              │ React PWA                     │
              │                               │
              │ Service Worker Caching        │
              │                               │
              │ IndexedDB (via Dexie.js)      │
              │      │                        │
              │      ▼                        │
              │ Offline engines (Quiz,        │
              │ Adaptive recommends)          │
              └───────────────────────────────┘
```

---

## Core System Components

### 1. Laravel (Application/Backend Backend)
* **Role**: Serves as the central backend, source of truth database access layer, and orchestrator of core services (sync, AI pipeline management, user management).
* **Architecture**: Uses standard Laravel controllers, resources, and request validators.

### 2. React + TypeScript (Frontend Client)
* **Role**: Runs on the user's web browser, rendering interactive, responsive user interfaces. 
* **Structure**: Organized by domain-oriented features (`resources/js/features/`) and UI modules (`resources/js/components/`).

### 3. Inertia.js (The Application Bridge)
* **Role**: Acts as a bridge between Laravel routes and React views. Inertia handles all routing and navigation via standard HTTP responses, eliminating the need for a separate clientside React router or client API endpoints during online activities.

### 4. MySQL (Central Database)
* **Role**: Relational server-side database storing central user accounts, roles, subject structures, topic definitions, complete question banks, and synced learner progress logs.

### 5. IndexedDB / Dexie.js (Offline Client Database)
* **Role**: A transactional database residing locally on the learner's device. 
* **Dexie wrapper**: Provides a clean, type-safe, and reactive wrapper over raw IndexedDB, enabling queries and transactions directly inside React components using React hooks (`dexie-react-hooks`).

### 6. PWA & Service Worker
* **Role**: Managed via `vite-plugin-pwa`. It caches web assets (HTML shell, compiled CSS, and JS files) and enables service worker registration so the app loads instantly and works offline.

### 7. Future AI Services
* **Role**: Treated as a replaceable service layer. The backend abstracts AI logic (`app/Services/AI/`) to call external cloud providers (Gemini, OpenAI) or orchestrate local/on-device AI models.

### 8. Role-Based Access Control
* **Role**: Single login flow where Laravel verifies the user's role (`learner`, `teacher`, `admin`) and Inertia routes them to their respective workspace dashboard view.
