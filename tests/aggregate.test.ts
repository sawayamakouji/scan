import { describe, expect, it } from "vitest";

import { applyScan, ScanState } from "../src/domain/aggregate";

const emptyState: ScanState = { counts: {}, lastScanAt: {}, completed: [] };

describe("applyScan", () => {
  it("increments default +1 on accepted scans", () => {
    const next = applyScan(emptyState, "111", {}, 1000);
    expect(next.counts["111"]).toBe(1);
    expect(next.lastScanAt["111"]).toBe(1000);
  });

  it("aggregates by pick JAN when mapped", () => {
    const master = { "111": "CASE-1" };
    const next = applyScan(emptyState, "111", master, 2000);
    expect(next.counts["CASE-1"]).toBe(1);
  });

  it("ignores duplicate scans within the debounce window", () => {
    const master = { "111": "CASE-1" };
    const first = applyScan(emptyState, "111", master, 3000, 800);
    const duplicate = applyScan(first, "111", master, 3500, 800);
    expect(duplicate).toBe(first);
  });

  it("accepts scans after the debounce window", () => {
    const master = { "111": "CASE-1" };
    const first = applyScan(emptyState, "111", master, 4000, 800);
    const next = applyScan(first, "111", master, 4800, 800);
    expect(next.counts["CASE-1"]).toBe(2);
  });
});
