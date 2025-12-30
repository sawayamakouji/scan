import { describe, expect, it } from "vitest";

import { applyScan, ScanState } from "../src/domain/aggregate";
import { FakeScanner } from "../src/scanner/FakeScanner";

describe("FakeScanner", () => {
  it("emits codes in order after start", () => {
    const fake = new FakeScanner(["111", "222", "333"]);
    const received: string[] = [];

    fake.start((code) => received.push(code));

    const emitted = fake.emitAll();

    expect(emitted).toBe(3);
    expect(received).toEqual(["111", "222", "333"]);
  });

  it("can drive domain applyScan from emitted codes", () => {
    const fake = new FakeScanner(["A", "A", "B"]);
    const master = { A: "CASE-A" };
    let state: ScanState = { counts: {}, lastScanAt: {} };
    const times = [1000, 1500, 3000];

    fake.start((code) => {
      const nowMs = times.shift() ?? 0;
      state = applyScan(state, code, master, nowMs, 800);
    });

    fake.emitAll();

    expect(state.counts["CASE-A"]).toBe(1);
    expect(state.counts["B"]).toBe(1);
  });
});
