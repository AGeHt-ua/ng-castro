import * as Empire from "./empire.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const STATE_TTL_SECONDS = 10 * 60;
const SESSION_COOKIE = "ng_castro_session";
const textEncoder = new TextEncoder();

const base64UrlEncode = (value) => {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const randomToken = (bytes = 32) => {
  const random = new Uint8Array(bytes);
  crypto.getRandomValues(random);
  return base64UrlEncode(random);
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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
};

const json = (request, env, payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request, env), ...headers },
});

const readCookie = (request, name) => {
  const row = request.headers.get("Cookie") || "";
  return row.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || null;
};

const sessionCookie = (env, sessionId, maxAge) => [
  `${SESSION_COOKIE}=${sessionId}`,
  "Path=/",
  `Domain=${env.COOKIE_DOMAIN || ".family-castro.com"}`,
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  `Max-Age=${maxAge}`,
].join("; ");

const hmac = async (secret, value) => {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
};

const constantTimeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

const makeState = async (env, returnUrl) => {
  const payload = base64UrlEncode(JSON.stringify({ returnUrl, exp: Date.now() + STATE_TTL_SECONDS * 1000, nonce: randomToken(16) }));
  const signature = base64UrlEncode(await hmac(env.OAUTH_STATE_SECRET, payload));
  return `${payload}.${signature}`;
};

const verifyState = async (env, state) => {
  const [payload, signature] = String(state || "").split(".");
  if (!payload || !signature) return null;
  const expected = await hmac(env.OAUTH_STATE_SECRET, payload);
  let received;
  try { received = base64UrlDecode(signature); } catch { return null; }
  if (!constantTimeEqual(expected, received)) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return Number(decoded.exp) > Date.now() && typeof decoded.returnUrl === "string" ? decoded : null;
  } catch { return null; }
};

const safeReturnUrl = (value, env) => {
  try {
    const url = new URL(value);
    return allowedOrigins(env).includes(url.origin) ? url.toString() : `${allowedOrigins(env)[0]}/`;
  } catch {
    return `${allowedOrigins(env)[0]}/`;
  }
};

const getSession = async (request, env) => {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId || !/^[A-Za-z0-9_-]{20,200}$/.test(sessionId)) return null;
  const session = await env.SESSIONS.get(`session:${sessionId}`, "json");
  return session?.id ? { sessionId, user: session } : null;
};

const publicUser = (user) => ({
  id: String(user.id),
  username: user.username || "",
  name: user.global_name || user.username || "Discord",
  avatar: user.avatar || null,
});

const profileFor = async (env, userId) => (await env.PROFILES.get(`profile:${userId}`, "json")) || {};

