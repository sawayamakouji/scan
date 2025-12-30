import { describe, expect, it } from "vitest";

import { mapPickJan } from "../src/domain/mapPickJan";

describe("mapPickJan", () => {
  it("returns the case JAN when present", () => {
    const master = { "111": "999" };
    expect(mapPickJan("111", master)).toBe("999");
  });

  it("returns the each JAN when not mapped", () => {
    const master = { "111": "999" };
    expect(mapPickJan("222", master)).toBe("222");
  });
});
