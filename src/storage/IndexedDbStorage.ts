import { ScanState } from "../domain/aggregate";
import { MasterData, Storage } from "./Storage";

type StoredValue = { key: string; value: unknown };

export class IndexedDbStorage implements Storage {
  private dbName: string;
  private storeName: string;

  constructor(dbName = "scanner-db", storeName = "kv") {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async loadMaster(): Promise<MasterData> {
    const entry = await this.get<StoredValue>("master");
    if (!entry || typeof entry.value !== "object" || entry.value === null) {
      return { mapping: {}, names: {} };
    }
    const value = entry.value as Record<string, unknown>;
    const hasMapping = Object.prototype.hasOwnProperty.call(value, "mapping");
    const hasNames = Object.prototype.hasOwnProperty.call(value, "names");
    if (hasMapping && hasNames) {
      const mapping = (value.mapping ?? {}) as Record<string, string>;
      const names = (value.names ?? {}) as Record<string, string>;
      return { mapping, names };
    }
    const mapping: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === "string") {
        mapping[key] = raw;
      }
    }
    return { mapping, names: {} };
  }

  async saveMaster(master: MasterData): Promise<void> {
    await this.put({ key: "master", value: master });
  }

  async loadState(): Promise<ScanState> {
    const entry = await this.get<StoredValue>("scanState");
    if (!entry || typeof entry.value !== "object" || entry.value === null) {
      return { counts: {}, lastScanAt: {}, completed: [] };
    }
    const value = entry.value as Partial<ScanState>;
    return {
      counts: value.counts ?? {},
      lastScanAt: value.lastScanAt ?? {},
      completed: value.completed ?? []
    };
  }

  async saveState(state: ScanState): Promise<void> {
    await this.put({ key: "scanState", value: state });
  }

  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(this.storeName, mode);
    const store = tx.objectStore(this.storeName);
    const result = await run(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return result;
  }

  private async get<T>(key: string): Promise<T | undefined> {
    return this.withStore("readonly", async (store) => {
      const request = store.get(key);
      const entry = await this.requestToPromise<T>(request);
      return entry ?? undefined;
    });
  }

  private async put(value: StoredValue): Promise<void> {
    await this.withStore("readwrite", async (store) => {
      await this.requestToPromise(store.put(value));
    });
  }

  private requestToPromise<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }
}
