// CASTRO: Empire — серверна економіка гри.
// Сервер — єдине джерело правди: гроші нараховуються за часом тут, клієнт лише показує.

export const OFFLINE_CAP_SECONDS = 8 * 60 * 60; // офлайн-дохід максимум за 8 годин
export const START_CASH = 50;
export const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400];
export const MAX_LEVEL = 500;

export const BUSINESSES = [
  { id: "wash",   name: "Автомийка «Блиск»",       short: "Автомийка", icon: "🧽", color: "#3fb6ff", unlock: 0,          income: 1,      upBase: 15,        growth: 1.17,
    desc: "Перший бізнес сімʼї. Чисті тачки — чисті гроші." },
  { id: "garage", name: "СТО «Castro Motors»",      short: "СТО",       icon: "🔧", color: "#ffb02e", unlock: 2500,       income: 8,      upBase: 260,       growth: 1.19,
    desc: "Ремонт, тюнінг і запчастини для всього Лос-Сантоса." },
  { id: "club",   name: "Клуб «Castro Lounge»",     short: "Клуб",      icon: "🍸", color: "#c04bff", unlock: 150000,     income: 70,     upBase: 18000,     growth: 1.21,
    desc: "Найгучніші вечірки Вайнвуда. VIP-зона — тільки для своїх." },
  { id: "dealer", name: "Автосалон «Vinewood Cars»", short: "Автосалон", icon: "🚘", color: "#22c55e", unlock: 12000000,   income: 640,    upBase: 1500000,   growth: 1.23,
    desc: "Преміум-авто для тих, хто не питає ціну." },
  { id: "port",   name: "Порт і склади",            short: "Порт",      icon: "⚓", color: "#ff5a3c", unlock: 1.2e9,      income: 6000,   upBase: 1.5e8,     growth: 1.25,
    desc: "Контейнери з усього світу. Логістика — серце імперії." },
  { id: "hangar", name: "Ангар і гелікоптери",      short: "Ангар",     icon: "🚁", color: "#f2c14e", unlock: 1.5e11,     income: 60000,  upBase: 2e10,      growth: 1.27,
    desc: "Bell 429 на злітці. Імперія виходить у небо." },
];
const BY_ID = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));

// Особняк (штаб) — глобальний множник доходу.
export const HQ_MAX = 10;
export const hqCost = (hq) => Math.round(250000 * Math.pow(12, hq - 1)); // ціна переходу hq → hq+1
export const hqMult = (hq) => 1 + 0.5 * (hq - 1);

export const RANKS = [
  { min: 0, name: "Новачок" },
  { min: 2e4, name: "Боєць" },
  { min: 1e6, name: "Солдат" },
  { min: 1e8, name: "Капо" },
  { min: 1e10, name: "Консильєрі" },
  { min: 1e12, name: "Заступник Дона" },
  { min: 1e14, name: "Дон" },
];
export const rankFor = (earned) => {
  let index = 0;
  RANKS.forEach((r, i) => { if (earned >= r.min) index = i; });
  return { index, name: RANKS[index].name, next: RANKS[index + 1] || null };
};

// ---------- Події: бізнес стає (простій), поки гравець не вирішить проблему ----------
export const INCIDENTS = {
  wash: {
    type: "sick",
    icon: "🤒",
    title: "Мийник захворів",
    text: "Тоні звалила застуда — нікому мити авто. Автомийка стоїть і не приносить дохід.",
    action: "Підмінити Тоні",
    game: "carwash",
    meanHours: 3,          // у середньому раз на 3 години
    minLevel: 5,           // не раніше 5 рівня мийки
    cooldownMinutes: 30,   // після вирішення — пауза
    hireMinutes: 20,       // найм підміни = 20 хв загального доходу
    bonusMinutes: 10,      // бонус за міні-гру = до 10 хв доходу мийки
    passScore: 70,
  },
};
export const GRACE_MINUTES = 15;           // нові гравці — без подій перші 15 хв
export const GAME_MIN_SECONDS = 8;
export const GAME_MAX_SECONDS = 300;

export const milestoneMult = (level) => Math.pow(2, MILESTONES.filter((m) => level >= m).length);
export const businessIncome = (b, level) => (level > 0 ? b.income * level * milestoneMult(level) : 0);
// ціна переходу level → level+1 (для level 0 — розблокування)
export const levelCost = (b, level) => (level <= 0 ? b.unlock : Math.round(b.upBase * Math.pow(b.growth, level - 1)));

