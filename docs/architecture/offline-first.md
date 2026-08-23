# Offline-First Architecture Philosophy

This document outlines the design principles and requirements for the offline capabilities of the Offline AI Learning Platform.

---

## Core Principle

> **A learner must eventually be able to access downloaded educational content, take quizzes, receive scores, track progress, and receive adaptive recommendations without an internet connection.**

The platform prioritizes availability and performance on low-bandwidth or disconnected networks, treating the server connection as an optimization rather than a hard dependency for daily learning activities.

---

## Offline Capability Scope

1. **Content Consumption**:
   * Learners download specific subject or class syllabus curriculum packages while connected.
   * Cached content (lessons, markdown files) must be fully readable offline.

2. **Quiz Execution**:
   * The quiz engine is built using frontend TypeScript code, completely independent of backend server routes.
   * Quizzes are generated, parsed, validated, and graded entirely on the client-side.

3. **Progress Assessment**:
   * Scores are calculated locally as soon as a quiz is completed.
   * Progress logs are saved immediately in IndexedDB.

4. **Adaptive Learning**:
   * Recommendation algorithms evaluate mastery score state, identify weak topics, and select next-questions directly on the client.

---

## Data flow in Offline State

When offline, any write actions (quiz completion, progress updates, settings changes) are routed directly to the local IndexedDB database via Dexie.js repositories. These actions write log records to a `syncLogs` tracking table so they can be merged when the client detects internet recovery.
