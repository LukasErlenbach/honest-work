/* ─── Constants ──────────────────────────────────────────────────────────── */
const DRAIN_PER_SEC    = 8 / 60;   // % per second — relentless
const REFILL_PER_ORDER = 9;        // % rewarded for completing a full 8-bit Work Order
const ERROR_DRAIN      = 8;        // % drained on wrong keystroke
const WORK_ORDER_LEN   = 24;       // bits per Work Order

/* ─── DOM refs ───────────────────────────────────────────────────────────── */
const statDurationEl    = document.getElementById("stat-duration");
const statTicketsEl     = document.getElementById("stat-tickets");
const statAvgEl         = document.getElementById("stat-avg");
const statFastestEl     = document.getElementById("stat-fastest");
const statErrorsEl      = document.getElementById("stat-errors");
const bitInput          = document.getElementById("bit-input");
const feedbackEl        = document.getElementById("feedback");
const terminalEl        = document.getElementById("terminal");
const inputZoneEl       = document.getElementById("input-zone");
const workOrderBitsEl   = document.getElementById("work-order-bits");
const workOrderIdEl     = document.getElementById("work-order-id");
const gameOverEl        = document.getElementById("game-over");
const restartBtn        = document.getElementById("restart-btn");
const btn0              = document.getElementById("btn-0");
const btn1              = document.getElementById("btn-1");
const agentBitsEl           = document.getElementById("agent-bits");
const agentStatusEl         = document.getElementById("agent-status");
const statAgentAvgEl        = document.getElementById("stat-agent-avg");
const statAgentFastestEl    = document.getElementById("stat-agent-fastest");
const statAgentErrorsEl     = document.getElementById("stat-agent-errors");

/* ─── State ──────────────────────────────────────────────────────────────── */
let level            = 100;
let lastTick         = performance.now();
let isGameOver       = false;
/* ─── Stats state ────────────────────────────────────────────────────────── */
let sessionStart     = performance.now();
let orderTimes         = [];        // ms per completed ticket
let orderStartTime     = 0;         // when the current ticket began
let errorCount         = 0;         // total wrong keystrokes this session
let humanTotalPresses  = 0;         // total button clicks (for error rate)

/* ─── Work Order state ───────────────────────────────────────────────────── */
let currentOrder     = "";   // e.g. "01101001"
let currentIndex     = 0;    // which char the user must type next
let orderCount       = 0;    // completed ticket count

/* ─── Agent state ────────────────────────────────────────────────────────── */
let agentIndex          = 0;    // how far the agent has typed
let agentTimer          = null; // setTimeout handle for the agent typing loop
let agentOrderTimes     = [];   // ms per completed agent ticket
let agentOrderStartTime = 0;    // when the current agent ticket started

/* ─── Generate a random Jira-style ticket ID ────────────────────────────── */
function generateTicketId() {
  const num = Math.floor(100 + Math.random() * 9900); // 100–9999
  return `ADEV-${num}`;
}

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

/* ─── Render the Agent's Work Order with per-character state classes ──────── */
function renderAgentOrder() {
  agentBitsEl.innerHTML = "";
  for (let i = 0; i < currentOrder.length; i++) {
    const span = document.createElement("span");
    span.className = "bit-char";
    span.textContent = currentOrder[i];
    if (i < agentIndex) {
      span.classList.add("done");
    } else if (i === agentIndex) {
      span.classList.add("active");
    } else {
      span.classList.add("pending");
    }
    agentBitsEl.appendChild(span);
  }
}

/* ─── Simulate the Agent typing its assigned string automatically ─────────── */
function startAgentTyping() {
  // Cancel any previous typing loop
  if (agentTimer !== null) {
    clearTimeout(agentTimer);
    agentTimer = null;
  }
  agentIndex = 0;
  agentOrderStartTime = performance.now();
  agentStatusEl.setAttribute("hidden", "");
  renderAgentOrder();

  function typeNextChar() {
    if (isGameOver) return;
    if (agentIndex >= currentOrder.length) {
      // Agent finished — record time, update comparison, show idle status
      agentOrderTimes.push(performance.now() - agentOrderStartTime);
      updateStats();
      agentStatusEl.removeAttribute("hidden");
      agentTimer = null;
      return;
    }
    agentIndex++;
    renderAgentOrder();
    const delay = 50 + Math.random() * 350; // 50–400 ms
    agentTimer = setTimeout(typeNextChar, delay);
  }

  // Tiny initial pause so the parallel start is visually obvious
  agentTimer = setTimeout(typeNextChar, 50 + Math.random() * 350);
}

/* ─── Start a new Work Order ─────────────────────────────────────────────── */
function startNewOrder() {
  currentOrder = generateWorkOrder();
  currentIndex = 0;
  orderStartTime = performance.now();
  workOrderIdEl.textContent = `[${generateTicketId()}]`;
  renderWorkOrder();
  startAgentTyping();
}

/* ─── Lake update (meter removed from DOM; level still drives game-over) ─── */
function updateLake() {
  // no DOM meter — level variable is kept for game-over drain logic only
}

/* ─── Message helpers ────────────────────────────────────────────────────── */
function showFeedback(text, isError = false) {
  feedbackEl.classList.remove("visible", "error-msg");
  void feedbackEl.offsetWidth; // force reflow
  feedbackEl.textContent = `> ${text}`;
  if (isError) feedbackEl.classList.add("error-msg");
  feedbackEl.classList.add("visible");
}

