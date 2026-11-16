/* =========================================================
   Family Castro — Auth Tip (stable + logical)
   Логіка:
   ✅ Якщо НЕ авторизований -> показує завжди при заході
   ✅ Якщо авторизований, але профіль НЕ заповнений (ic + sid) -> показує
   ✅ Якщо профіль заповнений -> НЕ показує
   ✅ Після логіну/логауту (подія castro-auth) -> перевіряє знову і показує/ховає
   ✅ Кнопка "Авторизуватись":
        - якщо не залогінений -> натискає Discord login
        - якщо залогінений -> відкриває модалку профілю (profile.js), якщо доступна
   Debug:
     ?tip=1 -> форс-показ
========================================================= */
(() => {
  const AUTH_BASE = "https://auth.family-castro.com";
  const PROFILE_URL = AUTH_BASE + "/profile";
  const DISMISSED_KEY = "castro-auth-tip-dismissed";

  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  };

  const getUser = () => window.__CASTRO_AUTH__?.user || null;

  const loadProfile = async () => {
    try {
      const res = await fetch(PROFILE_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) return {};
      return j.profile || {};
    } catch {
      return {};
    }
  };

  const isProfileOk = (p) => {
    const ic = String(p?.ic || "").trim();
    const sid = String(p?.sid || "").trim();
    return !!(ic && sid);
  };

  ready(() => {
    const tip = document.getElementById("auth-tip");
    const loginBtn = document.getElementById("auth-login") || document.querySelector(".auth__btn");
    const userBox = document.getElementById("auth-user");
    if (!tip || !loginBtn) return;

    // IMPORTANT: кнопки беремо тільки всередині tip (на випадок дублів)
    const goBtn = tip.querySelector("#authtip-go");
    const closeBtn = tip.querySelector("#authtip-close");

    // Текстові елементи (для 2 станів)
    const titleEl = tip.querySelector(".authtip__title");
    const textMainEl = tip.querySelector("#authtip-text-main");
    const monoEl  = tip.querySelector("#authtip-mono");

    const setState = (mode) => {
      // mode: "guest" | "need_profile"
      if (titleEl) titleEl.textContent = mode === "guest" ? "Доступ до заявок" : "Заверши профіль";

      if (mode === "guest") {
        if (textMainEl) textMainEl.textContent = "Увійди через Discord і налаштуй профіль.";
        if (monoEl) monoEl.style.display = "";
        if (goBtn) goBtn.textContent = "Увійти через Discord";
      } else {
        if (textMainEl) textMainEl.textContent = "Додай імʼя персонажа та Static ID.";
        if (monoEl) monoEl.style.display = "none";
        if (goBtn) goBtn.textContent = "Налаштувати";
      }
    };

    const url = new URL(location.href);
    const force = url.searchParams.get("tip") === "1";

    const isLoggedInUI = () => !!getUser() && userBox && !userBox.classList.contains("hidden");

    const getAnchor = () => (isLoggedInUI() ? userBox : loginBtn);

    const place = () => {
      const anchor = getAnchor();
      const r = anchor.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return;

      const bubble = tip.querySelector(".authtip__bubble");
      const bubbleW = bubble ? bubble.getBoundingClientRect().width : Math.min(360, window.innerWidth - 24);

      const gap = 16;
      const preferLeft = r.right > window.innerWidth * 0.6;
      const roomSide = preferLeft ? r.left - gap - 12 : window.innerWidth - r.right - gap - 12;

      let left;
      let top;
      if (roomSide >= bubbleW) {
        // Є місце збоку від кнопки
        left = preferLeft ? Math.round(r.left - bubbleW - gap) : Math.round(r.right + gap);
        top  = Math.round(r.top + r.height / 2 - 54);
      } else {
        // Вузький екран: ставимо під кнопкою, щоб не перекривати її
        left = preferLeft ? Math.round(r.right - bubbleW) : Math.round(r.left);
        top  = Math.round(r.bottom + 10);
      }

      if (left < 12) left = 12;
      if (left + bubbleW > window.innerWidth - 12) left = Math.round(window.innerWidth - bubbleW - 12);
      if (top < 12) top = 12;
      if (top > window.innerHeight - 140) top = Math.round(window.innerHeight - 140);

      tip.style.left = left + "px";
      tip.style.top  = top + "px";
    };

    const open = () => {
      tip.classList.add("is-open");
      tip.setAttribute("aria-hidden", "false");
      place();
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
    };

    const close = (remember = false) => {
      tip.classList.remove("is-open");
      tip.setAttribute("aria-hidden", "true");
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (remember) {
        try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
      }
    };

    const openProfileModalIfPossible = () => {
      // profile.js не експортує openModal у window, тому ми "клікаємо" по кнопці/боксу юзера,
      // бо в profile.js там зазвичай висить відкриття модалки.
      if (typeof window.openProfileModal === "function") {
        window.openProfileModal();
        return true;
      }
      // fallback: клік по userBox якщо він є
      if (userBox && !userBox.classList.contains("hidden")) {
        userBox.click?.();
        return true;
      }
      return false;
    };

    goBtn?.addEventListener("click", () => {
      const anchor = getAnchor();
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });

      if (!isLoggedInUI()) {
        loginBtn.focus?.();
        loginBtn.click?.();
      } else {
        // залогінений -> відкриваємо профіль (щоб ввів ic/sid)
        openProfileModalIfPossible();
      }
      close(true);
    });

    closeBtn?.addEventListener("click", () => close(true));

    // --- головна функція перевірки/показу
    let lastDecision = null; // "show" | "hide"
    const evaluate = async () => {
      if (force) {
        if (lastDecision !== "show") open();
        lastDecision = "show";
        return;
      }

      try {
        if (sessionStorage.getItem(DISMISSED_KEY) === "1") {
          close();
          lastDecision = "hide";
          return;
        }
      } catch {}

      const user = getUser();
      const authed = !!user;

      if (!authed) {
        setState("guest");
        if (lastDecision !== "show") open();
        lastDecision = "show";
        return;
      }

      // authed -> перевір профіль
      const p = await loadProfile();
      const ok = isProfileOk(p);

      if (ok) {
        if (lastDecision !== "hide") close();
        lastDecision = "hide";
      } else {
        setState("need_profile");
        if (lastDecision !== "show") open();
        lastDecision = "show";
      }
    };

    // Не показуємо підказку поверх лоадера / до завершення інтро головної
    const pageReady = () => {
      const loader = document.getElementById("vload");
      const loaderHidden = !loader || loader.classList.contains("is-hide");
      const root = document.documentElement;
      return loaderHidden &&
        !root.classList.contains("home-intro-pending") &&
        !root.classList.contains("page-transition-entering");
    };

    const whenPageReady = () => new Promise((resolve) => {
      if (pageReady()) return resolve();
      const obs = new MutationObserver(() => {
        if (!pageReady()) return;
        obs.disconnect();
        resolve();
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"], subtree: true });
    });

    let started = false;
    const evaluateWhenReady = () => {
      if (!started) return;
      setTimeout(() => { evaluate(); }, 0);
    };

    // Старт: чекаємо лоадер і даємо auth.js встигнути fetchMe + emitAuth
    whenPageReady().then(() => setTimeout(() => {
      started = true;
      evaluate();
    }, 700));

    // На зміну стану (auth.js міняє UI синхронно, але надійніше — через макротаск)
    window.addEventListener("castro-auth", evaluateWhenReady);

    // Після збереження профілю (profile.js диспатчить) — перевіряємо знову
    window.addEventListener("castro-profile", evaluateWhenReady);
  });
})();
