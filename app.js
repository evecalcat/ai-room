// KaiGI / AI会議室 - app.js
// - モード切替（ChatGPT / Claude / Gemini / 音楽さん）
// - 全員回答（パネル表示）
// - 👍👎フィードバック蓄積
// - ユーザー文体プロファイル簡易更新
// - 履歴保存/復元/クリア
// 注意：いまは「ダミー応答」。後で worker 経由の本物APIに差し替える。

/* =========================
   Storage Keys
========================= */
const LS = {
  HISTORY: "kaigi_history_v1",
  FEEDBACK: "kaigi_feedback_v1",
  STYLE: "kaigi_style_v1",
  SETTINGS: "kaigi_settings_v1",
};

/* =========================
   Agents (表示名は「本名 → (愛称)」)
========================= */
const AI_MAP = {
  gpt: {
    id: "gpt",
    label: "ChatGPT（仁）",
    short: "ChatGPT",
  },
  claude: {
    id: "claude",
    label: "Claude（愛）",
    short: "Claude",
  },
  gemini: {
    id: "gemini",
    label: "Gemini（勇）",
    short: "Gemini",
  },
  music: {
    id: "music",
    label: "音楽さん",
    short: "音楽",
  },
};

const MODE_DEFAULT = "gpt";

/* =========================
   DOM
========================= */
const $ = (q) => document.querySelector(q);

