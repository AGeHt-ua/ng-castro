(() => {
  const storageKey = "castro-page-transition-v2";
  const legacyStorageKey = "castro-page-transition";
  const root = document.documentElement;
  const staticRoutes = new Set(["/", "/info/", "/join/", "/shop/", "/info/legal/", "/shop/reviews/"]);
  const pageDetails = new Map([
    ["/", { title:"ГОЛОВНА СТОРІНКА", subtitle:"Порядок • Дисципліна • Сила" }],
    ["/info/", { title:"ІНФОРМАЦІЯ", subtitle:"Кодекс • База • Автопарк" }],
    ["/join/", { title:"ВСТУП ДО СІМ’Ї", subtitle:"Анкета кандидата CASTRO" }],
    ["/shop/", { title:"МАГАЗИН CASTRO", subtitle:"Зброя • Спорядження • Сервіс" }],
    ["/info/legal/", { title:"ПРАВОВА ІНФОРМАЦІЯ", subtitle:"Умови • Приватність • Правила" }],
    ["/shop/reviews/", { title:"ВІДГУКИ", subtitle:"Довіра спільноти CASTRO" }],
  ]);

  const normalizePath = (pathname) => {
    if (pathname === "/") return pathname;
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  };

  const detailsFor = (pathname) =>
    pageDetails.get(normalizePath(pathname)) || { title:"FAMILY CASTRO", subtitle:"Official Family • NG GTA 5" };

  /* The loader itself is critical UI, so request its only image as early as possible. */
  if (!document.head.querySelector('link[data-castro-loader-preload]')) {
    const loaderPreload = document.createElement("link");
    loaderPreload.rel = "preload";
    loaderPreload.as = "image";
    loaderPreload.href = "/assets/hero.gif";
    loaderPreload.dataset.castroLoaderPreload = "";
    document.head.append(loaderPreload);
  }

  const normalizeStaticDestination = (url) => {
    const normalized = new URL(url.href);
    if (!normalized.pathname.endsWith("/") && staticRoutes.has(`${normalized.pathname}/`)) {
      normalized.pathname += "/";
    }
    return normalized;
  };

  let arrivalState = null;

  try {
    const storedState = sessionStorage.getItem(storageKey);
    const arrivedViaLegacyTransition = sessionStorage.getItem(legacyStorageKey) === "1";

    if (storedState) arrivalState = JSON.parse(storedState);
    if (arrivalState || arrivedViaLegacyTransition) {
      const x = Number(arrivalState?.x);
      const y = Number(arrivalState?.y);

      if (Number.isFinite(x)) root.style.setProperty("--page-transition-x", `${x}%`);
      if (Number.isFinite(y)) root.style.setProperty("--page-transition-y", `${y}%`);
      root.classList.add("page-transition-entering");
      root.classList.add("page-transition-managed-arrival");
    }

    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(legacyStorageKey);
  } catch (_) {}

  const seedLoadingMarkup = (host, details) => {
    if (!host) return null;

    const eyebrow = host.querySelector(".page-transition__text, .vload__text");
    const logo = host.querySelector("img");
    if (!eyebrow || !logo) return null;

    host.classList.add("castro-loader--enhanced");
    eyebrow.classList.add("castro-loader__eyebrow");
    if (eyebrow.textContent !== "CASTRO SYSTEM") eyebrow.textContent = "CASTRO SYSTEM";

    let pageTitle = host.querySelector(".castro-loader__page");
    if (!pageTitle) {
      pageTitle = document.createElement("div");
      pageTitle.className = "castro-loader__page";
      eyebrow.insertAdjacentElement("afterend", pageTitle);
    }

    let pageSubtitle = host.querySelector(".castro-loader__subtitle");
    if (!pageSubtitle) {
      pageSubtitle = document.createElement("div");
      pageSubtitle.className = "castro-loader__subtitle";
      pageTitle.insertAdjacentElement("afterend", pageSubtitle);
    }

    if (pageTitle.textContent !== details.title) pageTitle.textContent = details.title;
    if (pageSubtitle.textContent !== details.subtitle) pageSubtitle.textContent = details.subtitle;

    let track = host.querySelector(".page-transition__line, .castro-loader__track");
    if (!track) {
      track = document.createElement("div");
      host.append(track);
    }
    track.classList.add("castro-loader__track");

    let bar = track.querySelector("span");
    if (!bar) {
      bar = document.createElement("span");
      track.append(bar);
    }
    bar.classList.add("castro-loader__bar");

    let statusRow = host.querySelector(".castro-loader__status");
    if (!statusRow) {
      statusRow = document.createElement("div");
      statusRow.className = "castro-loader__status";
      statusRow.setAttribute("role", "status");
      statusRow.setAttribute("aria-live", "polite");
      track.insertAdjacentElement("afterend", statusRow);
    }

    let statusText = statusRow.querySelector(".castro-loader__status-text");
    if (!statusText) {
      statusText = document.createElement("span");
      statusText.className = "castro-loader__status-text";
      statusRow.append(statusText);
    }

    let percent = statusRow.querySelector(".castro-loader__percent");
    if (!percent) {
      percent = document.createElement("span");
      percent.className = "castro-loader__percent";
      statusRow.append(percent);
    }

    if (!percent.textContent) {
      const entering = root.classList.contains("page-transition-entering");
      const initialProgress = entering && host.classList.contains("page-transition__loader") ? 42 : 8;
      host.style.setProperty("--castro-loader-progress", String(initialProgress / 100));
      statusText.textContent = entering ? "Завантажуємо фон" : "Підключення до CASTRO";
      percent.textContent = `${initialProgress}%`;
    }

    return { pageTitle, pageSubtitle, track, bar, statusRow, statusText, percent };
  };

  const seedAvailableLoaders = () => {
    const details = detailsFor(location.pathname);
    const transitionLoader = document.querySelector(".page-transition__loader");
    const pageLoader = document.querySelector("#vload .vload__center");
    seedLoadingMarkup(transitionLoader, details);
    seedLoadingMarkup(pageLoader, details);
    return Boolean(transitionLoader && pageLoader);
  };

  const earlyLoaderObserver = new MutationObserver(() => {
    if (seedAvailableLoaders()) earlyLoaderObserver.disconnect();
  });
  earlyLoaderObserver.observe(root, { childList:true, subtree:true });
  if (seedAvailableLoaders()) earlyLoaderObserver.disconnect();

  const ready = () => {
    earlyLoaderObserver.disconnect();
    seedAvailableLoaders();

    const overlay = document.querySelector(".page-transition");
    if (!overlay) return;

    const arrivedFromAnotherPage = root.classList.contains("page-transition-entering");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const wait = (milliseconds) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const createLoadingDisplay = (host, details) => {
      if (!host) return null;
      if (host.__castroLoadingDisplay) {
        host.__castroLoadingDisplay.setPage(details);
        return host.__castroLoadingDisplay;
      }

      const seeded = seedLoadingMarkup(host, details);
      if (!seeded) return null;
      const { pageTitle, pageSubtitle, statusText, percent } = seeded;

      let currentProgress = Number.parseInt(percent.textContent, 10) || 0;
      const api = {
        setPage(nextDetails) {
          pageTitle.textContent = nextDetails.title;
          pageSubtitle.textContent = nextDetails.subtitle;
        },
        setProgress(value, status, force = false) {
          const nextProgress = Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
          if (!force && nextProgress < currentProgress) return;
          currentProgress = nextProgress;
          host.style.setProperty("--castro-loader-progress", String(nextProgress / 100));
          percent.textContent = `${nextProgress}%`;
          if (status) statusText.textContent = status;
          host.classList.toggle("is-complete", nextProgress >= 100);
        },
      };

      api.setPage(details);
      api.setProgress(currentProgress, statusText.textContent || "Підключення до CASTRO", true);
      host.__castroLoadingDisplay = api;
      return api;
    };

    const transitionTime = () => {
      const styles = getComputedStyle(overlay);
      const durations = styles.transitionDuration.split(",").map(value => {
        const duration = Number.parseFloat(value);
        return value.trim().endsWith("ms") ? duration : duration * 1000;
      });
      return Math.max(0, ...durations.filter(Number.isFinite));
    };

    const waitForOverlayTransition = (expectedOpacity) => new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        overlay.removeEventListener("transitionend", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target === overlay && event.propertyName === "opacity") finish();
      };

      overlay.addEventListener("transitionend", onTransitionEnd);
      window.setTimeout(finish, transitionTime() + 120);

      if (getComputedStyle(overlay).opacity === String(expectedOpacity)) {
        requestAnimationFrame(() => {
          if (getComputedStyle(overlay).opacity === String(expectedOpacity)) finish();
        });
      }
    });

    const findBackgroundVideo = () =>
      document.querySelector(".video-bg video") ||
      document.querySelector(".hero-bg video") ||
      document.querySelector("video#bgVideo") ||
      document.querySelector("video");

    const overlayDisplay = createLoadingDisplay(
      overlay.querySelector(".page-transition__loader"),
      detailsFor(location.pathname)
    );

    const pageLoader = document.getElementById("vload");
    if (arrivedFromAnotherPage && pageLoader) {
      pageLoader.classList.add("is-hide", "is-transition-suppressed");
      pageLoader.setAttribute("aria-hidden", "true");
      root.classList.remove("is-video-loading");
      document.body.classList.remove("is-video-loading");
    }

    const pageLoaderDisplay = createLoadingDisplay(
      pageLoader?.querySelector(".vload__center"),
      detailsFor(location.pathname)
    );

    const runInitialLoaderStatus = () => {
      if (!pageLoader || !pageLoaderDisplay) return;

      const timers = [];
      let finished = false;
      const schedule = (delay, progress, status) => timers.push(window.setTimeout(() => {
        if (!finished) pageLoaderDisplay.setProgress(progress, status);
      }, delay));
      const clearTimers = () => timers.forEach(timer => window.clearTimeout(timer));

      pageLoaderDisplay.setProgress(10, "Підключення до CASTRO");
      schedule(260, 28, "Завантажуємо фон");
      schedule(650, 48, "Готуємо інтерфейс");
      schedule(1100, 66, "Перевіряємо ресурси");
      schedule(1800, 78, "Майже готово");
      schedule(3500, 86, "Фінальна підготовка");

      const video = findBackgroundVideo();
      const markBackgroundReady = () => {
        if (!finished) pageLoaderDisplay.setProgress(92, "Фон готовий");
      };

      if (video) {
        if (video.readyState >= 2) markBackgroundReady();
        else {
          video.addEventListener("loadeddata", markBackgroundReady, { once:true });
          video.addEventListener("canplay", markBackgroundReady, { once:true });
        }
      } else if (document.readyState === "complete") markBackgroundReady();
      else window.addEventListener("load", markBackgroundReady, { once:true });

      const finish = () => {
        if (finished) return;
        const hidden = pageLoader.classList.contains("is-hide") || pageLoader.getAttribute("aria-hidden") === "true";
        if (!hidden) return;
        finished = true;
        clearTimers();
        observer.disconnect();
        pageLoaderDisplay.setProgress(100, "Готово");
      };

      const observer = new MutationObserver(finish);
      observer.observe(pageLoader, { attributes:true, attributeFilter:["class", "aria-hidden"] });
      finish();
    };

    if (!arrivedFromAnotherPage) runInitialLoaderStatus();

    const waitForBackground = async () => {
      const startedAt = performance.now();
      const minimumLoadingTime = reducedMotion.matches ? 180 : 700;
      const fallbackTime = 7000;
      const video = findBackgroundVideo();

      const backgroundReady = new Promise(resolve => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          requestAnimationFrame(resolve);
        };

        if (video) {
          if (video.readyState >= 2) finish();
          else {
            video.addEventListener("loadeddata", finish, { once:true });
            video.addEventListener("canplay", finish, { once:true });
            try { video.load(); } catch (_) {}
          }
        } else if (document.readyState === "complete") finish();
        else window.addEventListener("load", finish, { once:true });

        window.setTimeout(finish, fallbackTime);
      });

      await backgroundReady;
      const remaining = minimumLoadingTime - (performance.now() - startedAt);
      if (remaining > 0) await wait(remaining);
    };

    const revealDestination = async () => {
      root.classList.add("page-transition-background-only");
      overlayDisplay?.setPage(detailsFor(location.pathname));
      overlayDisplay?.setProgress(42, "Завантажуємо фон");

      const backgroundPromise = waitForBackground().then(() => {
        overlayDisplay?.setProgress(74, "Фон готовий");
      });

      await backgroundPromise;
      overlayDisplay?.setProgress(86, "Готуємо інтерфейс");
      overlayDisplay?.setProgress(94, "Фінальна підготовка");
      await nextPaint();
      overlayDisplay?.setProgress(100, "Готово");
      if (!reducedMotion.matches) await wait(180);

      overlay.setAttribute("aria-hidden", "true");
      root.classList.remove("page-transition-entering");
      await waitForOverlayTransition(0);

      root.classList.remove("page-transition-background-only", "page-transition-managed-arrival");
      root.classList.add("page-transition-content-reveal");
      window.setTimeout(
        () => root.classList.remove("page-transition-content-reveal"),
        reducedMotion.matches ? 240 : 1100
      );
    };

    if (arrivedFromAnotherPage) revealDestination();

    const internalDestination = (link) => {
      if (!link || link.hasAttribute("download") || link.dataset.noTransition != null) return null;
      if (link.target && link.target.toLowerCase() !== "_self") return null;

      let destination;
      try { destination = normalizeStaticDestination(new URL(link.href, location.href)); }
      catch (_) { return null; }

      if (!/^https?:$/.test(destination.protocol) || destination.origin !== location.origin) return null;
      return destination;
    };

    const prefetched = new Set();
    const prefetch = (link) => {
      const destination = internalDestination(link);
      if (!destination || !staticRoutes.has(destination.pathname)) return;
      if (destination.pathname === location.pathname || prefetched.has(destination.href)) return;

      prefetched.add(destination.href);
      const hint = document.createElement("link");
      hint.rel = "prefetch";
      hint.as = "document";
      hint.href = destination.href;
      document.head.append(hint);
    };

    document.addEventListener("pointerover", event => prefetch(event.target.closest?.("a[href]")), { passive:true });
    document.addEventListener("focusin", event => prefetch(event.target.closest?.("a[href]")));

    const prefetchVisibleRoutes = () => document.querySelectorAll("a[href]").forEach(prefetch);
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const avoidIdlePrefetch = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "");
    if (!avoidIdlePrefetch) {
      if ("requestIdleCallback" in window) requestIdleCallback(prefetchVisibleRoutes, { timeout:1800 });
      else window.setTimeout(prefetchVisibleRoutes, 900);
    }

    let leaving = false;

    document.addEventListener("click", async event => {
      if (leaving || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest?.("a[href]");
      const destination = internalDestination(link);
      if (!destination) return;

      const sameDocument =
        destination.pathname === location.pathname &&
        destination.search === location.search;
      if (sameDocument && (destination.hash || destination.href === location.href)) return;

      event.preventDefault();
      leaving = true;

      const transitionX = event.detail === 0 ? window.innerWidth / 2 : event.clientX;
      const transitionY = event.detail === 0 ? window.innerHeight / 2 : event.clientY;
      const xPercent = Math.max(0, Math.min(100, transitionX / window.innerWidth * 100));
      const yPercent = Math.max(0, Math.min(100, transitionY / window.innerHeight * 100));

      overlayDisplay?.setPage(detailsFor(destination.pathname));
      overlayDisplay?.setProgress(12, "Відкриваємо розділ", true);

      root.style.setProperty("--page-transition-x", `${xPercent}%`);
      root.style.setProperty("--page-transition-y", `${yPercent}%`);
      overlay.setAttribute("aria-hidden", "false");
      root.classList.add("page-transition-leaving");

      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ x:xPercent, y:yPercent }));
      } catch (_) {}

      await nextPaint();
      window.setTimeout(() => overlayDisplay?.setProgress(28, "Готуємо перехід"), 160);
      await waitForOverlayTransition(1);
      overlayDisplay?.setProgress(36, "Переходимо");
      await nextPaint();
      location.assign(destination.href);
    });

    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      leaving = false;
      root.classList.remove("page-transition-leaving", "page-transition-entering");
      root.classList.remove("page-transition-background-only", "page-transition-content-reveal", "page-transition-managed-arrival");
      overlay.setAttribute("aria-hidden", "true");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once:true });
  } else ready();
})();
