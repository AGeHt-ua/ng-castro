/* /shop — каталог, кошик і відправка замовлення NG CASTRO (дані та запит замовлення — як у попередній версії shop/index.html) */
/* ==========================
   CONFIG
========================== */
const CONFIG = {
  ENDPOINT_URL: "https://api.family-castro.com",
  TIMEOUT_MS: 15000
};

const ASSET_BASE = "https://family-castro.com";
const LS_KEY = "CASTRO_ORDER_V2";

/* ==========================
   DATA
========================== */
const CATALOG = {
  "Вогнепальна зброя": [
    { id:"pistol", name:"Pistol", price:9000, img:"/guns/combat-pistol.png" },
    { id:"machine_pistol", name:"Machine Pistol", price:25000, img:"/guns/machine-pistol.png" },
    { id:"pump_shotgun", name:"Pump Shotgun", price:27500, img:"/guns/pump-shotgun.png" },
    { id:"combat_pdw", name:"Combat PDW", price:35500, img:"/guns/combat-pdw.png" },
    { id:"assault_smg", name:"Assault SMG", price:38000, img:"/guns/assault-smg.png" },
    { id:"bullpup_rifle", name:"Bullpup Rifle", price:41000, img:"/guns/bullpup-rifle.png" },
    { id:"heavy_shotgun", name:"Heavy Shotgun", price:63000, img:"/guns/heavy-shotgun.png" },
    { id:"mini_smg", name:"Mini SMG", price:35000, img:"/guns/mini-smg.png" },
    { id:"special_carbine", name:"Special Carbine", price:70000, img:"/guns/special-carbine.png" },
    { id:"special_carbine_mk2", name:"Special Carbine Mk II", price:75000, img:"/guns/special-carbine-mk2.png" },
    { id:"carbine_rifle", name:"Carbine Rifle", price:34000, img:"/guns/carbine-rifle.png" },
    { id:"pump_shotgun_mk2", name:"Pump Shotgun Mk II", price:30000, img:"/guns/pump-shotgun-mk2.png" },
    { id:"heavy_revolver", name:"Heavy Revolver", price:40000, img:"/guns/heavy-revolver.png" }
  ],
  "Ножі": [
    { id:"folding_knife", name:"Складний ніж", price:2500, img:"/guns/Stilet.png" },
    { id:"hunting_knife", name:"Мисливський ніж", price:12000, img:"/guns/knife.png" }
  ],
  "Боєприпаси": [
    { id:"ammo_9mm", name:"9mm", price:55, img:"/guns/9.png" },
    { id:"ammo_12mm", name:"12mm", price:55, img:"/guns/12.png" },
    { id:"ammo_556", name:"5.56mm", price:55, img:"/guns/5.png" },
    { id:"ammo_762", name:"7.62mm", price:55, img:"/guns/7.png" }
  ],
  "Бронежилет": [
    { id:"armor", name:"Бронежилет", price:12000, img:"/guns/armo.png" }
  ],
  "Інше": [
    { id: "small_medkit", name: "Мала аптечка", price: 1500, img: "/guns/medkit.png" },
    { id: "motuz", name: "Мотузка", price: 3500, img: "/guns/motuz.png" }
  ]
};

const DISCOUNTS_WEAPON = [
  { qty:5,  pct: 2  },
  { qty:10,  pct: 4  },
  { qty:15,  pct: 6  },
  { qty:20,  pct: 8 },
  { qty:25,  pct: 10 },
  { qty:30,  pct: 12 },
  { qty:35,  pct: 14 },
  { qty:40,  pct: 16 }
];

