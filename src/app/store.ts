import { applyScan, CompletedItem, ScanState } from "../domain/aggregate";
import { MasterData, Storage } from "../storage/Storage";

export type PickItem = { pickJan: string; qty: number };
export type CompletedListItem = CompletedItem;

export type AppStoreOptions = {
  storage?: Storage;
  debounceMs?: number;
};

export class AppStore {
  private state: ScanState;
  private master: MasterData;
  private storage?: Storage;
  private debounceMs: number;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: AppStoreOptions = {}) {
    this.state = { counts: {}, lastScanAt: {}, completed: [] };
    this.master = { mapping: {}, names: {} };
    this.storage = options.storage;
    this.debounceMs = options.debounceMs ?? 500;
  }

  async init(): Promise<void> {
    if (!this.storage) {
      return;
    }
    this.master = await this.storage.loadMaster();
    this.state = await this.storage.loadState();
  }

  handleScan(eachJan: string, nowMs: number, master: Record<string, string>): void {
    this.master = { mapping: master, names: this.master.names };
    this.state = applyScan(this.state, eachJan, master, nowMs);
    this.scheduleSave();
  }

  adjust(pickJan: string, delta: number): void {
    const current = this.state.counts[pickJan] ?? 0;
    const next = Math.max(0, current + delta);

    if (next === 0) {
      const { [pickJan]: _, ...rest } = this.state.counts;
      this.state = {
        counts: rest,
        lastScanAt: this.state.lastScanAt,
        completed: this.state.completed
      };
      this.scheduleSave();
      return;
    }

    this.state = {
      counts: {
        ...this.state.counts,
        [pickJan]: next
      },
      lastScanAt: this.state.lastScanAt,
      completed: this.state.completed
    };
    this.scheduleSave();
  }

  setMasterData(master: MasterData): void {
    this.master = master;
    this.scheduleSave();
  }

  getMasterData(): MasterData {
    return {
      mapping: { ...this.master.mapping },
      names: { ...this.master.names }
    };
  }

  resetAll(): void {
    this.state = { counts: {}, lastScanAt: {}, completed: [] };
    this.master = { mapping: {}, names: {} };
    this.scheduleSave();
  }

  getPickList(): PickItem[] {
    return Object.entries(this.state.counts)
      .map(([pickJan, qty]) => ({ pickJan, qty }))
      .sort((a, b) => a.pickJan.localeCompare(b.pickJan));
  }

  getCompletedList(): CompletedListItem[] {
    return [...this.state.completed].sort((a, b) => b.completedAt - a.completedAt);
  }

  completePick(pickJan: string, nowMs: number): void {
    const qty = this.state.counts[pickJan];
    if (!qty) {
      return;
    }
    const { [pickJan]: _, ...rest } = this.state.counts;
    const existingIndex = this.state.completed.findIndex(
      (item) => item.pickJan === pickJan
    );
    let nextCompleted = this.state.completed;
    if (existingIndex === -1) {
      nextCompleted = [
        ...this.state.completed,
        { pickJan, qty, completedAt: nowMs }
      ];
    } else {
      const updated = this.state.completed.map((item, index) =>
        index === existingIndex
          ? {
              pickJan,
              qty: item.qty + qty,
              completedAt: nowMs
            }
          : item
      );
      nextCompleted = updated;
    }
    this.state = {
      counts: rest,
      lastScanAt: this.state.lastScanAt,
      completed: nextCompleted
    };
    this.scheduleSave();
  }

  restorePick(pickJan: string): void {
    const index = this.state.completed.findIndex((item) => item.pickJan === pickJan);
    if (index === -1) {
      return;
    }
    const target = this.state.completed[index];
    const nextCompleted = this.state.completed.filter((_, i) => i !== index);
    this.state = {
      counts: {
        ...this.state.counts,
        [pickJan]: (this.state.counts[pickJan] ?? 0) + target.qty
      },
      lastScanAt: this.state.lastScanAt,
      completed: nextCompleted
    };
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.storage) {
      return;
    }
    if (this.saveTimer !== undefined) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      void this.storage?.saveMaster(this.master);
      void this.storage?.saveState(this.state);
    }, this.debounceMs);
  }
}
