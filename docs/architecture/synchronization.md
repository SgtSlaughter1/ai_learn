# Synchronization Architecture

This document describes the conceptual model for synchronizing offline user progress and attempts with the central database once internet connection is restored.

---

## Sync Flow Topology

```text
                  Local Device
                       │
                       │ [Writes offline actions]
                       ▼
                 Local IndexedDB (Dexie)
                       │
                       │ [Internet detected / Sync trigger]
                       ▼
             Laravel Sync Service (app/Services/Sync)
                       │
                       │ [Validates & Merges changes]
                       ▼
                  MySQL Database
```

---

## Sync Lifecycle

1. **Capture Changes (Offline)**:
   * Every quiz attempt or progress milestone creates a record in the local database and inserts a corresponding log in `syncLogs` tracking the table name, action (`insert`, `update`, `delete`), payload, and timestamp.

2. **Detect Connection**:
   * A service worker or frontend hook listens for `online` network changes.
   * If online status is detected, the frontend initiates a background synchronization request to Laravel's sync route.

3. **Data Merging and Conflict Resolution**:
   * The payload is validated on the backend.
   * Laravel's `SyncService` merges the records into MySQL. If progress logs have overlapping timestamps, the server resolves conflicts using a "latest-write-wins" policy or accumulates attempts to preserve history.

4. **Clear Sync Logs**:
   * Upon receipt of a successful sync response from Laravel, the frontend clears resolved log records in `syncLogs` or marks them as synced.
