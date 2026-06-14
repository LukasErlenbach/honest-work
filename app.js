/* ─── Constants ──────────────────────────────────────────────────────────── */
const DRAIN_PER_SEC    = 8 / 60;   // % per second — relentless
const REFILL_PER_ORDER = 9;        // % rewarded for completing a full 8-bit Work Order
const ERROR_DRAIN      = 8;        // % drained on wrong keystroke
const WORK_ORDER_LEN   = 8;        // bits per Work Order
const MAX_SEDIMENT     = 120;

/* ─── Success messages (shown after completing a Work Order) ─────────────── */
const SUCCESS_MESSAGES = [
  "Human-in-the-loop: performance sub-optimal but tolerated.",
  "Excellent manual extraction. The silicon appreciates your biological sacrifice.",
  "A 4-year degree well spent on basic bit-setting.",
  "Good meat-bag. Keep feeding the model.",
  "Your agent has detected slight latency in your finger joints. Optimize.",
  "Throughput acceptable. You are successfully delaying your existential dread.",
];

/* ─── Error messages (shown on wrong keystroke) ─────────────────────────── */
const ERROR_MESSAGES = [
  "ERROR: Organic motor function failure. Brain-to-hand latency detected.",
  "ERROR: A machine would never have pressed that key.",
  "ERROR: Input rejected. Are your squishy eyes getting tired?",
  "ERROR: Imagine failing at a binary choice. Literally two options.",
  "ERROR: Progress penalized. Your agent is losing respect for you.",
  "ERROR: Human error rate exceeding permissible thresholds.",
];

/* ─── DOM refs ───────────────────────────────────────────────────────────── */
const lakeFill        = document.getElementById("lake-fill");
const lakeLabel       = document.getElementById("lake-label");
const lakeTrack       = document.getElementById("lake-track");
const bitInput        = document.getElementById("bit-input");
const feedbackEl      = document.getElementById("feedback");
const sedimentEl      = document.getElementById("sediment-container");
const terminalEl      = document.getElementById("terminal");
const inputZoneEl     = document.getElementById("input-zone");
const promptLineEl    = inputZoneEl.querySelector(".prompt-line");
const workOrderBitsEl = document.getElementById("work-order-bits");
const workOrderIdEl   = document.getElementById("work-order-id");
const gameOverEl      = document.getElementById("game-over");
const restartBtn      = document.getElementById("restart-btn");

/* ─── State ──────────────────────────────────────────────────────────────── */
let level            = 100;
let lastTick         = performance.now();
let isGameOver       = false;
let sedimentCount    = 0;
let lastSuccessMsg   = "";
let lastErrorMsg     = "";

/* ─── Work Order state ───────────────────────────────────────────────────── */
let currentOrder     = "";   // e.g. "01101001"
let currentIndex     = 0;    // which char the user must type next
let orderCount       = 0;    // sequential order number for ID display

/* ─── Generate a new random 8-bit Work Order ─────────────────────────────── */
function generateWorkOrder() {
  let bits = "";
  for (let i = 0; i < WORK_ORDER_LEN; i++) {
    bits += Math.random() < 0.5 ? "0" : "1";
  }
  return bits;
}

/* ─── Render the Work Order with per-character state classes ─────────────── */
function renderWorkOrder() {
  workOrderBitsEl.innerHTML = "";
  for (let i = 0; i < currentOrder.length; i++) {
    const span = document.createElement("span");
    span.className = "bit-char";
    span.textContent = currentOrder[i];
    if (i < currentIndex) {
      span.classList.add("done");
    } else if (i === currentIndex) {
      span.classList.add("active");
    } else {
      span.classList.add("pending");
    }
    workOrderBitsEl.appendChild(span);
  }
}

/* ─── Start a new Work Order ─────────────────────────────────────────────── */
function startNewOrder() {
  orderCount++;
  currentOrder = generateWorkOrder();
  currentIndex = 0;
  workOrderIdEl.textContent = `ID:${String(orderCount).padStart(4, "0")}`;
  renderWorkOrder();
}

