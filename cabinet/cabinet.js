/* Особистий кабінет Family Castro.
   Дані: GET https://auth.family-castro.com/cabinet/state (сесія Discord у cookie).
   Worker питає бота CASTRO NG, чи є роль учасника, і віддає профіль. */
(() => {
  const AUTH_BASE = "https://auth.family-castro.com";
  const STATE_URL = AUTH_BASE + "/cabinet/state";
  const SITE = "https://family-castro.com";
  const $ = (id) => document.getElementById(id);
  const gate = $("cbGate");
  const app = $("cbApp");

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\/(cdn|media)\.discordapp\.(com|net)\//.test(String(u || "")) ? String(u) : "");
  const num = (n) => Number(n || 0).toLocaleString("uk-UA");
  const money = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const avatar = (person, cls = "") => {
    const url = safeUrl(person?.avatar);
    if (url) return `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">`;
    const letter = esc((person?.name || "?").trim().charAt(0).toUpperCase() || "?");
    return `<span class="cb-ava ${cls}">${letter}</span>`;
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const fmtAgo = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 2) return "щойно";
    if (mins < 60) return `${mins} хв тому`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} год тому`;
    const days = Math.round(h / 24);
    return `${days} дн. тому`;
  };
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  // ---------- Екран доступу ----------
  const loginHref = () => `${AUTH_BASE}/auth/login?return=${encodeURIComponent(SITE + "/cabinet/")}`;

  const log = async (lines) => {
    const box = $("cbGateLog");
    box.innerHTML = "";
    for (const line of lines) {
      const row = document.createElement("div");
      row.innerHTML = line;
      box.appendChild(row);
      await sleep(260);
    }
  };

  const setGate = (state, { eyebrow, title, text, actions = "" } = {}) => {
    gate.hidden = false;
    app.hidden = true;
    gate.dataset.state = state;
    if (eyebrow) $("cbGateEyebrow").textContent = eyebrow;
    if (title) $("cbGateTitle").textContent = title;
    if (text) $("cbGateText").textContent = text;
    $("cbGateActions").innerHTML = actions;
  };

  const showLogin = () => {
    setGate("login", {
      eyebrow: "CASTRO • Закритий доступ",
      title: "Увійди через Discord",
      text: "Кабінет відкривається лише учасникам сімʼї. Увійди через Discord — бот перевірить твою роль.",
      actions: `<a class="cb-btn cb-btn--red" href="${esc(loginHref())}"><img src="/assets/discord.svg" alt="">Увійти через Discord</a>`,
    });
    log(["&gt; сесію не знайдено", "&gt; очікую вхід через Discord<em>_</em>"]);
  };

  const showDenied = (data) => {
    const notInGuild = data?.reason === "not_in_guild";
    const pending = data?.pending_application;
    setGate("denied", {
      eyebrow: "CASTRO • Доступ заборонено",
      title: "Доступ закрито",
      text: notInGuild
        ? "Тебе немає на Discord-сервері сімʼї. Приєднайся і подай заявку на вступ."
        : pending
          ? "Твоя заявка ще на розгляді. Кабінет відкриється, щойно керівництво видасть роль учасника."
          : "У тебе немає ролі учасника сімʼї. Кабінет доступний лише складу Family Castro.",
      actions: `<a class="cb-btn cb-btn--red" href="/join/">Подати заявку</a><a class="cb-btn" href="/">На головну</a>`,
    });
    log([`&gt; користувач: <b>${esc(data?.user?.name || data?.user?.username || "—")}</b>`, notInGuild ? "&gt; сервер: <em>не знайдено</em>" : "&gt; роль «Учасник»: <em>відсутня</em>", "&gt; доступ: <em>ВІДМОВЛЕНО</em>"]);
  };

  const showError = (message) => {
    setGate("error", {
      eyebrow: "CASTRO • Звʼязок",
      title: "Кабінет недоступний",
      text: message || "Не вдалося звʼязатися з ботом сімʼї. Спробуй трохи пізніше.",
      actions: `<button class="cb-btn cb-btn--red" type="button" data-retry>Спробувати ще</button><a class="cb-btn" href="/">На головну</a>`,
    });
    log(["&gt; бот CASTRO NG: <em>немає відповіді</em>"]);
  };

  // ---------- Лічильники ----------
  const countUp = (el) => {
    const target = Number(el.dataset.count || 0);
    if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = num(target); return; }
    const start = performance.now(), dur = 1300;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = num(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ---------- Рендер кабінету ----------
  const render = (data) => {
    const m = data.member || {};
    const p = data.profile || {};
    const s = data.stats || {};
    const f = data.family || {};

    $("cbAvatar").src = safeUrl(m.avatar) || "/assets/castro-logo.webp";
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ");
    $("cbName").textContent = fullName || m.display_name || "Учасник";
    $("cbNick").textContent = p.nickname ? `${p.nickname} • @${m.username || ""}` : `@${m.username || ""}`;
    document.title = `${fullName || m.display_name || "Кабінет"} • Кабінет Castro`;

    const onVacation = !!p.vacation_until;
    const chips = [
      `<span class="cb-chip cb-chip--red">🎖️ ${esc(p.rank || "Учасник")}</span>`,
      p.department ? `<span class="cb-chip">🏷️ ${esc(p.department)}</span>` : "",
      onVacation
        ? `<span class="cb-chip cb-chip--gold">🏖️ Відпустка до ${esc(fmtDate(p.vacation_until))}</span>`
        : `<span class="cb-chip cb-chip--green">● ${esc(p.status || "Активний")}</span>`,
      data.leadership ? `<span class="cb-chip cb-chip--gold">👑 Керівництво</span>` : "",
    ];
    $("cbChips").innerHTML = chips.join("");

    const pts = $("cbPoints");
    pts.dataset.count = String(p.points || 0);
    $("cbPlace").textContent = s.place ? `#${s.place} з ${s.ranked} у ТОПі` : "";

    const days = s.days_in_family;
    const tiles = [
      ["🔥", p.points || 0, "Е-балів"],
      ["🏆", s.place || 0, s.place ? `місце з ${s.ranked}` : "місце в ТОПі"],
      ["📅", days ?? 0, days != null ? plural(days, "день у сімʼї", "дні в сімʼї", "днів у сімʼї") : "днів у сімʼї"],
      ["💰", p.donated || 0, "$ внесок у фонд"],
      ["🤝", (s.invited || []).length, "запрошено"],
    ];
    $("overview").innerHTML = tiles.map(([icon, value, label]) =>
      `<div class="cb-stat"><span class="cb-stat__icon">${icon}</span><b data-count="${Number(value) || 0}">0</b><span>${esc(label)}</span></div>`).join("");

    $("cbCardNo").textContent = p.card_number || "";
    const rows = [
      ["Статичний ID", p.static_id || "—"],
      ["Нікнейм", p.nickname || m.display_name || "—"],
      ["У сімʼї з", p.join_date || "—"],
      ["Дата народження", p.birth_date || "—"],
      ["Telegram", p.telegram || "Не вказано"],
      ["Останній онлайн", fmtAgo(p.last_active)],
      ["На сервері з", fmtDate(m.joined_guild_at)],
      ["Discord ID", m.id || "—"],
    ];
    $("cbDossier").innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    const hist = (p.name_history || []).filter(Boolean);
    $("cbHistory").innerHTML = [
      hist.length ? `Попередні ніки: <b>${hist.map(esc).join(", ")}</b>` : "",
      p.pending_name_change ? " • 🟡 Заявка на зміну імені на розгляді" : "",
    ].join("");
    if (!data.profile) $("cbDossier").innerHTML = `<div><dt>Профіль</dt><dd>Профіль у боті ще не створено — звернись до керівництва.</dd></div>`;

    const myId = String(m.id || "");
    const top = f.top || [];
    $("cbTop").innerHTML = top.length
      ? top.map((t, i) => `<li class="${String(t.id) === myId ? "is-me" : ""}"><span class="cb-top__pos">${i + 1}</span>${avatar(t)}<span class="cb-top__name">${esc(t.name)}</span><span class="cb-top__pts">${num(t.points)}</span></li>`).join("")
      : `<li><span class="cb-empty">Поки що ніхто не має Е-балів.</span></li>`;

    const by = s.invited_by;
    const ib = $("cbInvitedBy");
    ib.classList.toggle("is-solo", !by);
    ib.innerHTML = by
      ? `${avatar(by)}<div><small>Тебе запросив</small><b>${esc(by.name)}</b></div>`
      : `<span class="cb-ava">🚶</span><div><small>Тебе запросив</small><b>${s.invited_by_answered ? "Ніхто — прийшов сам" : "Не вказано"}</b></div>`;
    const invited = s.invited || [];
    $("cbInvited").innerHTML = invited.length
      ? invited.map((x) => `<span class="cb-person">${avatar(x)}${esc(x.name)}</span>`).join("")
      : `<span class="cb-empty">Ти ще нікого не запросив.</span>`;

    const roles = m.roles || [];
    $("cbRoles").innerHTML = roles.length
      ? roles.map((r) => `<span class="cb-role" style="--role:${/^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#8a8a92"}"><i></i>${esc(r.name)}</span>`).join("")
      : `<span class="cb-empty">Ролей немає.</span>`;

    $("cbFamilyCount").dataset.count = String(f.members || 0);
    const depts = Object.values(f.departments || {});
    const maxDept = Math.max(1, ...depts.map((d) => d.count || 0));
    $("cbDepts").innerHTML = depts.map((d) =>
      `<div class="cb-bar"><div class="cb-bar__top"><span>${esc(d.emoji)} ${esc(d.name)}</span><span>${num(d.count)}</span></div><div class="cb-bar__track"><div class="cb-bar__fill" data-w="${Math.round(((d.count || 0) / maxDept) * 100)}"></div></div></div>`).join("");
    const goal = Number(f.fund_goal || 0);
    const total = Number(f.fund_total || 0);
    $("cbFund").innerHTML = `<small>Фонд сімʼї</small><b>${money(total)}</b>${goal
      ? `<div class="cb-bar__track"><div class="cb-bar__fill" data-w="${Math.min(100, Math.round((total / goal) * 100))}"></div></div><p>Ціль: ${money(goal)} • ${Math.min(100, Math.round((total / goal) * 100))}%</p>`
      : `<p>Ціль збору ще не встановлено.</p>`}`;

    $("cbLeadTab").hidden = !data.leadership;
    $("leadership").hidden = !data.leadership;
    $("cbUpdated").textContent = `Дані з бота CASTRO NG • оновлено ${new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;

    gate.hidden = true;
    app.hidden = false;
    requestAnimationFrame(() => {
      document.querySelectorAll("#cbApp [data-count]").forEach(countUp);
      setTimeout(() => document.querySelectorAll("#cbApp .cb-bar__fill").forEach((el) => { el.style.width = `${el.dataset.w}%`; }), 250);
    });
  };

  // ---------- Активна вкладка під час прокрутки ----------
  const initTabs = () => {
    const links = Array.from(document.querySelectorAll(".cb-tabs a"));
    const byId = new Map(links.map((a) => [a.dataset.section, a]));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a === byId.get(e.target.id)));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  };

  // ---------- Завантаження ----------
  const demo = () => {
    const q = new URLSearchParams(location.search).get("demo");
    if (!q || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
    return q;
  };

  const DEMO = {
    ok: true, access: true, leadership: true,
    user: { id: "916397417421738034", name: "Dominic" },
    member: {
      id: "916397417421738034", display_name: "Dominic Castro | 256", username: "castro.ua", avatar: null,
      joined_guild_at: "2026-03-29T18:20:00+00:00",
      roles: [{ name: "Генерал", color: "#e0182d" }, { name: "Піар", color: "#f2c14e" }, { name: "Учасник", color: "#22c55e" }, { name: "Castro", color: null }],
    },
    profile: {
      first_name: "Dominic", last_name: "Castro", static_id: "256", card_number: "CF-256", department: "Піар", rank: "Генерал",
      points: 1240, join_date: "03.04.2026", status: "Активний", birth_date: "27.10", telegram: "@castro.ua", donated: 250000,
      last_active: new Date(Date.now() - 18 * 60000).toISOString(), nickname: "Dominic Castro | 256", name_history: ["Dominic Castro | 12279"], pending_name_change: false,
    },
    stats: {
      place: 1, ranked: 42, days_in_family: 227,
      invited_by: null, invited_by_answered: true,
      invited: [{ id: "1", name: "Kevin Castro | 9499" }, { id: "2", name: "Madara Castro | 1306" }, { id: "3", name: "Nice | 6422" }],
    },
    family: {
      members: 42, fund_total: 1850000, fund_goal: 3000000,
      departments: { piar: { name: "Піар", emoji: "📢", count: 14 }, farm: { name: "Фарм", emoji: "🌾", count: 19 }, kapt: { name: "Капт", emoji: "⚔️", count: 9 } },
      top: [
        { id: "916397417421738034", name: "Dominic Castro | 256", points: 1240 },
        { id: "4", name: "Kevin Castro | 9499", points: 980 },
        { id: "5", name: "Madara Castro | 1306", points: 870 },
        { id: "6", name: "Nice | 6422", points: 640 },
        { id: "7", name: "Juliet Castro | 12364", points: 515 },
      ],
    },
  };

  const load = async () => {
    setGate("loading", { eyebrow: "CASTRO • Закритий доступ", title: "Перевірка доступу", text: "Бот звіряє твою роль у Discord…" });
    const logging = log(["&gt; підключення до CASTRO NG…", "&gt; перевірка сесії Discord…", "&gt; звірка ролі «Учасник»…"]);

    const d = demo();
    if (d) {
      await logging;
      if (d === "login") return showLogin();
      if (d === "denied") return showDenied({ reason: "no_role", user: { name: "Guest" } });
      if (d === "error") return showError();
      gate.dataset.state = "granted";
      await sleep(350);
      return render(DEMO);
    }

    let res, data;
    try {
      res = await fetch(STATE_URL, { credentials: "include", cache: "no-store" });
      data = await res.json().catch(() => null);
    } catch {
      await logging;
      return showError();
    }
    await logging;
    if (res.status === 401) return showLogin();
    if (!res.ok || !data?.ok) return showError(data?.error === "cabinet_not_configured" ? "Кабінет ще налаштовується. Загляни трохи пізніше." : undefined);
    if (!data.access) return showDenied(data);
    gate.dataset.state = "granted";
    await log(["&gt; роль «Учасник»: <b>підтверджено</b>", "&gt; доступ: <b>ВІДКРИТО</b>"]);
    render(data);
  };

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) load();
  });

  initTabs();
  load();
})();
