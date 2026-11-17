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

// ---------- Рейди: напади сімей NG на особняк і власні напади ----------
export const RAID = {
  minHq: 2,                    // з якого рівня штабу сім'я стає помітною
  firstMinutes: [20, 60],      // перший рейд після досягнення штабу 2
  intervalHours: [12, 24],     // далі — раз на 12–24 год
  warnMinutes: 15,             // попередження до нападу
  debuffMinutes: 60,           // штраф: дохід −50% на годину
  debuffMult: 0.5,
  attackCooldownMinutes: 10,   // власний напад — раз на 10 хв
  battleMinSeconds: 25,
  battleMaxSeconds: 420,
  defendRewardMinutes: 15,     // захист: 15 хв доходу імперії
  attackRewardMinutes: 4,      // напад: 4 хв доходу імперії
  bossBonus: 1.5,
};
// Сім'ї NG (назви з форуму NG, розділ «Сімейні Role Play біографії»)
export const FAMILIES = [
  { id: "medellin", name: "Medellin", style: "swarm", color: "#ffb02e" },
  { id: "insane", name: "Insane", style: "swarm", color: "#ff3ea5" },
  { id: "akatske", name: "Akatske", style: "swarm", color: "#e0182d" },
  { id: "katsu", name: "Katsu", style: "swarm", color: "#c04bff" },
  { id: "grizzly", name: "Grizzly", style: "armored", color: "#8a5a2b" },
  { id: "armani", name: "Armani", style: "armored", color: "#d9d9de" },
  { id: "kingsley", name: "Kingsley", style: "armored", color: "#2f6bff" },
  { id: "belmont", name: "Belmont", style: "armored", color: "#22c55e" },
  { id: "syndicat", name: "Syndicat", style: "vehicle", color: "#7a7f8a" },
  { id: "gentlemen", name: "The Gentlemen", style: "vehicle", color: "#f2c14e" },
  { id: "darkmonarchs", name: "Dark Monarchs", style: "vehicle", color: "#6b2bff" },
  { id: "sacrum", name: "Sacrum", style: "vehicle", color: "#3fb6ff" },
];
const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
export const ARSENAL = {
  weapon: { name: "Стартова зброя", max: 4, base: 150000, mult: 18 },
  squad: { name: "Бійці з самого початку", max: 3, base: 300000, mult: 22 },
  gate: { name: "Броня воріт", max: 5, base: 100000, mult: 12 },
};
export const arsenalCost = (item, level) => Math.round(ARSENAL[item].base * Math.pow(ARSENAL[item].mult, level));

export const milestoneMult = (level) => Math.pow(2, MILESTONES.filter((m) => level >= m).length);
export const businessIncome = (b, level) => (level > 0 ? b.income * level * milestoneMult(level) : 0);
// ціна переходу level → level+1 (для level 0 — розблокування)
export const levelCost = (b, level) => (level <= 0 ? b.unlock : Math.round(b.upBase * Math.pow(b.growth, level - 1)));

const isDown = (incidents, id) => !!(incidents && incidents[id] && incidents[id].started_at);
export const ratePerSecond = (levels, hq, incidents) =>
  BUSINESSES.reduce((sum, b) => sum + (isDown(incidents, b.id) ? 0 : businessIncome(b, levels[b.id] || 0)), 0) * hqMult(hq);

export const freshState = (now) => ({ cash: START_CASH, earned: 0, levels: { wash: 1 }, hq: 1, incidents: {}, cooldowns: {},
  raid: null, attack: { ready_at: 0 }, debuff: null, battle: null, arsenal: { weapon: 0, squad: 0, gate: 0 }, stats: { won: 0, lost: 0, attacks: 0, attacksWon: 0 },
  updated_at: now, created_at: now });

const ensureExtra = (state) => {
  state.incidents ||= {}; state.cooldowns ||= {};
  state.attack ||= { ready_at: 0 };
  state.arsenal = { weapon: 0, squad: 0, gate: 0, ...(state.arsenal || {}) };
  state.stats = { won: 0, lost: 0, attacks: 0, attacksWon: 0, ...(state.stats || {}) };
};
const overlapSeconds = (a0, a1, b0, b1) => Math.max(0, (Math.min(a1, b1) - Math.max(a0, b0)) / 1000);
export const totalIncome = (state) => BUSINESSES.reduce((sum, b) => sum + businessIncome(b, state.levels[b.id] || 0), 0) * hqMult(state.hq);
const randBetween = (random, [a, b]) => a + random() * (b - a);
const pickFamily = (random) => FAMILIES[Math.floor(random() * FAMILIES.length)];

// Розклад рейду + автоматична поразка, якщо час нападу минув без захисту
const raidTick = (state, now, random) => {
  if (state.hq < RAID.minHq) return;
  if (!state.raid) {
    state.raid = { next_at: Math.round(now + randBetween(random, RAID.firstMinutes) * 60e3), family: pickFamily(random).id };
    return;
  }
  const defending = state.battle?.mode === "defend" && now - state.battle.at < RAID.battleMaxSeconds * 1000;
  if (now >= state.raid.next_at && !defending) {
    const at = state.raid.next_at;
    state.debuff = { from: at, until: at + RAID.debuffMinutes * 60e3, family: state.raid.family };
    state.stats.lost += 1;
    let next = at + randBetween(random, RAID.intervalHours) * 3600e3;
    if (next < now) next = now + randBetween(random, RAID.intervalHours) * 3600e3;
    state.raid = { next_at: Math.round(next), family: pickFamily(random).id, lostAt: at };
    if (state.battle?.mode === "defend") state.battle = null;
  }
};

