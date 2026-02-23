/* ai-kaigi — dummy chat engine (later replace with real API)
   Goals:
   - iOS tap-safe send
   - Rooms (All / 愛 / 仁 / 統合)
   - LocalStorage history
*/

const $ = (s) => document.querySelector(s);

const timeline = $("#timeline");
const input = $("#input");
const sendBtn = $("#sendBtn");
const tabs = $("#tabs");

const modal = $("#modal");
const modalBackdrop = $("#modalBackdrop");
const modalClose = $("#modalClose");
const apiBtn = $("#apiBtn");
const menuBtn = $("#menuBtn");
const clearBtn = $("#clearBtn");

const STORAGE_KEY = "ai-kaigi-history-v1";
const STORAGE_ROOM = "ai-kaigi-room-v1";

const ROOM_META = {
  all:  { label: "All",  avatar: { text: "All", cls: "sync" }, name: "統合" },
  love: { label: "愛",   avatar: { text: "愛",  cls: "love" }, name: "愛（Claude）" },
  jin:  { label: "仁",   avatar: { text: "仁",  cls: "jin"  }, name: "仁（ChatGPT）" },
  sync: { label: "統合", avatar: { text: "統",  cls: "sync" }, name: "統合" },
};

let activeRoom = loadRoom() || "all";
let history = loadHistory(); // [{id, room, role, text, ts}]

init();

function init(){
  // Set active tab
  setActiveTab(activeRoom);

  // Render
  render();

  // Events
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    activeRoom = btn.dataset.room;
    saveRoom(activeRoom);
    setActiveTab(activeRoom);
    render(true);
  });

  sendBtn.addEventListener("click", () => submit());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  // Modal open
  apiBtn.addEventListener("click", openModal);
  menuBtn.addEventListener("click", openModal);
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);

  clearBtn.addEventListener("click", () => {
    history = [];
    saveHistory(history);
    render(true);
    closeModal();
  });

  // Prevent iOS weird selection on double tap
  document.addEventListener("gesturestart", (e) => e.preventDefault?.(), { passive: false });

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // First hint message (only if empty)
  if (history.length === 0){
    pushMsg("bot", "ようこそ、中原。ここは ai-kaigi。\n“高級感のある、不思議なメッセージアプリ”として育てていこう。", "love");
    pushMsg("bot", "今はダミー応答。UIを固めたら本物のAI（API）に繋げる。", "jin");
    saveHistory(history);
    render(true);
  }
}

function submit(){
  const text = (input.value || "").trim();
  if (!text) return;

  // Add user message
  pushMsg("user", text, activeRoom === "all" ? "all" : activeRoom);

  input.value = "";
  input.blur(); // iOS: close keyboard sometimes improves tap issues

  saveHistory(history);
  render(true);

  // Bot reply (dummy)
  setTimeout(() => {
    const replyRoom = activeRoom === "all" ? pickBotRoom() : activeRoom;
    const reply = dummyReply(text, replyRoom);
    pushMsg("bot", reply, replyRoom);
    saveHistory(history);
    render(true);
  }, 180);
}

function pickBotRoom(){
  // rotate between love & jin for “All”
  const lastBot = [...history].reverse().find(m => m.role === "bot");
  if (!lastBot) return "love";
  return lastBot.room === "love" ? "jin" : "love";
}

function dummyReply(userText, room){
  const who = room === "love" ? "愛" : room === "jin" ? "仁" : "統合";
  const t = userText.toLowerCase();

  // a little “mystic”
  if (t.includes("デザイン") || t.includes("ui") || t.includes("フォント")){
    return `${who}：紫の“気配”を濃くする。角は丸く、影は深く、文字は静かに。\n今の方向性、かなり良い。`;
  }
  if (t.includes("api") || t.includes("接続")){
    return `${who}：まず見た目を完成させる。それから“本物”を注ぐ。\n順番が美しい。`;
  }
  if (t.includes("送信") || t.includes("押せない")){
    return `${who}：送信ボタンは fixed + z-index 最上位。\niPhoneでも押せる設計にしてある。`;
  }

  return `${who}：受け取った。\n「${userText}」\n…この言葉、少しだけ光ってる。`;
}

function pushMsg(role, text, room){
  history.push({
    id: cryptoId(),
    room,
    role, // "user" | "bot"
    text,
    ts: Date.now()
  });
}

function render(scrollToBottom=false){
  // Filter by room
  const filtered = history.filter(m => {
    if (activeRoom === "all") return true;
    return m.room === activeRoom;
  });

  timeline.innerHTML = "";

  for (const m of filtered){
    const node = renderMsg(m);
    timeline.appendChild(node);
  }

  if (scrollToBottom){
    requestAnimationFrame(() => {
      timeline.scrollTop = timeline.scrollHeight;
    });
  }
}

function renderMsg(m){
  const wrap = document.createElement("div");
  wrap.className = `msg ${m.role === "user" ? "user" : "bot"}`;

  if (m.role === "bot"){
    const meta = ROOM_META[m.room] || ROOM_META.all;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${meta.avatar.cls}`;
    avatar.textContent = meta.avatar.text;

    const box = document.createElement("div");
    box.className = "meta";

    const name = document.createElement("div");
    name.className = "meta__name";
    name.textContent = meta.name;

    const bubble = document.createElement("div");
    bubble.className = "bubble bot";
    bubble.textContent = m.text;

    box.appendChild(name);
    box.appendChild(bubble);

    wrap.appendChild(avatar);
    wrap.appendChild(box);
    return wrap;
  }

  // user
  const bubble = document.createElement("div");
  bubble.className = "bubble user";
  bubble.textContent = m.text;
  wrap.appendChild(bubble);
  return wrap;
}

function setActiveTab(room){
  [...tabs.querySelectorAll(".tab")].forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.room === room);
  });
}

function openModal(){
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

/* ---- storage ---- */
function loadHistory(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(x => x && typeof x.text === "string" && typeof x.role === "string");
  }catch{
    return [];
  }
}
function saveHistory(list){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }catch{}
}
function loadRoom(){
  try{ return localStorage.getItem(STORAGE_ROOM); }catch{ return null; }
}
function saveRoom(room){
  try{ localStorage.setItem(STORAGE_ROOM, room); }catch{}
}

/* ---- utils ---- */
function cryptoId(){
  // lightweight id
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
