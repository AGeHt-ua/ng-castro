/* /join — логіка анкети (перенесено з join/index.html без змін): авторизація, чернетка, покрокові секції, оцінка, відправка */
    // =========================
    // ✅ НАЛАШТУВАННЯ
    // =========================
    const WORKER_BASE = "https://join.family-castro.com";
    
    // expose for other scripts
    window.CASTRO_JOIN_WORKER_BASE = WORKER_BASE;
    const TOKEN_URL   = WORKER_BASE + "/token";
    const SUBMIT_URL  = WORKER_BASE + "/submit";
    const DISCORD_INVITE = "https://discord.gg/Jtrh5RaTX3";

    const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
    const DRAFT_KEY = "castro_join_draft_v1";

    // WOW
    const CAND_KEY = "castro_join_candidate_id_v1";

    // Глобальний стан авторизації (живиться з auth.js)
    window.AUTH_USER = null;

    // =========================
    // ✅ DOM
    // =========================
    const form = document.getElementById("joinForm");
    const statusEl = document.getElementById("status");
    const okEl = document.getElementById("ok");
    const okText = document.getElementById("okText");
    const btn = document.getElementById("submitBtn");
    const discordBtn = document.getElementById("discordBtn");
    const agreeChk = document.getElementById("agreeChk");
    const actionsEl = document.getElementById("actions");
    const discordInput = document.getElementById("discord");
    const discordMentionInput = document.getElementById("discordMention");

    // ✅ IRL split (name + age) → hidden 'irl' (для бекенду)
    const irlNameInput = document.getElementById("irlName");
    const irlAgeInput  = document.getElementById("irlAge");
    const irlHidden    = document.getElementById("irl");

    const syncIrl = () => {
      if (!irlHidden) return;
      const n = (irlNameInput?.value || "").trim();
      const a = (irlAgeInput?.value || "").trim();
      irlHidden.value = (n && a) ? `${n}, ${a}` : (n || "");
    };

    irlNameInput?.addEventListener("input", syncIrl);
    irlAgeInput?.addEventListener("input", syncIrl);

    // Автозаповнені поля (сховані) не повинні блокувати валідацію/flow
    const initAutoHiddenFields = () => {
      const autoWraps = form.querySelectorAll(".auto-hidden");
      autoWraps.forEach(w => {
        w.querySelectorAll("input, select, textarea").forEach(el => {
          el.required = false;
          el.dataset.auto = "1";
        });
      });
    };

    const applyDiscordFromAuth = () => {
      const u = window.AUTH_USER;
      if (!discordInput || !discordMentionInput) return;

      if (u?.id) {
        const uname = (u.username || u.global_name || u.name || "").trim();
        discordMentionInput.value = String(u.id);
        discordInput.value = uname ? ("@" + uname.replace(/^@+/, "")) : "@—";
        discordInput.readOnly = true;
      } else {
        discordMentionInput.value = "";
        discordInput.readOnly = false;
      }
    };

    discordBtn.href = DISCORD_INVITE;

    // ✅ Фото
    const photoInput = document.getElementById("charPhoto");
    const previewImg = document.getElementById("charPreview");
    const placeholder = document.getElementById("charPlaceholder");
    const removeBtn = document.getElementById("photoRemove");
    const pickBtn = document.getElementById("photoPickBtn");
    const photoHint = document.getElementById("photoHint");

    let lastObjectUrl = null;

    pickBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      photoInput?.click();
    });

    const revokeLastUrl = () => {
      if (lastObjectUrl) {
        try { URL.revokeObjectURL(lastObjectUrl); } catch {}
        lastObjectUrl = null;
      }
    };

    const clearPhoto = () => {
      revokeLastUrl();
      if (photoInput) photoInput.value = "";
      if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
      }
      if (placeholder) placeholder.style.display = "grid";
      if (removeBtn) removeBtn.disabled = true;
      if (photoHint) photoHint.textContent = "Максимальний розмір фото: 5 MB.";
      wowSafe(updateWow); // <-- WOW
    };

    photoInput?.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      if (!file) return clearPhoto();

      if (!file.type.startsWith("image/")) {
        clearPhoto();
        alert("Будь ласка, вибери файл зображення (PNG/JPG/WebP).");
        return;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        clearPhoto();
        alert("Фото завелике. Максимум 5 MB.");
        return;
      }

      revokeLastUrl();
      lastObjectUrl = URL.createObjectURL(file);

      previewImg.src = lastObjectUrl;
      previewImg.style.display = "block";
      placeholder.style.display = "none";
      removeBtn.disabled = false;

      if (photoHint) photoHint.textContent = "Фото додано ✅";
      wowSafe(updateWow); // <-- WOW
    });

    removeBtn?.addEventListener("click", clearPhoto);

    
    // Token + sending state
    let submitToken = null;
    let sending = false;
    let tokenFetchInFlight = null;