const DISCOUNTS_AMMO = [
  { qty:250,  pct: 4  },
  { qty:500,  pct: 6  },
  { qty:1000, pct: 10 },
  { qty:1500, pct: 15 },
  { qty:2000, pct: 18 },
  { qty:2500, pct: 20 }
];

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function money(n){
  const x = Math.round(Number(n) || 0);
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
const $ = (id) => document.getElementById(id);

/* ==========================
   ✅ WOW: Cinematic overlay controls (ORDER)
   (ported from join.html)
========================== */
const DISCORD_INVITE = "https://discord.gg/Tx4VyZSAjN";

const wowOverlay = document.getElementById("wowOverlay");
const wowOverlayFill = document.getElementById("wowOverlayFill");
const wowOverlayMain = document.getElementById("wowOverlayMain");
const wowOverlaySub  = document.getElementById("wowOverlaySub");
const wowStepsWrap   = document.getElementById("wowOverlaySteps");
const wowOverlayPct  = document.getElementById("wowOverlayPct");
const wowOverlayId   = document.getElementById("wowOverlayId");
const wowOverlayTerm = document.getElementById("wowOverlayTerm");
const wowOverlayActions = document.getElementById("wowOverlayActions");
const wowOverlayJoin = document.getElementById("wowOverlayJoin");
const wowOverlayHome = document.getElementById("wowOverlayHome");
const wowOverlayClose = document.getElementById("wowOverlayClose");

let wowTimer = null;
let wowTypingToken = 0;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const createOrderId = () =>
  `CASTRO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

const ensureOrderId = () => {
  // prefer existing state.order_id if already сформований
  const existing = String(state?.order_id || "").trim();
  if (existing) return existing;

  const next = createOrderId();
  state.order_id = next;
  return next;
};

const setOverlayProgress = (pct) => {
  const p = clamp(Math.round(pct), 0, 100);
  if (wowOverlayFill) wowOverlayFill.style.width = p + "%";
  if (wowOverlayPct) wowOverlayPct.textContent = String(p);
  const bar = wowOverlayFill?.closest?.('[role="progressbar"]');
  if (bar) bar.setAttribute("aria-valuenow", String(p));
  return p;
};

const markStep = (idx) => {
  if (!wowStepsWrap) return;
  const steps = Array.from(wowStepsWrap.querySelectorAll(".wowStep"));
  steps.forEach((s, i) => {
    s.classList.toggle("is-active", i === idx);
    s.classList.toggle("is-done", i < idx);
  });
};

const termPush = (line) => {
  if (!wowOverlayTerm) return;
  const el = document.createElement("div");
  el.className = "wowTermLine";
  el.textContent = line;
  wowOverlayTerm.appendChild(el);
  while (wowOverlayTerm.children.length > 10) wowOverlayTerm.removeChild(wowOverlayTerm.firstElementChild);
  wowOverlayTerm.scrollTop = wowOverlayTerm.scrollHeight;
};

const typeTo = (el, text, speed = 18) => {
  if (!el) return;
  const token = ++wowTypingToken;
  el.textContent = "";
  try{ el.setAttribute("data-text", text); }catch(e){}
  let i = 0;
  const tick = () => {
    if (token !== wowTypingToken) return;
    el.textContent = text.slice(0, i);
    i++;
    if (i <= text.length) setTimeout(tick, speed);
  };
  tick();
};

// ---- WebAudio: subtle scan beep ----
let audioCtx = null;
const ensureAudio = () => {
  try{
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }catch(e){}
};
const beep = (freq=740, dur=70, gain=0.02) => {
  try{
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(() => { try{o.stop()}catch(e){} }, dur);
  }catch(e){}
};

const showOverlay = () => {
  if (!wowOverlay) return;
  ensureAudio();

  wowOverlay.classList.remove("wowHidden");
  wowOverlay.classList.add("is-active");
  wowOverlay.setAttribute("aria-hidden", "false");

  const oid = ensureOrderId();
  if (wowOverlayId) wowOverlayId.textContent = oid;

  if (wowOverlayTerm) wowOverlayTerm.innerHTML = "";
  termPush(`[${oid}] BOOT :: init order protocol`);
  termPush(`AUTH :: ${window.AUTH_USER?.id ? "OK" : "WAIT"}`);

  setOverlayProgress(0);
  markStep(0);
  wowOverlayMain?.classList.remove("wowGlitch--ok", "wowGlitch--err");
  typeTo(wowOverlayMain, "Перевіряємо кошик…");
  if (wowOverlaySub) wowOverlaySub.textContent = "Готуємо замовлення до захищеної передачі.";
  document.documentElement.classList.add("wowLock");
  document.body.classList.add("protocolMode");
  if (wowOverlayJoin) wowOverlayJoin.href = DISCORD_INVITE;
  if (wowOverlayActions) wowOverlayActions.classList.add("wowHidden");
  if (wowOverlayClose) wowOverlayClose.classList.add("wowHidden");

  // Short visual timeline; real completion is controlled by the server response.
  const timeline = [
    { t: 120,  step:0, p: 18, main:"Перевіряємо кошик…", sub:"Звіряємо товари, кількість і підсумкову суму.", log:"ORDER :: verified" },
    { t: 650,  step:1, p: 54, main:"Створюємо замовлення…", sub:"Формуємо захищений пакет замовлення.", log:"ORDER :: package created" },
    { t: 1250, step:2, p: 84, main:"Передаємо менеджеру…", sub:"Очікуємо підтвердження від сервера.", log:"NET :: awaiting response" },
  ];

  if (wowTimer) { try { cancelAnimationFrame(wowTimer); } catch(e) {} }
  wowTimer = null;

  const startedAt = performance.now();
  let lastIdx = -1;

  const tick = () => {
    const now = performance.now();
    const elapsed = now - startedAt;

    let idx = -1;
    for (let i = 0; i < timeline.length; i++){
      if (elapsed >= timeline[i].t) idx = i;
    }

    if (idx !== lastIdx && idx >= 0){
      const item = timeline[idx];
      lastIdx = idx;

      markStep(item.step);
      typeTo(wowOverlayMain, item.main);
      if (wowOverlaySub) wowOverlaySub.textContent = item.sub;
      termPush(item.log);
      beep(740 + idx*60, 80, 0.018);
    }

    const curr = idx < 0 ? {t:0, p:0} : timeline[idx];
    const next = (idx+1 < timeline.length) ? timeline[idx+1] : curr;

    const segStartT = curr.t;
    const segEndT   = next.t;
    const segStartP = curr.p;
    const segEndP   = next.p;

    const x = (segEndT === segStartT) ? 1 : clamp((elapsed - segStartT) / (segEndT - segStartT), 0, 1);
    const p = segStartP + (segEndP - segStartP) * x;

    setOverlayProgress(Math.min(p, 88));

    if (elapsed > 2000 && (Math.floor(elapsed/1200) !== Math.floor((elapsed-50)/1200))) termPush("…");

    wowTimer = requestAnimationFrame(tick);
  };

  wowTimer = requestAnimationFrame(tick);
};

const hideOverlay = () => {
  if (wowTimer) { try { cancelAnimationFrame(wowTimer); } catch(e) {} }
  wowTimer = null;
  if (!wowOverlay) return;
  wowOverlay.classList.add("wowHidden");
  wowOverlay.classList.remove("is-active");
  wowOverlay.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("wowLock");
  document.body.classList.remove("protocolMode");
};

// Close button (only on error)
wowOverlayClose?.addEventListener("click", hideOverlay);

const overlaySuccess = () => {
  if (wowTimer) { try { cancelAnimationFrame(wowTimer); } catch(e) {} }
  wowTimer = null;

  markStep(3);
  setOverlayProgress(100);
  termPush("OK :: order protocol complete");

  if (wowOverlayMain) {
    wowOverlayMain.classList.add("wowGlitch--ok");
    typeTo(wowOverlayMain, "Замовлення успішно створено", 14);
  }
  if (wowOverlaySub) wowOverlaySub.textContent = "Перевір Discord. Якщо треба — надішли скрін менеджеру.";
  beep(1100, 110, 0.022);

  if (wowOverlayActions) wowOverlayActions.classList.remove("wowHidden");
};

const overlayFail = (msg) => {
  if (wowTimer) { try { cancelAnimationFrame(wowTimer); } catch(e) {} }
  wowTimer = null;

  termPush("ERR :: " + String(msg || "unknown"));
  if (wowOverlayMain) {
    wowOverlayMain.classList.add("wowGlitch--err");
    typeTo(wowOverlayMain, "⚠ Помилка протоколу", 14);
  }
  if (wowOverlaySub) wowOverlaySub.textContent = msg || "Спробуй ще раз.";
  if (wowOverlayClose) wowOverlayClose.classList.remove("wowHidden");
  beep(220, 160, 0.028);

  // Keep the error visible until the user closes it and retries.
};


/* ==========================
   DISCORD MENTION
========================== */
function parseDiscordId(input){
  const t = String(input || "").trim();
  if(!t) return null;

  let m = t.match(/^<@!?(\d{6,30})>$/);
  if(m) return m[1];

  m = t.match(/discord\.com\/users\/(\d{6,30})/i);
  if(m) return m[1];

  m = t.match(/^(\d{6,30})$/);
  if(m) return m[1];

  return null;
}

  function discordMentionFromInput(raw){
  const id = parseDiscordId(raw);
  return id ? `<@!${id}>` : "";
}

function syncDiscordMention(){
  const discVal = ($("disc")?.value || "").trim();
  const mention = discordMentionFromInput(discVal);
  const el = $("discordMention");
  if(el) el.value = mention;
}
/* ==========================
   STATE
========================== */
const state = {
  order_id: createOrderId(),
  category: null,
  item: null,
  qty: null,
  discountPct: 0,
  armorColor: "",
  cart: []
};

$("orderId").textContent = state.order_id;

const catIcons = {
  "Вогнепальна зброя": "🔫",
  "Ножі": "🗡️",
  "Боєприпаси": "📦",
  "Бронежилет": "🛡️",
  "Інше": "🧰"
};

function setStatus(msg){ $("status").textContent = msg; }

/* ==========================
   DISCOUNT HELPERS
========================== */
function getDiscountTableByCategory(cat){

  // 🔥 ІНДИВІДУАЛЬНІ ЗНИЖКИ ПО ТОВАРУ
  if(state?.item?.id === "small_medkit"){
    return [
      { qty: 5, pct: 24 },
      { qty: 10, pct: 32 },
      { qty: 15, pct: 40 }
    ];
  }

  if(state?.item?.id === "motuz"){
    return [
      { qty: 2, pct: 12 },
      { qty: 4, pct: 14 },
      { qty: 6, pct: 16 }
    ];
  }

  if(cat === "Боєприпаси") return DISCOUNTS_AMMO;

  return DISCOUNTS_WEAPON;
}
function bestDiscountForQty(cat, qty){
  const table = getDiscountTableByCategory(cat) || [];
  let best = { qty: 0, pct: 0 };

  for (const row of table) {
    if (qty >= row.qty) best = row;
  }
  return best;
}
function lineCalc(unitPrice, qty, discountPct){
  const subtotal = unitPrice * qty;
  const disc = Math.floor(subtotal * (discountPct || 0) / 100);
  const total = subtotal - disc;
  return { subtotal, disc, total };
}

/* ==========================
   PERSIST (localStorage)
========================== */
function saveLS(){
  const data = {
    v: 2,
    order_id: state.order_id,
    cart: state.cart,
    form: {
      nick: $("nick").value || "",
      disc: $("disc").value || "",
      delivery: $("delivery").value || "Самовивіз",
      note: $("note").value || ""
    }
  };
  try{ localStorage.setItem(LS_KEY, JSON.stringify(data)); }catch{}
}
function loadLS(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(!data || data.v !== 2) return;

    if(data.order_id){
      state.order_id = String(data.order_id).trim() || createOrderId();
    }

    if(data.form){
      $("nick").value = data.form.nick || "";
      $("disc").value = data.form.disc || "";
      $("delivery").value = data.form.delivery || "Самовивіз";
      $("note").value = data.form.note || "";
    }

    if(Array.isArray(data.cart)){
      state.cart = data.cart
        .filter(x=>x && x.item && x.item.id && x.item.unit_price)
        .map(x=>({
          ...x,
          qty: Math.max(1, Math.floor(Number(x.qty)||1)),
          discount_pct: Math.max(0, Math.floor(Number(x.discount_pct)||0))
        }));
    }
  }catch{}
}

/* ==========================
   CATEGORY / ITEMS
========================== */
function renderCats(){
  const wrap = $("cats");
  wrap.innerHTML = "";
  Object.keys(CATALOG).forEach(cat=>{
    const btn = document.createElement("div");
    btn.className = "chip";
    btn.dataset.cat = cat;
    btn.innerHTML = `${catIcons[cat] || "📌"} <span>${esc(cat)}</span>`;
    btn.onclick = () => selectCategory(cat);
    wrap.appendChild(btn);
  });
}
function selectCategory(cat){
  state.category = cat;
  state.item = null;
  state.qty = null;
  state.discountPct = 0;
  state.armorColor = "";
  $("armorColor").value = "";
  $("qtyCustom").value = "";

  [...$("cats").children].forEach(ch=>{
    ch.classList.toggle("active", ch.dataset.cat === cat);
  });

  $("itemsWrap").style.display = "block";
  $("qtyWrap").style.display = "none";
  $("armorWrap").style.display = (cat === "Бронежилет") ? "block" : "none";

  renderItems();
  updateAll();
  setStatus(`Категорія: ${cat}\nТепер обери товар.`);
}
function renderItems(){
  const items = CATALOG[state.category] || [];
  const wrap = $("items");
  wrap.innerHTML = "";

  items.forEach(it=>{
    const card = document.createElement("div");
    card.className = "item";
    card.dataset.item = it.id;

    card.innerHTML = `
      <div class="thumb">
        <img alt="${esc(it.name)}" src="${esc(it.img)}" loading="lazy" />
      </div>
      <div class="itm-body">
        <div class="itm-title">${esc(it.name)}</div>
        <div class="price">${money(it.price)}$ <small>/ 1 од.</small></div>
      </div>
    `;

    const img = card.querySelector("img");
    img.addEventListener("error", ()=>{
      const thumb = card.querySelector(".thumb");
      thumb.innerHTML = `<div class="muted small">Немає картинки<br><span class="mono">перевір шлях img</span></div>`;
    });

    card.onclick = () => selectItem(it.id);
    wrap.appendChild(card);
  });
}
function selectItem(itemId){
  const it = (CATALOG[state.category] || []).find(x=>x.id===itemId);
  if(!it) return;

  state.item = it;
  state.qty = null;
  state.discountPct = 0;
  $("qtyCustom").value = "";

  [...$("items").children].forEach(c=>{
    c.classList.toggle("active", c.dataset.item === itemId);
  });

  $("qtyWrap").style.display = "block";
  renderQtyPresets();
  updateAll();
  setStatus(`Товар: ${it.name}\nОбери кількість і додай у кошик.`);
}

/* ==========================
   QTY
========================== */
function renderQtyPresets(){
  const wrap = $("qtyGrid");
  wrap.innerHTML = "";
  const table = getDiscountTableByCategory(state.category);

  $("qtyHint").textContent = (state.category === "Боєприпаси")
    ? "Знижка залежить від кількості боєприпасів."
    : "Знижка залежить від кількості одиниць.";

  table.forEach(row=>{
    const b = document.createElement("div");
    b.className = "qty";
    b.dataset.qty = String(row.qty);
    const d = row.pct ? `-${row.pct}%` : "без знижки";
    b.innerHTML = `<div>${row.qty}</div><span class="d">${d}</span>`;
    b.onclick = () => {
      $("qtyCustom").value = "";
      selectQty(row.qty, row.pct);
    };
    wrap.appendChild(b);
  });
}
function selectQty(qty, pct){
  state.qty = qty;
  state.discountPct = pct;

  [...$("qtyGrid").children].forEach(c=>{
    c.classList.toggle("active", Number(c.dataset.qty) === Number(qty));
  });

  updateAll();
  setStatus(`✅ Готово до додавання\n${state.category} • ${state.item?.name}\nКількість: ${state.qty}\nЗнижка: -${state.discountPct}%`);
}
function applyCustomQty(v){
  const n = Math.max(0, Math.floor(Number(String(v).replace(/[^\d]/g,"")) || 0));
  if(!n) return;

  const best = bestDiscountForQty(state.category, n);
  state.qty = n;
  state.discountPct = best.pct || 0;

  [...$("qtyGrid").children].forEach(c=>{
    c.classList.toggle("active", Number(c.dataset.qty) === Number(best.qty));
  });

  updateAll();
  setStatus(`✅ Своя кількість\n${state.category} • ${state.item?.name}\nКількість: ${state.qty}\nЗнижка: -${state.discountPct}% (поріг ${best.qty})`);
}

/* ==========================
   CART
========================== */
function canAddLine(){
  if(!state.category || !state.item || !state.qty) return false;
  if(state.category === "Бронежилет"){
    const c = $("armorColor").value.trim();
    if(!c) return false;
    state.armorColor = c;
  }
  return true;
}

function addToCart(){
  if(!canAddLine()){
    setStatus("❌ Вибери товар/кількість. Для бронежилету — заповни колір.");
    return;
  }

  const cat = state.category;
  const it = state.item;
  const qty = Math.max(1, Math.floor(Number(state.qty)||1));
  const armorColor = (cat === "Бронежилет") ? $("armorColor").value.trim() : null;

  const keyMatch = (x) =>
    x.item.id === it.id &&
    x.category === cat &&
    (cat !== "Бронежилет" ? true : (x.armor_color || "").toLowerCase() === (armorColor || "").toLowerCase());

  const existing = state.cart.find(keyMatch);

  if(existing){
    existing.qty += qty;
    const best = bestDiscountForQty(existing.category, existing.qty);
    existing.discount_pct = best.pct || 0;
    const sums = lineCalc(existing.item.unit_price, existing.qty, existing.discount_pct);
    existing.subtotal = sums.subtotal;
    existing.discount_amount = sums.disc;
    existing.total = sums.total;
  }else{
    const best = bestDiscountForQty(cat, qty);
    const pct = best.pct || 0;
    const sums = lineCalc(it.price, qty, pct);

    state.cart.push({
      line_id: `L-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
      category: cat,
      item: {
        id: it.id,
        name: it.name,
        unit_price: it.price,
        image_url: ASSET_BASE + it.img
      },
      qty,
      discount_pct: pct,
      subtotal: sums.subtotal,
      discount_amount: sums.disc,
      total: sums.total,
      armor_color: (cat === "Бронежилет") ? armorColor : null
    });
  }

  state.qty = null;
  state.discountPct = 0;
  $("qtyCustom").value = "";
  [...$("qtyGrid").children].forEach(c=>c.classList.remove("active"));

  updateAll();
  setStatus("✅ Додано в кошик! Можеш додати ще позиції або відправити замовлення.");
}

