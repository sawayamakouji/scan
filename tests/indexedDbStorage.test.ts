import { beforeEach, describe, expect, it } from "vitest";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { IndexedDbStorage } from "../src/storage/IndexedDbStorage";

const dbName = "test-scanner-db";

beforeEach(async () => {
  (globalThis as typeof globalThis & { indexedDB: IDBFactory }).indexedDB = indexedDB;
  (globalThis as typeof globalThis & { IDBKeyRange: typeof IDBKeyRange }).IDBKeyRange =
    IDBKeyRange;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

describe("IndexedDbStorage", () => {
  it("saves and loads master mapping", async () => {
    const storage = new IndexedDbStorage(dbName);
    const master = { mapping: { "111": "CASE-1", "222": "CASE-2" }, names: {} };

    await storage.saveMaster(master);
    const loaded = await storage.loadMaster();

    expect(loaded).toEqual(master);
  });

  it("saves and loads scan state", async () => {
    const storage = new IndexedDbStorage(dbName);
    const state = { counts: { A: 2 }, lastScanAt: { A: 1000 }, completed: [] };

    await storage.saveState(state);
    const loaded = await storage.loadState();

    expect(loaded).toEqual(state);
  });
});
