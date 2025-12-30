import { describe, expect, it, vi } from "vitest";

import { AppStore } from "../src/app/store";

describe("AppStore", () => {
  it("maps each JAN to case JAN in pick list", () => {
    const store = new AppStore();
    const master = { "111": "CASE-1" };

    store.handleScan("111", 1000, master);

    expect(store.getPickList()).toEqual([{ pickJan: "CASE-1", qty: 1 }]);
  });

  it("increments default +1 via handleScan", () => {
    const store = new AppStore();

    store.handleScan("A", 1000, {});
    store.handleScan("A", 2000, {});

    expect(store.getPickList()).toEqual([{ pickJan: "A", qty: 2 }]);
  });

  it("adjusts by delta and does not go below 0", () => {
    const store = new AppStore();

    store.handleScan("A", 1000, {});
    store.adjust("A", 3);
    store.adjust("A", -10);

    expect(store.getPickList()).toEqual([]);
  });

  it("resets state and master mapping", () => {
    const store = new AppStore();

    store.handleScan("A", 1000, { A: "CASE-A" });
    store.setMasterMapping({ A: "CASE-A" });
    store.resetAll();

    expect(store.getPickList()).toEqual([]);
    expect(store.getMasterMapping()).toEqual({});
  });

  it("debounces persistence by 500ms on changes", async () => {
    vi.useFakeTimers();
    const calls: { master: number; state: number } = { master: 0, state: 0 };
    const storage = {
      loadMaster: async () => ({}),
      saveMaster: async () => {
        calls.master += 1;
      },
      loadState: async () => ({ counts: {}, lastScanAt: {} }),
      saveState: async () => {
        calls.state += 1;
      }
    };
    const store = new AppStore({ storage });

    store.setMasterMapping({ "111": "CASE-1" });
    store.handleScan("111", 1000, { "111": "CASE-1" });
    store.adjust("CASE-1", 1);

    vi.advanceTimersByTime(499);
    expect(calls.master).toBe(0);
    expect(calls.state).toBe(0);

    vi.advanceTimersByTime(1);
    await vi.runOnlyPendingTimersAsync();

    expect(calls.master).toBe(1);
    expect(calls.state).toBe(1);
    vi.useRealTimers();
  });
});
