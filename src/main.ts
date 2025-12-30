import { AppStore } from "./app/store";
import { CameraScanner } from "./scanner/CameraScanner";
import { IndexedDbStorage } from "./storage/IndexedDbStorage";
import { MasterData } from "./storage/Storage";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const storage = new IndexedDbStorage();
const store = new AppStore({ storage });

app.innerHTML = `
  <header>
    <h1>JANスキャナー</h1>
  </header>

  <section>
    <h2>スキャン入力</h2>
    <div class="row">
      <div>
        <label for="eachJan">単品JAN</label>
        <input id="eachJan" class="mono" placeholder="例: 4901234567890" />
      </div>
      <div>
        <label for="batchQty">+N 数量</label>
        <input id="batchQty" type="number" min="1" value="1" />
      </div>
      <div class="controls">
        <button id="addOne">+1 追加</button>
        <button id="addBatch">+N 追加</button>
      </div>
    </div>
    <div class="controls" style="margin-top: 12px;">
      <button id="cameraStart">カメラ開始</button>
      <button id="cameraStop">カメラ停止</button>
    </div>
    <div class="camera-wrap" style="margin-top: 12px;">
      <video id="cameraPreview" autoplay playsinline muted></video>
      <div class="camera-guide"></div>
      <div class="camera-guide-label">バーコードを枠内に合わせてください</div>
    </div>
  </section>

  <section>
    <h2>マスタマッピング (単品JAN,ケースJAN)</h2>
    <div class="controls" style="margin-bottom: 8px;">
      <button id="toggleMaster">マスタ表示</button>
    </div>
    <div id="masterUpdatedAt" class="helper-text"></div>
    <div id="masterBody">
      <label for="masterMap">1行に1件</label>
      <textarea id="masterMap" class="mono" placeholder="111,CASE-1&#10;222,CASE-2"></textarea>
      <div class="controls" style="margin-top: 8px;">
        <input id="masterCsvFile" type="file" accept=".csv,text/csv" />
        <button id="loadMasterCsv">CSV読み込み</button>
        <button id="loadMasterServer">サーバーから読み込み</button>
      </div>
      <div id="masterCsvStatus" class="helper-text"></div>
    </div>
  </section>

  <section>
    <h2>ピックリスト</h2>
    <div class="controls" style="margin-bottom: 12px;">
      <button id="resetAll">全消去</button>
    </div>
    <div id="pickList" class="pick-list"></div>
  </section>

  <section>
    <h2>pickup完了リスト</h2>
    <div id="completedList" class="pick-list"></div>
  </section>
`;

const eachJanInput = app.querySelector<HTMLInputElement>("#eachJan")!;
const batchQtyInput = app.querySelector<HTMLInputElement>("#batchQty")!;
const addOneButton = app.querySelector<HTMLButtonElement>("#addOne")!;
const addBatchButton = app.querySelector<HTMLButtonElement>("#addBatch")!;
const masterMapInput = app.querySelector<HTMLTextAreaElement>("#masterMap")!;
const masterCsvFileInput = app.querySelector<HTMLInputElement>("#masterCsvFile")!;
const loadMasterCsvButton = app.querySelector<HTMLButtonElement>("#loadMasterCsv")!;
const loadMasterServerButton = app.querySelector<HTMLButtonElement>("#loadMasterServer")!;
const masterCsvStatus = app.querySelector<HTMLDivElement>("#masterCsvStatus")!;
const masterToggleButton = app.querySelector<HTMLButtonElement>("#toggleMaster")!;
const masterBody = app.querySelector<HTMLDivElement>("#masterBody")!;
const masterUpdatedAt = app.querySelector<HTMLDivElement>("#masterUpdatedAt")!;
const pickListEl = app.querySelector<HTMLDivElement>("#pickList")!;
const completedListEl = app.querySelector<HTMLDivElement>("#completedList")!;
const resetButton = app.querySelector<HTMLButtonElement>("#resetAll")!;
const cameraStartButton = app.querySelector<HTMLButtonElement>("#cameraStart")!;
const cameraStopButton = app.querySelector<HTMLButtonElement>("#cameraStop")!;
const cameraPreview = app.querySelector<HTMLVideoElement>("#cameraPreview")!;
const cameraGuide = app.querySelector<HTMLDivElement>(".camera-guide");

const cameraScanner = new CameraScanner(cameraPreview);
let masterCache: Record<string, string> = {};
let masterNameCache: Record<string, string> = {};
let audioContext: AudioContext | null = null;
let isMasterHidden = false;