// =========================
    // ✅ КНОПКА: галочка + авторизація
    // =========================
    const syncAgree = () => {
      const agreeOk = !!agreeChk.checked;
      const authOk = !!window.AUTH_USER;

      // validity without popping messages
      syncIrl();
      const validOk = form.checkValidity();
      const tokenOk = !!submitToken;
      const ready = authOk && agreeOk && validOk && tokenOk && !sending;

      btn.classList.toggle("ready", ready);
      btn.disabled = !ready;

      if (!authOk) statusEl.textContent = "🔐 Увійди через Discord, щоб відправити заявку.";
      else if (!agreeOk) statusEl.textContent = "Постав галочку та відправ заявку.";
      else if (!validOk) statusEl.textContent = "Заповни всі обов’язкові поля.";
      else if (!tokenOk) statusEl.textContent = "⛔ Немає токена захисту. Онови сторінку.";
      else statusEl.textContent = "✅ Можеш відправляти заявку.";
    };

    agreeChk.addEventListener("change", () => {
      syncAgree();
      wowSafe(updateWow);
    });

    syncAgree();
    initAutoHiddenFields();

    // 🔐 Отримуємо статус логіну з auth.js
    window.addEventListener("castro-auth", (e) => {
      window.AUTH_USER = e.detail?.user || null;
      applyDiscordFromAuth();
      if (window.AUTH_USER) fetchToken();
      syncAgree();
      wowSafe(updateWow); // <-- WOW
    });

