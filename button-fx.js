(() => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const selector = ["button", "a.btn", "a.btn-glass", "a.back", "a[class*='btn' i]", "a[class*='button' i]", "[role='button']", ".chip"].join(",");
  const technicalSelector = [
    ".auth__logout", ".authtip__close", ".wowOverlay__close", ".upgradeDetails__close",
    ".lb__close", ".pmodal__x", ".preceipt__x", ".pimgview__x", ".profileGuide__close",
    ".photo__remove", "[data-close]", "[data-receipt-close]", "[data-img-close]", "[data-castro-fx='off']"
  ].join(",");

  const approach = (current, target, amount) => current + (target - current) * amount;

  const enhance = (element) => {
    if (!(element instanceof HTMLElement) || element.dataset.castroFxReady === "1") return;
    if (!element.matches(selector) || element.matches(technicalSelector)) return;
    const positioning = getComputedStyle(element).position;
    if ((positioning === "absolute" || positioning === "fixed") && !element.classList.contains("btn-glass")) return;

    element.dataset.castroFxReady = "1";
    element.classList.add("castro-button-fx");
    const isHomeButton = element.classList.contains("btn-glass");
    const hoverLift = isHomeButton ? -3.5 : -3;

    if (!isHomeButton) {
      const glow = document.createElement("span");
      glow.className = "castro-button-fx__glow";
      glow.setAttribute("aria-hidden", "true");
      element.appendChild(glow);
    }

    const prefix = isHomeButton ? "" : "fx-";
    const state = {
      frame: 0, rect: null,
      x: element.clientWidth / 2, y: element.clientHeight / 2,
      tiltX: 0, tiltY: 0, lift: 0, scale: 1,
      targetX: element.clientWidth / 2, targetY: element.clientHeight / 2,
      targetTiltX: 0, targetTiltY: 0, targetLift: 0, targetScale: 1
    };
    const set = (name, value) => element.style.setProperty(`--${prefix}${name}`, value);

    const animate = () => {
      state.x = approach(state.x, state.targetX, .23);
      state.y = approach(state.y, state.targetY, .23);
      state.tiltX = approach(state.tiltX, state.targetTiltX, .19);
      state.tiltY = approach(state.tiltY, state.targetTiltY, .19);
      state.lift = approach(state.lift, state.targetLift, .20);
      state.scale = approach(state.scale, state.targetScale, .23);
      set("spot-x", `${state.x.toFixed(2)}px`);
      set("spot-y", `${state.y.toFixed(2)}px`);
      set("tilt-x", `${state.tiltX.toFixed(3)}deg`);
      set("tilt-y", `${state.tiltY.toFixed(3)}deg`);
      set("lift", `${state.lift.toFixed(2)}px`);
      set(isHomeButton ? "press-scale" : "scale", state.scale.toFixed(4));

      const moving = Math.abs(state.x - state.targetX) > .08 || Math.abs(state.y - state.targetY) > .08 ||
        Math.abs(state.tiltX - state.targetTiltX) > .008 || Math.abs(state.tiltY - state.targetTiltY) > .008 ||
        Math.abs(state.lift - state.targetLift) > .01 || Math.abs(state.scale - state.targetScale) > .0005;
      state.frame = moving ? requestAnimationFrame(animate) : 0;
    };
    const paint = () => { if (!state.frame) state.frame = requestAnimationFrame(animate); };

    element.addEventListener("pointerenter", () => {
      if (element.matches(":disabled, [aria-disabled='true']")) return;
      state.rect = element.getBoundingClientRect();
      state.targetLift = hoverLift;
      paint();
    });
    element.addEventListener("pointermove", (event) => {
      if (element.matches(":disabled, [aria-disabled='true']")) return;
      const rect = state.rect || element.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const nx = Math.max(-.5, Math.min(.5, localX / rect.width - .5));
      const ny = Math.max(-.5, Math.min(.5, localY / rect.height - .5));
      state.targetX = localX; state.targetY = localY;
      state.targetTiltX = -ny * 6.4; state.targetTiltY = nx * 8;
      paint();
    }, { passive: true });
    element.addEventListener("pointerleave", () => {
      element.classList.remove("is-castro-pressed");
      state.rect = null;
      state.targetX = element.clientWidth / 2; state.targetY = element.clientHeight / 2;
      state.targetTiltX = 0; state.targetTiltY = 0; state.targetLift = 0; state.targetScale = 1;
      paint();
    });
    element.addEventListener("pointerdown", () => {
      if (element.matches(":disabled, [aria-disabled='true']")) return;
      element.classList.add("is-castro-pressed");
      state.targetLift = .9;
      state.targetScale = .955;
      state.lift = approach(state.lift, state.targetLift, .58);
      state.scale = approach(state.scale, state.targetScale, .68);
      paint();
    });
    const release = () => {
      element.classList.remove("is-castro-pressed");
      state.targetLift = element.matches(":hover") ? hoverLift : 0;
      state.targetScale = 1;
      paint();
    };
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !element.matches(":disabled, [aria-disabled='true']")) {
        element.classList.add("is-castro-pressed");
        state.targetLift = .9;
        state.targetScale = .955;
        paint();
      }
    });
    element.addEventListener("keyup", release);
    element.addEventListener("blur", release);
  };

  const scan = (root = document) => {
    if (root instanceof HTMLElement && root.matches(selector)) enhance(root);
    root.querySelectorAll?.(selector).forEach(enhance);
  };
  scan();
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node instanceof HTMLElement) scan(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();
