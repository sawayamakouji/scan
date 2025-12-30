import { describe, expect, it } from "vitest";

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
});