/* ─── Stats helpers ──────────────────────────────────────────────────────── */
function fmtMs(ms) {
  if (ms < 60000) {
    return (ms / 1000).toFixed(1) + "s";
  }
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${m}:${s}`;
}

function fmtSessionTime(ms) {
  const m = String(Math.floor(ms / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${m}:${s}`;
}

function updateStats() {
  // ── Human column ────────────────────────────────────────────────────────
  if (orderTimes.length === 0) {
    statAvgEl.textContent     = "—";
    statFastestEl.textContent = "—";
  } else {
    const avg     = orderTimes.reduce((a, b) => a + b, 0) / orderTimes.length;
    const fastest = Math.min(...orderTimes);
    statAvgEl.textContent     = fmtMs(avg);
    statFastestEl.textContent = fmtMs(fastest);
  }

  const errRate = humanTotalPresses > 0
    ? ((errorCount / humanTotalPresses) * 100).toFixed(1) + "%"
    : "0%";
  if (errorCount > 0) {
    statErrorsEl.innerHTML = `<span class="stat-error-nonzero">${errRate}</span>`;
  } else {
    statErrorsEl.textContent = errRate;
  }

  // ── Agent column ────────────────────────────────────────────────────────
  if (agentOrderTimes.length === 0) {
    statAgentAvgEl.textContent     = "—";
    statAgentFastestEl.textContent = "—";
  } else {
    const agentAvg     = agentOrderTimes.reduce((a, b) => a + b, 0) / agentOrderTimes.length;
    const agentFastest = Math.min(...agentOrderTimes);
    statAgentAvgEl.innerHTML     = `<span class="agent-faster">${fmtMs(agentAvg)}</span>`;
    statAgentFastestEl.innerHTML = `<span class="agent-faster">${fmtMs(agentFastest)}</span>`;
  }
  statAgentErrorsEl.innerHTML = `<span class="agent-faster">0%</span>`;
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
  triggerRipple(false);

  if (currentIndex >= WORK_ORDER_LEN) {
    // Record ticket time
    orderCount++;
    statTicketsEl.textContent = orderCount;
    orderTimes.push(performance.now() - orderStartTime);
    updateStats();

    // Completed the full Work Order
    level = Math.min(100, level + REFILL_PER_ORDER);
    updateLake();

    startNewOrder();
  }
}

/* ─── Handle wrong bit typed ─────────────────────────────────────────────── */
function handleWrongBit() {
  errorCount++;
  updateStats();
  level = Math.max(0, level - ERROR_DRAIN);
  updateLake();

  triggerTerminalShake();
  triggerInputShake();
  triggerRipple(true);

  // Reset current order progress on error (must retype from scratch)
  currentIndex = 0;
  renderWorkOrder();
}

/* ─── Shared bit processing (buttons only) ──────────────────────────────── */
function processBit(char) {
  if (isGameOver) return;
  if (char !== "0" && char !== "1") return;

  humanTotalPresses++;
  const expected = currentOrder[currentIndex];
  if (char === expected) {
    handleCorrectBit(char);
  } else {
    handleWrongBit();
  }
}

/* ─── Keyboard disabled — show system warning on any key attempt ─────────── */
let keyWarnDebounce = null;
function showKeyboardWarning() {
  if (isGameOver) return;
  clearTimeout(keyWarnDebounce);
  feedbackEl.classList.remove("visible", "error-msg");
  void feedbackEl.offsetWidth;
  feedbackEl.textContent = "> SYSTEM: Physical keyboard entry disabled. Please utilize the designated manual click interface.";
  feedbackEl.classList.add("visible");
  keyWarnDebounce = setTimeout(() => feedbackEl.classList.remove("visible"), 3000);
}

function handlePaste(event) {
  event.preventDefault();
}

/* ─── Intercept keyboard attempts — warn, don't process ─────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    showKeyboardWarning();
  }
});

/* ─── Bit button handlers ────────────────────────────────────────────────── */
btn0.addEventListener("click", () => { processBit("0"); });
btn1.addEventListener("click", () => { processBit("1"); });

/* ─── Game Over ──────────────────────────────────────────────────────────── */
function triggerGameOver() {
  isGameOver = true;
  gameOverEl.removeAttribute("hidden");
  bitInput.blur();
}

/* ─── Restart ────────────────────────────────────────────────────────────── */
function restartGame() {
  level          = 100;
  isGameOver     = false;
  lastTick       = performance.now();
  orderCount     = 0;
  statTicketsEl.textContent = 0;
  sessionStart   = performance.now();
  orderTimes     = [];
  errorCount     = 0;

  humanTotalPresses  = 0;
  agentOrderTimes    = [];

  // Clear any in-flight agent typing
  if (agentTimer !== null) {
    clearTimeout(agentTimer);
    agentTimer = null;
  }
  agentIndex = 0;
  agentStatusEl.setAttribute("hidden", "");

  gameOverEl.setAttribute("hidden", "");
  feedbackEl.classList.remove("visible", "error-msg");
  feedbackEl.textContent = "";
  updateStats();
  updateLake();
  startNewOrder();
}

restartBtn.addEventListener("click", restartGame);

/* ─── Drain loop ─────────────────────────────────────────────────────────── */
function tick(now) {
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  if (!isGameOver && level > 0) {
    level = Math.max(0, level - DRAIN_PER_SEC * delta);
    updateLake();
    statDurationEl.textContent = fmtSessionTime(now - sessionStart);

    if (level <= 0) {
      triggerGameOver();
    }
  }

  requestAnimationFrame(tick);
}

bitInput.addEventListener("paste", handlePaste);

updateLake();
startNewOrder();
requestAnimationFrame(tick);
