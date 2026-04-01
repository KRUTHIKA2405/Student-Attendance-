const DB_NAME = 'attendance-db';
const STORE_NAME = 'attendance';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

export async function saveRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    record.synced = false;
    record.createdAt = new Date().toISOString();
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    const req = index.getAll(false);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function markRecordsSynced(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    let counter = ids.length;
    if (!counter) return resolve();

    ids.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        const obj = req.result;
        if (!obj) {
          if (--counter === 0) resolve();
          return;
        }
        obj.synced = true;
        const update = store.put(obj);
        update.onsuccess = () => {
          if (--counter === 0) resolve();
        };
        update.onerror = () => reject(update.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}