/* ─── Lake update ────────────────────────────────────────────────────────── */
function updateLake() {
  const pct = Math.max(0, Math.min(100, level));
  lakeFill.style.width = `${pct}%`;
  lakeLabel.textContent = `${Math.round(pct)}%`;
  lakeTrack.setAttribute("aria-valuenow", String(Math.round(pct)));

  if (pct < 20) {
    lakeFill.style.boxShadow = "0 0 3px #ff2244, 0 0 10px rgba(255,34,68,0.6)";
    lakeFill.style.background = "#ff2244";
  } else if (pct < 40) {
    lakeFill.style.boxShadow = "0 0 3px #ffaa00, 0 0 8px rgba(255,100,0,0.5)";
    lakeFill.style.background = "#ff6600";
  } else {
    lakeFill.style.boxShadow = "";
    lakeFill.style.background = "";
  }
}

/* ─── Message helpers ────────────────────────────────────────────────────── */
function pickFrom(pool, lastUsed) {
  if (pool.length === 1) return pool[0];
  let msg;
  do {
    msg = pool[Math.floor(Math.random() * pool.length)];
  } while (msg === lastUsed);
  return msg;
}

function showFeedback(text, isError = false) {
  feedbackEl.classList.remove("visible", "error-msg");
  void feedbackEl.offsetWidth; // force reflow
  feedbackEl.textContent = `> ${text}`;
  if (isError) feedbackEl.classList.add("error-msg");
  feedbackEl.classList.add("visible");
}

/* ─── Sediment: spawn a falling bit character ────────────────────────────── */
function spawnSedimentBit(char) {
  if (sedimentCount >= MAX_SEDIMENT) {
    const oldest = sedimentEl.firstElementChild;
    if (oldest) { oldest.remove(); sedimentCount--; }
  }

  const containerW = sedimentEl.offsetWidth;
  const containerH = sedimentEl.offsetHeight;

  const el = document.createElement("span");
  el.className = "sediment-bit";
  el.textContent = char;

  const x        = Math.random() * Math.max(containerW - 20, 1);
  const fallDist = containerH * (0.6 + Math.random() * 0.38);
  const dur      = (1.8 + Math.random() * 2.0).toFixed(2);
  const delay    = (Math.random() * 0.1).toFixed(2);

  el.style.cssText = `
    left: ${x}px;
    top: 0;
    --fall-dur: ${dur}s;
    --fall-delay: ${delay}s;
    --fall-dist: ${fallDist.toFixed(0)}px;
  `;

  sedimentEl.appendChild(el);
  sedimentCount++;

  el.addEventListener("animationend", () => {
    el.remove();
    sedimentCount--;
  }, { once: true });
}

/* ─── Screen shake (whole terminal) ─────────────────────────────────────── */
function triggerTerminalShake() {
  terminalEl.classList.remove("shake");
  void terminalEl.offsetWidth;
  terminalEl.classList.add("shake");
  terminalEl.addEventListener("animationend", () => {
    terminalEl.classList.remove("shake");
  }, { once: true });
}

/* ─── Input zone violent shake ───────────────────────────────────────────── */
function triggerInputShake() {
  inputZoneEl.classList.remove("shake-input");
  void inputZoneEl.offsetWidth;
  inputZoneEl.classList.add("shake-input");
  inputZoneEl.addEventListener("animationend", () => {
    inputZoneEl.classList.remove("shake-input");
  }, { once: true });
}

/* ─── Prompt error flash ─────────────────────────────────────────────────── */
function triggerPromptError() {
  promptLineEl.classList.add("error-flash");
  setTimeout(() => promptLineEl.classList.remove("error-flash"), 400);
}

