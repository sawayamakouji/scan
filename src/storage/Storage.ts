import { ScanState } from "../domain/aggregate";

export type MasterData = {
  mapping: Record<string, string>;
  names: Record<string, string>;
};

export interface Storage {
  loadMaster(): Promise<MasterData>;
  saveMaster(master: MasterData): Promise<void>;
  loadState(): Promise<ScanState>;
  saveState(state: ScanState): Promise<void>;
}