const cleanProfile = (value, current) => {
  const ic = String(value?.ic ?? current.ic ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
  const sid = String(value?.sid ?? current.sid ?? "").replace(/\D/g, "").slice(0, 10);
  if (ic && ic.trim().split(/\s+/).length < 2) throw new Error("Вкажи ім’я та прізвище персонажа.");
  if (sid && !/^\d{1,10}$/.test(sid)) throw new Error("Static ID має містити лише цифри.");
  return { ...current, ic, sid, updatedAt: new Date().toISOString() };
};

// ---- Особистий кабінет: підписаний запит до бота CASTRO NG (cabinet_api.py) ----
const CABINET_TIMEOUT_MS = 8000;

const callCabinet = async (env, action, payload) => {
  if (!env.CABINET_API_URL || !env.CABINET_API_SECRET) return { status: 503, data: { ok: false, error: "cabinet_not_configured" } };
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomToken(18);
  const signature = base64UrlEncode(await hmac(env.CABINET_API_SECRET, `${timestamp}.${nonce}.${body}`));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CABINET_TIMEOUT_MS);
  try {
    const response = await fetch(`${String(env.CABINET_API_URL).replace(/\/+$/, "")}/cabinet/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Castro-Timestamp": timestamp,
        "X-Castro-Nonce": nonce,
        "X-Castro-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({ ok: false, error: "bad_bot_response" }));
    return { status: response.ok ? 200 : (response.status >= 500 ? 503 : response.status), data };
  } catch {
    return { status: 503, data: { ok: false, error: "bot_unreachable" } };
  } finally {
    clearTimeout(timer);
  }
};

// ---- CASTRO: Empire — доступ лише учасникам (поки гра в кабінеті) ----
const ACCESS_TTL_MS = 10 * 60 * 1000;
const ACCESS_STALE_MS = 24 * 60 * 60 * 1000;

const gameAccess = async (env, userId) => {
  const now = Date.now();
  const cached = await env.GAME_DB.prepare("SELECT ok, checked_at FROM access_cache WHERE user_id = ?").bind(userId).first();
  if (cached && now - Number(cached.checked_at) < ACCESS_TTL_MS) return { ok: !!cached.ok };
  const { status, data } = await callCabinet(env, "state", { user_id: userId });
  if (status === 200 && data?.ok) {
    await env.GAME_DB.prepare("INSERT INTO access_cache (user_id, ok, checked_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET ok = excluded.ok, checked_at = excluded.checked_at")
      .bind(userId, data.access ? 1 : 0, now).run();
    return { ok: !!data.access, reason: data.reason };
  }
  // Бот тимчасово недоступний — пускаємо за нещодавньою успішною перевіркою.
  if (cached && cached.ok && now - Number(cached.checked_at) < ACCESS_STALE_MS) return { ok: true };
  return { ok: false, unavailable: true };
};

const avatarUrl = (user) => (user?.id && user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null);

const handleGame = async (request, env, url) => {
  const session = await getSession(request, env);
  if (!session) return json(request, env, { ok: false, error: "unauthorized" }, 401);
  if (!env.GAME_DB) return json(request, env, { ok: false, error: "game_not_configured" }, 503);
  const userId = String(session.user.id);
  const access = await gameAccess(env, userId);
  if (!access.ok) {
    return access.unavailable
      ? json(request, env, { ok: false, error: "bot_unreachable" }, 503)
      : json(request, env, { ok: false, error: "no_access", reason: access.reason || "no_role" }, 403);
  }
  const player = { name: session.user.name, avatar: avatarUrl(session.user) };
  const now = Date.now();

  if (request.method === "GET" && url.pathname === "/game/state") {
    const { state, isNew } = await Empire.loadState(env.GAME_DB, userId, now);
    const offline = isNew ? { gain: 0, seconds: 0, capped: false } : Empire.settle(state, now);
    await Empire.saveState(env.GAME_DB, userId, player, state);
    const place = await Empire.placeOf(env.GAME_DB, state.earned);
    return json(request, env, {
      ok: true, isNew, player: { id: userId, ...player }, config: Empire.publicConfig(),
      state: Empire.view(state), offline: offline.seconds >= 60 ? offline : null, place,
    });
  }

  if (request.method === "POST" && url.pathname === "/game/upgrade") {
    let body;
    try { body = await request.json(); } catch { return json(request, env, { ok: false, error: "bad_json" }, 400); }
    const target = String(body?.target || "");
    const count = body?.count === "max" ? "max" : Number(body?.count) || 1;
    const { state } = await Empire.loadState(env.GAME_DB, userId, now);
    Empire.settle(state, now);
    let result;
    try { result = Empire.upgrade(state, target, count); } catch { return json(request, env, { ok: false, error: "unknown_target" }, 400); }
    await Empire.saveState(env.GAME_DB, userId, player, state);
    return json(request, env, { ok: true, result, state: Empire.view(state) });
  }

  if (request.method === "GET" && url.pathname === "/game/top") {
    const { state } = await Empire.loadState(env.GAME_DB, userId, now);
    return json(request, env, { ok: true, top: await Empire.topPlayers(env.GAME_DB), me: { id: userId, ...(await Empire.placeOf(env.GAME_DB, state.earned)) } });
  }

  return json(request, env, { ok: false, error: "Not found" }, 404);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return isAllowedOrigin(request, env) ? new Response(null, { status: 204, headers: corsHeaders(request, env) }) : new Response(null, { status: 403 });
    }
    if (!isAllowedOrigin(request, env)) return json(request, env, { ok: false, error: "Forbidden origin" }, 403);

    if (request.method === "GET" && url.pathname === "/auth/login") {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.OAUTH_STATE_SECRET || !env.OAUTH_REDIRECT_URI) return json(request, env, { ok: false, error: "OAuth is not configured" }, 500);
      const returnUrl = safeReturnUrl(url.searchParams.get("return"), env);
      const state = await makeState(env, returnUrl);
      const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
      authorizeUrl.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.OAUTH_REDIRECT_URI,
        response_type: "code",
        scope: "identify",
        state,
        prompt: "none",
      }).toString();
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const state = await verifyState(env, url.searchParams.get("state"));
      const code = url.searchParams.get("code");
      if (!state || !code) return new Response("Invalid or expired authorization request.", { status: 400 });

      const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: env.OAUTH_REDIRECT_URI,
        }),
      });
      if (!tokenResponse.ok) return new Response("Discord authorization failed.", { status: 502 });
      const token = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (!userResponse.ok) return new Response("Discord user lookup failed.", { status: 502 });
      const discordUser = await userResponse.json();
      const sessionId = randomToken(32);
      const user = publicUser(discordUser);
      await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(user), { expirationTtl: SESSION_TTL_SECONDS });
      return new Response(null, { status: 302, headers: { Location: state.returnUrl, "Set-Cookie": sessionCookie(env, sessionId, SESSION_TTL_SECONDS), "Cache-Control": "no-store" } });
    }

    if (request.method === "GET" && url.pathname === "/auth/me") {
      const session = await getSession(request, env);
      return session ? json(request, env, { ok: true, user: session.user }) : json(request, env, { ok: false, user: null }, 401);
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      const session = await getSession(request, env);
      if (session) await env.SESSIONS.delete(`session:${session.sessionId}`);
      return json(request, env, { ok: true }, 200, { "Set-Cookie": sessionCookie(env, "deleted", 0) });
    }

    if (url.pathname.startsWith("/game/")) return handleGame(request, env, url);

    if (request.method === "GET" && url.pathname === "/cabinet/state") {
      const session = await getSession(request, env);
      if (!session) return json(request, env, { ok: false, error: "unauthorized" }, 401);
      const { status, data } = await callCabinet(env, "state", { user_id: String(session.user.id) });
      return json(request, env, { ...data, user: session.user }, status);
    }

    if (url.pathname === "/profile") {
      const session = await getSession(request, env);
      if (!session) return json(request, env, { ok: false, error: "Unauthorized" }, 401);
      const current = await profileFor(env, session.user.id);
      if (request.method === "GET") return json(request, env, { ok: true, profile: current });
      if (request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json(request, env, { ok: false, error: "Invalid JSON" }, 400); }
        try {
          const profile = cleanProfile(body, current);
          await env.PROFILES.put(`profile:${session.user.id}`, JSON.stringify(profile));
          return json(request, env, { ok: true, profile });
        } catch (error) {
          return json(request, env, { ok: false, error: error.message || "Invalid profile" }, 400);
        }
      }
    }

    return json(request, env, { ok: false, error: "Not found" }, 404);
  },
};