if (window.__CASTRO_AUTH__?.user) {
  window.AUTH_USER = window.__CASTRO_AUTH__.user;
  applyDiscordFromAuth();
  syncAgree();
  wowSafe(updateWow);
}

    // =========================
    // ✅ Чернетка (localStorage)
    // =========================
    const serializeDraft = () => {
      syncIrl();

      const fd = new FormData(form);
      fd.delete("charPhoto");

      const obj = {};
      for (const [k, v] of fd.entries()) obj[k] = String(v ?? "");
      obj._agree = agreeChk.checked ? "1" : "0";

      localStorage.setItem(DRAFT_KEY, JSON.stringify(obj));
      wowSafe(updateWow); // <-- WOW
    };

    const restoreDraft = () => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);

        for (const [k, v] of Object.entries(obj)) {
          if (k === "_agree") continue;
          const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
          if (!el) continue;
          el.value = String(v ?? "");
        }

        if (obj.irl && (irlNameInput || irlAgeInput)) {
          const s = String(obj.irl || "").trim();
          const m = s.match(/^\s*([^,]+?)\s*(?:,\s*(\d{1,2}))?\s*$/);
          if (m) {
            if (irlNameInput && !irlNameInput.value) irlNameInput.value = (m[1] || "").trim();
            if (irlAgeInput && !irlAgeInput.value) irlAgeInput.value = (m[2] || "").trim();
          }
        }

        syncIrl();

        agreeChk.checked = obj._agree === "1";
        syncAgree();
      } catch {}
    };

    form.addEventListener("input", serializeDraft);
    restoreDraft();
    syncIrl();

    // =========================
    // ✅ UI: прогрес заповнення (sidebar) + підсвітка секцій
    // =========================
    const sections = Array.from(form.querySelectorAll(".section"));
    const progFill = document.getElementById("progFill");
    const progPct  = document.getElementById("progPct");
    const progSteps = document.getElementById("progSteps");

    const STEP_TITLES = ["Дані персонажа", "Досвід", "Зв’язок"];

    const isFieldMeaningful = (el) => {
      if (!el) return false;
      if (el.type === "checkbox") return el.checked;
      const v = (el.value ?? "").trim();
      return v.length > 0;
    };

    const isAutoField = (el) => !!el?.closest?.(".auto-hidden");

    const sectionProgress = (sec) => {
      const fields = Array.from(sec.querySelectorAll("input, select, textarea"))
        .filter(el => el.name && el.type !== "file" && el.type !== "hidden" && el.name !== "website" && !isAutoField(el));
      if (!fields.length) return { done: 0, total: 0, ratio: 1 };

      let done = 0;
      for (const el of fields) if (isFieldMeaningful(el)) done += 1;
      return { done, total: fields.length, ratio: done / fields.length };
    };

    const buildSteps = () => {
      if (!progSteps) return;
      progSteps.innerHTML = "";
      sections.forEach((sec, idx) => {
        const title = STEP_TITLES[idx] || `Крок ${idx + 1}`;
        const pill = document.createElement("div");
        pill.className = "jstep";
        pill.textContent = `${idx + 1}. ${title}`;
        pill.addEventListener("click", () => {
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
          markActiveSection(sec);
        });
        progSteps.appendChild(pill);
      });
    };

    const setProgress = (pct) => {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      if (progFill) progFill.style.width = `${p}%`;
      if (progPct) progPct.textContent = `${p}%`;
      const bar = progFill?.closest?.('[role="progressbar"]');
      if (bar) bar.setAttribute("aria-valuenow", String(p));
      return p;
    };

    const updateProgress = () => {
      let sum = 0;
      let count = 0;

      sections.forEach((sec) => {
        const { ratio } = sectionProgress(sec);
        sum += ratio;
        count += 1;
      });

      const agreeBoost = agreeChk.checked ? 1 : 0;
      const totalParts = count + 1;
      const pct = ((sum + agreeBoost) / totalParts) * 100;

      const p = setProgress(pct);

      sections.forEach((sec, idx) => {
        const { ratio } = sectionProgress(sec);
        sec.classList.toggle("is-done", ratio >= 0.85);
        const stepEl = progSteps?.children?.[idx];
        if (stepEl) stepEl.classList.toggle("is-done", ratio >= 0.85);
      });

      return p;
    };

    const markActiveSection = (activeSec) => {
      sections.forEach((sec, idx) => {
        const isActive = sec === activeSec;
        sec.classList.toggle("is-active", isActive);
        const stepEl = progSteps?.children?.[idx];
        if (stepEl) stepEl.classList.toggle("is-active", isActive);
      });
    };

    form.addEventListener("focusin", (e) => {
      const sec = e.target.closest?.(".section");
      if (sec) markActiveSection(sec);
    });

    // =========================
    // ✅ FLOW: секції відкриваються ПО ЧЕРЗІ (плавно)
    // =========================
    const bodyOf = (sec) => sec.querySelector(".section__body");

    const markInitialRequired = () => {
      sections.forEach(sec => {
        const body = bodyOf(sec);
        if (!body) return;
        body.querySelectorAll("[required]").forEach(el => {
          if (isAutoField(el)) return;
          el.dataset.req = "1";
        });
      });
    };

    const disableSectionFields = (sec) => {
      const body = bodyOf(sec);
      if (!body) return;
      body.querySelectorAll("input,select,textarea,button").forEach(el => {
        if (isAutoField(el)) return;
        el.disabled = true;
      });
    };

    const enableSectionFields = (sec) => {
      const body = bodyOf(sec);
      if (!body) return;
      body.querySelectorAll("input,select,textarea,button").forEach(el => {
        if (isAutoField(el)) return;
        el.disabled = false;
      });
    };

    const sectionComplete = (sec) => {
      const body = bodyOf(sec);
      if (!body) return true;

      const requiredEls = Array.from(body.querySelectorAll("input,select,textarea"))
        .filter(el =>
          (el.dataset.req === "1" || el.required) &&
          el.type !== "file" &&
          el.type !== "hidden" &&
          el.name !== "website" &&
          !isAutoField(el)
        );

      if (!requiredEls.length) return true;

      return requiredEls.every(el => {
        const v = (el.value ?? "").trim();
        if (!v) return false;
        if (el.tagName === "SELECT" && !el.value) return false;
        return el.checkValidity();
      });
    };

    const setSectionOpen = (sec, open) => {
      const body = bodyOf(sec);
      if (!body) return;

      if (open) {
        sec.classList.add("is-open");
        sec.classList.remove("is-collapsed", "is-locked");
        enableSectionFields(sec);

        if (!sec.dataset.opened) {
          sec.dataset.opened = "1";
          sec.classList.add("was-just-opened");
          setTimeout(() => sec.classList.remove("was-just-opened"), 250);
        }
      } else {
        sec.classList.add("is-collapsed", "is-locked");
        sec.classList.remove("is-open");
        disableSectionFields(sec);
      }
    };

    let unlockedIndex = 0;

    const applyFlow = () => {
      while (unlockedIndex < sections.length - 1 && sectionComplete(sections[unlockedIndex])) {
        unlockedIndex += 1;
      }
      sections.forEach((sec, idx) => setSectionOpen(sec, idx <= unlockedIndex));
    };

    let flowTimer = null;
    const scheduleFlow = () => {
      if (flowTimer) clearTimeout(flowTimer);
      flowTimer = setTimeout(() => {
        applyFlow();
        updateProgress();
        syncAgree();
        wowSafe(updateWow); // <-- WOW
      }, 120);
    };

    const initFlow = () => {
      if (!sections.length) return;
      markInitialRequired();

      unlockedIndex = 0;
      sections.forEach((sec, idx) => {
        if (idx === 0) sec.dataset.opened = "1";
        else delete sec.dataset.opened;
        setSectionOpen(sec, idx === 0);
      });

      applyFlow();
    };

    form.addEventListener("input", scheduleFlow);
    form.addEventListener("change", scheduleFlow);

    buildSteps();
    initFlow();
    updateProgress();

    // =========================
    // ✅ Token
    // =========================

    const fetchToken = async () => {
      if (tokenFetchInFlight) return tokenFetchInFlight;
      tokenFetchInFlight = (async () => {
      try {
        const res = await fetch(TOKEN_URL, { method: "GET", credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.token) throw new Error("token_failed");
        submitToken = json.token;
              syncAgree();
} catch {
        submitToken = null;
        syncAgree();
      } finally {
        tokenFetchInFlight = null;
      }
      })();
      return tokenFetchInFlight;
    };
    if (window.AUTH_USER || window.__CASTRO_AUTH__?.user) fetchToken();

    // =========================
    // ✅ Відображення помилок
    // =========================
const explainError = (res, json) => {
  if (json?.error) return "❌ " + String(json.error);
  if (res?.status === 413) return "❌ Фото завелике. Стисни або вибери інше (до 5MB).";
  if (res?.status === 429) return "⏳ Забагато спроб. Зачекай трохи і повтори.";
  if (res?.status === 403) return "⛔ Доступ заборонено (перевір, що відкрив з family-castro.com).";
  if (res?.status === 400) return "❌ Неправильні дані. Перевір поля та спробуй ще раз.";
  return "❌ Помилка відправки. Спробуй ще раз або напиши керівництву.";
};

    // =========================
    // ✅ Валідація перед сабмітом
    // =========================
    const validateBeforeSubmit = () => {
      syncIrl();
      const hp = form.querySelector('input[name="website"]');
      if (hp && hp.value.trim()) return { ok: false, msg: "⛔ Відхилено." };

      if (!form.checkValidity()) {
        form.reportValidity();
        return { ok: false, msg: "❌ Заповни всі обов’язкові поля коректно." };
      }

      if (!agreeChk.checked) return { ok: false, msg: "⛔ Спочатку постав галочку згоди." };
      if (!submitToken) return { ok: false, msg: "⛔ Немає токена захисту. Онови сторінку і спробуй ще раз." };

      return { ok: true };
    };

    // =========================
    // ✅ WOW: Candidate ID + Score + Dossier
    // =========================
    const wowFill = document.getElementById("wowFill");
    const wowScoreNum = document.getElementById("wowScoreNum");
    const wowChance = document.getElementById("wowChance");
    const wowBadge = document.getElementById("wowBadge");
    const wowHint = document.getElementById("wowHint");

    const candIdEl = document.getElementById("candId");
    const candDiscordEl = document.getElementById("candDiscord");
    const candClassEl = document.getElementById("candClass");
    const candStatusEl = document.getElementById("candStatus");

    const ensureCandidateId = () => {
      let id = localStorage.getItem(CAND_KEY);
      if (id) return id;

      // якщо є discord id — робимо більш "стабільно"
      const did = String(window.AUTH_USER?.id || "");
      let num = 0;
      for (let i = 0; i < did.length; i++) num = (num * 31 + did.charCodeAt(i)) >>> 0;

      const rnd = (num || Math.floor(Math.random() * 99999)) % 100000;
      id = "CSTR-" + String(rnd).padStart(5, "0");
      localStorage.setItem(CAND_KEY, id);
      return id;
    };

    const getTextLen = (id) => {
      const el = document.getElementById(id);
      const v = (el?.value || "").trim();
      return v.length;
    };

    const getSelectVal = (id) => (document.getElementById(id)?.value || "").trim();

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    // =========================
    // ✅ SAFE CALL (ніколи не ламає flow)
    // =========================
    const wowSafe = (fn) => { try { if (typeof fn === "function") fn(); } catch(e){ console.warn("wowSafe:", e); } };

    const computeScore = () => {
      // базова “вага” (0..100)
      let score = 0;

      // AUTH
      if (window.AUTH_USER?.id) score += 18;

      // agree
      if (agreeChk.checked) score += 6;

      // photo
      const hasPhoto = !!photoInput?.files?.[0];
      if (hasPhoto) score += 12;

      // time on server
      const tos = getSelectVal("timeOnServer");
      if (tos === "Понад 6 місяців") score += 10;
      else if (tos === "3–6 місяці") score += 8;
      else if (tos === "1–3 місяці") score += 6;
      else if (tos === "Менше місяця") score += 4;

      // hours per day (simple parse)
      const hpd = (document.getElementById("hoursPerDay")?.value || "").trim();
      if (hpd.length >= 3) score += 5;

      // mic
      const mic = getSelectVal("mic");
      if (mic === "Так") score += 8;
      else if (mic === "Ні") score += 2;

      // rules/rename
      const rules = getSelectVal("rules");
      const rename = getSelectVal("rename");
      if (rules.startsWith("Так")) score += 6;
      if (rename === "Так") score += 5;

      // text depth
      const expL = getTextLen("exp");
      const whyL = getTextLen("why");
      const sklL = getTextLen("skills");

      score += clamp(Math.floor(expL / 80), 0, 10);
      score += clamp(Math.floor(whyL / 80), 0, 10);
      score += clamp(Math.floor(sklL / 80), 0, 8);

      // name + age (irl)
      const nameL = (irlNameInput?.value || "").trim().length;
      const ageV = Number((irlAgeInput?.value || "").trim());
      if (nameL >= 2) score += 4;
      if (ageV >= 14 && ageV <= 60) score += 3;

      // progress boost (поведінковий вау)
      const p = updateProgress(); // 0..100
      score += clamp(Math.round(p / 25), 0, 4); // +0..4

      score = clamp(score, 0, 100);

      // tier
      let tier = "Weak";
      let chance = "НИЗЬКИЙ";
      let hint = "Заповни детальніше — це підніме шанс.";
      if (score >= 80) { tier = "Elite"; chance = "ВИСОКИЙ"; hint = "Сильний профіль. Тримай рівень і не лий воду."; }
      else if (score >= 55) { tier = "Good"; chance = "СЕРЕДНІЙ"; hint = "Добре. Додай конкретики в мотивації/навичках."; }
      else { tier = "Weak"; chance = "НИЗЬКИЙ"; hint = "Потрібно більше деталей + фото + мікрофон."; }

      return { score, tier, chance, hint };
    };

    const updateWow = () => {
      const id = ensureCandidateId();
      if (candIdEl) candIdEl.textContent = id;

      const u = window.AUTH_USER;
      const name = (u?.username || u?.global_name || u?.name || "").trim();
      if (candDiscordEl) candDiscordEl.textContent = name ? ("@" + name.replace(/^@+/, "")) : "—";

      const { score, tier, chance, hint } = computeScore();

      if (wowScoreNum) wowScoreNum.textContent = String(score);
      if (wowFill) wowFill.style.width = score + "%";
      if (wowChance) wowChance.textContent = "Шанс: " + chance;
      if (wowBadge) wowBadge.textContent = tier;
      if (wowHint) wowHint.textContent = hint;

      if (candClassEl) candClassEl.textContent = tier;
      if (candStatusEl) candStatusEl.textContent = u?.id ? "Авторизований" : "Очікує Discord";

      // стилізація badge
      wowBadge?.classList.toggle("is-elite", tier === "Elite");
      wowBadge?.classList.toggle("is-good", tier === "Good");
      wowBadge?.classList.toggle("is-weak", tier === "Weak");
    };

    // init wow
    wowSafe(updateWow);

    // =========================
    // =========================
    // ✅ WOW: Cinematic overlay controls (MAXIMUM WOW)
    // =========================
    const wowOverlay = document.getElementById("wowOverlay");
    const wowOverlayFill = document.getElementById("wowOverlayFill");
    const wowOverlayMain = document.getElementById("wowOverlayMain");
    const wowOverlaySub = document.getElementById("wowOverlaySub");
    const wowStepsWrap = document.getElementById("wowOverlaySteps");
    const wowOverlayPct = document.getElementById("wowOverlayPct");
    const wowOverlayId = document.getElementById("wowOverlayId");
    const wowOverlayTerm = document.getElementById("wowOverlayTerm");
    const wowOverlayActions = document.getElementById("wowOverlayActions");
    const wowOverlayJoin = document.getElementById("wowOverlayJoin");
    const wowOverlayHome = document.getElementById("wowOverlayHome");
    const wowOverlayClose = document.getElementById("wowOverlayClose");


    let wowTimer = null;
    let wowTypingToken = 0;

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
      // keep last ~10 lines
      while (wowOverlayTerm.children.length > 10) wowOverlayTerm.removeChild(wowOverlayTerm.firstElementChild);
      wowOverlayTerm.scrollTop = wowOverlayTerm.scrollHeight;
    };

    const typeTo = (el, text, speed = 18) => {
      if (!el) return;
      const token = ++wowTypingToken;
      el.textContent = ""; try{ el.setAttribute("data-text", text); }catch(e){}
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
        if (audioCtx.state === "suspended") audioCtx.resume();
      }catch(e){}
    };
    const beep = (freq = 880, durMs = 80, vol = 0.02) => {
      if (!audioCtx) return;
      const t0 = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs/1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + durMs/1000 + 0.02);
    };

    const showOverlay = () => {
      if (!wowOverlay) return;
      ensureAudio();

      wowOverlay.classList.remove("wowHidden");
      wowOverlay.classList.add("is-active");
      wowOverlay.setAttribute("aria-hidden", "false");

      const cid = ensureCandidateId();
      if (wowOverlayId) wowOverlayId.textContent = cid;

      if (wowOverlayTerm) wowOverlayTerm.innerHTML = "";
      termPush(`[${cid}] BOOT :: init protocol`);
      termPush(`AUTH :: ${window.AUTH_USER?.id ? "OK" : "WAIT"}`);

      setOverlayProgress(0);
      markStep(0);
      wowOverlayMain?.classList.remove("wowGlitch--ok", "wowGlitch--err");
      typeTo(wowOverlayMain, "Перевіряємо анкету…");
      if (wowOverlaySub) wowOverlaySub.textContent = "Готуємо дані до захищеної передачі.";
      document.documentElement.classList.add("wowLock");
      document.body.classList.add("protocolMode");
      if (wowOverlayJoin) wowOverlayJoin.href = DISCORD_INVITE;
      if (wowOverlayActions) wowOverlayActions.classList.add("wowHidden");
      if (wowOverlayClose) wowOverlayClose.classList.add("wowHidden");

      // Short visual timeline; real completion is controlled by the server response.
      const timeline = [
        { t: 120,  step:0, p: 16, main:"Перевіряємо анкету…", sub:"Звіряємо обов’язкові поля та вкладення.", log:"FORM :: verified" },
        { t: 650,  step:1, p: 52, main:"Захищено передаємо заявку…", sub:"Надсилаємо дані на сервер Family Castro.", log:"NET :: secure transfer" },
        { t: 1250, step:2, p: 84, main:"Очікуємо підтвердження…", sub:"Заявка вже майже передана.", log:"NET :: awaiting response" },
      ];

      // clear old
      if (wowTimer) clearInterval(wowTimer);
      wowTimer = null;

      // drive smooth progress between points
      const start = performance.now();
      let lastIdx = -1;

      const tick = () => {
        const now = performance.now();
        const elapsed = now - start;

        // find current segment
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

        // interpolate progress
        const prev = idx <= 0 ? {t:0, p:0} : timeline[idx-1];
        const curr = idx < 0 ? {t:0, p:0} : timeline[idx];
        const next = (idx+1 < timeline.length) ? timeline[idx+1] : curr;

        const segStartT = curr.t;
        const segEndT = next.t;
        const segStartP = curr.p;
        const segEndP = next.p;

        const x = (segEndT === segStartT) ? 1 : clamp((elapsed - segStartT) / (segEndT - segStartT), 0, 1);
        const p = segStartP + (segEndP - segStartP) * x;

        // do not exceed 88 unless success sets 100
        const capped = Math.min(p, 88);
        setOverlayProgress(capped);

        // subtle terminal "typing" pulse
        if (elapsed > 2000 && (Math.floor(elapsed/1200) !== Math.floor((elapsed-50)/1200))) {
          termPush("…");
        }

        wowTimer = requestAnimationFrame(tick);
      };

      wowTimer = requestAnimationFrame(tick);
    };

    const hideOverlay = () => {
      if (wowTimer) {
        try { cancelAnimationFrame(wowTimer); } catch(e) {}
        wowTimer = null;
      }
      if (!wowOverlay) return;
      wowOverlay.classList.add("wowHidden");
      wowOverlay.classList.remove("is-active");
      wowOverlay.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("wowLock");
      document.body.classList.remove("protocolMode");
    };

    // Close button (only on error)
    wowOverlayClose?.addEventListener("click", () => {
      hideOverlay();
      // allow user to try again
      syncAgree?.();
    });


    const overlaySuccess = () => {
      if (wowTimer) {
        try { cancelAnimationFrame(wowTimer); } catch(e) {}
        wowTimer = null;
      }
      markStep(3);
      setOverlayProgress(100);
      termPush("OK :: protocol complete");
      if (wowOverlayMain) {
        wowOverlayMain.classList.add("wowGlitch--ok");
        typeTo(wowOverlayMain, "Заявку успішно передано", 14);
      }
      if (wowOverlaySub) wowOverlaySub.textContent = "Ми отримали анкету. Статус можна відстежувати у Discord.";
      beep(1100, 110, 0.022);
            // stay on full-page protocol screen + show buttons
      if (wowOverlayActions) wowOverlayActions.classList.remove("wowHidden");
};

    const overlayFail = (msg) => {
      if (wowTimer) {
        try { cancelAnimationFrame(wowTimer); } catch(e) {}
        wowTimer = null;
      }
      setOverlayProgress(35);
      termPush("ERR :: " + (msg || "unknown"));
      if (wowOverlayMain) {
        wowOverlayMain.classList.add("wowGlitch--err");
        typeTo(wowOverlayMain, "⚠ Помилка протоколу", 14);
      }
      if (wowOverlaySub) wowOverlaySub.textContent = msg || "Спробуй ще раз.";
      if (wowOverlayClose) wowOverlayClose.classList.remove("wowHidden");
      beep(220, 160, 0.028);
      // Keep the error visible until the user closes it and retries.
    };

    // =========================
    // ✅ Відправка форми
    // =========================

    form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!window.AUTH_USER) {
    statusEl.textContent = "⛔ Увійди через Discord перед відправкою заявки.";
    return;
  }

  if (sending) return;

  const v = validateBeforeSubmit();
  if (!v.ok) {
    statusEl.textContent = v.msg;
    return;
  }

  sending = true;
  btn.disabled = true;

  try {
    const api = window.CastroProfile;
    if (api?.loadProfile && api?.canSubmitJoin) {
      const prof = await api.loadProfile();
      const gate = api.canSubmitJoin(prof);
      if (!gate.ok) {
        statusEl.textContent = gate.reason;
        sending = false;
        syncAgree();
        wowSafe(updateWow);
        return;
      }
    }
  } catch (e) {
    console.warn("join gate check failed:", e);
    statusEl.textContent = "Не вдалося перевірити профіль. Онови сторінку та спробуй ще раз.";
    sending = false;
    syncAgree();
    wowSafe(updateWow);
    return;
  }

  showOverlay();
  statusEl.textContent = "⏳ Відправляємо заявку…";

  const fd = new FormData(form);

  const file = photoInput?.files?.[0];
  if (file) fd.set("charPhoto", file, file.name);

  fd.set("agree", agreeChk.checked ? "yes" : "no");

  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "X-Token": submitToken },
      body: fd,
      credentials: "include"
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      const emsg = explainError(res, json);
      statusEl.textContent = emsg;
      overlayFail(emsg);
      await fetchToken();
      sending = false;
      syncAgree();
      wowSafe(updateWow);
      return;
    }

    overlaySuccess();

    try {
      const api = window.CastroProfile;
      if (api?.setJoinPending) await api.setJoinPending();
    } catch (e) {
      console.warn("setJoinPending failed:", e);
    }

    const cid = ensureCandidateId();
    statusEl.textContent = "✅ Готово. Перевір Discord.";
    okEl.style.display = "block";
    if (actionsEl) actionsEl.style.display = "none";

    if (okText) {
      okText.textContent = `Твоє досьє створено. Номер кандидата: ${cid}. Приєднуйся до Discord для зв’язку.`;
    }

    localStorage.removeItem(DRAFT_KEY);

    form.reset();
    clearPhoto();

    okEl.scrollIntoView({ behavior: "smooth", block: "start" });

    syncAgree();
    wowSafe(updateWow);
    await fetchToken();
  } catch (err) {
    console.error(err);
    const msg = "❌ Помилка мережі. Перевір інтернет і спробуй ще раз.";
    statusEl.textContent = msg;
    overlayFail(msg);
    await fetchToken();
    sending = false;
    syncAgree();
    wowSafe(updateWow);
    return;
  }

  sending = false;
});


