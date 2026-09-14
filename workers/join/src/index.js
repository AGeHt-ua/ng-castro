const TOKEN_TTL_SECONDS = 10 * 60;
const CANCEL_COOLDOWN_MS = 30 * 60 * 1000;

const base64UrlEncode = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const allowedOrigins = (env) => String(env.SITE_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const isAllowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins(env).includes(origin);
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
};

const json = (request, env, payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request, env) },
});

const readCookie = (request, name) => {
  const row = request.headers.get("Cookie") || "";
  return row.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || null;
};

const getSession = async (request, env) => {
  const sessionId = readCookie(request, "ng_castro_session");
  if (!sessionId || !/^[A-Za-z0-9_-]{20,200}$/.test(sessionId)) return null;
  const user = await env.SESSIONS.get(`session:${sessionId}`, "json");
  return user?.id ? { sessionId, user } : null;
};

const trim = (value, max = 1024) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
const code = (value) => `\`${String(value).replace(/`/g, "'")}\``;

const departments = (env) => ({
  piar: { name: "Піар", emoji: "📢", channelId: env.PIAR_CHANNEL_ID },
  farm: { name: "Фарм", emoji: "🌾", channelId: env.FARM_CHANNEL_ID },
  kapt: { name: "Капт", emoji: "⚔️", channelId: env.KAPT_CHANNEL_ID },
});

const botFetch = (env, path, init = {}) => fetch(`https://discord.com/api/v10${path}`, {
  ...init,
  headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, ...(init.headers || {}) },
});

const getApplication = async (env, userId) => (await env.APPLICATIONS.get(`application:${userId}`, "json")) || {};

const saveApplication = (env, userId, application) => env.APPLICATIONS.put(`application:${userId}`, JSON.stringify(application));

