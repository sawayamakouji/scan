import { JanMaster, mapPickJan } from "./mapPickJan";

export type ScanState = {
  counts: Record<string, number>;
  lastScanAt: Record<string, number>;
};

export function applyScan(
  state: ScanState,
  eachJan: string,
  master: JanMaster,
  nowMs: number,
  debounceMs = 800
): ScanState {
  const pickJan = mapPickJan(eachJan, master);
  const lastSeen = state.lastScanAt[pickJan];

  if (typeof lastSeen === "number" && nowMs - lastSeen < debounceMs) {
    return state;
  }

  return {
    counts: {
      ...state.counts,
      [pickJan]: (state.counts[pickJan] ?? 0) + 1
    },
    lastScanAt: {
      ...state.lastScanAt,
      [pickJan]: nowMs
    }
  };
}
