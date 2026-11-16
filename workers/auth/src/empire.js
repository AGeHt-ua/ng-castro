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

export const milestoneMult = (level) => Math.pow(2, MILESTONES.filter((m) => level >= m).length);
export const businessIncome = (b, level) => (level > 0 ? b.income * level * milestoneMult(level) : 0);
// ціна переходу level → level+1 (для level 0 — розблокування)
export const levelCost = (b, level) => (level <= 0 ? b.unlock : Math.round(b.upBase * Math.pow(b.growth, level - 1)));

export const ratePerSecond = (levels, hq) =>
  BUSINESSES.reduce((sum, b) => sum + businessIncome(b, levels[b.id] || 0), 0) * hqMult(hq);

export const freshState = (now) => ({ cash: START_CASH, earned: 0, levels: { wash: 1 }, hq: 1, updated_at: now, created_at: now });

// Нарахувати дохід за час, що минув. Повертає скільки додано і за скільки секунд.
export const settle = (state, now) => {
  const elapsed = Math.max(0, (now - state.updated_at) / 1000);
  const seconds = Math.min(elapsed, OFFLINE_CAP_SECONDS);
  const gain = ratePerSecond(state.levels, state.hq) * seconds;
  state.cash += gain;
  state.earned += gain;
  state.updated_at = now;
  return { gain, seconds, capped: elapsed > OFFLINE_CAP_SECONDS };
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
    rate: ratePerSecond(state.levels, state.hq),
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
  updated_at: Number(row.updated_at) || Date.now(),
  created_at: Number(row.created_at) || Date.now(),
});

export const loadState = async (db, userId, now) => {
  const row = await db.prepare("SELECT * FROM empire WHERE user_id = ?").bind(userId).first();
  return row ? { state: parseRow(row), isNew: false } : { state: freshState(now), isNew: true };
};

export const saveState = async (db, userId, user, state) => {
  await db.prepare(
    `INSERT INTO empire (user_id, name, avatar, cash, earned, levels, hq, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, cash = excluded.cash,
       earned = excluded.earned, levels = excluded.levels, hq = excluded.hq, updated_at = excluded.updated_at`,
  ).bind(userId, String(user?.name || "").slice(0, 64), user?.avatar || null, state.cash, state.earned,
    JSON.stringify(state.levels), state.hq, state.updated_at, state.created_at).run();
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