function recalcLine(line){
  const best = bestDiscountForQty(line.category, line.qty);
  line.discount_pct = best.pct || 0;
  const sums = lineCalc(line.item.unit_price, line.qty, line.discount_pct);
  line.subtotal = sums.subtotal;
  line.discount_amount = sums.disc;
  line.total = sums.total;
}

function changeQty(lineId, delta){
  const line = state.cart.find(x => x.line_id === lineId);
  if(!line) return;
  line.qty = Math.max(1, (Number(line.qty)||1) + delta);
  recalcLine(line);
  updateAll();
}

function setQty(lineId, value){
  const line = state.cart.find(x => x.line_id === lineId);
  if(!line) return;
  const n = Math.max(1, Math.floor(Number(String(value).replace(/[^\d]/g,"")) || 1));
  line.qty = n;
  recalcLine(line);
  updateAll();
}

function splitLine(lineId){
  const line = state.cart.find(x => x.line_id === lineId);
  if(!line) return;

  const copy = JSON.parse(JSON.stringify(line));
  copy.line_id = `L-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  state.cart.push(copy);
  updateAll();
  setStatus("🧩 Позицію розділено: створено копію рядка.");
}

function removeLine(lineId){
  state.cart = state.cart.filter(x => x.line_id !== lineId);
  updateAll();
  setStatus("🗑️ Позицію видалено з кошика.");
}

function clearCart(){
  state.cart = [];
  updateAll();
  setStatus("🧺 Кошик очищено.");
}

function renderCart(){
  const wrap = $("cart");
  wrap.innerHTML = "";

  if(!state.cart.length){
    wrap.innerHTML = `<div class="cartEmpty">Кошик порожній. Додай товари зліва.</div>`;
    return;
  }

  state.cart.forEach(line=>{
    const dtxt = line.discount_pct ? `-${line.discount_pct}% (${money(line.discount_amount)}$)` : `0% (0$)`;
    const armor = (line.category === "Бронежилет" && line.armor_color) ? ` • 🎨 ${esc(line.armor_color)}` : "";

    const div = document.createElement("div");
    div.className = "cartItem";
    div.innerHTML = `
      <div class="cartL">
        <div class="cartTitle">${catIcons[line.category] || "📌"} ${esc(line.item.name)}</div>
        <div class="cartMeta">
          <div>${esc(line.category)}${armor}</div>
          <div>
            <span class="mono">${money(line.item.unit_price)}$</span>
            ×
            <span class="mono">${line.qty}</span>
            • знижка: <span class="mono">${dtxt}</span>
          </div>
        </div>
      </div>

      <div class="cartR">
        <div class="cartPrice">${money(line.total)}$</div>

        <div class="qtyPill" title="Кількість">
          <div class="miniBtn" data-act="dec">➖</div>
          <div class="q mono">${line.qty}</div>
          <div class="miniBtn" data-act="inc">➕</div>
        </div>

        <div class="miniRow">
          <div class="miniBtn" data-act="edit" title="Ввести кількість">✍️</div>
          <div class="miniBtn" data-act="split" title="Розділити (створити копію рядка)">🧩</div>
          <div class="miniBtn danger" data-act="del" title="Видалити">🗑️</div>
        </div>
      </div>
    `;

    div.querySelector('[data-act="dec"]').onclick = () => changeQty(line.line_id, -1);
    div.querySelector('[data-act="inc"]').onclick = () => changeQty(line.line_id, +1);
    div.querySelector('[data-act="del"]').onclick = () => removeLine(line.line_id);
    div.querySelector('[data-act="split"]').onclick = () => splitLine(line.line_id);

    div.querySelector('[data-act="edit"]').onclick = () => {
      const v = prompt("Введи нову кількість:", String(line.qty));
      if(v === null) return;
      setQty(line.line_id, v);
    };

    wrap.appendChild(div);
  });
}

function cartTotals(){
  const lines = state.cart.length;
  const subtotal = state.cart.reduce((s,x)=>s+(Number(x.subtotal)||0),0);
  const discount = state.cart.reduce((s,x)=>s+(Number(x.discount_amount)||0),0);
  const total = state.cart.reduce((s,x)=>s+(Number(x.total)||0),0);
  return { lines, subtotal, discount, total };
}

function isValidToSend(){
  // 🔐 MUST BE LOGGED IN
  if(!window.AUTH_USER) return false;

  const nick = $("nick").value.trim();
  const disc = $("disc").value.trim();
  if(!nick || !disc) return false;
  if(!state.cart.length) return false;
  return true;
}

function updateReceipt(){
  const t = cartTotals();
  $("rLines").textContent = t.lines ? `${t.lines}` : "—";
  $("rSub").textContent = t.lines ? `${money(t.subtotal)}$` : "—";
  $("rDisc").textContent = t.lines ? `${money(t.discount)}$` : "—";
  $("rTotal").textContent = t.lines ? `${money(t.total)}$` : "—";

  // ⚠️ ВАЖЛИВО: кнопка залежить від isValidToSend()
  $("sendBtn").disabled = !isValidToSend();
}
  
function updateAddBtn(){
  $("addToCartBtn").disabled = !canAddLine();
}

// Текст користувача в повідомленні Discord: без markdown, @everyone/@here і тегів.
function discordSafe(s, { multiline = false } = {}){
  let t = String(s ?? "")
    .replace(/([\\`*_~|>#\[\]()-])/g, "\\$1")
    .replace(/@/g, "@​")
    .replace(/<(?=[@#:a])/g, "<​");
  t = multiline ? t.replace(/\n{3,}/g, "\n\n") : t.replace(/\s*\n\s*/g, " ");
  return t.trim().slice(0, multiline ? 1000 : 120);
}

function buildDiscordPreview(payload){
  const lines = payload.items.map((x)=>{
    const armor = (x.category === "Бронежилет" && x.armor_color) ? ` | 🎨 ${discordSafe(x.armor_color)}` : "";
    const d = x.discount_pct ? ` (-${x.discount_pct}%)` : "";
    return `• **${discordSafe(x.item.name)}** (${discordSafe(x.category)}${armor}) — \`${x.qty}\` × \`${money(x.item.unit_price)}$\`${d} = **${money(x.total)}$**`;
  });

  const header =
`🧾 **Нове оптове замовлення**
🆔 \`${payload.order_id}\`
👤 **${discordSafe(payload.buyer.nick_static)}**
💬 **Discord:** \`${payload.buyer.discord}\`
🚚 **Отримання:** ${discordSafe(payload.delivery)}`;

  const footer =
`━━━━━━━━━━━━━━
📦 Позицій: **${payload.totals.lines}**
💰 Сума: **${money(payload.totals.subtotal)}$**
💸 Знижка: **${money(payload.totals.discount_amount)}$**
✅ До сплати: **${money(payload.totals.total)}$**
${payload.note ? `🗺️ **Деталі:** ${discordSafe(payload.note, { multiline: true })}` : ""}`.trim();

  return { content: `${header}\n\n${lines.join("\n")}\n\n${footer}`.trim(), lines };
}

let sending = false;

async function sendOrder(){
  // 🔐 AUTH CHECK
  if (!window.AUTH_USER) {
    setStatus("⛔ Спочатку увійди через Discord.");
    return;
  }

  // Не довіряємо localStorage: без підтвердженого сервером профілю не відправляємо.
  try {
    const profile = await window.CastroProfile?.loadProfile?.();
    if (!String(profile?.ic || "").trim() || !String(profile?.sid || "").trim()) {
      setStatus("⛔ Спочатку заповни профіль (IC та Static ID).");
      return;
    }
  } catch {
    setStatus("⛔ Не вдалося перевірити профіль. Спробуй ще раз.");
    return;
  }

  if (sending) return;

  if(!isValidToSend()){
    setStatus("❌ Заповни Nick/Discord і додай хоча б 1 позицію в кошик.");
    return;
  }

  sending = true;
  $("sendBtn").disabled = true;
  showOverlay();

  const nick = $("nick").value.trim();
  const disc = $("disc").value.trim();
  const delivery = $("delivery").value;
  const note = $("note").value.trim();
  const totals = cartTotals();

  const payload = {
    order_id: state.order_id,
    created_at: new Date().toISOString(),
    buyer: {
      nick_static: nick,
      discord: disc,
      discordMention: ($("discordMention")?.value || "").trim()
    },
    items: state.cart.map(x => ({
      line_id: x.line_id,
      category: x.category,
      item: x.item,
      qty: x.qty,
      discount_pct: x.discount_pct,
      subtotal: x.subtotal,
      discount_amount: x.discount_amount,
      total: x.total,
      armor_color: x.armor_color || null
    })),
    totals: {
      lines: totals.lines,
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      total: totals.total
    },
    delivery,
    note
  };

  payload.discord_preview = buildDiscordPreview(payload);

  setStatus("⏳ Відправляю в Discord...");

  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), CONFIG.TIMEOUT_MS);

  try{
    const resp = await fetch(CONFIG.ENDPOINT_URL + "/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    const text = await resp.text().catch(()=> "");
    if(!resp.ok){
      setStatus(`❌ Помилка від сервера: ${resp.status}\n${text || ""}`.trim());
      sending = false;
      updateReceipt();
      saveLS();
      return;
    }
overlaySuccess();
    setStatus(
      `✅ Відправлено!\norder_id: ${state.order_id}\nПозицій: ${totals.lines}\nСума до сплати: ${money(totals.total)}$`
    );

    // очистка після успіху
    state.cart = [];
    state.order_id = createOrderId();
    $("orderId").textContent = state.order_id;
    updateAll();
    saveLS();

    sending = false;
    updateReceipt();
  }catch(err){
    clearTimeout(timer);
    overlayFail(`❌ Не вдалося відправити.\n${String(err)}`);
    setStatus(`❌ Не вдалося відправити.\n${String(err)}`);
    sending = false;
    updateReceipt();
    saveLS();
  }
}



function resetPick(){
  state.item = null;
  state.qty = null;
  state.discountPct = 0;
  $("qtyCustom").value = "";
  $("armorColor").value = "";
  $("qtyWrap").style.display = "none";
  [...$("items").children].forEach(c=>c.classList.remove("active"));
  setStatus("↩️ Вибір скинуто. Обери товар заново.");
  updateAll();
}

function updateAll(){
  renderCart();
  updateReceipt();
  updateAddBtn();
  saveLS();
}

/* EVENTS */
$("nick").addEventListener("input", updateAll);
$("disc").addEventListener("input", ()=>{ syncDiscordMention(); updateAll(); });
syncDiscordMention();
$("delivery").addEventListener("change", updateAll);
$("note").addEventListener("input", updateAll);
$("armorColor").addEventListener("input", ()=>{ updateAddBtn(); saveLS(); });

$("qtyCustom").addEventListener("input", (e)=>{
  const v = e.target.value;
  if(!v) return;
  if(!state.category || !state.item) return;
  applyCustomQty(v);
  updateAddBtn();
  saveLS();
});

$("addToCartBtn").addEventListener("click", addToCart);
$("resetPickBtn").addEventListener("click", resetPick);
$("clearCartBtn").addEventListener("click", clearCart);
$("sendBtn").addEventListener("click", sendOrder);

/* INIT */
loadLS();
syncDiscordMention();
renderCats();
updateAll();

// ---------- Відгуки: кількість і середній рейтинг ----------
(async function updateReviewsStats(){
  try{
    const res = await fetch("https://api.family-castro.com/reviews?t=" + Date.now(), { cache: "no-store" });
    const json = await res.json();
    const reviews = Array.isArray(json?.reviews) ? json.reviews : (Array.isArray(json) ? json : []);

    const count = reviews.length;
    const elCount = document.getElementById("reviewsBadge");
    if(elCount) elCount.textContent = String(count);

    const rated = reviews.filter(r => Number(r.rate) >= 1 && Number(r.rate) <= 5);
    const avg = rated.length ? (rated.reduce((s, x) => s + Number(x.rate), 0) / rated.length) : null;

    const elAvg = document.getElementById("avgRating");
    if(elAvg){
      if(avg){
        const rounded = avg.toFixed(2);
        elAvg.textContent = `${rounded} / 5`;
      } else {
        elAvg.textContent = `— / 5`;
      }
    }
  }catch(e){}
})();
