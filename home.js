(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!finePointer.matches) return;

  document.querySelectorAll(".actions .btn-glass").forEach((button) => {
    const state = {
      frame: 0,
      rect: null,
      x: button.clientWidth / 2,
      y: button.clientHeight / 2,
      tiltX: 0,
      tiltY: 0,
      lift: 0,
      scale: 1,
      targetX: button.clientWidth / 2,
      targetY: button.clientHeight / 2,
      targetTiltX: 0,
      targetTiltY: 0,
      targetLift: 0,
      targetScale: 1,
    };

    const approach = (current, target, amount) => current + (target - current) * amount;

    const animate = () => {
      state.x = approach(state.x, state.targetX, 0.16);
      state.y = approach(state.y, state.targetY, 0.16);
      state.tiltX = approach(state.tiltX, state.targetTiltX, 0.11);
      state.tiltY = approach(state.tiltY, state.targetTiltY, 0.11);
      state.lift = approach(state.lift, state.targetLift, 0.12);
      state.scale = approach(state.scale, state.targetScale, 0.16);

      button.style.setProperty("--spot-x", `${state.x.toFixed(2)}px`);
      button.style.setProperty("--spot-y", `${state.y.toFixed(2)}px`);
      button.style.setProperty("--tilt-x", `${state.tiltX.toFixed(3)}deg`);
      button.style.setProperty("--tilt-y", `${state.tiltY.toFixed(3)}deg`);
      button.style.setProperty("--lift", `${state.lift.toFixed(2)}px`);
      button.style.setProperty("--press-scale", state.scale.toFixed(4));

      const moving =
        Math.abs(state.x - state.targetX) > 0.08 ||
        Math.abs(state.y - state.targetY) > 0.08 ||
        Math.abs(state.tiltX - state.targetTiltX) > 0.008 ||
        Math.abs(state.tiltY - state.targetTiltY) > 0.008 ||
        Math.abs(state.lift - state.targetLift) > 0.01 ||
        Math.abs(state.scale - state.targetScale) > 0.0005;

      state.frame = moving ? requestAnimationFrame(animate) : 0;
    };

    const requestPaint = () => {
      if (!state.frame) state.frame = requestAnimationFrame(animate);
    };

    button.addEventListener("pointerenter", () => {
      state.rect = button.getBoundingClientRect();
      state.targetLift = -3.5;
      requestPaint();
    });

    button.addEventListener("pointermove", (event) => {
      const rect = state.rect || button.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const normalizedX = Math.max(-0.5, Math.min(0.5, localX / rect.width - 0.5));
      const normalizedY = Math.max(-0.5, Math.min(0.5, localY / rect.height - 0.5));

      state.targetX = localX;
      state.targetY = localY;
      state.targetTiltX = -normalizedY * 6.4;
      state.targetTiltY = normalizedX * 8;
      requestPaint();
    }, { passive: true });

    button.addEventListener("pointerleave", () => {
      state.rect = null;
      state.targetX = button.clientWidth / 2;
      state.targetY = button.clientHeight / 2;
      state.targetTiltX = 0;
      state.targetTiltY = 0;
      state.targetLift = 0;
      state.targetScale = 1;
      requestPaint();
    });

    button.addEventListener("pointerdown", () => {
      state.targetLift = 0.5;
      state.targetScale = 0.988;
      requestPaint();
    });

    const release = () => {
      state.targetLift = button.matches(":hover") ? -3.5 : 0;
      state.targetScale = 1;
      requestPaint();
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
  });
})();