function expandScientific(value: string): string | null {
  const match = value.match(/^(\d+)(?:\.(\d+))?[eE]\+?(\d+)$/);
  if (!match) {
    return null;
  }
  const intPart = match[1];
  const fracPart = match[2] ?? "";
  const exp = Number(match[3]);
  const digits = `${intPart}${fracPart}`;
  const position = intPart.length + exp;
  if (position <= 0) {
    return null;
  }
  if (position >= digits.length) {
    return `${digits}${"0".repeat(position - digits.length)}`;
  }
  return digits.slice(0, position);
}

function normalizeJan(value: string): string {
  const trimmed = value.trim().replace(/^'+/, "").replace(/^"+|"+$/g, "");
  if (!trimmed) {
    return "";
  }
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 8) {
      return trimmed.padStart(13, "0");
    }
    return trimmed;
  }
  const expanded = expandScientific(trimmed);
  if (expanded) {
    if (expanded.length === 8) {
      return expanded.padStart(13, "0");
    }
    return expanded;
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 8) {
    return digits.padStart(13, "0");
  }
  return digits;
}

function normalizeName(value: string): string {
  return value.trim().replace(/^'+/, "").replace(/^"+|"+$/g, "").trim();
}

function parseMasterCsv(text: string): MasterData {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { mapping: {}, names: {} };
  }

  const header = lines[0].split(",").map((cell) => cell.trim());
  const eachIndex = header.findIndex((cell) => cell === "バラ商品コード");
  const caseIndex = header.findIndex((cell) => cell === "ケース商品コード");
  const eachNameIndex = header.findIndex((cell) => cell === "バラ商品名称");
  const startRow = eachIndex !== -1 && caseIndex !== -1 ? 1 : 0;
  const eachColumn = eachIndex !== -1 ? eachIndex : 0;
  const caseColumn = caseIndex !== -1 ? caseIndex : 2;
  const nameColumn = eachNameIndex !== -1 ? eachNameIndex : 1;
  const map: Record<string, string> = {};
  const names: Record<string, string> = {};

  for (let i = startRow; i < lines.length; i += 1) {
    const cells = lines[i].split(",").map((cell) => cell.trim());
    if (cells.length <= Math.max(eachColumn, caseColumn)) {
      continue;
    }
    const eachJan = normalizeJan(cells[eachColumn] ?? "");
    const caseJan = normalizeJan(cells[caseColumn] ?? "");
    const eachName = normalizeName(cells[nameColumn] ?? "");
    if (eachJan && caseJan) {
      map[eachJan] = caseJan;
      if (eachName) {
        names[eachJan] = eachName;
      }
    }
  }

  return { mapping: map, names };
}

function playScanBeep(): void {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    if (!audioContext) {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    // Ignore audio errors (e.g. device restrictions).
  }
}

function triggerScanFeedback(): void {
  playScanBeep();
  if (!cameraGuide) {
    return;
  }
  cameraGuide.classList.remove("flash");
  requestAnimationFrame(() => {
    cameraGuide.classList.add("flash");
  });
  window.setTimeout(() => {
    cameraGuide.classList.remove("flash");
  }, 260);
}

function parseMasterMap(text: string): MasterData {
  const headerLine = text.split(/\r?\n/)[0] ?? "";
  const headerCells = headerLine.split(",").map((cell) => cell.trim());
  if (
    headerLine.includes("バラ商品コード") ||
    headerLine.includes("ケース商品コード") ||
    headerCells.length >= 3
  ) {
    return parseMasterCsv(text);
  }
  const lines = text.split(/\r?\n/);
  const map: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [eachJanRaw, caseJanRaw] = trimmed.split(",").map((part) => part.trim());
    const eachJan = normalizeJan(eachJanRaw ?? "");
    const caseJan = normalizeJan(caseJanRaw ?? "");
    if (eachJan && caseJan) {
      map[eachJan] = caseJan;
    }
  }

  return { mapping: map, names: {} };
}

function masterMapToText(master: Record<string, string>): string {
  return Object.entries(master)
    .map(([eachJan, caseJan]) => `${eachJan},${caseJan}`)
    .join("\n");
}

function applyMasterData(nextMaster: MasterData): void {
  masterCache = nextMaster.mapping;
  masterNameCache = nextMaster.names;
  store.setMasterData(nextMaster);
  masterMapInput.value = masterMapToText(masterCache);
  setMasterHidden(Object.keys(masterCache).length > 0);
  renderLists();
  masterCsvStatus.textContent = `CSV読み込み: ${Object.keys(masterCache).length} 件`;
}

