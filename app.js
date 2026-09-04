// сюди вставиш свій Cloudflare Worker URL
const WORKER_ENDPOINT = "late-sky-471b-ng.d-f-12339.workers.dev";

const form = document.getElementById("orderForm");
const statusEl = document.getElementById("status");

function setStatus(text, ok = true) {
  statusEl.textContent = text;
  statusEl.style.opacity = "1";
  statusEl.style.color = ok ? "" : "#ff6b6b";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Відправляю…");

  const data = Object.fromEntries(new FormData(form).entries());

  if (!String(data.nicknameId || "").includes("|")) {
    setStatus("Помилка: формат має бути Nickname | ID", false);
    return;
  }

  try {
    const res = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "HTTP " + res.status);
    }

    form.reset();
    setStatus("✅ Заявка відправлена в Discord!");
  } catch (err) {
    console.error(err);
    setStatus("❌ Не вдалося відправити. Перевір Worker URL / секрет webhook.", false);
  }
});
 
