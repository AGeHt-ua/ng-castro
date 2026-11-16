/* /shop — доступ за авторизацією, підказка профілю, привʼязки форми (перенесено з shop/index.html без змін).
   Підключається ПІСЛЯ auth.js і profile.js. */
/* =========================
   🔐 AUTH GATE — ORDER
   ========================= */

window.AUTH_USER = window.__CASTRO_AUTH__?.user || null;

window.addEventListener("castro-auth", (e) => {
  window.AUTH_USER = e.detail?.user || null;

  // оновлюємо кнопку і стан блокування
  if (typeof updateReceipt === "function") updateReceipt();
  if (window.AUTH_USER) unlockForms();
  else lockForms();
});
  
async function checkAuthGate() {
  try {
    const res = await fetch("https://auth.family-castro.com/auth/me", {
      credentials: "include",
      cache: "no-store"
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json.user) {
      window.AUTH_USER = null;
      lockForms();
      return;
    }

    window.AUTH_USER = json.user;

    // оновити кнопку "Відправити" з урахуванням логіну
    if (typeof updateReceipt === "function") updateReceipt();

    unlockForms();
  } catch {
    window.AUTH_USER = null;
    lockForms();
  }
}

function showAuthWarning(){
  const hint = document.getElementById("authHint");
  if(hint) hint.style.display = "block";
}

async function hideAuthWarning(){
  const hint = document.getElementById("authHint");
  if(!hint) return;

  // ховаємо підказку тільки якщо користувач авторизований і профіль заповнений
  try{
    const user = window.AUTH_USER || window.__CASTRO_AUTH__?.user;
    if(user && typeof hasProfileIC === "function" && await hasProfileIC()){
      hint.style.display = "none";
      return;
    }
  }catch(e){}
  hint.style.display = "block";
}

function lockForms() {
  document.querySelectorAll("#sendBtn, button[type='submit']").forEach(b => {
    b.disabled = true;
    b.classList.add("locked");
  });
  showAuthWarning();
}

function unlockForms() {
  // не робимо "unlock all inputs", тільки кнопки
  // (щоб не ламати твою логіку required/disabled)
  document.querySelectorAll("#sendBtn, button[type='submit']").forEach(b => {
    // sendBtn все одно перераховується updateReceipt()
    b.classList.remove("locked");
  });
  hideAuthWarning();
}

checkAuthGate();
window.addEventListener("focus", checkAuthGate);

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

  // ❌ НЕ АВТОРИЗОВАНИЙ
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

  // ⚠️ АВТОРИЗОВАНИЙ, АЛЕ НЕМА ПРОФІЛЮ
  if(!(await hasProfileIC())){
    text.innerHTML = "<b>Крок 2 з 2:</b> профіль не завершений. Відкрий його, введи Ім’я Прізвище персонажа та числовий Static ID, потім натисни «Зберегти».";
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
}

window.addEventListener("castro-auth", renderAuthHint);
window.addEventListener("castro-profile", renderAuthHint);
document.addEventListener("DOMContentLoaded", renderAuthHint);

})();

// --- bindings: armor select + qtyCustom + addToCart sync
(function(){
  const $id = id => document.getElementById(id);

  function attachListeners(){
    // синхронізує стан кнопки додати в кошик
    function syncAddBtn(){
      const btn = $id('addToCartBtn');
      if(!btn) return;
      try{
        btn.disabled = !canAddLine();
      }catch(e){
        console.error('syncAddBtn error', e);
        btn.disabled = false;
      }
    }

    // qtyCustom -> applyCustomQty (debounced)
    const qtyEl = $id('qtyCustom');
    if(qtyEl){
      let t;
      qtyEl.addEventListener('input', e=>{
        clearTimeout(t);
        const v = e.target.value;
        t = setTimeout(()=>{
          try{ applyCustomQty(v); }catch(err){ console.error(err); }
          syncAddBtn();
        }, 150);
      });
    }

    // armorColor select -> update state + sync
    const armorEl = $id('armorColor');
    if(armorEl){
      armorEl.addEventListener('change', e=>{
        try{ state.armorColor = (e.target.value || '').trim(); }catch(e){}
        try{ if(typeof updateAll === 'function') updateAll(); }catch(e){}
        syncAddBtn();
      });
    }

    // Після вибору бронежилета переводимо фокус на вибір кольору.
    const origSelectCategory = window.selectCategory;
    if(typeof origSelectCategory === 'function'){
      window.selectCategory = function(cat){
        origSelectCategory(cat);
        if(cat === 'Бронежилет'){
          setTimeout(()=> $id('armorColor')?.focus(), 40);
        }
      };
    }

    // Початкова синхронізація.
    syncAddBtn();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachListeners, { once: true });
  } else {
    attachListeners();
  }
})();

