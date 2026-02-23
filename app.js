/* =========================
   KaiGI Core Logic
   最軽量・高速・暴れない
   ========================= */

const $ = (id) => document.getElementById(id);

const timeline = $("timeline");
const input = $("input");
const sendBtn = $("send");
const modePill = $("modePill");

/* ==========
   状態
========== */
let mode = "ChatGPT";
let rageMode = false;

/* ==========
   メッセージ表示
========== */
function addMessage(text, who = "bot") {
  const row = document.createElement("div");
  row.className = "row " + (who === "user" ? "user" : "bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (who === "user" ? "user" : "bot");
  bubble.textContent = text;

  row.appendChild(bubble);
  timeline.appendChild(row);

  // スクロール暴れ防止
  requestAnimationFrame(() => {
    timeline.scrollTop = timeline.scrollHeight;
  });
}

/* ==========
   モード切替
========== */
function setMode(newMode) {
  mode = newMode;
  modePill.textContent = "Mode: " + newMode;
  addMessage(`モードを「${newMode}」に切り替えた。`);
}

/* ==========
   暴走モード
========== */
function toggleRage() {
  rageMode = !rageMode;
  addMessage(
    rageMode
      ? "暴走モードON（長文解禁）"
      : "暴走モードOFF"
  );
}

/* ==========
   ダミー応答
========== */
function reply(text) {
  if (rageMode) {
    return `${mode}: ${text}。その発想は広げられる。次の具体を一つだけ出せ。`;
  }
  return `${mode}: いい視点。次の一手を一つ決めよ。`;
}

/* ==========
   送信
========== */
function send() {
  const text = input.value.trim();
  if (!text) return;

  addMessage("中原: " + text, "user");
  input.value = "";

  setTimeout(() => {
    addMessage(reply(text));
  }, 120);
}

/* ==========
   イベント
========== */
sendBtn.addEventListener("click", send);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

/* ==========
   初期メッセージ
========== */
addMessage("ChatGPT: よう、KaiGI。まずは一言くれ。");
