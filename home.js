/* Головна: «логотип-вікно» у стилі сайту GTA VI.
   Скрол по висоті .hero керує кадром: слово CASTRO збільшується,
   маска зникає, відкривається відео, далі з'являється меню-список 01–04;
   при наведенні на пункт фон змінюється на відео відповідного розділу. */
(() => {
  const hero = document.getElementById("hero");
  const stage = document.getElementById("heroStage");
  if (!hero || !stage) return;

  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeIn = (t) => t * t * t;
  let frame = 0;
  // Згладжений прогрес: кадр «доганяє» скрол, тому крок колеса мишки не смикає анімацію
  let current = null;
  const SMOOTH = .06;

  const set = (name, value) => stage.style.setProperty(name, value);

  function progress(){
    const max = hero.offsetHeight - window.innerHeight;
    if (max <= 0) return 1;
    return clamp(-hero.getBoundingClientRect().top / max);
  }

  function render(){
    frame = 0;
    const target = reduced.matches ? 1 : progress();
    current = current === null ? target : current + (target - current) * SMOOTH;
    if (Math.abs(target - current) < .0005) current = target;
    else frame = requestAnimationFrame(render);
    const p = current;
    const zoom = clamp(p / .55);

    set("--mask-scale", (1 + easeIn(zoom) * 38).toFixed(3));
    set("--mask-opacity", (1 - clamp((p - .32) / .2)).toFixed(3));
    set("--intro-opacity", (1 - clamp(p / .12)).toFixed(3));
    set("--video-scale", (1.15 - zoom * .15).toFixed(4));
    // затемнення приходить раніше за меню — без «брудного» проміжного кадру
    set("--shade", clamp((p - .38) / .2).toFixed(3));

    const final = clamp((p - .55) / .25);
    set("--final", final.toFixed(3));
    stage.classList.toggle("is-final", final > .6);
    stage.classList.toggle("is-scrolled", p > .1);
  }

  const request = () => { if (!frame) frame = requestAnimationFrame(render); };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  reduced.addEventListener?.("change", () => {
    root.classList.toggle("home-reduced", reduced.matches);
    request();
  });
  root.classList.toggle("home-reduced", reduced.matches);

  // Кнопка «Гортай» — плавно доводить до меню
  stage.querySelector("[data-hero-skip]")?.addEventListener("click", () => {
    const target = hero.offsetTop + hero.offsetHeight - window.innerHeight;
    window.scrollTo({ top: target, behavior: reduced.matches ? "auto" : "smooth" });
  });

  // Меню: наведення підсвічує пункт, вмикає його фон і показує опис
  const links = [...stage.querySelectorAll(".hmenu a")];
  const previews = [...stage.querySelectorAll(".hero-previews > *")];
  const descText = document.getElementById("hmenuText");
  const showSection = (link) => {
    links.forEach((l) => l.classList.toggle("is-on", l === link));
    previews.forEach((el) => {
      const on = !!link && el.dataset.for === link.dataset.key;
      el.classList.toggle("is-on", on);
      // грає лише видиме відео, решта на паузі
      if (el.tagName === "VIDEO") on ? el.play().catch(() => {}) : el.pause();
    });
    if (descText) descText.textContent = link ? link.dataset.text : "Обери розділ.";
  };
  links.forEach((link) => {
    link.addEventListener("mouseenter", () => showSection(link));
    link.addEventListener("focus", () => showSection(link));
  });
  stage.querySelector(".hmenu")?.addEventListener("mouseleave", () => showSection(null));

  // Повернення «Назад» у браузері не повинно лишати недомальований кадр
  window.addEventListener("pageshow", request);
  render();
})();
