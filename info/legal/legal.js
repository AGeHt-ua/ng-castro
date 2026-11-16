/* /info/legal — перемикач мови UA/EN (перенесено з info/legal/index.html без змін) */
(function(){
  const dict = {
    uk: {
      title: "Правова інформація",
      chipVirtual: "Віртуальні товари",
      chipPrivacy: "Privacy / Cookies",

      heroH: "Офіційні правила сайту",
      heroP: "Сайт <b>family-castro.com</b> — фан-проєкт сім’ї/клану <b>Family Castro</b> для гри на сервері <b>NG GTA 5</b>. Тут зібрані умови користування, конфіденційність, cookies, повернення та DMCA.",
      navDisclaimer: "Дисклеймер",
      navTerms: "Terms",
      navPrivacy: "Privacy",
      navCookies: "Cookies",
      navRefund: "Refund",
      navDMCA: "DMCA",
      kpiUpdated: "Оновлено: 02.03.2026",
      kpiJur: "Юрисдикція: Україна",
      kpiAge: "Вік: 18+",
      miniLinks: "Офіційні проєкти:",

      dH: "Дисклеймер",
      dSub: "Ключове — щоб не було проблем: це RP, це віртуально, це фан-проєкт.",
      dC1T: "Що це за сайт",
      dC1S: "Про Family Castro",
      dC1P: "<b>family-castro.com</b> — сайт для членів Family Castro (клан/сім’я), створений у <b>січні 2026</b>. Він використовується для внутрішніх заявок, інформації та замовлень у межах RP.",
      dC2T: "Віртуальні товари",
      dC2S: "Найважливіший пункт",
      dC2P: "<b>Всі товари є виключно віртуальними і не мають відношення до реальної зброї.</b> “Зброя/валюта/доставка” означають лише <b>внутрішньоігрові предмети</b> та <b>внутрішньоігрові дії</b>.",
      dC3T: "Афіліація",
      dC3S: "Захист по брендах",
      dC3P: "Ми <b>не афілійовані</b> з Rockstar Games / Take-Two Interactive та не є офіційними представниками серверу. Усі торгові марки належать власникам і використовуються з фан/інформаційною метою.",
      dQ1T: "Суть",
      dQ1P: "Це сторінка правил для зниження ризиків: сайт — RP фан-проєкт; товари — віртуальні; реальної зброї немає.",

      tH: "Умови користування (Terms of Service)",
      tP1: "Користуючись сайтом, ви погоджуєтесь з цими умовами. Якщо не погоджуєтесь — припиніть використання сайту.",
      tL1: "<b>Вік:</b> сайт призначений для аудиторії <b>18+</b>.",
      tL2: "<b>Правила платформ:</b> ви відповідаєте за дотримання правил Discord та правил сервера.",
      tL3: "<b>Заборони:</b> спам, шахрайство, фішинг, спроби зламу, обходи обмежень, токсичні провокації.",
      tL4: "<b>Модерація:</b> ми можемо відмовити у виконанні запиту/замовлення за порушення правил або підозру в зловживаннях.",
      tL5: "<b>Оновлення:</b> документ може змінюватись без попередження. Актуальна версія — на цій сторінці.",
      tP2: "Якщо з’являється конфлікт між “логікою сайту” та правилами сервера/Discord — пріоритет мають правила сервера/Discord.",

      gH: "Віртуальні товари та доставка",
      gP1: "На сайті використовуються лише <b>віртуальна валюта</b> та <b>віртуальні предмети</b> (включно з “ігровою зброєю”). “Доставка” — це передача в грі (RP), коли учасник Family Castro привозить/передає предмети.",
      gL1: "<b>Час виконання:</b> залежить від онлайну, доступності учасників та ігрових умов.",
      gL2: "<b>Форс-мажор:</b> техроботи, виліт сервера, зміни правил, блокування акаунтів можуть вплинути на виконання.",
      gL3: "<b>Реальний світ:</b> жодних фізичних поставок, жодних реальних товарів.",

      rH: "Політика повернення (Refund Policy)",
      rP1: "Повернення стосується лише <b>віртуальних операцій</b>. Реальні фізичні товари не продаються.",
      rL1: "<b>Можливе повернення:</b> якщо сталася помилка з нашого боку (не те передали / не виконали / дубль), ми повернемо віртуальну валюту або виправимо операцію.",
      rL2: "<b>Не повертається:</b> якщо віртуальні предмети/валюта вже передані і підтверджено отримання; або якщо проблема через некоректні дані/дії користувача.",
      rL3: "<b>Термін:</b> бажано звернутися протягом <b>24 годин</b>.",
      rL4: "<b>Контакти:</b> Discord <b>castro_ua</b>, Telegram <b>@castro_ua</b>, Email <b>ageht1488@outlook.com</b>.",

      pH: "Політика конфіденційності (Privacy Policy)",
      pP1: "Ми обробляємо мінімальний набір даних, потрібний для авторизації та роботи функцій сайту.",
      pH2: "Які дані обробляються",
      pH3: "Для чого це потрібно",
      pH4: "GDPR-підстава (формулювання)",
      pL1: "<b>Discord ID</b>",
      pL2: "<b>Nickname</b>",
      pL3: "<b>Avatar</b>",
      pL4: "Технічні дані сесії (cookies/токени для входу).",
      pL5: "Дані, які ви вводите у формах (заявка/замовлення).",
      pL6: "Авторизація через Discord та контроль доступу.",
      pL7: "Обробка заявок/замовлень, захист від спаму та зловживань.",
      pL8: "Технічна стабільність і базова безпека.",
      pL9: "<b>Consent:</b> ви добровільно входите через Discord або надсилаєте форму.",
      pL10: "<b>Contract:</b> виконання домовленості (надати доступ/обробити запит).",
      pL11: "<b>Legitimate interest:</b> безпека, антиспам, стабільність.",
      pP2: "Запит на доступ/видалення даних: Discord <b>castro_ua</b> / Telegram <b>@castro_ua</b> / Email <b>ageht1488@outlook.com</b>.",

      cH: "Cookies Policy",
      cP1: "Сайт використовує cookies/локальне сховище для коректної роботи сесії та входу через Discord. Якщо вимкнути cookies — авторизація може працювати некоректно.",
      cL1: "<b>Necessary:</b> сесія, безпека, авторизація.",
      cL2: "<b>Functional:</b> зручність і стан інтерфейсу.",

      mH: "DMCA / Copyright",
      mP1: "Якщо ви правовласник і вважаєте, що матеріал порушує ваші права — надішліть запит на видалення.",
      mL1: "Посилання (URL) на матеріал.",
      mL2: "Підтвердження правовласника або уповноваженої особи.",
      mL3: "Контакти для зворотного зв’язку.",
      mP2: "Контакти: Discord <b>castro_ua</b> • Telegram <b>@castro_ua</b> • Email <b>ageht1488@outlook.com</b>",

      footLegal: "Правова інформація",
      footDisc: "Всі товари є виключно віртуальними і не мають відношення до реальної зброї."
    },

    en: {
      title: "Legal Information",
      chipVirtual: "Virtual goods",
      chipPrivacy: "Privacy / Cookies",

      heroH: "Official Website Rules",
      heroP: "Website <b>family-castro.com</b> is a fan project of the <b>Family Castro</b> clan/community for playing on <b>NG GTA 5</b>. This page contains Terms, Privacy, Cookies, Refund policy and DMCA.",
      navDisclaimer: "Disclaimer",
      navTerms: "Terms",
      navPrivacy: "Privacy",
      navCookies: "Cookies",
      navRefund: "Refund",
      navDMCA: "DMCA",
      kpiUpdated: "Updated: Mar 02, 2026",
      kpiJur: "Jurisdiction: Ukraine",
      kpiAge: "Age: 18+",
      miniLinks: "Official projects:",

      dH: "Disclaimer",
      dSub: "Key points: RP only, virtual only, fan project.",
      dC1T: "What this site is",
      dC1S: "About Family Castro",
      dC1P: "<b>family-castro.com</b> is a members-only website for the Family Castro clan/community, created in <b>January 2026</b>. It is used for internal requests, info and orders within RP.",
      dC2T: "Virtual goods",
      dC2S: "The most important line",
      dC2P: "<b>All goods are strictly virtual and have no relation to real weapons.</b> “Weapons / currency / delivery” refer only to <b>in-game items</b> and <b>in-game actions</b>.",
      dC3T: "Affiliation",
      dC3S: "Trademark / brand safety",
      dC3P: "We are <b>not affiliated</b> with Rockstar Games / Take-Two Interactive and we are not an official server representative. All trademarks belong to their owners and are used for fan/informational purposes.",
      dQ1T: "Summary",
      dQ1P: "This page reduces risks: fan RP project, virtual goods only, no real weapons.",

      tH: "Terms of Service",
      tP1: "By using this website, you agree to these terms. If you disagree, stop using the website.",
      tL1: "<b>Age:</b> this website is intended for <b>18+</b>.",
      tL2: "<b>Platform rules:</b> you are responsible for complying with Discord and server rules.",
      tL3: "<b>Prohibited:</b> spam, fraud, phishing, hacking attempts, bypassing restrictions, harassment/toxic behavior.",
      tL4: "<b>Moderation:</b> we may refuse a request/order if rules are violated or abuse is suspected.",
      tL5: "<b>Updates:</b> this document may change without notice. The latest version is on this page.",
      tP2: "If there is a conflict between website logic and server/Discord rules, server/Discord rules take priority.",

      gH: "Virtual goods & delivery",
      gP1: "This website involves only <b>virtual currency</b> and <b>virtual in-game items</b> (including “in-game weapons”). “Delivery” means an in-game RP transfer where a Family Castro member brings/transfers items in the game.",
      gL1: "<b>Timing:</b> depends on online availability and in-game conditions.",
      gL2: "<b>Force majeure:</b> maintenance, crashes, rule changes, account restrictions may affect completion.",
      gL3: "<b>Real world:</b> no physical shipping, no real goods.",

      rH: "Refund Policy",
      rP1: "Refunds apply only to <b>virtual operations</b>. We do not sell physical real-world goods.",
      rL1: "<b>Refund possible:</b> if an issue happened on our side (wrong transfer / not completed / duplicate), we will return virtual currency or correct the operation.",
      rL2: "<b>No refund:</b> if items/currency were already transferred and confirmed; or if the issue is caused by incorrect user data/actions.",
      rL3: "<b>Timeframe:</b> please contact us within <b>24 hours</b>.",
      rL4: "<b>Contacts:</b> Discord <b>castro_ua</b>, Telegram <b>@castro_ua</b>, Email <b>ageht1488@outlook.com</b>.",

      pH: "Privacy Policy",
      pP1: "We process only the minimum data required for authentication and website features.",
      pH2: "Data we process",
      pH3: "Purposes",
      pH4: "GDPR-style legal basis",
      pL1: "<b>Discord ID</b>",
      pL2: "<b>Nickname</b>",
      pL3: "<b>Avatar</b>",
      pL4: "Technical session data (cookies/tokens for login).",
      pL5: "Data you submit in forms (request/order).",
      pL6: "Discord authentication and access control.",
      pL7: "Processing requests/orders, anti-spam and abuse prevention.",
      pL8: "Technical stability and basic security.",
      pL9: "<b>Consent:</b> you voluntarily sign in with Discord or submit a form.",
      pL10: "<b>Contract:</b> performing the agreement (grant access / process a request).",
      pL11: "<b>Legitimate interest:</b> security, anti-spam, stability.",
      pP2: "Data access/deletion requests: Discord <b>castro_ua</b> / Telegram <b>@castro_ua</b> / Email <b>ageht1488@outlook.com</b>.",

      cH: "Cookies Policy",
      cP1: "We use cookies/local storage for proper session handling and Discord login. Disabling cookies may break authentication.",
      cL1: "<b>Necessary:</b> session, security, authentication.",
      cL2: "<b>Functional:</b> convenience and UI state.",

      mH: "DMCA / Copyright",
      mP1: "If you are a rights holder and believe content infringes your rights, send a takedown request.",
      mL1: "URL link to the content.",
      mL2: "Proof of ownership or authorization.",
      mL3: "Your contact details for reply.",
      mP2: "Contacts: Discord <b>castro_ua</b> • Telegram <b>@castro_ua</b> • Email <b>ageht1488@outlook.com</b>",

      footLegal: "Legal information",
      footDisc: "All goods are strictly virtual and have no relation to real weapons."
    }
  };

  const langLabel = document.getElementById("langLabel");
  const btn = document.getElementById("langToggle");

  function applyLang(lang){
    const d = dict[lang] || dict.uk;

    document.documentElement.lang = (lang === "en") ? "en" : "uk";

    document.querySelectorAll("[data-t]").forEach(el => {
      const key = el.getAttribute("data-t");
      const val = d[key];
      if(val == null) return;
      el.innerHTML = val;
    });

    // Button shows target language (what you'll switch to)
    const next = (lang === "en") ? "UA" : "EN";
    langLabel.textContent = next;

    try { localStorage.setItem("castro_lang", lang); } catch(e) {}
  }

  function getSaved(){
    try { return localStorage.getItem("castro_lang"); } catch(e) { return null; }
  }

  let current = getSaved() || "uk";
  applyLang(current);

  btn.addEventListener("click", () => {
    current = (current === "en") ? "uk" : "en";
    applyLang(current);
  });
})();
