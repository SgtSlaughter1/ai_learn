import Dexie, { type Table } from 'dexie';

export interface SyncLog {
  id?: number;
  tableName: string;
  action: 'insert' | 'update' | 'delete';
  payload: string; // JSON string representing the change
  timestamp: string;
  isSynced: number; // 0 or 1
}

export class OfflineDB extends Dexie {
  // Sync log table instance
  syncLogs!: Table<SyncLog, number>;

  constructor() {
    super('OfflineAIDatabase');
    
    // Initial schema for version 1
    this.version(1).stores({
      syncLogs: '++id, tableName, action, timestamp, isSynced'
    });
  }
}

export const db = new OfflineDB();
