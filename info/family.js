/* /info — Сімʼя Castro: статистика Discord, керівництво, автопарк, галерея (бічна навігація — у /castro.js) */
(() => {
  // ---------- Статистика Discord (онлайн / всього) ----------
  const onlineEl = document.getElementById("fcOnline2");
  const totalEl = document.getElementById("fcTotal2");
  const STATS_URL = "https://api.family-castro.com/api/family/stats";
  const WIDGET_URL = "https://discord.com/api/guilds/920571973535428628/widget.json";

  async function updateStats(){
    // 1) власний API дає total + online
    try {
      const r = await fetch(STATS_URL, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (typeof j.online === "number") onlineEl.textContent = j.online;
        if (typeof j.total === "number") totalEl.textContent = j.total;
        return;
      }
    } catch (e) {}

    // 2) фолбек: Discord Widget (лише online)
    try {
      const r = await fetch(WIDGET_URL, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      onlineEl.textContent = data.presence_count ?? "—";
    } catch (e) {
      onlineEl.textContent = "—";
    }
  }
  if (onlineEl && totalEl) {
    updateStats();
    setInterval(updateStats, 60000);
  }

  // ---------- Керівництво: розкриття картки ----------
  const crews = [...document.querySelectorAll(".crew")];
  crews.forEach((card) => {
    const btn = card.querySelector(".crew__btn");
    btn?.addEventListener("click", () => {
      const open = !card.classList.contains("is-open");
      crews.forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".crew__btn")?.setAttribute("aria-expanded", "false");
      });
      card.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  // ---------- Автопарк: фільтр категорій ----------
  const tabs = [...document.querySelectorAll("[data-fleet]")];
  const cars = [...document.querySelectorAll(".fm-fleet .car")];
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    const cat = tab.dataset.fleet;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    cars.forEach((car) => {
      car.hidden = cat !== "all" && car.dataset.cat !== cat;
      car.classList.add("is-in");
    });
  }));

  // ---------- Штаб: особняк на карті ----------
  const map = document.getElementById("fmMap");
  const mapBtn = document.querySelector("[data-map-open]");
  if (map && mapBtn) {
    const mapImg = map.querySelector("img");
    const zoomBtn = map.querySelector(".fm-map__zoom");
    const view = map.querySelector(".fm-map__view");
    const closeBtn = map.querySelector(".fm-map__close");
    let mapFocus = null;
    const setZoom = (on) => {
      map.classList.toggle("is-zoomed", on);
      zoomBtn.setAttribute("aria-pressed", String(on));
      zoomBtn.textContent = on ? "↺ Віддалити" : "🔍 Наблизити";
    };
    const openMap = () => {
      mapFocus = document.activeElement;
      if (!mapImg.getAttribute("src")) mapImg.src = mapImg.dataset.src;
      setZoom(false);
      map.hidden = false;
      document.body.classList.add("fm-lock");
      closeBtn.focus();
    };
    const closeMap = () => {
      map.hidden = true;
      document.body.classList.remove("fm-lock");
      mapFocus?.focus();
    };
    mapBtn.addEventListener("click", openMap);
    closeBtn.addEventListener("click", closeMap);
    zoomBtn.addEventListener("click", () => setZoom(!map.classList.contains("is-zoomed")));
    view.addEventListener("click", () => setZoom(!map.classList.contains("is-zoomed")));
    map.addEventListener("click", (e) => { if (e.target === map) closeMap(); });
    document.addEventListener("keydown", (e) => { if (!map.hidden && e.key === "Escape") closeMap(); });
  }

  // ---------- Галерея: лайтбокс ----------
  const lb = document.getElementById("fmLightbox");
  const shots = [...document.querySelectorAll(".fm-gallery .shot")];
  if (lb && shots.length) {
    const img = lb.querySelector("img");
    const tag = lb.querySelector("figcaption small");
    const title = lb.querySelector("figcaption b");
    let index = 0;
    let lastFocus = null;
    let touchX = 0;

    const show = (i) => {
      index = (i + shots.length) % shots.length;
      const shot = shots[index];
      const src = shot.querySelector("img");
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      tag.textContent = shot.querySelector("small")?.textContent || "";
      title.textContent = src.alt;
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false;
      document.body.classList.add("fm-lock");
      lb.querySelector(".fm-lb__close").focus();
    };
    const close = () => {
      lb.hidden = true;
      img.removeAttribute("src");
      document.body.classList.remove("fm-lock");
      lastFocus?.focus();
    };

    shots.forEach((shot, i) => shot.addEventListener("click", () => open(i)));
    lb.querySelector(".fm-lb__close").addEventListener("click", close);
    lb.querySelector(".fm-lb__nav--prev").addEventListener("click", () => show(index - 1));
    lb.querySelector(".fm-lb__nav--next").addEventListener("click", () => show(index + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }
})();
