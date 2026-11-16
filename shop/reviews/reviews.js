/* /shop/reviews — завантаження, фон і відправка відгуків (перенесено з shop/reviews/index.html без змін) */
const REVIEWS_API = "https://api.family-castro.com/reviews";
const $ = (id) => document.getElementById(id);

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function prefillFromQuery(){
  const qs = new URLSearchParams(location.search);
  const nick = qs.get("nick") || "";
  const disc = qs.get("disc") || "";
  if(nick) $("nick").value = nick;
  if(disc) $("disc").value = disc;
}

function formatWhen(v){
  if(!v) return "";
  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

// ⭐ Average stars (rounded to nearest 0.5)
function toStars(avg){
  if(!Number.isFinite(avg) || avg <= 0) return "—";
  const half = Math.round(avg * 2) / 2;
  const full = Math.floor(half);
  const hasHalf = (half - full) === 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return "★".repeat(full) + (hasHalf ? "⯨" : "") + "☆".repeat(empty);
}

function buildAvatarUrl(did, av){
  if(did && av) return `https://cdn.discordapp.com/avatars/${did}/${av}.png?size=96`;
  if(did) return `https://cdn.discordapp.com/embed/avatars/${(Number(did) % 5)}.png?size=96`;
  return "";
}

function renderReviewCard(x, idx, total){
  const nick = x.nick || "—";
  const disc = x.discord || "—";
  const text = x.text || "";
  const stars = Math.max(0, Math.min(5, Number(x.rate || 0)));
  const when = formatWhen(x.created_at);
  const initials = (String(nick).trim().slice(0,1) || "★").toUpperCase();

  // Try to get discord identity fields from backend
  const authUser = window.AUTH_USER || window.__CASTRO_AUTH__?.user;
  const authId = authUser?.id || authUser?.user_id || "";
  const authAvatar = authUser?.avatar || authUser?.avatar_hash || "";
  const authName = String(authUser?.username || authUser?.global_name || authUser?.name || "").toLowerCase();

  const discStr = String(disc || "").trim();
  const discNorm = discStr.startsWith("@") ? discStr.slice(1) : discStr;
  const matchesAuth = !!(authId && (
    discStr.includes(authId) ||
    discNorm.toLowerCase() === authName
  ));

  const did = x.discord_id || x.user_id || x.discordUserId || (matchesAuth ? authId : "");
  const av  = x.discord_avatar || x.avatar || x.discordAvatar || (matchesAuth ? authAvatar : "");
  const avatarUrl = buildAvatarUrl(did, av);

  const card = document.createElement("article");
  card.className = "reviewItem";

  card.innerHTML = `
    <div class="reviewGlow" aria-hidden="true"></div>

    <div class="reviewHead">
      <div class="reviewLeft">
        <div class="reviewAvatar">
          ${avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="" />`
            : `<div class="reviewAvatarFallback">${escapeHtml(initials)}</div>`
          }
        </div>

        <div class="reviewIdentity">
          <div class="reviewName">${escapeHtml(nick)}</div>
          <div class="reviewDisc">${escapeHtml(disc)}</div>
        </div>
      </div>

      <div class="reviewRight">
        <div class="reviewBadge">#${total - idx}</div>
        ${when ? `<div class="reviewTime">🕒 ${escapeHtml(when)}</div>` : ``}
      </div>
    </div>

    <div class="reviewStars" aria-label="Оцінка">
      ${stars
        ? `<span class="starsOn">${"★".repeat(stars)}</span><span class="starsOff">${"☆".repeat(5 - stars)}</span>`
        : `<span class="starsOff">—</span>`
      }
    </div>

    <div class="reviewText">${escapeHtml(text)}</div>
  `;

  return card;
}

function renderBackgroundReviews(data){
  const host = document.getElementById("bgReviews");
  if(!host) return;

  host.innerHTML = "";

  // Беремо тільки нормальні відгуки (з текстом) і обмежуємо кількість
  const pool = (data || [])
    .filter(x => (x?.text || "").trim().length >= 3)
    .slice(0, 30);

  if(!pool.length) return;

  const W = window.innerWidth;
  const H = window.innerHeight;

  // Скільки карточок у фоні
  const count = Math.min(8, Math.max(4, Math.floor(W / 260)));

  for(let i=0;i<count;i++){
    const x = pool[Math.floor(Math.random() * pool.length)];

    const nick = x.nick || "—";
    const text = (x.text || "").trim();
    const stars = Math.max(0, Math.min(5, Number(x.rate || 0)));

    // avatar (як у тебе)
    const did = x.discord_id || x.user_id || "";
    const av  = x.discord_avatar || x.avatar || "";
    const avatarUrl = (did && av)
      ? `https://cdn.discordapp.com/avatars/${did}/${av}.png?size=96`
      : (did ? `https://cdn.discordapp.com/embed/avatars/${(Number(did) % 5)}.png?size=96` : "");

    const card = document.createElement("div");
    card.className = "bgReview";

    // позиція (рандом, але не перекриває центр занадто сильно)
    const left = Math.round(Math.random() * (W - Math.min(520, W*0.7)));
    const top  = Math.round(Math.random() * (H - 220));

    card.style.left = left + "px";
    card.style.top  = top + "px";

    // тривалість + затримка (щоб не з’являлись всі разом)
    const dur = 14 + Math.random() * 10;      // 14-24s
    const delay = Math.random() * 8;          // 0-8s
    card.style.animation = `bgFadeFloat ${dur}s ease-in-out ${delay}s infinite`;

    card.innerHTML = `
      <div class="bgReview__head">
        <div class="bgReview__avatar">
          ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="">` : ``}
        </div>
        <div class="bgReview__name">${escapeHtml(nick)}</div>
        <div class="bgReview__stars">${stars ? "★".repeat(stars) : "—"}</div>
      </div>
      <div class="bgReview__text">${escapeHtml(text)}</div>
    `;

    host.appendChild(card);
  }
}

window.addEventListener("resize", () => {
  // легкий debounce
  clearTimeout(window.__bgRsz);
  window.__bgRsz = setTimeout(() => {
    // перегенериться при наступному loadReviews, або збережи lastData якщо хочеш
    loadReviews();
  }, 250);
});
  
async function loadReviews(){
  const wrap = $("rList");
  wrap.innerHTML = "";

  try{
    const url = REVIEWS_API + "?t=" + Date.now();
    const r = await fetch(url, {
      method:"GET",
      cache:"no-store",
      credentials:"include"   // 🔥
    });

    const ct = r.headers.get("content-type") || "";
    const json = ct.includes("application/json") ? await r.json() : null;

    const data = Array.isArray(json?.reviews) ? json.reviews : (Array.isArray(json) ? json : []);
    $("rCount").textContent = data.length ? `${data.length}` : "0";

    const rates = data.map(x => Number(x.rate || 0)).filter(n => n > 0);
    const avg = rates.length ? (rates.reduce((a,b)=>a+b,0)/rates.length) : 0;

    $("avgRate").textContent = rates.length ? avg.toFixed(2) : "—";
    $("avgStars").textContent = toStars(avg);

    // 🔥 ФОН ТЕПЕР ГЕНЕРУЄТЬСЯ ЗАВЖДИ
    renderBackgroundReviews(data);

    if(!data.length){
      wrap.innerHTML = `<div class="reviewsEmpty">Поки відгуків немає. Будь першим 🙂</div>`;
      return;
    }

    // Від нових до старих
    data
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach((x, idx) => wrap.appendChild(renderReviewCard(x, idx, data.length)));

  }catch(err){
    console.error("loadReviews error:", err);
    $("rCount").textContent = "0";
    $("avgRate").textContent = "—";
    $("avgStars").textContent = "—";
    wrap.innerHTML = `<div class="reviewsEmpty">❌ Не вдалося завантажити відгуки.</div>`;
  }
}

async function sendReview(){
  const authUser = window.AUTH_USER || window.__CASTRO_AUTH__?.user;
  if (!authUser) {
    $("rStatus").textContent = "⛔ Спочатку увійди через Discord.";
    return;
  }
  try {
    const profile = await window.CastroProfile?.loadProfile?.();
    if (!String(profile?.ic || "").trim() || !String(profile?.sid || "").trim()) {
      $("rStatus").textContent = "⛔ Спочатку заповни профіль (IC та Static ID).";
      return;
    }
  } catch {
    $("rStatus").textContent = "⛔ Не вдалося перевірити профіль. Спробуй ще раз.";
    return;
  }

  const nick = $("nick").value.trim();
  const disc = $("disc").value.trim();
  const text = $("rText").value.trim();
  const rate = $("rRate").value;

  if(!nick || !disc || !text || Number(rate) < 1){
    $("rStatus").textContent = "❌ Заповни Nick / Discord / Відгук і постав зірочки.";
    return;
  }

  $("rSend").disabled = true;
  $("rStatus").textContent = "⏳ Відправляю...";

  const fd = new FormData();
  fd.append("nick", nick);
  fd.append("discord", disc);
  fd.append("text", text);
  fd.append("rate", rate);

  // ✅ attach Discord identity for avatar rendering (backend may store these)
  const user = window.AUTH_USER || window.__CASTRO_AUTH__?.user;
  const discordId = user?.id || user?.user_id || "";
  const discordAvatar = user?.avatar || user?.avatar_hash || "";
  if(discordId) fd.append("discord_id", discordId);
  if(discordAvatar) fd.append("discord_avatar", discordAvatar);

  try{
    const res = await fetch(REVIEWS_API, {
      method: "POST",
      body: fd,
      credentials: "include"   // 🔥 ОБОВ'ЯЗКОВО
    });
    const outText = await res.text().catch(()=> "");

    if(!res.ok){
      $("rStatus").textContent = `❌ Помилка: ${res.status} ${outText}`;
      $("rSend").disabled = false;
      return;
    }

    $("rStatus").textContent = "✅ Дякую! Відгук додано.";
    $("rText").value = "";
    $("rRate").value = "0";
    stars.forEach(s => s.classList.remove("active"));
    const rn = document.getElementById("rateNum");
    if(rn) rn.textContent = "0";
    $("rSend").disabled = false;

    await loadReviews();
    setTimeout(loadReviews, 1200);
  }catch(err){
    console.error("sendReview error:", err);
    $("rStatus").textContent = "❌ Помилка відправки (перевір консоль).";
    $("rSend").disabled = false;
  }
}

// ⭐ Star rating logic
const stars = [...document.querySelectorAll("#rStars span")];
const rateInput = document.getElementById("rRate");
const rateNumEl = document.getElementById("rateNum");

function paint(val){
  stars.forEach(s => {
    const v = Number(s.dataset.val);
    s.classList.toggle("active", v <= val);
  });
}
function setRate(val){
  rateInput.value = String(val);
  if(rateNumEl) rateNumEl.textContent = String(val);
  paint(val);
}
function getRate(){
  return Number(rateInput.value || 0);
}

setRate(getRate());

stars.forEach(star => {
  const v = Number(star.dataset.val);
  star.addEventListener("mouseenter", () => paint(v));
  star.addEventListener("click", () => setRate(v));
});

document.getElementById("rStars").addEventListener("mouseleave", () => {
  paint(getRate());
});

$("rSend").addEventListener("click", sendReview);

function normalizeMention(s){
  const v = String(s || "").trim();
  if(!v) return "";
  const m = v.match(/^<@!?(\d+)>$/);
  if(m) return `<@${m[1]}>`;
  if(/^\d{6,}$/.test(v)) return `<@${v}>`;
  return v.startsWith("@") ? v : v;
}

const LS_ORDER = "CASTRO_ORDER_V2";
const LS_REV   = "CASTRO_REVIEWS_V1";

function readLS(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}

function saveReviewsLS(){
  try{
    localStorage.setItem(LS_REV, JSON.stringify({
      v: 1,
      nick: ($("nick")?.value || "").trim(),
      disc: ($("disc")?.value || "").trim()
    }));
  }catch{}
}

function prefillFromOrderLS(){
  const data = readLS(LS_ORDER);
  const nick = data?.form?.nick ? String(data.form.nick).trim() : "";
  const disc = data?.form?.disc ? String(data.form.disc).trim() : "";
  return { nick, disc };
}

function prefillFromReviewsLS(){
  const data = readLS(LS_REV);
  const nick = data?.nick ? String(data.nick).trim() : "";
  const disc = data?.disc ? String(data.disc).trim() : "";
  return { nick, disc };
}

function prefillFromProfileModal(){
  const ic  = (document.getElementById("pf-ic")?.value || "").trim();
  const sid = (document.getElementById("pf-sid")?.value || "").trim();
  if(ic && sid) return `${ic} | ${sid}`;
  if(ic) return ic;
  return "";
}

function applyMention(){
  const discEl = $("disc");
  const mentionEl = $("discordMention");
  if(!discEl || !mentionEl) return;
  mentionEl.value = normalizeMention(discEl.value);
}

function prefillAutofill(){
  const nickEl = $("nick");
  const discEl = $("disc");
  if(!nickEl || !discEl) return;

  const orderLS = prefillFromOrderLS();
  const revLS = prefillFromReviewsLS();
  const profileNick = prefillFromProfileModal();

  if(!nickEl.value.trim()){
    nickEl.value = orderLS.nick || revLS.nick || profileNick || "";
  }

  if(!discEl.value.trim()){
    discEl.value = orderLS.disc || revLS.disc || "";
  }

  applyMention();
}

$("nick")?.addEventListener("input", () => {
  saveReviewsLS();
});

$("disc")?.addEventListener("input", () => {
  applyMention();
  saveReviewsLS();
});

document.getElementById("pf-save")?.addEventListener("click", () => {
  setTimeout(prefillAutofill, 50);
});

prefillFromQuery();
prefillAutofill();
loadReviews();

// ---------- Підказка авторизації ----------
(function(){
  async function hasProfileIC(){
    const api = window.CastroProfile;
    if (!api?.loadProfile) return false;
    try {
      const profile = await api.loadProfile();
      return !!(String(profile?.ic || "").trim() && String(profile?.sid || "").trim());
    } catch {
      return false;
    }
  }

  async function renderAuthHint(){
    const hint = document.getElementById("authHint");
    const text = document.getElementById("authHintText");
    const actions = document.getElementById("authHintActions");
    if(!hint || !text || !actions) return;

    const user = window.AUTH_USER || window.__CASTRO_AUTH__?.user;
    actions.innerHTML = "";
    hint.hidden = false;

    if(!user){
      text.innerHTML = "<b>Крок 1 з 2:</b> увійди через Discord. Після входу потрібно один раз вказати IC ім’я та Static ID у профілі.";
      actions.innerHTML = `
        <button class="authHint__btn"
          onclick="document.getElementById('auth-login')?.click()">
          🔐 Авторизуватись
        </button>
      `;
      return;
    }

    if(!(await hasProfileIC())){
      text.innerHTML = "<b>Крок 2 з 2:</b> профіль не завершений. Відкрий його, введи Ім’я Прізвище персонажа та числовий Static ID, потім натисни «Зберегти».";
      actions.innerHTML = `
        <button class="authHint__btn"
          onclick="openProfileSetup()">
          🛠️ Відкрити та заповнити профіль
        </button>
      `;
      return;
    }

    // Профіль підтверджено API — службова підказка більше не потрібна.
    hint.hidden = true;
  }

  window.addEventListener("castro-auth", renderAuthHint);
  window.addEventListener("castro-profile", renderAuthHint);
  document.addEventListener("DOMContentLoaded", renderAuthHint);
})();
