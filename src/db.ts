import type { DeskMessage, ScheduleItem } from './types';

const DB_NAME = 'liuli-dispatch-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('schedules')) {
        db.createObjectStore('schedules', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('ts', 'ts');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return dbPromise;
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------------- schedules ---------------- */

export async function dbGetAllSchedules(): Promise<ScheduleItem[]> {
  const db = await openDB();
  const store = db.transaction('schedules', 'readonly').objectStore('schedules');
  return reqAsPromise(store.getAll() as IDBRequest<ScheduleItem[]>);
}

export async function dbPutSchedule(item: ScheduleItem): Promise<void> {
  const db = await openDB();
  const store = db.transaction('schedules', 'readwrite').objectStore('schedules');
  await reqAsPromise(store.put(item));
}

export async function dbPutSchedules(items: ScheduleItem[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('schedules', 'readwrite');
  const store = tx.objectStore('schedules');
  for (const it of items) store.put(it);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteSchedule(id: string): Promise<void> {
  const db = await openDB();
  const store = db.transaction('schedules', 'readwrite').objectStore('schedules');
  await reqAsPromise(store.delete(id));
}

export async function dbSetOrders(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('schedules', 'readwrite');
  const store = tx.objectStore('schedules');
  await Promise.all(
    ids.map(
      (id, i) =>
        new Promise<void>((resolve, reject) => {
          const get = store.get(id);
          get.onsuccess = () => {
            const item = get.result as ScheduleItem | undefined;
            if (item) {
              const put = store.put({ ...item, order: i });
              put.onsuccess = () => resolve();
              put.onerror = () => reject(put.error);
            } else {
              resolve();
            }
          };
          get.onerror = () => reject(get.error);
        })
    )
  );
}

/* ---------------- messages ---------------- */

export type NewMessage = Omit<DeskMessage, 'id'> & { id?: number };

export async function dbAddMessage(m: NewMessage): Promise<DeskMessage> {
  const db = await openDB();
  const store = db.transaction('messages', 'readwrite').objectStore('messages');
  const key = await reqAsPromise(store.add(m));
  return { ...m, id: key as number } as DeskMessage;
}

/** 最新 limit 条（升序返回）；beforeId 用于向前翻页 */
export async function dbGetMessages(
  limit: number,
  beforeId?: number
): Promise<DeskMessage[]> {
  const db = await openDB();
  const store = db.transaction('messages', 'readonly').objectStore('messages');
  return new Promise((resolve, reject) => {
    const out: DeskMessage[] = [];
    const range = beforeId !== undefined ? IDBKeyRange.upperBound(beforeId - 1) : undefined;
    const cursorReq = store.openCursor(range, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && out.length < limit) {
        out.push(cursor.value as DeskMessage);
        cursor.continue();
      } else {
        resolve(out.reverse());
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function dbCountMessages(): Promise<number> {
  const db = await openDB();
  const store = db.transaction('messages', 'readonly').objectStore('messages');
  return reqAsPromise(store.count());
}

export async function dbPruneMessages(max: number): Promise<void> {
  const count = await dbCountMessages();
  if (count <= max) return;
  const db = await openDB();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  let toDelete = count - max;
  await new Promise<void>((resolve, reject) => {
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && toDelete > 0) {
        cursor.delete();
        toDelete -= 1;
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
    tx.oncomplete = () => resolve();
  });
}

/* ---------------- meta ---------------- */

export async function dbGetMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDB();
  const store = db.transaction('meta', 'readonly').objectStore('meta');
  const row = await reqAsPromise(store.get(key));
  return (row as { key: string; value: T } | undefined)?.value;
}

export async function dbSetMeta(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const store = db.transaction('meta', 'readwrite').objectStore('meta');
  await reqAsPromise(store.put({ key, value }));
}
