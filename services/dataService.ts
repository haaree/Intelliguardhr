
import { AppData } from '../types.ts';

const DB_NAME = 'AttendifyDB';
const DB_VERSION = 1;
const STORES = {
  APP_DATA: 'app_data'
};

let dbPromise: Promise<IDBDatabase> | null = null;

export const dataService = {
  private_initDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.APP_DATA)) {
          db.createObjectStore(STORES.APP_DATA);
        }
      };

      request.onsuccess = (event: any) => resolve(event.target.result);
      request.onerror = (event: any) => {
        dbPromise = null; // Reset promise on error so we can retry
        reject(event.target.error);
      };
    });

    return dbPromise;
  },

  async saveData(data: AppData): Promise<void> {
    const db = await this.private_initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.APP_DATA, 'readwrite');
      const store = transaction.objectStore(STORES.APP_DATA);
      const request = store.put(data, 'current_state');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getData(): Promise<AppData> {
    const db = await this.private_initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.APP_DATA, 'readonly');
      const store = transaction.objectStore(STORES.APP_DATA);
      const request = store.get('current_state');

      request.onsuccess = () => {
        const initialData: AppData = {
          employees: [],
          attendance: [],
          shifts: [],
          holidays: [],
          weeklyOffs: [],
          leaveRecords: [],
          leaveReconciliations: [],
          auditQueue: [],
          auditLogs: []
        };
        resolve(request.result || initialData);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clearData(): Promise<void> {
    const db = await this.private_initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.APP_DATA, 'readwrite');
      const store = transaction.objectStore(STORES.APP_DATA);
      const request = store.clear();

      request.onsuccess = () => {
        dbPromise = null;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
};