const firstAndLastName = (ic) => {
  const parts = trim(ic, 32).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const statusFromMessage = (message) => {
  const description = String(message?.embeds?.[0]?.description || "").toLowerCase();
  if (description.includes("заявку прийнято")) return "accepted";
  if (description.includes("заявку відхилено")) return "rejected";
  return null;
};

const syncApplicationStatus = async (env, userId, application) => {
  if (application.status !== "pending" || !application.channelId || !application.messageId) return application;
  const response = await botFetch(env, `/channels/${application.channelId}/messages/${application.messageId}`);
  if (response.status === 404) return application;
  if (!response.ok) return application;
  const status = statusFromMessage(await response.json());
  if (!status) return application;
  const next = { ...application, status, decidedAt: new Date().toISOString() };
  await saveApplication(env, userId, next);
  return next;
};

const publicApplication = (application) => ({
  applicationStatus: application.status || "none",
  applicationCreatedAt: application.createdAt || null,
  applicationUpdatedAt: application.decidedAt || application.updatedAt || null,
  joinCooldownUntil: application.cooldownUntil || null,
});

const validBirthDate = (value) => {
  const match = /^(\d{2})\.(\d{2})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(2024, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const validTelegram = (value) => !value || /^@?[A-Za-z0-9_]{5,32}$/.test(value);

const discordAvatarUrl = (user) => user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;

const applicationEmbeds = (session, application, form, photoName) => {
  const avatar = discordAvatarUrl(session.user);
  const embed = {
    title: `${application.department.emoji} Нова заявка у відділ ${application.department.name}`,
    description: "🟡 Очікує розгляд\nТип заявки: **Вступ із сайту**",
    color: 0x5865f2,
    fields: [
      { name: "Користувач", value: `<@${session.user.id}>`, inline: false },
      { name: "Discord ID", value: String(session.user.id), inline: false },
      { name: "Ім'я", value: application.firstName, inline: true },
      { name: "Прізвище", value: application.lastName, inline: true },
      { name: "Статичний ID", value: application.staticId, inline: true },
      { name: "Дата народження", value: application.birthDate, inline: true },
      { name: "Telegram", value: application.telegram || "Не вказано", inline: true },
      { name: "Відділ", value: application.department.name, inline: true },
      { name: "Новий нікнейм", value: code(`${application.firstName} ${application.lastName} | ${application.staticId}`), inline: false },
    ],
    footer: { text: "Використайте кнопки нижче для рішення по заявці" },
    timestamp: new Date().toISOString(),
  };
  if (avatar) embed.thumbnail = { url: avatar };
  if (photoName) embed.image = { url: `attachment://${photoName}` };
  const answers = {
    title: "📝 Анкета з сайту",
    color: 0x5865f2,
    fields: [
      { name: "Час на сервері", value: code(form.timeOnServer), inline: true },
      { name: "Годин на день", value: code(form.hoursPerDay), inline: true },
      { name: "Мікрофон", value: code(form.mic), inline: true },
      { name: "Досвід", value: code(form.exp), inline: false },
      { name: "Чому CASTRO", value: code(form.why), inline: false },
      { name: "Сильні сторони", value: code(form.skills), inline: false },
      { name: "Правила", value: code(form.rules), inline: true },
      { name: "Зміна прізвища", value: code(form.rename), inline: true },
    ],
  };
  if (form.extra) answers.fields.push({ name: "Додатково", value: code(form.extra), inline: false });
  return [embed, answers];
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return isAllowedOrigin(request, env) ? new Response(null, { status: 204, headers: corsHeaders(request, env) }) : new Response(null, { status: 403 });
    }
    if (!isAllowedOrigin(request, env)) return json(request, env, { ok: false, error: "Forbidden origin" }, 403);
    const session = await getSession(request, env);
    if (!session) return json(request, env, { ok: false, error: "Unauthorized" }, 401);

    if (request.method === "GET" && url.pathname === "/token") {
      const token = randomToken();
      await env.JOIN_TOKENS.put(`token:${token}`, session.user.id, { expirationTtl: TOKEN_TTL_SECONDS });
      return json(request, env, { ok: true, token });
    }

    if (request.method === "GET" && url.pathname === "/profile") {
      const requestedId = url.searchParams.get("uid");
      if (requestedId && requestedId !== String(session.user.id)) return json(request, env, { ok: false, error: "Forbidden" }, 403);
      const application = await syncApplicationStatus(env, session.user.id, await getApplication(env, session.user.id));
      return json(request, env, { ok: true, profile: publicApplication(application) });
    }

    if (request.method === "POST" && url.pathname === "/cancel") {
      const application = await syncApplicationStatus(env, session.user.id, await getApplication(env, session.user.id));
      if (application.status !== "pending") return json(request, env, { ok: false, error: "Немає активної заявки." }, 409);
      const deleted = await botFetch(env, `/channels/${application.channelId}/messages/${application.messageId}`, { method: "DELETE" });
      if (!deleted.ok && deleted.status !== 404) return json(request, env, { ok: false, error: "Не вдалося скасувати заявку в Discord." }, 502);
      const next = { ...application, status: "cancelled", updatedAt: new Date().toISOString(), cooldownUntil: new Date(Date.now() + CANCEL_COOLDOWN_MS).toISOString() };
      await saveApplication(env, session.user.id, next);
      return json(request, env, { ok: true, profile: publicApplication(next) });
    }

    if (request.method === "POST" && url.pathname === "/submit") {
      const token = request.headers.get("X-Token") || "";
      const owner = token ? await env.JOIN_TOKENS.get(`token:${token}`) : null;
      if (!owner || owner !== String(session.user.id)) return json(request, env, { ok: false, error: "Недійсний або прострочений токен." }, 401);
      await env.JOIN_TOKENS.delete(`token:${token}`);

      let data;
      try { data = await request.formData(); } catch { return json(request, env, { ok: false, error: "Некоректні дані форми." }, 400); }
      const get = (name, max) => trim(data.get(name), max);
      if (get("website", 200)) return json(request, env, { ok: false, error: "Запит відхилено." }, 400);
      if (get("agree", 10) !== "yes") return json(request, env, { ok: false, error: "Потрібно підтвердити згоду з правилами." }, 400);

      const profile = (await env.PROFILES.get(`profile:${session.user.id}`, "json")) || {};
      const names = firstAndLastName(profile.ic);
      const staticId = String(profile.sid || "").replace(/\D/g, "").slice(0, 10);
      if (!names || !staticId) return json(request, env, { ok: false, error: "Спершу заповни IC ім’я, прізвище та Static ID у профілі." }, 400);

      const department = departments(env)[get("department", 20)];
      const form = {
        timeOnServer: get("timeOnServer", 120), hoursPerDay: get("hoursPerDay", 120), exp: get("exp", 900),
        why: get("why", 900), skills: get("skills", 900), mic: get("mic", 60), rules: get("rules", 120),
        rename: get("rename", 120), extra: get("extra", 900),
      };
      const birthDate = get("birthDate", 5);
      const telegram = get("telegram", 33);
      if (!department?.channelId || !validBirthDate(birthDate) || !validTelegram(telegram) || Object.values(form).slice(0, 8).some((value) => !value)) {
        return json(request, env, { ok: false, error: "Перевір обов’язкові поля анкети." }, 400);
      }

      const current = await syncApplicationStatus(env, session.user.id, await getApplication(env, session.user.id));
      if (current.status === "accepted") return json(request, env, { ok: false, error: "Тебе вже прийнято до сім’ї." }, 409);
      if (current.status === "pending") return json(request, env, { ok: false, error: "Твоя заявка вже на розгляді." }, 409);
      if (current.cooldownUntil && new Date(current.cooldownUntil).getTime() > Date.now()) return json(request, env, { ok: false, error: "Після скасування потрібно зачекати 30 хвилин." }, 429);

      const uploadedPhoto = data.get("charPhoto");
      const hasPhoto = uploadedPhoto && typeof uploadedPhoto === "object" && Number(uploadedPhoto.size) > 0;
      if (hasPhoto && (!String(uploadedPhoto.type || "").startsWith("image/") || Number(uploadedPhoto.size) > 5 * 1024 * 1024)) {
        return json(request, env, { ok: false, error: "Фото має бути зображенням розміром до 5 MB." }, 400);
      }
      const photoName = hasPhoto ? String(uploadedPhoto.name || "character.png").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) : null;

      const application = {
        status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        firstName: names.firstName, lastName: names.lastName, staticId, birthDate, telegram: telegram ? `@${telegram.replace(/^@/, "")}` : "Не вказано", department,
      };
      const payload = {
        embeds: applicationEmbeds(session, application, form, photoName),
        allowed_mentions: { parse: [] },
        components: [{ type: 1, components: [
          { type: 2, style: 3, custom_id: "application_accept", label: "Прийняти" },
          { type: 2, style: 4, custom_id: "application_reject", label: "Відхилити" },
        ] }],
      };
      const requestInit = hasPhoto ? (() => {
        const body = new FormData();
        body.append("payload_json", JSON.stringify(payload));
        body.append("files[0]", uploadedPhoto, photoName);
        return { method: "POST", body };
      })() : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
      const response = await botFetch(env, `/channels/${department.channelId}/messages`, requestInit);
      if (!response.ok) return json(request, env, { ok: false, error: "Discord не прийняв заявку. Спробуй ще раз пізніше." }, 502);
      const message = await response.json();
      const stored = { ...application, channelId: String(department.channelId), messageId: String(message.id) };
      await saveApplication(env, session.user.id, stored);
      return json(request, env, { ok: true, profile: publicApplication(stored) });
    }

    return json(request, env, { ok: false, error: "Not found" }, 404);
  },
};