// ---------- Статус заявки з профілю ----------
(async () => {

  if (!window.CastroProfile) return;

  try {
    const profile = await window.CastroProfile.loadProfile();

    if (!profile) return;

    const status = profile.applicationStatus;

    if (status === "accepted") {

      const okBox = document.getElementById("ok");
      const okText = document.getElementById("okText");

      if (okBox && okText) {
        okBox.style.display = "block";
        okText.textContent = "✅ Твою заявку прийнято. Приєднуйся до Discord!";
      }

    }

    if (status === "rejected") {

      const statusEl = document.getElementById("status");

      if (statusEl) {
        statusEl.textContent = "❌ Заявку відхилено. Можеш подати нову.";
      }

    }

  } catch (e) {
    console.warn("profile refresh failed", e);
  }

})();

// ---------- Підказка авторизації / статус заявки ----------
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
    text.innerHTML = "<b>Крок 2 з 2:</b> профіль не завершений. Натисни кнопку нижче, введи Ім’я Прізвище персонажа та числовий Static ID, потім натисни «Зберегти».";
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

  const base = (window.CASTRO_JOIN_WORKER_BASE || "https://join.family-castro.com").replace(/\/+$/, "");
  const uid = user?.id || user?.discord_id || user?.discordId || user?.user_id;
  const submitBtn = document.getElementById("submitBtn");

  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const setSubmitEnabled = (ok) => {
    if (!submitBtn) return;
    submitBtn.disabled = !ok;
  };

  setSubmitEnabled(true);

  if(!uid){
    text.innerHTML = "✅ Профіль готовий. Можеш оформлювати анкету.";
    return;
  }

  if (renderAuthHint._loading) return;
  renderAuthHint._loading = true;

  try{
    const r = await fetch(`${base}/profile?uid=${encodeURIComponent(uid)}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await r.json().catch(() => ({}));
    const profile = data?.profile || {};

    const st = String(profile.applicationStatus || profile.application_status || "").toLowerCase();
    // NG worker віддає joinCooldownUntil як ISO-рядок
    const cdRaw = profile.joinCooldownUntil || profile.cooldownUntil || profile.cooldown_until || 0;
    const cooldownUntil = (typeof cdRaw === "number" ? cdRaw : (Number(cdRaw) || Date.parse(cdRaw))) || 0;
    const now = Date.now();
    const cdLeft = cooldownUntil ? (cooldownUntil - now) : 0;

    if(st === "accepted"){
      hint.hidden = false;
      text.innerHTML = "✅ Твою заявку <b>прийнято</b>. Повторно подати анкету не можна.";
      actions.innerHTML = `
        <button class="authHint__btn" onclick="openProfileModal()">👤 Відкрити профіль</button>
      `;
      setSubmitEnabled(false);
      return;
    }

    if(st === "pending"){
      hint.hidden = false;
      text.innerHTML = "⏳ Твоя заявка <b>очікує розгляду</b>. Якщо помилився — відміни заявку в профілі.";
      actions.innerHTML = `
        <button class="authHint__btn" onclick="openProfileModal()">👤 Відкрити профіль</button>
      `;
      setSubmitEnabled(false);
      return;
    }

    if(cdLeft > 0){
      hint.hidden = false;
      const renderCd = () => {
        const left = Math.max(0, cooldownUntil - Date.now());
        text.innerHTML = `⏱️ Після відміни діє КД <b>${fmt(left)}</b>. Потім можна подати повторно.`;
        if(left <= 0){
          clearInterval(renderAuthHint._cdTimer);
          renderAuthHint._cdTimer = null;
          renderAuthHint._loading = false;
          renderAuthHint();
        }
      };

      if(renderAuthHint._cdTimer) clearInterval(renderAuthHint._cdTimer);
      renderCd();
      renderAuthHint._cdTimer = setInterval(renderCd, 1000);

      actions.innerHTML = `
        <button class="authHint__btn" onclick="openProfileModal()">👤 Відкрити профіль</button>
      `;
      setSubmitEnabled(false);
      return;
    }

    if(st === "rejected"){
      hint.hidden = false;
      text.innerHTML = "❌ Заявку <b>відхилено</b>. Ти можеш подати анкету повторно.";
      actions.innerHTML = `
        <button class="authHint__btn" onclick="openProfileModal()">👤 Відкрити профіль</button>
      `;
      setSubmitEnabled(true);
      return;
    }

    text.innerHTML = "✅ Профіль готовий. Можеш оформлювати анкету.";
    setSubmitEnabled(true);
  } catch(e){
    console.warn("renderAuthHint failed:", e);
    hint.hidden = false;
    text.innerHTML = "⚠️ Не вдалося перевірити статус заявки. Онови сторінку та спробуй ще раз.";
    setSubmitEnabled(false);
  } finally{
    renderAuthHint._loading = false;
  }
}

window.addEventListener("castro-auth", renderAuthHint);
window.addEventListener("castro-profile", renderAuthHint);
document.addEventListener("DOMContentLoaded", renderAuthHint);

})();

// ---------- Статистика сімʼї (онлайн / всього) ----------
(() => {
  const onlineEl = document.getElementById("fcOnlineTop");
  const totalEl  = document.getElementById("fcTotalTop");
  if (!onlineEl || !totalEl) return;

  const STATS_URL = "https://api.family-castro.com/api/family/stats";

  async function updateStats(){
    try{
      const r = await fetch(STATS_URL, { cache: "no-store", credentials: "include" });
      const j = await r.json().catch(()=>null);
      if (!r.ok || !j) throw new Error(j?.error || "bad response");

      onlineEl.textContent = (typeof j.online === "number" ? j.online : "—");
      totalEl.textContent  = (typeof j.total  === "number" ? j.total  : "—");
    }catch{
      onlineEl.textContent = "—";
      totalEl.textContent  = "—";
    }
  }

  updateStats();
  setInterval(updateStats, 60000); // раз на хвилину
})();