// Нарахувати дохід за час, що минув. Повертає скільки додано і за скільки секунд.
export const settle = (state, now, random = Math.random) => {
  ensureExtra(state);
  raidTick(state, now, random);
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
    const debuffLoss = state.debuff
      ? overlapSeconds(windowStart, windowStart + activeSeconds * 1000, state.debuff.from, state.debuff.until) * (1 - RAID.debuffMult)
      : 0;
    gain += income * Math.max(0, activeSeconds - debuffLoss);
  }
  state.cash += gain;
  state.earned += gain;
  state.updated_at = now;
  if (state.debuff && state.debuff.until <= now) state.debuff = null;
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

// ---------- Бій ----------
export const raidStatus = (state, now) => {
  if (!state.raid || state.hq < RAID.minHq) return "none";
  return now >= state.raid.next_at - RAID.warnMinutes * 60e3 ? "warning" : "scheduled";
};

export const startBattle = (state, mode, now, familyId, random = Math.random) => {
  ensureExtra(state);
  if (state.hq < RAID.minHq) throw new Error("hq_too_low");
  let family;
  if (mode === "defend") {
    if (raidStatus(state, now) !== "warning") throw new Error("no_raid");
    family = state.raid.family;
  } else if (mode === "attack") {
    if (now < (state.attack.ready_at || 0)) throw new Error("attack_cooldown");
    family = FAMILY_BY_ID[familyId] ? familyId : pickFamily(random).id;
    state.attack.ready_at = now + RAID.attackCooldownMinutes * 60e3; // пауза з моменту старту
  } else throw new Error("bad_mode");
  state.battle = { token: randomToken(), at: now, mode, family };
  return { token: state.battle.token, mode, family: FAMILY_BY_ID[family], arsenal: state.arsenal };
};

export const finishBattle = (state, token, result, now, random = Math.random) => {
  ensureExtra(state);
  const battle = state.battle;
  if (!battle || battle.token !== token) throw new Error("bad_token");
  const took = (now - battle.at) / 1000;
  state.battle = null;
  if (took < RAID.battleMinSeconds || took > RAID.battleMaxSeconds) throw new Error("bad_timing");
  const won = !!result?.won;
  const boss = won && !!result?.boss;
  let reward = 0;
  if (battle.mode === "defend") {
    if (won) {
      reward = Math.round(totalIncome(state) * RAID.defendRewardMinutes * 60 * (boss ? RAID.bossBonus : 1));
      state.stats.won += 1;
    } else {
      state.debuff = { from: now, until: now + RAID.debuffMinutes * 60e3, family: battle.family };
      state.stats.lost += 1;
    }
    state.raid = { next_at: Math.round(now + randBetween(random, RAID.intervalHours) * 3600e3), family: pickFamily(random).id };
  } else {
    state.stats.attacks += 1;
    if (won) {
      reward = Math.round(totalIncome(state) * RAID.attackRewardMinutes * 60 * (boss ? RAID.bossBonus : 1));
      state.stats.attacksWon += 1;
    }
  }
  state.cash += reward;
  state.earned += reward;
  return { won, boss, reward, mode: battle.mode, family: FAMILY_BY_ID[battle.family] };
};

export const buyArsenal = (state, item) => {
  ensureExtra(state);
  const cfg = ARSENAL[item];
  if (!cfg) throw new Error("unknown_item");
  const level = state.arsenal[item] || 0;
  if (level >= cfg.max) return { bought: false, max: true };
  const cost = arsenalCost(item, level);
  if (state.cash < cost) return { bought: false, cost };
  state.cash -= cost;
  state.arsenal[item] = level + 1;
  return { bought: true, cost, level: level + 1 };
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
  raid: RAID,
  families: FAMILIES,
  arsenal: ARSENAL,
});

export const view = (state) => {
  ensureExtra(state);
  const rank = rankFor(state.earned);
  const now = state.updated_at;
  const debuffOn = state.debuff && state.debuff.from <= now && state.debuff.until > now;
  return {
    cash: state.cash,
    earned: state.earned,
    levels: state.levels,
    hq: state.hq,
    hqCost: state.hq < HQ_MAX ? hqCost(state.hq) : null,
    hqMult: hqMult(state.hq),
    rate: ratePerSecond(state.levels, state.hq, state.incidents) * (debuffOn ? RAID.debuffMult : 1),
    raid: state.raid ? { status: raidStatus(state, now), next_at: state.raid.next_at, warn_at: state.raid.next_at - RAID.warnMinutes * 60e3, family: FAMILY_BY_ID[state.raid.family], lostAt: state.raid.lostAt || null } : null,
    attack: { ready_at: state.attack.ready_at || 0 },
    debuff: debuffOn ? { until: state.debuff.until, family: FAMILY_BY_ID[state.debuff.family] || null } : null,
    arsenal: state.arsenal,
    arsenalCosts: Object.fromEntries(Object.keys(ARSENAL).map((k) => [k, state.arsenal[k] >= ARSENAL[k].max ? null : arsenalCost(k, state.arsenal[k])])),
    stats: state.stats,
    battle: state.battle ? { mode: state.battle.mode, family: state.battle.family } : null,
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
  ...(() => {
    try {
      const x = JSON.parse(row.incidents || "{}");
      return { incidents: x.active || {}, cooldowns: x.cooldowns || {}, raid: x.raid || null, attack: x.attack || { ready_at: 0 }, debuff: x.debuff || null, battle: x.battle || null, arsenal: x.arsenal || {}, stats: x.stats || {} };
    } catch { return { incidents: {}, cooldowns: {} }; }
  })(),
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
    JSON.stringify(state.levels), state.hq, JSON.stringify({ active: state.incidents || {}, cooldowns: state.cooldowns || {}, raid: state.raid || null, attack: state.attack || null, debuff: state.debuff || null, battle: state.battle || null, arsenal: state.arsenal || null, stats: state.stats || null }),
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
