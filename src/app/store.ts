import { applyScan, ScanState } from "../domain/aggregate";

export type PickItem = { pickJan: string; qty: number };

export class AppStore {
  private state: ScanState;

  constructor() {
    this.state = { counts: {}, lastScanAt: {} };
  }

  handleScan(eachJan: string, nowMs: number, master: Record<string, string>): void {
    this.state = applyScan(this.state, eachJan, master, nowMs);
  }

  adjust(pickJan: string, delta: number): void {
    const current = this.state.counts[pickJan] ?? 0;
    const next = Math.max(0, current + delta);

    if (next === 0) {
      const { [pickJan]: _, ...rest } = this.state.counts;
      this.state = {
        counts: rest,
        lastScanAt: this.state.lastScanAt
      };
      return;
    }

    this.state = {
      counts: {
        ...this.state.counts,
        [pickJan]: next
      },
      lastScanAt: this.state.lastScanAt
    };
  }

  getPickList(): PickItem[] {
    return Object.entries(this.state.counts)
      .map(([pickJan, qty]) => ({ pickJan, qty }))
      .sort((a, b) => a.pickJan.localeCompare(b.pickJan));
  }
}