const isDown = (incidents, id) => !!(incidents && incidents[id] && incidents[id].started_at);
export const ratePerSecond = (levels, hq, incidents) =>
  BUSINESSES.reduce((sum, b) => sum + (isDown(incidents, b.id) ? 0 : businessIncome(b, levels[b.id] || 0)), 0) * hqMult(hq);

export const freshState = (now) => ({ cash: START_CASH, earned: 0, levels: { wash: 1 }, hq: 1, incidents: {}, cooldowns: {}, updated_at: now, created_at: now });

// Нарахувати дохід за час, що минув. Повертає скільки додано і за скільки секунд.
export const settle = (state, now, random = Math.random) => {
  state.incidents ||= {};
  state.cooldowns ||= {};
  const elapsed = Math.max(0, (now - state.updated_at) / 1000);
  const seconds = Math.min(elapsed, OFFLINE_CAP_SECONDS);
  const windowStart = now - seconds * 1000;
  const mult = hqMult(state.hq);
  let gain = 0;
  const started = [];
  for (const b of BUSINESSES) {
    const level = state.levels[b.id] || 0;
    if (level <= 0) continue;
    const income = businessIncome(b, level) * mult;
    if (isDown(state.incidents, b.id)) continue; // простій — нічого не заробляє
    let activeSeconds = seconds;
    const cfg = INCIDENTS[b.id];
    const eligible = cfg && level >= cfg.minLevel
      && now - state.created_at > GRACE_MINUTES * 60e3
      && (!state.cooldowns[b.id] || now - state.cooldowns[b.id] > cfg.cooldownMinutes * 60e3);
    if (eligible && seconds > 0) {
      const chance = 1 - Math.exp(-seconds / (cfg.meanHours * 3600));
      if (random() < chance) {
        const cooldownEnd = state.cooldowns[b.id] ? state.cooldowns[b.id] + cfg.cooldownMinutes * 60e3 : 0;
        const at = Math.max(windowStart, cooldownEnd, state.created_at + GRACE_MINUTES * 60e3);
        const startAt = Math.min(now, at + random() * Math.max(0, now - at));
        activeSeconds = Math.max(0, (startAt - windowStart) / 1000);
        state.incidents[b.id] = { type: cfg.type, started_at: Math.round(startAt) };
        started.push(b.id);
      }
    }
    gain += income * activeSeconds;
  }
  state.cash += gain;
  state.earned += gain;
  state.updated_at = now;
  return { gain, seconds, capped: elapsed > OFFLINE_CAP_SECONDS, started };
};

const randomToken = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
};

export const hireCost = (state, id) => {
  const cfg = INCIDENTS[id];
  const total = BUSINESSES.reduce((sum, b) => sum + businessIncome(b, state.levels[b.id] || 0), 0) * hqMult(state.hq);
  return Math.max(100, Math.round(total * cfg.hireMinutes * 60));
};

const resolveIncident = (state, id, now) => {
  delete state.incidents[id];
  state.cooldowns[id] = now;
};

// Старт міні-гри: видаємо одноразовий токен.
export const startIncidentGame = (state, id, now) => {
  const inc = state.incidents?.[id];
  if (!INCIDENTS[id] || !inc) throw new Error("no_incident");
  inc.game = { token: randomToken(), at: now };
  return { token: inc.game.token };
};

// Фініш міні-гри: score 0..100. Від passScore — бізнес знову працює + бонус.
export const finishIncidentGame = (state, id, token, score, now) => {
  const cfg = INCIDENTS[id];
  const inc = state.incidents?.[id];
  if (!cfg || !inc) throw new Error("no_incident");
  if (!inc.game || inc.game.token !== token) throw new Error("bad_token");
  const took = (now - inc.game.at) / 1000;
  if (took < GAME_MIN_SECONDS || took > GAME_MAX_SECONDS) { delete inc.game; throw new Error("bad_timing"); }
  delete inc.game;
  const clean = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (clean < cfg.passScore) return { passed: false, score: clean, stars: 0, bonus: 0 };
  const stars = clean >= 95 ? 3 : clean >= 85 ? 2 : 1;
  const b = BY_ID[id];
  const bonus = Math.round(businessIncome(b, state.levels[id] || 0) * hqMult(state.hq) * cfg.bonusMinutes * 60 * (clean / 100));
  state.cash += bonus;
  state.earned += bonus;
  resolveIncident(state, id, now);
  return { passed: true, score: clean, stars, bonus };
};