const el = {
  title: $("#appTitle"),
  status: $("#statusPwa"),
  modePill: $("#modePill"),
  modeButtons: $("#modeButtons"),
  timeline: $("#timeline"),
  input: $("#input"),
  send: $("#send"),
  clear: $("#clearHistory"),
  chaos: $("#chaosToggle"),
  chaosPill: $("#chaosPill"),
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* =========================
   State
========================= */
let state = {
  mode: MODE_DEFAULT,
  chaos: false, // 全員回答モード（暴走=思想競争）
  history: [],
  feedback: [],
  style: {
    avgLength: 0,
    formality: 0.3,
    usesEmoji: false,
    frequentWords: [],
    punctuation: "none",
    samples: 0,
  },
};

/* =========================
   Load/Save
========================= */
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadAll() {
  state.history = loadJSON(LS.HISTORY, []);
  state.feedback = loadJSON(LS.FEEDBACK, []);
  state.style = loadJSON(LS.STYLE, state.style);
  const settings = loadJSON(LS.SETTINGS, { mode: MODE_DEFAULT, chaos: false });
  state.mode = settings.mode || MODE_DEFAULT;
  state.chaos = !!settings.chaos;
}

function saveSettings() {
  saveJSON(LS.SETTINGS, { mode: state.mode, chaos: state.chaos });
}

function persist() {
  saveJSON(LS.HISTORY, state.history);
  saveJSON(LS.FEEDBACK, state.feedback);
  saveJSON(LS.STYLE, state.style);
}

/* =========================
   UI Helpers
========================= */
function setMode(modeId) {
  state.mode = modeId;
  saveSettings();
  renderHeader();
  systemMsg(`モードを「${AI_MAP[modeId].short}」に切り替えた。`);
}

function setChaos(v) {
  state.chaos = v;
  saveSettings();
  renderHeader();
  systemMsg(state.chaos ? "暴走モード（全員回答）: ON" : "暴走モード: OFF");
}

function renderHeader() {
  const m = AI_MAP[state.mode];
  el.modePill.textContent = `モード: ${m.label}`;
  el.chaosPill.textContent = state.chaos ? "暴走: ON（長文解禁）" : "暴走: OFF";
  el.chaos.checked = state.chaos;
}

function scrollToBottom() {
  el.timeline.scrollTop = el.timeline.scrollHeight;
}

function escapeHTML(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function msgBubble({ id, role, speaker, text, ts, isSystem = false }) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}${isSystem ? " system" : ""}`;
  wrap.dataset.id = id;

  const header = document.createElement("div");
  header.className = "msgHeader";
  header.textContent = speaker;

  const body = document.createElement("div");
  body.className = "msgBody";
  body.innerHTML = escapeHTML(text).replaceAll("\n", "<br>");

  const meta = document.createElement("div");
  meta.className = "msgMeta";
  meta.textContent = new Date(ts).toLocaleTimeString();

  const actions = document.createElement("div");
  actions.className = "msgActions";
  actions.innerHTML = `
    <button class="vote up" title="役に立った">👍</button>
    <button class="vote down" title="役に立たなかった">👎</button>
  `;

  // System message has no votes
  if (isSystem) actions.style.display = "none";

  wrap.appendChild(header);
  wrap.appendChild(body);
  wrap.appendChild(meta);
  wrap.appendChild(actions);

  return wrap;
}

function addMsg({ role, speaker, text, isSystem = false }) {
  const item = {
    id: uid(),
    role,
    speaker,
    text,
    ts: Date.now(),
    isSystem,
  };
  state.history.push(item);
  persist();
  el.timeline.appendChild(msgBubble(item));
  scrollToBottom();
  return item;
}

function systemMsg(text) {
  addMsg({ role: "system", speaker: "System", text, isSystem: true });
}

/* =========================
   Feedback
========================= */
function addFeedback({ msgId, vote }) {
  const msg = state.history.find((m) => m.id === msgId);
  if (!msg) return;

  state.feedback.push({
    msgId,
    role: msg.role,
    speaker: msg.speaker,
    text: msg.text,
    vote, // 1 or -1
    ts: Date.now(),
  });
  persist();
}

/* =========================
   Style Profile (超軽量)
========================= */
function updateStyleProfile(userText) {
  const len = userText.length;
  const usesEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(userText);

  // rough formality: です/ます/ございます 等
  const polite = /(です|ます|ございます|いたします)/.test(userText) ? 1 : 0;

  // punctuation heuristic
  const hasDot = /[。．\.]/.test(userText);
  const hasNone = !/[。．\.\!\?！？]/.test(userText);
  const punctuation = hasNone ? "none" : hasDot ? "dot" : "full";

  // frequent words (top few)
  const words = userText
    .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}a-zA-Z0-9\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 8)
    .slice(0, 40);

  // update
  const s = state.style;
  s.samples = (s.samples || 0) + 1;
  s.avgLength = Math.round(((s.avgLength || 0) * (s.samples - 1) + len) / s.samples);
  s.usesEmoji = s.usesEmoji || usesEmoji;
  s.formality = ((s.formality || 0.3) * (s.samples - 1) + polite) / s.samples;
  s.punctuation = punctuation;

  const freq = new Map((s.frequentWords || []).map((w) => [w, 1]));
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  s.frequentWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);

  state.style = s;
  persist();
}

/* =========================
   Dummy Responses (仮)
   後で worker 経由の本物AIに差し替え
========================= */
function dummyReply(agentId, userText) {
  const base = {
    gpt: [
      "なるほど。論点を3つに分けよう。",
      "一旦、結論→理由→次アクションで出す。",
      "中原の狙いが見えた。次はこれで攻める。",
    ],
    claude: [
      "丁寧に整理するね。前提→制約→最適解の順でいく。",
      "今の状態を短く要約してから、手順に落とす。",
      "リスクも含めて実務的にいこう。",
    ],
    gemini: [
      "選択肢を並べて比較する。A/B/Cでいく？",
      "最短ルートを提示する。やることを削る。",
      "検証ステップも同時に出す。",
    ],
    music: [
      "音の方向性に落とすなら、まず世界観を決めよう。",
      "制作の手数を減らす設計にする。",
      "曲に繋がるアウトプットに変換する。",
    ],
  };

  const pool = base[agentId] || base.gpt;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  // chaos ON → 少し長め
  if (state.chaos) {
    return `${pick}\n\n・要点: ${userText.slice(0, 30)}${userText.length > 30 ? "…" : ""}\n・次: 1) まずMVPを壊さず改善 2) 本物AI接続 3) 学習(👍👎/文体)\n・確認: どれ優先？`;
  }
  return pick;
}

/* =========================
   Send Flow
========================= */
async function send() {
  const text = (el.input.value || "").trim();
  if (!text) return;

  // user message
  addMsg({ role: "user", speaker: "中原", text });
  updateStyleProfile(text);
  el.input.value = "";

  if (state.chaos) {
    // all agents respond (panel)
    for (const k of Object.keys(AI_MAP)) {
      const agent = AI_MAP[k];
      const reply = dummyReply(k, text);
      addMsg({ role: "ai", speaker: agent.label, text: reply });
    }
  } else {
    // single agent
    const agent = AI_MAP[state.mode];
    const reply = dummyReply(state.mode, text);
    addMsg({ role: "ai", speaker: agent.label, text: reply });
  }
}

/* =========================
   Clear History
========================= */
function clearHistory() {
  state.history = [];
  persist();
  el.timeline.innerHTML = "";
  systemMsg("履歴をクリアした。");
}

/* =========================
   Timeline render (on load)
========================= */
function renderHistory() {
  el.timeline.innerHTML = "";
  for (const m of state.history) {
    el.timeline.appendChild(msgBubble(m));
  }
  scrollToBottom();
}

/* =========================
   Events
========================= */
function bindEvents() {
  el.send.addEventListener("click", send);

  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  el.clear.addEventListener("click", clearHistory);

  // mode buttons
  el.modeButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  // chaos toggle
  el.chaos.addEventListener("change", (e) => setChaos(e.target.checked));

  // vote buttons
  el.timeline.addEventListener("click", (e) => {
    const up = e.target.closest("button.vote.up");
    const down = e.target.closest("button.vote.down");
    if (!up && !down) return;

    const msg = e.target.closest(".msg");
    if (!msg) return;

    const msgId = msg.dataset.id;
    addFeedback({ msgId, vote: up ? 1 : -1 });

    // UI feedback
    msg.classList.add(up ? "votedUp" : "votedDown");
    setTimeout(() => msg.classList.remove("votedUp", "votedDown"), 350);
  });
}

/* =========================
   Boot
========================= */
function boot() {
  loadAll();
  renderHeader();
  renderHistory();
  bindEvents();

  // initial system prompt
  if (state.history.length === 0) {
    systemMsg("よう、KaiGI。まずは一言くれ。");
  }
}

boot();
