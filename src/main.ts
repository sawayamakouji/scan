import { AppStore } from "./app/store";
import { FakeScanner } from "./scanner/FakeScanner";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const store = new AppStore();
const fakeScanner = new FakeScanner();

app.innerHTML = `
  <header>
    <h1>JAN Scanner</h1>
  </header>

  <section>
    <h2>Scan Input</h2>
    <div class="row">
      <div>
        <label for="eachJan">Each-item JAN</label>
        <input id="eachJan" class="mono" placeholder="e.g. 4901234567890" />
      </div>
      <div>
        <label for="batchQty">+N Qty</label>
        <input id="batchQty" type="number" min="1" value="5" />
      </div>
      <div class="controls">
        <button id="addOne">Add +1</button>
        <button id="addBatch">Add +N</button>
      </div>
      <div class="controls">
        <button id="demoScan">Demo (FakeScanner)</button>
      </div>
    </div>
  </section>

  <section>
    <h2>Master Mapping (eachJan,caseJan)</h2>
    <label for="masterMap">One mapping per line</label>
    <textarea id="masterMap" class="mono" placeholder="111,CASE-1&#10;222,CASE-2"></textarea>
  </section>

  <section>
    <h2>Pick List</h2>
    <div id="pickList" class="pick-list"></div>
  </section>
`;

const eachJanInput = app.querySelector<HTMLInputElement>("#eachJan");
const batchQtyInput = app.querySelector<HTMLInputElement>("#batchQty");
const addOneButton = app.querySelector<HTMLButtonElement>("#addOne");
const addBatchButton = app.querySelector<HTMLButtonElement>("#addBatch");
const demoButton = app.querySelector<HTMLButtonElement>("#demoScan");
const masterMapInput = app.querySelector<HTMLTextAreaElement>("#masterMap");
const pickListEl = app.querySelector<HTMLDivElement>("#pickList");

if (
  !eachJanInput ||
  !batchQtyInput ||
  !addOneButton ||
  !addBatchButton ||
  !demoButton ||
  !masterMapInput ||
  !pickListEl
) {
  throw new Error("Missing UI elements");
}

function parseMasterMap(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  const map: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [eachJan, caseJan] = trimmed.split(",").map((part) => part.trim());
    if (eachJan && caseJan) {
      map[eachJan] = caseJan;
    }
  }

  return map;
}

function renderPickList(): void {
  const items = store.getPickList();

  if (items.length === 0) {
    pickListEl.innerHTML = `<div>No picks yet.</div>`;
    return;
  }

  pickListEl.innerHTML = items
    .map(
      (item) => `
        <div class="pick-item" data-pick-jan="${item.pickJan}">
          <div class="mono">${item.pickJan}</div>
          <div>Qty: ${item.qty}</div>
          <button data-adjust="-1">-1</button>
          <button data-adjust="1">+1</button>
          <button data-adjust="5">+5</button>
        </div>
      `
    )
    .join("");

  for (const button of pickListEl.querySelectorAll<HTMLButtonElement>("button")) {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.adjust ?? "0");
      const row = button.closest<HTMLDivElement>(".pick-item");
      const pickJan = row?.dataset.pickJan;
      if (!pickJan || !delta) {
        return;
      }
      store.adjust(pickJan, delta);
      renderPickList();
    });
  }
}

function handleScanInput(eachJan: string, qty = 1): void {
  const trimmed = eachJan.trim();
  if (!trimmed) {
    return;
  }
  const master = parseMasterMap(masterMapInput.value);
  let nowMs = Date.now();

  for (let i = 0; i < qty; i += 1) {
    store.handleScan(trimmed, nowMs, master);
    nowMs += 1000;
  }

  eachJanInput.value = "";
  eachJanInput.focus();
  renderPickList();
}

addOneButton.addEventListener("click", () => {
  handleScanInput(eachJanInput.value, 1);
});

addBatchButton.addEventListener("click", () => {
  const qty = Math.max(1, Number(batchQtyInput.value || "1"));
  handleScanInput(eachJanInput.value, qty);
});

demoButton.addEventListener("click", () => {
  const demoCodes = ["111", "222", "111"];
  fakeScanner.enqueue(demoCodes);

  const master = parseMasterMap(masterMapInput.value);
  let nowMs = Date.now();

  fakeScanner.start((code) => {
    store.handleScan(code, nowMs, master);
    nowMs += 1000;
  });
  fakeScanner.emitAll();
  fakeScanner.stop();

  renderPickList();
});

eachJanInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleScanInput(eachJanInput.value, 1);
  }
});

renderPickList();