function buildPickMaps(): {
  nameByPickJan: Map<string, string>;
  eachByCaseJan: Map<string, string>;
} {
  const nameByPickJan = new Map<string, string>();
  const eachByCaseJan = new Map<string, string>();

  for (const [eachJan, caseJan] of Object.entries(masterCache)) {
    const name = masterNameCache[eachJan];
    if (name) {
      if (!nameByPickJan.has(caseJan)) {
        nameByPickJan.set(caseJan, name);
      }
      if (!nameByPickJan.has(eachJan)) {
        nameByPickJan.set(eachJan, name);
      }
    }
    if (!eachByCaseJan.has(caseJan)) {
      eachByCaseJan.set(caseJan, eachJan);
    }
  }
  return { nameByPickJan, eachByCaseJan };
}

function renderPickList(
  nameByPickJan: Map<string, string>,
  eachByCaseJan: Map<string, string>
): void {
  const items = store.getPickList();
  const mappedPickSet = new Set(Object.values(masterCache));

  if (items.length === 0) {
    pickListEl.innerHTML = `<div>まだピックがありません。</div>`;
    return;
  }

  pickListEl.innerHTML = items
    .map((item) => {
      const unmapped = mappedPickSet.has(item.pickJan)
        ? ""
        : ` <span style="color:#c0392b;font-size:12px;">未マッピング</span>`;
      const itemName = nameByPickJan.get(item.pickJan) ?? "";
      const nameLine = itemName ? `<div class="item-name">${itemName}</div>` : "";
      const caseJan = item.pickJan;
      const eachJan = eachByCaseJan.get(caseJan) ?? "";
      const janLines = eachJan
        ? `
            <div class="mono">ケースJAN: ${caseJan}</div>
            <div class="mono">バラJAN: ${eachJan}</div>
          `
        : `
            <div class="mono">JAN: ${caseJan}</div>
          `;
      return `
        <div class="pick-item pick-active" data-pick-jan="${item.pickJan}">
          <div class="pick-info">
            ${janLines}
            ${nameLine}
          </div>
          <div class="pick-controls">
            <div class="pick-qty">数量: ${item.qty}${unmapped}</div>
            <div class="pick-actions">
              <button data-adjust="-1">-1</button>
              <button data-adjust="1">+1</button>
              <button data-adjust="5">+5</button>
              <button data-complete="true" class="pickup-complete">pickup完了</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  pickListEl
    .querySelectorAll("button[data-adjust]")
    .forEach((button) => {
      const btn = button as HTMLButtonElement;
      btn.addEventListener("click", () => {
        const delta = Number(btn.dataset.adjust ?? "0");
        const row = btn.closest<HTMLDivElement>(".pick-item");
        const pickJan = row?.dataset.pickJan;
        if (!pickJan || !delta) {
          return;
        }
        store.adjust(pickJan, delta);
        renderLists();
      });
    });

  pickListEl
    .querySelectorAll("button[data-complete]")
    .forEach((button) => {
      const btn = button as HTMLButtonElement;
      btn.addEventListener("click", () => {
        const row = btn.closest<HTMLDivElement>(".pick-item");
        const pickJan = row?.dataset.pickJan;
        if (!pickJan) {
          return;
        }
        store.completePick(pickJan, Date.now());
        renderLists();
      });
    });
}

function renderCompletedList(nameByPickJan: Map<string, string>): void {
  const items = store.getCompletedList();
  if (items.length === 0) {
    completedListEl.innerHTML = `<div>まだ完了がありません。</div>`;
    return;
  }

  completedListEl.innerHTML = items
    .map((item) => {
      const itemName = nameByPickJan.get(item.pickJan) ?? "";
      const nameLine = itemName ? `<div class="item-name">${itemName}</div>` : "";
      const completedAt = new Date(item.completedAt);
      const timeLabel = completedAt.toLocaleTimeString();
      return `
        <div class="pick-item pick-active" data-pick-jan="${item.pickJan}">
          <div>
            <div class="mono">${item.pickJan}</div>
            ${nameLine}
          </div>
          <div class="pick-qty">数量: ${item.qty}</div>
          <div class="completed-at">${timeLabel}</div>
          <button data-restore="true">ピックに戻す</button>
        </div>
      `;
    })
    .join("");

  completedListEl
    .querySelectorAll("button[data-restore]")
    .forEach((button) => {
      const btn = button as HTMLButtonElement;
      btn.addEventListener("click", () => {
        const row = btn.closest<HTMLDivElement>(".pick-item");
        const pickJan = row?.dataset.pickJan;
        if (!pickJan) {
          return;
        }
        store.restorePick(pickJan);
        renderLists();
      });
    });
}

function renderLists(): void {
  const { nameByPickJan, eachByCaseJan } = buildPickMaps();
  renderPickList(nameByPickJan, eachByCaseJan);
  renderCompletedList(nameByPickJan);
}

function handleScanInput(eachJan: string, qty = 1): void {
  const normalized = normalizeJan(eachJan);
  if (!normalized) {
    return;
  }
  const master = masterCache;
  let nowMs = Date.now();

  for (let i = 0; i < qty; i += 1) {
    store.handleScan(normalized, nowMs, master);
    nowMs += 1000;
  }

  eachJanInput.value = "";
  eachJanInput.focus();
  triggerScanFeedback();
  renderLists();
}

addOneButton.addEventListener("click", () => {
  handleScanInput(eachJanInput.value, 1);
});

addBatchButton.addEventListener("click", () => {
  const qty = Math.max(1, Number(batchQtyInput.value || "1"));
  handleScanInput(eachJanInput.value, qty);
});
masterMapInput.addEventListener("input", () => {
  const parsed = parseMasterMap(masterMapInput.value);
  masterCache = parsed.mapping;
  masterNameCache = parsed.names;
  store.setMasterData(parsed);
  setMasterHidden(Object.keys(masterCache).length > 0);
  masterCsvStatus.textContent = "";
});

loadMasterCsvButton.addEventListener("click", () => {
  const file = masterCsvFileInput.files?.[0];
  if (!file) {
    alert("CSVファイルを選択してください。");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? "");
    const nextMaster = parseMasterCsv(text);
    if (Object.keys(nextMaster.mapping).length === 0) {
      alert("CSVから有効なマッピングが見つかりませんでした。");
      return;
    }
    applyMasterData(nextMaster);
  };
  reader.onerror = () => {
    alert("CSVの読み込みに失敗しました。");
  };
  reader.readAsText(file);
});

async function loadMasterFromServer(showAlert = true): Promise<void> {
  try {
    const response = await fetch("/data/masters/each-to-case.csv");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const updatedAtHeader = response.headers.get("x-master-updated-at");
    setMasterUpdatedAt(updatedAtHeader);
    const text = await response.text();
    const nextMaster = parseMasterCsv(text);
    if (Object.keys(nextMaster.mapping).length === 0) {
      if (showAlert) {
        alert("CSVから有効なマッピングが見つかりませんでした。");
      }
      return;
    }
    applyMasterData(nextMaster);
  } catch (error) {
    console.error(error);
    if (showAlert) {
      alert("CSVが見つかりません。/data/masters/each-to-case.csv を確認してください。");
    }
  }
}

loadMasterServerButton.addEventListener("click", async () => {
  await loadMasterFromServer(true);
});

resetButton.addEventListener("click", () => {
  const confirmed = window.confirm("すべてのデータを消去します。よろしいですか？");
  if (!confirmed) {
    return;
  }
  store.resetAll();
  masterCache = {};
  masterMapInput.value = "";
  setMasterHidden(false);
  setMasterUpdatedAt(null);
  renderLists();
});

function setMasterHidden(hidden: boolean): void {
  isMasterHidden = hidden;
  masterBody.classList.toggle("hidden", hidden);
  masterToggleButton.textContent = hidden ? "マスタ表示" : "マスタ非表示";
}

function setMasterUpdatedAt(value: string | null): void {
  if (!value) {
    masterUpdatedAt.textContent = "";
    return;
  }
  const date = new Date(value);
  const label = Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  masterUpdatedAt.textContent = `サーバー更新日時: ${label}`;
}

masterToggleButton.addEventListener("click", () => {
  setMasterHidden(!isMasterHidden);
});

cameraStartButton.addEventListener("click", async () => {
  try {
    await cameraScanner.start((code) => {
      const normalized = normalizeJan(code);
      if (!normalized) {
        return;
      }
      store.handleScan(normalized, Date.now(), masterCache);
      triggerScanFeedback();
      renderLists();
    });
  } catch (error) {
    alert("カメラの起動に失敗しました。権限を確認してください。");
    console.error(error);
  }
});

cameraStopButton.addEventListener("click", () => {
  cameraScanner.stop();
});

eachJanInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleScanInput(eachJanInput.value, 1);
  }
});

async function initApp(): Promise<void> {
  await store.init();
  const storedMaster = store.getMasterData();
  masterCache = storedMaster.mapping;
  masterNameCache = storedMaster.names;
  masterMapInput.value = masterMapToText(masterCache);
  if (Object.keys(masterCache).length > 0) {
    masterCsvStatus.textContent = `マスタ読み込み済み: ${Object.keys(masterCache).length} 件`;
  }
  setMasterHidden(Object.keys(masterCache).length > 0);
  await loadMasterFromServer(false);
  renderLists();
}

void initApp();

