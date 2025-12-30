export type ScanHandler = (code: string) => void;

export interface Scanner {
  start(onCode: ScanHandler): void;
  stop(): void;
}