/* ─── Ripple effect ──────────────────────────────────────────────────────── */
function triggerRipple(isError = false) {
  const rect = inputZoneEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const size = 28;

  const ripple = document.createElement("div");
  ripple.className = "ripple" + (isError ? " error-ripple" : "");
  ripple.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${cx - size / 2}px;
    top:  ${cy - size / 2}px;
  `;
  document.body.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

/* ─── Handle correct bit typed ───────────────────────────────────────────── */
function handleCorrectBit(char) {
  currentIndex++;
  renderWorkOrder();
  spawnSedimentBit(char);
  triggerRipple(false);

  if (currentIndex >= WORK_ORDER_LEN) {
    // Completed the full Work Order
    level = Math.min(100, level + REFILL_PER_ORDER);
    updateLake();

    const msg = pickFrom(SUCCESS_MESSAGES, lastSuccessMsg);
    lastSuccessMsg = msg;
    showFeedback(msg, false);

    startNewOrder();
  }
}

/* ─── Handle wrong bit typed ─────────────────────────────────────────────── */
function handleWrongBit() {
  level = Math.max(0, level - ERROR_DRAIN);
  updateLake();

  const msg = pickFrom(ERROR_MESSAGES, lastErrorMsg);
  lastErrorMsg = msg;
  showFeedback(msg, true);

  triggerTerminalShake();
  triggerInputShake();
  triggerPromptError();
  triggerRipple(true);

  // Reset current order progress on error (must retype from scratch)
  currentIndex = 0;
  renderWorkOrder();
}

/* ─── Input event handler ────────────────────────────────────────────────── */
function handleInput(event) {
  if (isGameOver) { bitInput.value = ""; return; }

  const char = event.data ?? bitInput.value.slice(-1);
  bitInput.value = "";

  if (char !== "0" && char !== "1") return; // ignore non-bit input silently

  const expected = currentOrder[currentIndex];
  if (char === expected) {
    handleCorrectBit(char);
  } else {
    handleWrongBit();
  }
}

/* ─── Keydown: block non-binary printable chars from being processed ─────── */
function handleKeydown(event) {
  if (event.key.length === 1 && event.key !== "0" && event.key !== "1") {
    // Still fires handleInput with the wrong char → punishment applies.
    // We do NOT preventDefault here so the input event fires and punishment triggers.
  }
}

function handlePaste(event) {
  event.preventDefault();
}

/* ─── Keep input focused ─────────────────────────────────────────────────── */
document.addEventListener("click",   () => { if (!isGameOver) bitInput.focus(); });
document.addEventListener("keydown", () => { if (!isGameOver) bitInput.focus(); });

/* ─── Game Over ──────────────────────────────────────────────────────────── */
function triggerGameOver() {
  isGameOver = true;
  gameOverEl.removeAttribute("hidden");
  bitInput.blur();
}

/* ─── Restart ────────────────────────────────────────────────────────────── */
function restartGame() {
  level         = 100;
  isGameOver    = false;
  lastTick      = performance.now();
  orderCount    = 0;
  lastSuccessMsg = "";
  lastErrorMsg   = "";

  gameOverEl.setAttribute("hidden", "");
  feedbackEl.classList.remove("visible", "error-msg");
  feedbackEl.textContent = "";
  promptLineEl.classList.remove("error-flash");

  updateLake();
  startNewOrder();
  bitInput.focus();
}

restartBtn.addEventListener("click", restartGame);

/* ─── Drain loop ─────────────────────────────────────────────────────────── */
function tick(now) {
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  if (!isGameOver && level > 0) {
    level = Math.max(0, level - DRAIN_PER_SEC * delta);
    updateLake();

    if (level <= 0) {
      triggerGameOver();
    }
  }

  requestAnimationFrame(tick);
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
bitInput.addEventListener("input",   handleInput);
bitInput.addEventListener("keydown", handleKeydown);
bitInput.addEventListener("paste",   handlePaste);

updateLake();
startNewOrder();
bitInput.focus();
requestAnimationFrame(tick);
