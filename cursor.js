(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!finePointer.matches) return;

  const pulse = document.createElement("div");
  pulse.className = "castro-cursor-pulse";
  pulse.setAttribute("aria-hidden", "true");
  document.body.appendChild(pulse);

  const offsetX = 8;
  const offsetY = 9;
  const radius = 22;
  let frame = 0;
  let x = 0;
  let y = 0;

  const paint = () => {
    pulse.style.transform = `translate3d(${x + offsetX - radius}px, ${y + offsetY - radius}px, 0)`;
    frame = 0;
  };

  document.addEventListener("pointermove", (event) => {
    x = event.clientX;
    y = event.clientY;
    pulse.classList.add("is-visible");
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });

  document.addEventListener("pointerleave", () => pulse.classList.remove("is-visible"));
  window.addEventListener("blur", () => pulse.classList.remove("is-visible"));
})();
