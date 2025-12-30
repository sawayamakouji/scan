import {
  BarcodeFormat,
  DecodeHintType,
  BrowserMultiFormatReader
} from "@zxing/library";

import { ScanHandler, Scanner } from "./Scanner";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorCtor = new (options: { formats: string[] }) => {
  detect(video: HTMLVideoElement): Promise<DetectedBarcode[]>;
};

declare const BarcodeDetector: BarcodeDetectorCtor | undefined;

export class CameraScanner implements Scanner {
  private video: HTMLVideoElement;
  private stream?: MediaStream;
  private onCode?: ScanHandler;
  private running = false;
  private rafId: number | null = null;
  private lastValue: string | null = null;
  private detector?: InstanceType<BarcodeDetectorCtor>;
  private zxing?: BrowserMultiFormatReader;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async start(onCode: ScanHandler): Promise<void> {
    this.onCode = onCode;
    this.running = true;
    this.lastValue = null;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    this.video.srcObject = this.stream;
    this.video.muted = true;
    await this.video.play();
    await this.waitForVideoReady();

    if (typeof BarcodeDetector !== "undefined") {
      this.detector = new BarcodeDetector({ formats: ["ean_13", "ean_8"] });
      this.scanWithDetector();
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8
    ]);
    this.zxing = new BrowserMultiFormatReader(hints, 200);
    this.zxing.decodeFromVideoElementContinuously(this.video, (result) => {
      if (!this.running || !result) {
        return;
      }
      const text = result.getText();
      if (text && text !== this.lastValue) {
        this.lastValue = text;
        this.onCode?.(text);
      }
    });
  }

  stop(): void {
    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.zxing) {
      this.zxing.reset();
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }
    this.stream = undefined;
    this.video.pause();
    this.video.srcObject = null;
  }

  private scanWithDetector(): void {
    if (!this.running || !this.detector) {
      return;
    }

    this.detector
      .detect(this.video)
      .then((barcodes) => {
        for (const barcode of barcodes) {
          const value = barcode.rawValue;
          if (value && value !== this.lastValue) {
            this.lastValue = value;
            this.onCode?.(value);
          }
        }
      })
      .catch(() => {
        // Ignore intermittent decode errors.
      })
      .finally(() => {
        if (this.running) {
          this.rafId = requestAnimationFrame(() => this.scanWithDetector());
        }
      });
  }

  private async waitForVideoReady(): Promise<void> {
    if (this.video.readyState >= 2) {
      return;
    }
    await new Promise<void>((resolve) => {
      const handler = () => {
        this.video.removeEventListener("loadeddata", handler);
        resolve();
      };
      this.video.addEventListener("loadeddata", handler);
    });
  }
}
