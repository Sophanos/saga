export interface TrialUploadRef {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

interface TrialUploadRecord extends TrialUploadRef {
  blob: Blob;
}

const DB_NAME = "mythos_trial_uploads";
const DB_VERSION = 1;
const STORE_NAME = "trial_files";

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }
  return indexedDB;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trial_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function openDb(): Promise<IDBDatabase> {
  const idb = ensureIndexedDb();

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  const resultPromise = executor(store, tx);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });

  return resultPromise;
}

export async function storeTrialFiles(files: File[]): Promise<TrialUploadRef[]> {
  if (files.length === 0) return [];

  return runTransaction("readwrite", async (store) => {
    const refs: TrialUploadRef[] = [];

    for (const file of files) {
      const id = generateId();
      const record: TrialUploadRecord = {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        blob: file,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to store file"));
      });

      refs.push({
        id,
        name: record.name,
        type: record.type,
        size: record.size,
        lastModified: record.lastModified,
      });
    }

    return refs;
  });
}

export async function loadTrialFiles(refs: TrialUploadRef[]): Promise<File[]> {
  if (refs.length === 0) return [];

  return runTransaction("readonly", async (store) => {
    const results: File[] = [];

    for (const ref of refs) {
      const record = await new Promise<TrialUploadRecord | undefined>((resolve, reject) => {
        const request = store.get(ref.id);
        request.onsuccess = () => resolve(request.result as TrialUploadRecord | undefined);
        request.onerror = () => reject(request.error ?? new Error("Failed to read file"));
      });

      if (!record) continue;

      const file = new File([record.blob], record.name, {
        type: record.type,
        lastModified: record.lastModified,
      });

      results.push(file);
    }

    return results;
  });
}

export async function clearTrialFiles(refs?: TrialUploadRef[]): Promise<void> {
  await runTransaction("readwrite", async (store) => {
    if (!refs || refs.length === 0) {
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to clear uploads"));
      });
      return;
    }

    for (const ref of refs) {
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(ref.id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to delete upload"));
      });
    }
  });
}
