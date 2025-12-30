import { ScanHandler, Scanner } from "./Scanner";

export class FakeScanner implements Scanner {
  private queue: string[];
  private onCode?: ScanHandler;
  private started = false;

  constructor(codes: string[] = []) {
    this.queue = [...codes];
  }

  start(onCode: ScanHandler): void {
    this.onCode = onCode;
    this.started = true;
  }

  stop(): void {
    this.started = false;
  }

  enqueue(codes: string[]): void {
    this.queue.push(...codes);
  }

  emitNext(): boolean {
    if (!this.started || !this.onCode) {
      return false;
    }

    const code = this.queue.shift();
    if (code === undefined) {
      return false;
    }

    this.onCode(code);
    return true;
  }

  emitAll(): number {
    let count = 0;
    while (this.emitNext()) {
      count += 1;
    }
    return count;
  }
}