// Найняти підміну без міні-гри.
export const hireForIncident = (state, id, now) => {
  if (!INCIDENTS[id] || !state.incidents?.[id]) throw new Error("no_incident");
  const cost = hireCost(state, id);
  if (state.cash < cost) return { hired: false, cost };
  state.cash -= cost;
  resolveIncident(state, id, now);
  return { hired: true, cost };
};

// Покращення: target = "hq" або id бізнесу; count = 1 | 10 | "max".
export const upgrade = (state, target, count) => {
  const limit = count === "max" ? MAX_LEVEL : Math.max(1, Math.min(100, Number(count) || 1));
  let bought = 0;
  let spent = 0;
  if (target === "hq") {
    while (bought < limit && state.hq < HQ_MAX) {
      const cost = hqCost(state.hq);
      if (state.cash < cost) break;
      state.cash -= cost; spent += cost; state.hq += 1; bought += 1;
    }
    return { bought, spent };
  }
  const b = BY_ID[target];
  if (!b) throw new Error("unknown_target");
  let level = state.levels[b.id] || 0;
  while (bought < limit && level < MAX_LEVEL) {
    const cost = levelCost(b, level);
    if (state.cash < cost) break;
    state.cash -= cost; spent += cost; level += 1; bought += 1;
  }
  state.levels[b.id] = level;
  return { bought, spent };
};

export const publicConfig = () => ({
  businesses: BUSINESSES,
  milestones: MILESTONES,
  maxLevel: MAX_LEVEL,
  hqMax: HQ_MAX,
  ranks: RANKS,
  offlineCap: OFFLINE_CAP_SECONDS,
  incidents: INCIDENTS,
});

export const view = (state) => {
  const rank = rankFor(state.earned);
  return {
    cash: state.cash,
    earned: state.earned,
    levels: state.levels,
    hq: state.hq,
    hqCost: state.hq < HQ_MAX ? hqCost(state.hq) : null,
    hqMult: hqMult(state.hq),
    rate: ratePerSecond(state.levels, state.hq, state.incidents),
    incidents: Object.fromEntries(Object.entries(state.incidents || {}).map(([id, inc]) => [id, { type: inc.type, started_at: inc.started_at, hireCost: hireCost(state, id) }])),
    rank,
    server_time: state.updated_at,
  };
};

// ---------- Робота з D1 ----------
const parseRow = (row) => ({
  cash: Number(row.cash) || 0,
  earned: Number(row.earned) || 0,
  levels: (() => { try { return JSON.parse(row.levels || "{}"); } catch { return {}; } })(),
  hq: Math.max(1, Math.min(HQ_MAX, Number(row.hq) || 1)),
  ...(() => { try { const x = JSON.parse(row.incidents || "{}"); return { incidents: x.active || {}, cooldowns: x.cooldowns || {} }; } catch { return { incidents: {}, cooldowns: {} }; } })(),
  updated_at: Number(row.updated_at) || Date.now(),
  created_at: Number(row.created_at) || Date.now(),
});

export const loadState = async (db, userId, now) => {
  const row = await db.prepare("SELECT * FROM empire WHERE user_id = ?").bind(userId).first();
  return row ? { state: parseRow(row), isNew: false } : { state: freshState(now), isNew: true };
};

export const saveState = async (db, userId, user, state) => {
  await db.prepare(
    `INSERT INTO empire (user_id, name, avatar, cash, earned, levels, hq, incidents, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, cash = excluded.cash,
       earned = excluded.earned, levels = excluded.levels, hq = excluded.hq, incidents = excluded.incidents, updated_at = excluded.updated_at`,
  ).bind(userId, String(user?.name || "").slice(0, 64), user?.avatar || null, state.cash, state.earned,
    JSON.stringify(state.levels), state.hq, JSON.stringify({ active: state.incidents || {}, cooldowns: state.cooldowns || {} }),
    state.updated_at, state.created_at).run();
};

export const topPlayers = async (db, limit = 15) => {
  const { results } = await db.prepare("SELECT user_id, name, avatar, earned, hq FROM empire ORDER BY earned DESC LIMIT ?").bind(limit).all();
  return (results || []).map((r) => ({ id: r.user_id, name: r.name, avatar: r.avatar, earned: Number(r.earned) || 0, hq: Number(r.hq) || 1, rank: rankFor(Number(r.earned) || 0).name }));
};

export const placeOf = async (db, earned) => {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM empire WHERE earned > ?").bind(earned).first();
  const total = await db.prepare("SELECT COUNT(*) AS n FROM empire").first();
  return { place: (Number(row?.n) || 0) + 1, total: Number(total?.n) || 0 };
};
