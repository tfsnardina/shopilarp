/* Shopify app (2025 design): renders every screen from the store payload. */
(function () {
  "use strict";
  var P = JSON.parse(document.getElementById("payload").textContent || "{}");
  var S = P.st, D = P.d;
  /* Store clock: the base data is on New York time (UTC-4). For a store in another country the clock used for the
     hourly chart ("Today" / "Yesterday") and the order times must be that country's, otherwise a store in France
     starts its day at 6 am and the "Today" chart has a single point (= no line) until 7 am. */
  (function storeClock() {
    var TZ = { FR: "Europe/Paris", DE: "Europe/Berlin", ES: "Europe/Madrid", IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels", IE: "Europe/Dublin", GB: "Europe/London", CH: "Europe/Zurich", AU: "Australia/Sydney", JP: "Asia/Tokyo" };
    var tz = S && TZ[S.country];
    if (!tz || !window.Intl || !Intl.DateTimeFormat) return;
    try {
      var at = Number(S.now) || Date.now();
      var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
      var q = {}; f.formatToParts(new Date(at)).forEach(function (x) { q[x.type] = parseInt(x.value, 10); });
      var wall = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second);
      var off = Math.round((wall - Math.floor(at / 1000) * 1000) / 60000) * 60000;
      if (isFinite(off) && Math.abs(off) <= 14 * 3600000) S.off = off;
    } catch (e) { }
  })();
  /* Store in France: the base data is American (cities, states, ZIP codes, +1 phones). Swap it, once, for French
     cities / regions / postcodes / streets / phones. Every US city always maps to the same French city, so a
     customer and their orders stay in the same place, and new orders (built from these templates) are French too. */
  (function localizeFR() {
    if (!S || S.country !== "FR") return;
    var CITIES = [
      ["Paris", "Île-de-France", "75", 5], ["Lyon", "Auvergne-Rhône-Alpes", "69", 3], ["Marseille", "Provence-Alpes-Côte d'Azur", "13", 3],
      ["Toulouse", "Occitanie", "31", 2], ["Nice", "Provence-Alpes-Côte d'Azur", "06", 2], ["Nantes", "Pays de la Loire", "44", 2],
      ["Montpellier", "Occitanie", "34", 1], ["Strasbourg", "Grand Est", "67", 1], ["Bordeaux", "Nouvelle-Aquitaine", "33", 2],
      ["Lille", "Hauts-de-France", "59", 2], ["Rennes", "Bretagne", "35", 1], ["Grenoble", "Auvergne-Rhône-Alpes", "38", 1],
      ["Dijon", "Bourgogne-Franche-Comté", "21", 1], ["Rouen", "Normandie", "76", 1], ["Toulon", "Provence-Alpes-Côte d'Azur", "83", 1],
      ["Angers", "Pays de la Loire", "49", 1], ["Reims", "Grand Est", "51", 1], ["Tours", "Centre-Val de Loire", "37", 1]
    ];
    var POOL = []; CITIES.forEach(function (c) { for (var i = 0; i < c[3]; i++) POOL.push(c); });
    var STREETS = ["rue de la République", "avenue Victor Hugo", "boulevard Voltaire", "rue Pasteur", "rue Jean Jaurès", "avenue de la Gare", "rue Nationale", "avenue du Général de Gaulle", "rue des Lilas", "rue Saint-Michel", "rue Gambetta", "avenue Jean Moulin", "boulevard Haussmann", "rue du Commerce", "rue Victor Hugo", "impasse des Roses", "rue de la Paix", "boulevard Saint-Germain", "avenue des Écoles", "rue des Tilleuls", "rue Émile Zola", "rue du Moulin", "avenue de la Liberté", "rue Carnot"];
    function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }
    function cityOf(city, reg) { return POOL[hash(city + "|" + reg) % POOL.length]; }
    function zipOf(c, h) {
      if (c[2] === "75") return "750" + pad(1 + (h % 20), 2);
      if (c[2] === "69") return "6900" + (1 + (h % 9));
      if (c[2] === "13") return "130" + pad(1 + (h % 16), 2);
      return c[2] + (h % 4) + "00";
    }
    function phoneOf(p) {
      if (!p) return p;
      var h = hash(p), d = pad(h % 100000000, 8);
      return "+33 " + (h % 3 ? "6" : "7") + " " + d.slice(0, 2) + " " + d.slice(2, 4) + " " + d.slice(4, 6) + " " + d.slice(6, 8);
    }
    (P.cus || []).forEach(function (c) { var f = cityOf(c[3], c[4]); c[2] = phoneOf(c[2]); c[3] = f[0]; c[4] = f[1]; });
    (P.ord || []).forEach(function (o) {
      var f = cityOf(o[19], o[20]), h = hash(o[0] + "|" + o[19] + "|" + o[22]);
      o[19] = f[0]; o[20] = f[1]; o[21] = zipOf(f, h);
      o[22] = (1 + (h % 120)) + " " + STREETS[(h >>> 8) % STREETS.length];
    });
  })();
  // EMPTY START: a brand-new store (0 sales, 0 orders, no products, no customers).
  // P.ord / P.pro stay in memory only as templates so new orders can still be generated.
  var EMPTY = true, CFG = {};
  // The native layer injects the settings it had when the web view was created, which can be older than
  // what this page saved since. Whichever copy (injected or localStorage) carries the newest __ts wins.
  function readCfgFresh() {
    var a = null, b = null;
    try { a = JSON.parse(window.__LARP_SAVED_SETTINGS__ || "null"); } catch (e) { }
    try { b = JSON.parse(localStorage.getItem("checker.settings.shopifyLarp") || "null"); } catch (e) { }
    if (a && b) return (Number(b.__ts) || 0) > (Number(a.__ts) || 0) ? b : a;
    return a || b || {};
  }
  try { CFG = readCfgFresh() || {}; } catch (e) { CFG = {}; }
  if (CFG.emptyStore === false) EMPTY = false;
  // Lists (orders / products / customers) always start empty. The NUMBERS follow the Preferences:
  // all-zero Preferences => everything at 0; otherwise sales, orders, sessions... take the values you typed.
  var WANT_ZERO = CFG.__zero !== undefined ? !!CFG.__zero : !(CFG.totalSales > 0 || CFG.orders > 0 || CFG.customers > 0 || CFG.sessions > 0 || CFG.payoutBalance > 0);
  if (EMPTY) {
    S.lastN = 1000;
    if (WANT_ZERO) {
      Object.keys(D).forEach(function (k) { if (Array.isArray(D[k])) D[k] = D[k].map(function () { return 0; }); });
      if (P.hr) ["y", "t"].forEach(function (k) { if (Array.isArray(P.hr[k])) P.hr[k] = P.hr[k].map(function (row) { return Array.isArray(row) ? row.map(function () { return 0; }) : 0; }); });
      S.custTotal = 0;
      // A payout balance typed in Preferences is applied on its own; it does not need the other numbers.
      if (!(CFG.payoutBalance > 0)) { S.payout = 0; P.pay = []; }
      else P.pay = (P.pay || []).filter(function (r) { return r[2] === "Scheduled"; });   // keep only the scheduled payout, no fake history
      P.live = { visitors: 0, carts: 0, checkingOut: 0, purchased: 0 };
    } else {
      // The Preferences numbers only describe the last 30 days. Anything older is demo data from the base file: it
      // used to show up (e.g. in 90d / 365d) as soon as the history was rebuilt, for instance after changing currency.
      var cut = Math.max(0, (Number(S.n) || 0) - 30);
      Object.keys(D).forEach(function (k) { if (Array.isArray(D[k])) for (var i = 0; i < cut && i < D[k].length; i++) D[k][i] = 0; });
    }
  }
  var A = "./larp-assets/shopify-mobile";
  var DAY = 86400000, HOUR = 3600000;
  var N = S.n, T = N - 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var app = $("#app"), layers = $("#layers"), toastEl = $("#toast"), bannerEl = $("#banner");
  if (bannerEl) bannerEl.style.display = "none";
  // Hide any small version label (e.g. "v1.2") shown at the top.
  (function hideVersion() {
    var sel = "#ver,#version,#build,.ver,.version,.app-version,.build,.build-tag,.ver-tag,[data-version]";
    $$(sel).forEach(function (e) { e.style.display = "none"; });
    $$("body *").forEach(function (e) {
      if (e.children.length === 0 && /^\s*(v|version\s*)?\d+(\.\d+){1,3}\s*$/i.test(e.textContent || "")) e.style.display = "none";
    });
  })();
  // Time runs on from the server's clock, so live orders keep realistic times.
  var t0 = Date.now(), nowMs = function () { return S.now + (Date.now() - t0); };

  /* ── Formatting ──────────────────────────────────────────── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(n, c) { return '<i class="ic i-' + n + (c ? " " + c : "") + '"></i>'; }
  function money(c, opt) {
    opt = opt || {};
    var neg = c < 0, v = Math.abs(c) / 100;
    var dec = S.dec == null ? 2 : S.dec; // 0 for JPY/KRW
    var whole = opt.whole || (opt.auto && v >= 1000);
    var s = v.toLocaleString(S.loc || "en-US", { minimumFractionDigits: whole ? 0 : dec, maximumFractionDigits: whole ? 0 : dec });
    // Euro : symbole après le montant (« 2,00 € »), sauf demande explicite (opt.pre) comme sur l'accueil Shopify (« €184,25 »).
    if (S.cur === "EUR" && !opt.pre) return (neg ? "-" : "") + s + "\u00A0" + S.sym.trim();
    return (neg ? "-" : "") + S.sym + s;
  }
  function compact(v, isMoney) {
    var a = Math.abs(v), s;
    if (a >= 1e6) s = trim(v / 1e6) + "M"; else if (a >= 1e3) s = trim(v / 1e3) + "K"; else s = String(Math.round(v));
    return (isMoney ? S.sym : "") + s;
  }
  function trim(x) { return String(parseFloat(x.toFixed(x >= 100 ? 0 : 1))); }
  function count(n) { return Math.round(n).toLocaleString(S.loc || "en-US"); }
  function pctStr(v) { return (v >= 10 || v === 0 ? Math.round(v * 10) / 10 : v.toFixed(v < 1 ? 2 : 1)).toString().replace(/\.0$/, "") + "%"; }
  var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function L(t) { return new Date(t + S.off); }
  function hm(t) { var d = L(t), h = d.getUTCHours(), m = d.getUTCMinutes(); return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "AM" : "PM"); }
  function hmPad(t) { var d = L(t), h = d.getUTCHours() % 12 || 12, m = d.getUTCMinutes(); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + " " + (d.getUTCHours() < 12 ? "AM" : "PM"); }
  function md(t) { var d = L(t); return MON[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate(); }
  function mdLong(t) { var d = L(t); return MON[d.getUTCMonth()] + " " + d.getUTCDate(); }
  function ymdStr(t) { var d = L(t); return MON[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate() + ", " + d.getUTCFullYear(); }
  function dayIdx(t) { return Math.floor((t + S.off - (S.day0 + S.off)) / DAY); }
  function sameYear(t) { return L(t).getUTCFullYear() === L(nowMs()).getUTCFullYear(); }
  function relDay(t) {
    var di = dayIdx(t);
    if (di === T) return "Today";
    if (di === T - 1) return "Yesterday";
    return sameYear(t) ? mdLong(t) : ymdStr(t);
  }
  function relAt(t) { var r = relDay(t); return (r === "Today" || r === "Yesterday" ? r : sameYear(t) ? md(t) : ymdStr(t)) + " at " + hm(t); }
  function ago(t) {
    var s = Math.max(0, (nowMs() - t) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 7 * 86400) return Math.floor(s / 86400) + "d ago";
    return md(t);
  }
  // Haptics: on iPhone this goes to the native Taptic Engine (navigator.vibrate does not exist in iOS web views).
  // Intensity follows the old millisecond hints: small taps = "selection", 7-9 = light, 10-13 = medium,
  // 14+ or a pattern = success. Strings ("selection", "light", "medium", "heavy", "success", "warning", "error") work too.
  function hap(a) {
    var kind = typeof a === "string" ? a : Array.isArray(a) ? "success" : a >= 14 ? "success" : a >= 10 ? "medium" : a >= 7 ? "light" : "selection";
    try { window.webkit.messageHandlers.larpHaptic.postMessage(kind); return; } catch (e) { }
    try { if (navigator.vibrate) navigator.vibrate(typeof a === "number" ? a : a || 8); } catch (e2) { }
  }
  var toastT;
  function toast(msg, kind, ms) {
    toastEl.textContent = msg;
    if (kind) { var ti = document.createElement("i"); ti.className = "tt-ic " + kind; if (kind === "ok") ti.innerHTML = '<i class="ic i-check"></i>'; toastEl.insertBefore(ti, toastEl.firstChild); }
    toastEl.classList.toggle("up", typeof current === "string" && current === "products" && typeof stack !== "undefined" && !stack.length);
    toastEl.classList.add("on"); clearTimeout(toastT);
    if (ms !== 0) toastT = setTimeout(function () { toastEl.classList.remove("on"); }, ms || 2400);
  }

  /* ── Data ────────────────────────────────────────────────── */
  var custs = EMPTY ? [] : P.cus.map(function (c) { return { name: c[0], email: c[1], phone: c[2], city: c[3], region: c[4], ts: c[5], n: c[6], spent: c[7], sub: !!c[8], tags: c[9] || [] }; });
  var demoRaw = P.demoPro || P.pro, userRaw = P.demoPro ? P.pro : [];
  // Products deleted from the native product page stay deleted after a relaunch (the saved payload still lists them).
  (function dropDeleted() {
    var del = (typeof CFG === "object" && CFG && Array.isArray(CFG.__deleted)) ? CFG.__deleted : [];
    if (!del.length || !userRaw.length) return;
    userRaw = userRaw.filter(function (x) { return del.indexOf(x[15] ? "id:" + x[15] : "t:" + x[0]) < 0; });
  })();
  function mkProd(x, i, hidden) {
    var img = typeof x[13] === "string" && x[13].indexOf("data:image/") === 0 ? x[13] : "";
    return { i: hidden ? -1 - i : i, title: x[0], price: x[1], compare: x[2], inv: x[3], vars: x[4], vnames: x[5] || [], type: x[6], vendor: x[7], sku: x[8], status: x[9], sold: x[10], ts: x[11], hue: x[12], img: img, share: x[14] > 0 ? x[14] : 0, pid: x[15] || "" };
  }
  var allProds = demoRaw.map(function (x, i) { return mkProd(x, i, EMPTY); });   // templates for generated orders
  var prods = EMPTY ? userRaw.map(function (x, i) { return mkProd(x, i, false); }) : allProds;
  prods.forEach(function (p) { p.baseInv = p.inv; });
  var HUES = [233, 18, 142, 88, 201];
  // Fields only the native product page edits (description, category, tags, collections, shipping).
  function prodExtras(p, c) {
    p.desc = typeof c.description === "string" ? c.description : (p.desc || "");
    p.category = typeof c.category === "string" ? c.category : (p.category || "");
    p.tags = Array.isArray(c.tags) ? c.tags.slice() : (p.tags || []);
    p.collections = Array.isArray(c.collections) ? c.collections.slice() : (p.collections || null);
    p.physical = c.physical === false ? false : (p.physical !== false);
  }
  function splitVariants(v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12); }
  // Products created in the app (or edited in Preferences) after the saved payload was built are added back,
  // so a new product never disappears after a relaunch.
  (function mergeSavedProducts() {
    if (!EMPTY || !Array.isArray(CFG.products)) return;
    var f = Math.pow(10, S.dec != null ? S.dec : 2), used = {};
    CFG.products.forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var m = null;
      prods.forEach(function (p) { if (!m && !used[p.i] && ((c.id && p.pid === c.id) || (!p.pid && p.title === c.title))) m = p; });
      if (m) {
        used[m.i] = 1;
        if (c.edited) {   // edited in the native product page after the saved payload was built
          var evn = splitVariants(c.variants);
          if (c.title) m.title = String(c.title);
          m.price = Math.round((Number(c.price) || 0) * f); m.compare = c.compare > 0 ? Math.round(c.compare * f) : 0;
          m.inv = Math.max(0, Math.round(Number(c.inventory) || 0)); m.baseInv = m.inv;
          m.vnames = evn.length ? evn : ["Default"]; m.vars = Math.max(1, evn.length || 1);
          m.type = c.type || "General"; m.vendor = c.vendor || m.vendor; m.sku = c.sku || m.sku; m.status = c.status || m.status;
          m.img = typeof c.image === "string" && c.image.indexOf("data:image/") === 0 ? c.image : "";
        }
        prodExtras(m, c);
        return;
      }
      var vn = splitVariants(c.variants), idx = prods.length, title = String(c.title || "Untitled product");
      var code = title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "PRD";
      var np = { i: idx, pid: c.id || "", title: title, price: Math.round((Number(c.price) || 0) * f), compare: c.compare > 0 ? Math.round(c.compare * f) : 0, inv: Math.max(0, Math.round(Number(c.inventory) || 0)), vars: Math.max(1, vn.length || 1), vnames: vn.length ? vn : ["Default"], type: c.type || "General", vendor: c.vendor || S.name, sku: c.sku || (code + "-" + (1000 + idx)), status: c.status || "Active", sold: 0, ts: Number(c.ts) || (S.now - 3 * DAY), hue: HUES[idx % HUES.length], img: typeof c.image === "string" && c.image.indexOf("data:image/") === 0 ? c.image : "", share: c.allocationPct > 0 ? c.allocationPct : 0 };
      np.baseInv = np.inv; prodExtras(np, c); used[idx] = 1; prods.push(np);
    });
  })();
  function mkOrder(o) {
    return {
      n: o[0], ts: o[1], c: custs[o[2]] || null, items: o[3].map(function (x) { return { p: allProds[x[0]] || allProds[0], q: x[1], price: x[2] }; }),
      sub: o[4], disc: o[5], code: o[6], ship: o[7], shipM: o[8], tax: o[9], rate: o[10], total: o[11], refunded: o[12], pay: o[13], ful: o[14], ch: o[15],
      gw: o[16], card: o[17], l4: o[18], city: o[19], reg: o[20], zip: o[21], street: o[22], carrier: o[23], trk: o[24], fat: o[25], risk: o[26], note: o[27], archived: false,
    };
  }
  var orders = EMPTY ? [] : P.ord.map(mkOrder);
  orders.forEach(function (o) { if (o.ful === "Fulfilled" && (nowMs() - o.ts) > 9 * DAY) o.archived = true; });
  var payouts = P.pay.map(function (x) { return { ts: x[0], amt: x[1], st: x[2], n: x[3], fees: x[4], gross: x[5] }; });
  var HR = { y: P.hr.y, t: P.hr.t };
  var live = P.live;
  /* PERSISTENCE: new orders survive an app relaunch (stored inside the saved settings as __state). */
  var STATE_V = 2, lastSnap = "";
  var pend = { sales: 0, orders: 0, cust: 0, sess: 0 }; // growth not yet written into the Preferences
  function savedSettingsObj() {
    try { return readCfgFresh() || {}; } catch (e) { return {}; }
  }
  function writeSettings(cfg) {
    cfg.__ts = Date.now();   // freshness stamp: lets the editor tell this copy from a stale injected one
    var raw = JSON.stringify(cfg);
    try { localStorage.setItem("checker.settings.shopifyLarp", raw); } catch (e1) { }
    window.__LARP_SAVED_SETTINGS__ = raw;
    try { window.webkit.messageHandlers.larpStore.postMessage({ settings: raw }); } catch (e2) { }
  }
  function sigOf(c) {
    // Only the numbers that define the store's history. Payout balance, country, products, name, vibe... apply on their own.
    return [c.totalSales, c.orders, c.customers, c.sessions, c.conversionRate, c.returningCustomersPct]
      .map(function (v) { return String(+(Number(v) || 0).toFixed(2)); })
      .concat([String(c.currency == null ? "" : c.currency)]).join("|");
  }
  function lookupProd(title, price) {
    var f = function (l) { return l.filter(function (p) { return p.title === title; })[0]; };
    return f(prods) || f(allProds) || { i: -99, title: title || "Item", price: price || 0, compare: 0, inv: 0, vars: 1, vnames: ["Default"], type: "", vendor: S.name, sku: "", status: "Archived", sold: 0, ts: 0, hue: 233, img: "", share: 0 };
  }
  var frozen = false;   // set while "Edit store" rebuilds the store, so the old state is not written back
  function saveState() {
    if (!EMPTY || frozen) return;
    try {
      var list = orders.slice(0, 300), cl = [];
      list.forEach(function (o) { if (o.c && cl.indexOf(o.c) < 0) cl.push(o.c); });
      var inv = {};
      prods.forEach(function (p) { inv[p.title] = [p.inv, p.baseInv, p.sold]; });
      var snap = {
        v: STATE_V, D: D, hrT: HR.t, purchased: live.purchased, custTotal: S.custTotal, custs: cl, inv: inv,
        pay: { base: Number(CFG.payoutBalance) || 0, bal: S.payout || 0, tr: transfers, accts: payAccts, pp: payPal, sel: paySel },
        orders: list.map(function (o) {
          var c = Object.assign({}, o);
          c.c = cl.indexOf(o.c);
          c.items = o.items.map(function (x) { return [x.p ? x.p.title : "", x.q, x.price]; });
          return c;
        }),
      };
      var str = JSON.stringify(snap);
      if (str === lastSnap && !pend.orders && !pend.cust && !pend.sess) return;
      lastSnap = str;
      var cfg = savedSettingsObj(); cfg.__state = snap;
      if (cfg.__zero === undefined) cfg.__zero = WANT_ZERO;
      // Preferences follow the store: sales / orders / customers / sessions grow with every new order.
      cfg.totalSales = Math.round(((Number(cfg.totalSales) || 0) + pend.sales) * 100) / 100;
      cfg.orders = Math.round((Number(cfg.orders) || 0) + pend.orders);
      cfg.customers = Math.round((Number(cfg.customers) || 0) + pend.cust);
      cfg.sessions = Math.round((Number(cfg.sessions) || 0) + pend.sess);
      cfg.__sig = sigOf(cfg);
      pend = { sales: 0, orders: 0, cust: 0, sess: 0 };
      writeSettings(cfg);
    } catch (e) { }
  }
  (function restoreState() {
    if (!EMPTY) return;
    var snap = savedSettingsObj().__state;
    if (!snap || (snap.v !== 1 && snap.v !== 2) || !Array.isArray(snap.orders)) return;
    if (!prods.length) return;   // no products => any saved order/customer comes from the old demo data: ignore it
    try {
      Object.keys(snap.D || {}).forEach(function (k) { if (D[k] && snap.D[k] && D[k].length === snap.D[k].length) D[k] = snap.D[k]; });
      if (snap.hrT) HR.t = snap.hrT;
      live.purchased = snap.purchased || 0;
      S.custTotal = snap.custTotal || 0;
      custs = (snap.custs || []).slice();
      prods.forEach(function (p) {
        var r = snap.inv && snap.inv[p.title];
        if (r && r[1] === p.baseInv) { p.inv = r[0]; p.sold = r[2] || 0; }   // stock edited in Preferences wins
      });
      orders = snap.orders.map(function (c) {
        var o = Object.assign({}, c);
        o.c = custs[c.c] || null;
        o.items = c.items.map(function (x) { return { p: typeof x[0] === "number" ? (allProds[x[0]] || allProds[0]) : lookupProd(x[0], x[2]), q: x[1], price: x[2] }; });
        return o;
      });
      lastSnap = JSON.stringify(snap);
    } catch (e) { }
  })();
  /* Payout balance, transfers and the saved bank account survive a relaunch.
     If the balance typed in Preferences changed since, the Preferences win. */
  var payAccts = [], payPal = "", paySel = "", transfers = [], payEl = null;
  (function restorePay() {
    if (!EMPTY) return;
    var pay = (savedSettingsObj().__state || {}).pay;
    if (!pay) return;
    try {
      // Saved accounts always come back; balance and history only if the Preferences balance did not change.
      if (Array.isArray(pay.accts)) payAccts = pay.accts.filter(function (x) { return x && x.iban; });
      else if (pay.bank && pay.bank.iban) payAccts = [{ id: "a0", holder: String(pay.bank.holder || ""), iban: String(pay.bank.iban) }];
      payPal = String(pay.pp || ""); paySel = String(pay.sel || (payAccts[0] ? payAccts[0].id : ""));
      if (pay.base !== (Number(CFG.payoutBalance) || 0)) return;
      if (typeof pay.bal === "number") S.payout = pay.bal;
      transfers = Array.isArray(pay.tr) ? pay.tr : [];
      transfers.slice().reverse().forEach(function (t) { payouts.unshift(t); });
    } catch (e) { }
  })();
  setInterval(saveState, 3000);
  window.addEventListener("pagehide", saveState);
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveState(); });
  var unread = 0;
  var notifs = [];
  orders.slice(0, 30).forEach(function (o) { notifs.push({ kind: "order", o: o, ts: o.ts, read: (S.now - o.ts) > 10 * HOUR }); });
  transfers.forEach(function (t) { notifs.push({ kind: "payout", t: t, ts: t.ts, read: (S.now - t.ts) > 10 * HOUR }); });
  notifs.sort(function (a, b) { return b.ts - a.ts; });
  notifs.forEach(function (x) { if (!x.read) unread++; });
  unread = Math.min(unread, 12);
  var units = function (o) { return o.items.reduce(function (a, x) { return a + x.q; }, 0); };
  function chName(ch) { return ch === "Instagram" || ch === "Facebook" ? "Facebook & Instagram" : ch; }
  // Current push format: "Order #1013" / "$92.00, 1 item from Online Store • Store".
  function L10n(t) { return window.I18N ? window.I18N.tr(t) : t; }
  function pushBody(o) { var n = units(o); return money(o.total) + ", " + n + " item" + (n === 1 ? "" : "s") + " from " + chName(o.ch) + " \u2022 " + S.name; }
  function nativeOrderPush(o) {
    return postNative({ type: "shopify_order", title: L10n("Order #" + o.n), body: L10n(pushBody(o)), orderNumber: o.n });
  }
  function payoutBody(t) { return money(t.amt) + " \u2192 " + t.bank + " \u2022 " + S.name; }
  // A transfer rings like an order: bell badge + row in Notifications + a real iOS notification.
  function notifyPayout(t) {
    notifs.unshift({ kind: "payout", t: t, ts: t.ts, read: false });
    unread += 1; setBell();
    if (S.pops !== false) postNative({ type: "shopify_payout", title: L10n("Transfer sent"), body: L10n(payoutBody(t)) });
  }
  function postNative(payload) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.shopifyOrder) {
        window.webkit.messageHandlers.shopifyOrder.postMessage(payload);
        return true;
      }
    } catch (e1) {}
    try {
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === "function") {
        window.chrome.webview.postMessage(payload);
        return true;
      }
    } catch (e2) {}
    return false;
  }
  function pushTime(t) {
    var s2 = (nowMs() - t) / 1000;
    if (s2 < 60) return "now";
    if (s2 < 3600) return Math.floor(s2 / 60) + "m ago";
    if (s2 < 6 * 3600) return Math.floor(s2 / 3600) + "h ago";
    var d = L(t), di = dayIdx(t);
    if (di === T) return hm(t);
    if (di >= T - 6) return WD[d.getUTCDay()].slice(0, 3) + " " + hm(t);
    return md(t);
  }
  var VAT = S.country !== "US" && S.country !== "CA" ? 1 : 0;

  /* ── Metrics and ranges ──────────────────────────────────── */
  function sum(a, i0, i1) { var s = 0; for (var i = Math.max(0, i0); i <= i1; i++) s += a[i] || 0; return s; }
  function agg(i0, i1) { return { s: sum(D.s, i0, i1), o: sum(D.o, i0, i1), se: sum(D.se, i0, i1), rc: sum(D.rc, i0, i1) }; }
  function aggH(h, a, b) { return { s: sum(h[0], a, b), o: sum(h[1], a, b), se: sum(h[2], a, b), rc: 0 }; }
  var MET = {
    sales: { t: "Total sales", k: "money", v: function (x) { return x.s; } },
    orders: { t: "Orders", k: "count", v: function (x) { return x.o; } },
    conv: { t: "Conversion rate", k: "pct", v: function (x) { return x.se ? (x.o / x.se) * 100 : 0; } },
    sessions: { t: "Sessions", k: "count", v: function (x) { return x.se; } },
    aov: { t: "Average order value", k: "money", v: function (x) { return x.o ? x.s / x.o : 0; } },
  };
  var MET_ORDER = ["sales", "orders", "conv", "sessions", "aov"];
  var RANGES = [["today", "Today"], ["yday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["365d", "Last 365 days"]];
  var curHour = function () { return L(nowMs()).getUTCHours(); };
  function rangeData(key) {
    // Returns totals and chart buckets for the range and its previous period.
    var cur = [], prev = [], labels = [], tot, ptot, n;
    if (key === "today" || key === "yday") {
      var H = key === "today" ? HR.t : HR.y, Hp = key === "today" ? HR.y : null;
      var upto = key === "today" ? curHour() : 23;
      for (var h = 0; h <= 23; h++) {
        if (h <= upto) cur.push(aggH(H, h, h));
        if (Hp) prev.push(aggH(Hp, h, h));
        labels.push(h);
      }
      tot = key === "today" ? agg(T, T) : agg(T - 1, T - 1);
      ptot = key === "today" ? agg(T - 1, T - 1) : agg(T - 2, T - 2);
      if (key === "today") {
        // Today so far is compared with yesterday up to the same time.
        var fr = L(nowMs()).getUTCMinutes() / 60, y0 = aggH(HR.y, 0, upto - 1), y1 = aggH(HR.y, upto, upto);
        ptot = { s: y0.s + y1.s * fr, o: Math.round(y0.o + y1.o * fr), se: Math.round(y0.se + y1.se * fr), rc: 0 };
      }
      if (!Hp) {
        // Yesterday compares with the day before, spread over the same hours.
        var share = function (h) { return HR.y[0][h] && tot.s ? HR.y[0][h] / tot.s : 1 / 24; };
        for (var k = 0; k <= 23; k++) { var f = share(k); prev.push({ s: ptot.s * f, o: ptot.o * f, se: ptot.se * f, rc: 0 }); }
      }
      return { key: key, hourly: true, cur: cur, prev: prev, tot: tot, ptot: ptot, n: 24, x0: T - (key === "yday" ? 1 : 0) };
    }
    n = key === "7d" ? 7 : key === "30d" ? 30 : key === "90d" ? 90 : 365;
    var a = T - n + 1, pa = a - n;
    var step = n > 120 ? 7 : 1;
    for (var i = a; i <= T; i += step) { cur.push(agg(i, Math.min(T, i + step - 1))); labels.push(i); }
    for (var j = pa; j < a; j += step) prev.push(agg(j, Math.min(a - 1, j + step - 1)));
    tot = agg(a, T); ptot = agg(pa, a - 1);
    return { key: key, hourly: false, cur: cur, prev: prev, tot: tot, ptot: ptot, a: a, step: step, n: cur.length };
  }
  function change(cv, pv) {
    if (!pv) return cv ? null : 0;
    return ((cv - pv) / Math.abs(pv)) * 100;
  }
  function fmtMet(k, v, strip, pre) {
    return k === "money" ? (strip ? money(v, { auto: true, pre: true }) : money(v, { pre: !!pre })) : k === "pct" ? pctStr(v) : count(v);
  }
  function chgHtml(c, cls) {
    if (c === null) return "";
    var r = Math.round(c);
    if (!r) return '<em class="' + (cls || "") + ' flat">0%</em>';
    return '<em class="' + (cls || "") + (r > 0 ? " up" : " dn") + '">' + (r > 0 ? "+" : "-") + Math.abs(r) + "%</em>";
  }

  /* ── Chart ───────────────────────────────────────────────── */
  function niceStep(v) {
    if (v <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    var n = f < Math.sqrt(2) ? 1 : f < Math.sqrt(10) ? 2 : f < Math.sqrt(50) ? 5 : 10;
    return n * e;
  }
  // Monotone cubic path through points, so curves never overshoot below zero.
  function smooth(pts) {
    var n = pts.length;
    if (n === 0) return "";
    if (n === 1) return "M" + pts[0][0] + "," + pts[0][1];
    var dx = [], dy = [], m = [], t = [];
    for (var i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / (dx[i] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (var k = 1; k < n - 1; k++) t[k] = m[k - 1] * m[k] <= 0 ? 0 : (m[k - 1] + m[k]) / 2;
    for (var j = 0; j < n - 1; j++) {
      if (m[j] === 0) { t[j] = 0; t[j + 1] = 0; continue; }
      var a = t[j] / m[j], b = t[j + 1] / m[j], h = a * a + b * b;
      if (h > 9) { var s = 3 / Math.sqrt(h); t[j] = s * a * m[j]; t[j + 1] = s * b * m[j]; }
    }
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var q = 0; q < n - 1; q++) {
      var x0 = pts[q][0], y0 = pts[q][1], x1 = pts[q + 1][0], y1 = pts[q + 1][1], w = (x1 - x0) / 3;
      d += "C" + (x0 + w).toFixed(1) + "," + (y0 + t[q] * w).toFixed(1) + " " + (x1 - w).toFixed(1) + "," + (y1 - t[q + 1] * w).toFixed(1) + " " + x1.toFixed(1) + "," + y1.toFixed(1);
    }
    return d;
  }
  function xLabel(R, i) {
    if (R.hourly) { var h = i; return (h % 12 || 12) + " " + (h < 12 ? "AM" : "PM"); }
    var di = R.a + i * R.step, t = S.day0 + di * DAY + 12 * HOUR;
    if (R.step > 1) { var d = L(t); return MON[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCFullYear(); }
    return md(t);
  }
  // Tick positions: every 5 hours for a day, every other day for a week, thirds otherwise.
  function xTicks(R) {
    var n = R.n;
    if (R.hourly) return [0, 5, 10, 15, 20];
    if (n <= 8) return [0, 2, 4, 6].filter(function (i) { return i < n; });
    return [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3)];
  }
  var gradN = 0;
  // The current line is solid; the last point is a day still in progress, so
  // the segment into it is dotted (the way the app draws an unfinished day).
  function lnPaths(cur, X, Y, R) {
    var pts = cur.map(function (v, i) { return [X(i), Y(v)]; });
    var open = !R.hourly && R.key !== "yday" && pts.length > 2;
    if (pts.length === 1) return '<path class="ln" d="' + smooth(pts) + '"/><circle cx="' + pts[0][0].toFixed(1) + '" cy="' + pts[0][1].toFixed(1) + '" r="3.2" fill="#20a8e6"/>';
    if (!open) return '<path class="ln" d="' + smooth(pts) + '"/>';
    var full = smooth(pts), head = smooth(pts.slice(0, -1));
    var tail = full.slice(full.lastIndexOf("C"));
    var p0 = pts[pts.length - 2];
    return '<path class="ln" d="' + head + '"/><path class="ln tail" d="M' + p0[0].toFixed(1) + "," + p0[1].toFixed(1) + tail + '"/>';
  }
  function drawChart(host, R, mk, opts) {
    opts = opts || {};
    var M = MET[mk];
    var W = host.clientWidth || 360, Hh = opts.h || 150;
    var cur = R.cur.map(M.v), prev = R.prev.map(M.v);
    var n = R.n;
    var max = Math.max.apply(null, cur.concat(prev).concat([0]));
    if (max <= 0) max = M.k === "money" ? 10000 : M.k === "pct" ? 5 : 10;
    // A gridline at every nice step up to the peak ($1K, $2K ... or just $5K).
    var step = niceStep(max / 2.2), lines = [];
    for (var gv = step; gv <= max * 1.001 && lines.length < 4; gv += step) lines.push(gv);
    if (!lines.length) lines.push(step);
    var top = Math.max(max, lines[lines.length - 1]) * 1.04;
    // Money metrics are in cents; axis labels are whole currency units.
    var axis = function (v) { return M.k === "money" ? compact(v / 100, true) : M.k === "pct" ? pctStr(v) : v >= 1000 ? compact(v) : String(Math.round(v)); };
    var lblW = 8 + 8 * Math.max.apply(null, lines.map(function (v) { return axis(v).length; }));
    var gid = "cf" + (++gradN);
    var x0 = lblW + 12, x1 = W - 2, yTop = 6, yBot = Hh - 33;
    var X = function (i) { return x0 + (n > 1 ? (i / (n - 1)) * (x1 - x0) : 0); };
    var Y = function (v) { return yBot - (Math.max(0, v) / top) * (yBot - yTop); };
    var zl = M.k === "money" ? S.sym + "0" : M.k === "pct" ? "0%" : "0";
    var lab = xTicks(R);
    var svg = '<svg width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20a8e6" stop-opacity=".16"/><stop offset="1" stop-color="#20a8e6" stop-opacity="0"/></linearGradient></defs>' +
      lines.map(function (v) { return '<line class="gl" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="yl" x="' + (x0 - 12) + '" y="' + (Y(v) + 5).toFixed(1) + '" text-anchor="end">' + esc(axis(v)) + "</text>"; }).join("") +
      '<line class="gl" x1="' + x0 + '" x2="' + x1 + '" y1="' + yBot + '" y2="' + yBot + '"/>' +
      '<text class="yl" x="' + (x0 - 12) + '" y="' + (yBot + 5) + '" text-anchor="end">' + esc(zl) + "</text>" +
      lab.map(function (i) { return '<text class="xl" x="' + X(i).toFixed(1) + '" y="' + (Hh - 5) + '" text-anchor="middle">' + esc(xLabel(R, i)) + "</text>"; }).join("") +
      '<path class="pv" d="' + smooth(prev.map(function (v, i) { return [X(i), Y(v)]; })) + '"/>' +
      '<path class="ar" fill="url(#' + gid + ')" d="' + (cur.length ? smooth(cur.map(function (v, i) { return [X(i), Y(v)]; })) + "L" + X(cur.length - 1).toFixed(1) + "," + yBot + "L" + x0 + "," + yBot + "Z" : "") + '"/>' +
      lnPaths(cur, X, Y, R) +
      '<line class="hair" y1="' + yTop + '" y2="' + yBot + '"/><circle class="cdot" r="4.5"/>' +
      "</svg>";
    host.innerHTML = svg;
    host._g = { X: X, Y: Y, n: n, cur: cur, prev: prev, R: R, mk: mk, x0: x0, x1: x1 };
    if (opts.anim && !reduce) {
      var ln = $(".ln", host), ar = $(".ar", host), pv = $(".pv", host);
      try {
        var len = ln.getTotalLength();
        ln.style.strokeDasharray = len + " " + len; ln.style.strokeDashoffset = len;
        ar.style.opacity = 0; pv.style.opacity = 0;
        ln.getBoundingClientRect();
        ln.style.transition = "stroke-dashoffset 1s cubic-bezier(.3,.7,.2,1)"; ln.style.strokeDashoffset = 0;
        ar.style.transition = "opacity .6s .45s"; ar.style.opacity = 1;
        pv.style.transition = "opacity .5s .2s"; pv.style.opacity = 1;
        setTimeout(function () { ln.style.strokeDasharray = ""; ln.style.transition = ""; }, 1100);
      } catch (e) { }
    }
  }
  function bindScrub(host, onMove) {
    var on = false;
    function at(e) {
      var g = host._g; if (!g) return;
      var r = host.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var i = Math.round(((x - g.x0) / (g.x1 - g.x0)) * (g.n - 1));
      i = Math.max(0, Math.min(Math.max(g.cur.length, g.prev.length) - 1, i));
      if (host._i === i) return;
      host._i = i; hap(4);
      var xi = g.X(i), v = g.cur[i];
      var hair = $(".hair", host), dot = $(".cdot", host);
      hair.setAttribute("x1", xi); hair.setAttribute("x2", xi);
      if (v != null) { dot.setAttribute("cx", xi); dot.setAttribute("cy", g.Y(v)); dot.style.opacity = 1; } else dot.style.opacity = 0;
      host.classList.add("scrub");
      onMove(i, g);
    }
    host.addEventListener("touchstart", function (e) { on = true; host._i = -1; at(e); }, { passive: true });
    host.addEventListener("touchmove", function (e) { if (on) at(e); }, { passive: true });
    var end = function () { on = false; host._i = -1; host.classList.remove("scrub"); onMove(-1); };
    host.addEventListener("touchend", end); host.addEventListener("touchcancel", end);
    host.addEventListener("mousedown", function (e) { on = true; host._i = -1; at(e); });
    window.addEventListener("mousemove", function (e) { if (on) at(e); });
    window.addEventListener("mouseup", function () { if (on) end(); });
  }

  /* ── Count-up ────────────────────────────────────────────── */
  function countTo(el, from, to, fmt, ms) {
    el.style.fontVariantNumeric = "tabular-nums";
    el.style.minWidth = ""; el.textContent = fmt(Math.max(from, to));
    var fw = el.getBoundingClientRect().width;          // widest text of the animation, measured once
    if (fw > 0) { el.style.display = "inline-block"; el.style.minWidth = Math.ceil(fw) + "px"; }
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    var st = performance.now(); ms = ms || 900;
    (function step(now) {
      var k = Math.min(1, (now - st) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(st);
  }

  /* ── Home ────────────────────────────────────────────────── */
  var homeRange = "30d", homeMet = "sales", CH = 172;
  var pickLock = false;
  function greeting() { var h = curHour(); return h < 12 ? "Good morning!" : h < 18 ? "Good afternoon!" : "Good evening!"; }
  function unfulfilled() { return orders.filter(function (o) { return o.ful !== "Fulfilled" && o.pay !== "Refunded" && o.pay !== "Voided" && !o.archived; }); }
  function toCapture() { return orders.filter(function (o) { return o.pay === "Authorized"; }); }
  function nextPayout() {
    var bal = Math.max(0, S.payout || 0);
    if (!bal) return null;
    var scheduled = payouts.filter(function (p) { return p.st === "Scheduled"; })[0];
    var ts = scheduled && scheduled.ts > nowMs() ? scheduled.ts : nowMs() + 3 * DAY;   // never an estimate in the past
    return { ts: ts, amt: bal, st: "Scheduled", n: 0, fees: 0, gross: bal };
  }
  function sparkSvg(vals, up) {
    var n = vals.length, w = 28, h = 14;
    if (n < 2) return "";
    var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var pts = vals.map(function (v, i) { return [1 + (i / (n - 1)) * (w - 2), h - 1.5 - (mx > mn ? ((v - mn) / (mx - mn)) * (h - 3) : (h - 3) / 2)]; });
    var d = smooth(pts);
    return '<svg class="spk ' + up + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '"><path d="' + d + (up === "fl" ? "" : "L" + (w - 1) + "," + h + "L1," + h + "Z") + '"/></svg>';
  }
  function metStrip(R) {
    var liveBtn = '<button class="met live" data-act="liveview"><span>Live</span><b><i class="radar"><i></i></i><span id="liveN">' + count(live.visitors) + "</span></b></button>";
    var tiles = MET_ORDER.map(function (k) {
      var M = MET[k], cv = M.v(R.tot), pv = M.v(R.ptot), c = change(cv, pv);
      var on = k === homeMet;
      var dir = c === null || Math.round(c) === 0 ? "fl" : c > 0 ? "up" : "dn";
      // Unselected metrics carry a tiny trend line instead of the chart.
      var vals = R.cur.map(M.v);
      var step = Math.max(1, Math.floor(vals.length / 8)), sp = [];
      for (var i = 0; i < vals.length; i += step) sp.push(vals.slice(i, i + step).reduce(function (a, b) { return a + b; }, 0));
      return '<button class="met' + (on ? " on" : "") + '" data-met="' + k + '"><span>' + esc(M.t) + '</span><b><span class="mv">' + fmtMet(M.k, cv, true) + "</span>" +
        (on ? "" : sparkSvg(dir === "fl" ? [1, 1] : sp, dir)) + chgHtml(c) + "</b></button>";
    }).join("");
    return liveBtn + '<div class="mets-sc">' + tiles + tiles + tiles + "</div>"; // 3 copies: the strip loops forever
  }
  function pulseCards() {
    var R30 = rangeData("30d");
    var top = prods.slice().sort(function (a, b) { return b.sold - a.sold; })[0];
    var tUnits = prods.reduce(function (a, p) { return a + p.sold; }, 0) || 1;
    var cards = [];
    if (top && top.sold > 0) {
      var days = top.sold > 0 ? Math.max(1, Math.round((top.inv / top.sold) * 30)) : 0;
      cards.push(["Keep " + top.title + " in stock", top.title + " made up " + Math.round((top.sold / tUnits) * 100) + "% of units sold in the last 30 days. At this pace, the " + count(top.inv) + " you have left will last about " + days + " day" + (days === 1 ? "" : "s") + ".", "Review inventory", "inventory"]);
    }
    var c = change(R30.tot.s, R30.ptot.s);
    if (c !== null && c > 5) cards.push(["Sales are up " + Math.round(c) + "%", "Your sales over the last 30 days are " + money(R30.tot.s, { whole: true }) + ", up from " + money(R30.ptot.s, { whole: true }) + " the 30 days before. Most of the lift came from returning customers.", "See what's driving it", "analytics"]);
    cards.push(["Capture more search shoppers", "Over the last 90 days, search converted at " + (MET.conv.v(rangeData("90d").tot) * 1.35).toFixed(2) + "% vs. " + (MET.conv.v(rangeData("90d").tot) * 0.55).toFixed(2) + "% from social, but it's a small slice of traffic and your top products have no SEO titles or descriptions.", "Add SEO to top products", "seo"]);
    return cards;
  }
  function renderHome() {
    var el = $("#s-home");
    var R = rangeData(homeRange);
    var np = nextPayout();
    var pDays = np ? Math.max(0, dayIdx(np.ts) - T) : 0;
    var uf = unfulfilled().length, cap = toCapture().length;
    var cards = [];
    if (np) cards.push('<button class="act" data-act="payouts"><span>' + (pDays === 0 ? "Payout today" : pDays === 1 ? "Payout tomorrow" : "Payouts in " + pDays + " days") + "</span><b>" + money(np.amt) + "</b>" + ic("payout") + "</button>");
    cards.push('<button class="act" data-act="fulfill"><span>Fulfill orders</span><b>' + (uf > 50 ? "50+" : uf) + "</b>" + ic("tab-orders") + "</button>");
    if (cap) cards.push('<button class="act" data-act="capture"><span>Capture payments</span><b>' + cap + "</b>" + ic("capture") + "</button>");
    var low = prods.filter(function (p) { return p.inv < 15; }).length;
    if (low) cards.push('<button class="act" data-act="inventory"><span>Low inventory</span><b>' + low + "</b>" + ic("inventory") + "</button>");
    var pc = pulseCards();
    el.innerHTML =
      '<div class="hm-top">' +
      '<div class="ptr" id="ptr"><i></i></div>' +
      '<header class="hm-hd"><button class="av" data-act="account" aria-label="Account">' + avHTML() + '</button>' +
      '<button class="store" data-act="stores">' + logoTile() + "<b>" + esc(S.name) + "</b></button>" +
      '<button class="bell" data-act="notifs" aria-label="Notifications">' + ic("bell") + '<span class="nb" id="nb"' + (unread ? "" : ' hidden') + ">" + unread + "</span></button></header>" +
      '<div class="mets" id="mets">' + metStrip(R) + "</div>" +
      '<div class="hchart" id="hchart"></div>' +
      '<div class="tip" id="tip"></div>' +
      '<div class="hpills"><button class="hpill" data-act="range">' + ic("calendar") + '<span id="rngL">' + esc(rangeShort(homeRange)) + '</span></button><button class="hpill" data-act="analytics">' + ic("report") + "<span>View report</span></button></div>" +
      "</div>" +
      '<div class="hm-sheet">' +
      '<h2 class="greet"><span>' + greeting() + "</span> Here's your activity</h2>" +
      '<div class="acts">' + cards.join("") + "</div>" +
      '<div class="pulse"><div class="pl-h"><i class="pl-dot"><i></i></i>Sidekick Pulse<span class="pl-n">1 of ' + pc.length + '</span></div><div class="pl-track" id="pltrack">' +
      pc.map(function (c) { return '<div class="pl-card"><h3>' + esc(c[0]) + "</h3><p>" + esc(c[1]) + '</p><button class="pl-btn" data-pulse="' + c[3] + '">' + esc(c[2]) + "</button></div>"; }).join("") +
      "</div></div>" +
      topProductsCard() +
      '<div class="card lv" data-act="liveview"><div class="lv-l"><h3>Live View</h3><p>See what\u2019s happening in your store right now</p></div><div class="lv-g">' + globeSvg(64) + "</div></div>" +
      '<div class="spacer"></div>' +
      "</div>";
    var host = $("#hchart");
    drawChart(host, R, homeMet, { anim: true, h: CH });
    bindScrub(host, function (i, g) { showTip(i, g); });
    $$(".met[data-met]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-met"); if (k === homeMet) { foldHome(); return; }
        hap(6); switchMetric(k, b);
      });
    });
    var track = $("#pltrack");
    track.addEventListener("scroll", function () { var k = Math.round(track.scrollLeft / track.clientWidth); $(".pl-n", el).textContent = k + 1 + " of " + pc.length; }, { passive: true });
    countIn();
    layoutStrip();
    bindPtr();
  }
  /* Metric switch (Total sales -> Orders -> ...): the chart slides sideways (old one out, new one in) and the
     tiles glide inside their own scroller so the chosen tile docks right beside the "Live" tile - which never
     moves and is never covered, because the tiles are clipped at the scroller edge instead of passing under it. */
  function layoutStrip() {
    var m = $("#mets"), sc = $(".mets-sc", m); if (!m || !sc) return;
    if (window.I18N) window.I18N.apply(m);           // translate first: widths (and so scroll offsets) must be measured on the final text
    if (!document.getElementById("mets-sc-css")) {
      var st = document.createElement("style"); st.id = "mets-sc-css";
      st.textContent = ".mets-sc::-webkit-scrollbar{display:none}";
      document.head.appendChild(st);
    }
    var gap = getComputedStyle(m).columnGap;
    m.style.display = "flex"; m.style.overflow = "hidden";
    var lv = $(".met.live", m); if (lv) lv.style.flex = "none";
    sc.style.cssText = "flex:1 1 auto;min-width:0;display:flex;align-items:inherit;gap:" + (gap && gap !== "normal" ? gap : "0px") +
      ";overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scroll-snap-type:x mandatory";
    $$(".met", sc).forEach(function (t) { t.style.flex = "none"; t.style.scrollSnapAlign = "start"; t.style.scrollSnapStop = "always"; }); // one tile per swipe
    sc.addEventListener("touchstart", function () { if (sc._glide) { cancelAnimationFrame(sc._glide); sc._glide = 0; } sc.style.scrollSnapType = "x mandatory"; }, { passive: true });
    var w0 = setWidth(sc);
    if (w0) sc.scrollLeft = w0;                      // rest on the middle copy
    var tm = 0;
    function wrap() {                                // identical copies => shifting by one set is invisible
      var W = setWidth(sc); if (!W || sc._glide) return;
      var x = sc.scrollLeft, n = x;
      while (n < W) n += W;
      while (n >= 2 * W) n -= W;
      if (Math.abs(n - x) > 0.5) sc.scrollLeft = n;
    }
    sc._wrap = wrap;
    var pt = 0;
    // When a swipe lands on a tile, select it as if it had been tapped.
    function pick() {
      if (sc._glide || pickLock || !sc.isConnected) return;
      var sr = sc.getBoundingClientRect(), best = null, bd = 1e9;
      $$(".met[data-met]", sc).forEach(function (t) { var d = Math.abs(t.getBoundingClientRect().left - sr.left); if (d < bd) { bd = d; best = t; } });
      if (!best || bd > 24) return;
      var k = best.getAttribute("data-met");
      if (k === homeMet) return;
      pickLock = true; setTimeout(function () { pickLock = false; }, 800);
      hap(6); switchMetric(k, best, true);
    }
    sc.addEventListener("scroll", function () {
      clearTimeout(pt); pt = setTimeout(pick, 140);
      var W = setWidth(sc); if (!W || sc._glide) return;
      var x = sc.scrollLeft, maxX = sc.scrollWidth - sc.clientWidth;
      if (x < 6 || x > maxX - 6) { wrap(); return; } // about to hit a hard end: re-centre right away
      clearTimeout(tm); tm = setTimeout(wrap, 120);   // otherwise wait until scrolling settles (keeps iOS momentum)
    }, { passive: true });
  }
  function setWidth(sc) { // pixel width of one copy of the tiles
    var t = $$(".met[data-met]", sc), n = MET_ORDER.length;
    return t.length >= 2 * n ? t[n].offsetLeft - t[0].offsetLeft : 0;
  }
  function glideScroll(el, to, ms) {
    if (el._glide) cancelAnimationFrame(el._glide);
    var from = el.scrollLeft, t0 = performance.now();
    if (Math.abs(to - from) < 1) { el.style.scrollSnapType = "x mandatory"; return; }
    el.style.scrollSnapType = "none";                    // snapping would fight our own animation
    (function f(now) {
      var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.scrollLeft = from + (to - from) * e;
      el._glide = k < 1 ? requestAnimationFrame(f) : 0;
      if (k >= 1) { el.style.scrollSnapType = "x mandatory"; if (el._wrap) el._wrap(); }
    })(t0);
  }
  function switchMetric(k, src, inPlace) {
    var old = homeMet; if (k === old) return;
    var host = $("#hchart"), mets = $("#mets"), R2 = rangeData(homeRange);
    if (reduce || !host || !host.animate) {
      homeMet = k; mets.innerHTML = metStrip(R2); bindMetButtons(); layoutStrip();
      drawChart(host, R2, homeMet, { anim: true, h: CH }); return;
    }
    var MS = 460, EASE = "cubic-bezier(.22,.9,.24,1)";
    $$(".hc-old,.met-ghost", $("#s-home")).forEach(function (n) { n.remove(); });
    var sc0 = $(".mets-sc", mets), sl = sc0 ? sc0.scrollLeft : 0, W = host.clientWidth || 360;
    var dir = MET_ORDER.indexOf(k) > MET_ORDER.indexOf(old) ? 1 : -1;
    if (sc0 && sc0._glide) { cancelAnimationFrame(sc0._glide); sc0._glide = 0; }
    // remember where every tile is on screen (FLIP) and what the old highlight pill looks like
    var before = [], gInfo = null;
    $$(".met[data-met]", mets).forEach(function (t, i) { before[i] = t.getBoundingClientRect().left; });
    // the highlighted tile that is actually on screen (there are 3 copies)
    var oldOn = null, scR0 = sc0 ? sc0.getBoundingClientRect() : null;
    $$(".met.on", mets).forEach(function (t) {
      var r = t.getBoundingClientRect();
      if (scR0 && r.right > scR0.left && r.left < scR0.right && (!oldOn || r.left < oldOn.getBoundingClientRect().left)) oldOn = t;
    });
    if (!oldOn) oldOn = $(".met.on", mets);
    if (src && oldOn) dir = src.getBoundingClientRect().left >= oldOn.getBoundingClientRect().left ? 1 : -1;
    if (oldOn && sc0) {
      var r = oldOn.getBoundingClientRect(), s0 = sc0.getBoundingClientRect(), cs = getComputedStyle(oldOn);
      gInfo = { l: r.left - s0.left + sc0.scrollLeft, t: r.top - s0.top + sc0.scrollTop, w: r.width, h: r.height, br: cs.borderRadius, bg: cs.backgroundColor, bd: cs.borderTopWidth + " solid " + cs.borderTopColor };
    }
    var srcIdx = inPlace && src ? $$(".met[data-met]", mets).indexOf(src) : -1;
    var oldHTML = host.innerHTML;
    homeMet = k;
    mets.innerHTML = metStrip(R2); bindMetButtons(); layoutStrip();
    var sc = $(".mets-sc", mets);
    if (sc) {
      sc.style.scrollSnapType = "none";
      sc.scrollLeft = sl;
      if (getComputedStyle(sc).position === "static") sc.style.position = "relative";
      if (inPlace && srcIdx >= 0) { // swipe: just select the tile where it already sits, no glide, no loop
        var nt = $$(".met[data-met]", sc)[srcIdx];
        if (nt) sc.scrollLeft += nt.getBoundingClientRect().left - sc.getBoundingClientRect().left;
        requestAnimationFrame(function () { sc.style.scrollSnapType = "x mandatory"; });
        drawChart(host, R2, homeMet, { h: CH });
        var oldL0 = document.createElement("div"); oldL0.className = "hc-old";
        oldL0.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
        oldL0.innerHTML = oldHTML; host.style.position = "relative"; host.style.overflow = "hidden"; host.appendChild(oldL0);
        oldL0.animate([{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: "translate3d(" + (-dir * W * 0.55) + "px,0,0)", opacity: 0 }], { duration: MS, easing: EASE, fill: "forwards" }).onfinish = function () { oldL0.remove(); host.style.overflow = ""; };
        var sv0 = $("svg", host); if (sv0) sv0.animate([{ transform: "translate3d(" + dir * W + "px,0,0)" }, { transform: "translate3d(0,0,0)" }], { duration: MS, easing: EASE });
        return;
      }
      // tiles whose width changed (trend line appears/disappears) keep their on-screen position, then glide
      $$(".met[data-met]", sc).forEach(function (t, i) {
        var d = before[i] - t.getBoundingClientRect().left;
        if (Math.abs(d) > 0.5) t.animate([{ transform: "translate3d(" + d + "px,0,0)" }, { transform: "translate3d(0,0,0)" }], { duration: MS, easing: EASE });
      });
      if (gInfo) { // old pill fades out
        var g = document.createElement("div"); g.className = "met-ghost";
        g.style.cssText = "position:absolute;pointer-events:none;z-index:0;box-sizing:border-box;left:" + gInfo.l + "px;top:" + gInfo.t + "px;width:" + gInfo.w + "px;height:" + gInfo.h + "px;border-radius:" + gInfo.br + ";background:" + gInfo.bg + ";border:" + gInfo.bd;
        sc.appendChild(g);
        g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out", fill: "forwards" }).onfinish = function () { g.remove(); };
      }
      var copies = $$(".met.on", sc), nOn = null;
      if (copies.length) { // pick the copy in the travel direction (shortest way round the loop)
        var best = Infinity;
        copies.forEach(function (t) {
          var d = t.offsetLeft - sl;                       // layout position: unaffected by FLIP transforms
          var score = (dir > 0 ? d < -4 : d > 4) ? Math.abs(d) + 1e5 : Math.abs(d);
          if (score < best) { best = score; nOn = t; }
        });
      }
      if (nOn) { // new pill fades in, strip docks the chosen tile next to Live
        copies.forEach(function (t) {
          var nbg = getComputedStyle(t).backgroundColor;
          t.animate([{ backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: nbg }], { duration: 320, easing: "ease-out" });
        });
        var to = Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, nOn.offsetLeft));
        glideScroll(sc, to, MS);
      } else sc.style.scrollSnapType = "x mandatory";
    }
    // chart: old layer slides out (parallax + fade), new chart slides in from the side
    drawChart(host, R2, homeMet, { h: CH });
    var oldL = document.createElement("div"); oldL.className = "hc-old";
    oldL.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
    oldL.innerHTML = oldHTML;
    host.style.position = "relative"; host.style.overflow = "hidden";
    host.appendChild(oldL);
    oldL.animate([{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: "translate3d(" + (-dir * W * 0.55) + "px,0,0)", opacity: 0 }], { duration: MS, easing: EASE, fill: "forwards" })
      .onfinish = function () { oldL.remove(); host.style.overflow = ""; };
    var sv = $("svg", host);
    if (sv) sv.animate([{ transform: "translate3d(" + dir * W + "px,0,0)" }, { transform: "translate3d(0,0,0)" }], { duration: MS, easing: EASE });
  }
  // Tap the selected metric: the chart folds away (and unfolds again) with a slide + blur + line redraw.
  function foldHome() {
    var top = $(".hm-top"); if (!top) return;
    var closing = !top.classList.contains("fold");
    clearTimeout(top._ft); clearTimeout(top._fd);
    top.classList.add("anim");
    if (closing) {
      hap("medium");
      top.classList.add("fold");
      top._fd = setTimeout(function () { hap("light"); }, 330);
    } else {
      hap("light");
      top.classList.remove("fold");
      top._fd = setTimeout(function () {
        var host = $("#hchart");
        if (host && host._g) drawChart(host, host._g.R, homeMet, { anim: true, h: CH });
        hap("selection");
      }, 220);
    }
    top._ft = setTimeout(function () { top.classList.remove("anim"); }, 900);
  }
  function bindMetButtons() {
    $$(".met[data-met]", $("#s-home")).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-met"); if (k === homeMet) { foldHome(); return; }
        hap(6); switchMetric(k, b);
      });
    });
  }
  function countIn() {
    var M = MET[homeMet], v = M.v(rangeData(homeRange).tot);
    $$(".met.on .mv").forEach(function (mv) { countTo(mv, 0, v, function (x) { return fmtMet(M.k, x, true); }, 1000); });
  }
  function rangeSheet() {
    optSheet("Date range", RANGES.map(function (r) { return r[1]; }), rangeLabel(homeRange), function (v) {
      RANGES.forEach(function (r) { if (r[1] === v) homeRange = r[0]; });
      var R = rangeData(homeRange);
      $("#mets").innerHTML = metStrip(R); bindMetButtons(); layoutStrip();
      $("#rngL").textContent = rangeShort(homeRange);
      drawChart($("#hchart"), R, homeMet, { anim: true, h: CH });
      countIn();
    });
  }
  function rangeShort(k) { return { today: "Today", yday: "Yesterday", "7d": "7 days", "30d": "30 days", "90d": "90 days", "365d": "365 days" }[k] || k; }
  function rangeLabel(k) { for (var i = 0; i < RANGES.length; i++) if (RANGES[i][0] === k) return RANGES[i][1]; return k; }
  function showTip(i, g) {
    var tip = $("#tip");
    if (!tip) return;
    if (i < 0) { tip.classList.remove("on"); return; }
    var M = MET[g.mk], R = g.R;
    var cur = g.cur[i], pv = g.prev[i];
    var lbl, plbl;
    if (R.hourly) {
      var base = R.key === "today" ? T : T - 1;
      lbl = md(S.day0 + base * DAY + 12 * HOUR) + ", " + xLabel(R, i);
      plbl = md(S.day0 + (base - 1) * DAY + 12 * HOUR) + ", " + xLabel(R, i);
    } else {
      var di = R.a + i * R.step, pdi = di - R.n * R.step;
      lbl = md(S.day0 + di * DAY + 12 * HOUR) + (R.step > 1 ? " – " + md(S.day0 + Math.min(T, di + R.step - 1) * DAY + 12 * HOUR) : "");
      plbl = md(S.day0 + pdi * DAY + 12 * HOUR);
    }
    tip.innerHTML = '<div><i class="sw cur"></i><span>' + esc(lbl) + "</span><b>" + (cur == null ? "–" : fmtMet(M.k, cur, false, true)) + '</b></div><div><i class="sw prv"></i><span>' + esc(plbl) + "</span><b>" + (pv == null ? "–" : fmtMet(M.k, pv, false, true)) + "</b></div>";
    var x = g.X(i), w = 210, host = $("#hchart");
    var left = Math.max(12, Math.min(host.clientWidth - w - 4, x - w / 2));
    tip.style.transform = "translateX(" + left + "px)";
    tip.classList.add("on");
  }
  function logoTile(big) {
    if (S.logo) return '<span class="logo' + (big ? " big" : "") + '"><img src="' + esc(S.logo) + '" alt=""></span>';
    var pal = ["#7b61ff", "#2c6ecb", "#008060", "#e8590c", "#d6336c", "#0b7285", "#5c940d", "#495057"], h = 0;
    for (var i = 0; i < S.name.length; i++) h = (h * 31 + S.name.charCodeAt(i)) >>> 0;
    return '<span class="logo ini' + (big ? " big" : "") + '" style="background:' + pal[h % pal.length] + '">' + esc(S.ini) + "</span>";
  }
  function topProductsCard() {
    var list = prods.slice().sort(function (a, b) { return b.sold - a.sold; }).slice(0, 3);
    if (!list.length || !list[0].sold) return "";
    return '<div class="card tp"><div class="card-h"><h3>Top products</h3><span>Last 30 days</span></div>' + list.map(function (p) {
      return '<button class="tp-r" data-prod="' + p.i + '">' + thumb(p, 40) + '<div><b>' + esc(p.title) + "</b><span>" + count(p.sold) + " units sold</span></div><em>" + money(p.sold * p.price, { auto: true }) + "</em></button>";
    }).join("") + "</div>";
  }
  function thumb(p, size) {
    var cls = "th" + (size >= 60 ? " lg" : "") + (p.img ? " img" : "");
    return '<span class="' + cls + '" style="--h:' + p.hue + '">' + (p.img ? '<img src="' + p.img + '" alt="">' : ic("image")) + "</span>";
  }
  function globeSvg(sz) {
    return '<svg class="globe" width="' + sz + '" height="' + sz + '" viewBox="0 0 64 64"><defs><radialGradient id="gg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#3a3f47"/><stop offset="1" stop-color="#0d0f12"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#gg)"/>' +
      '<g fill="none" stroke="#5c6470" stroke-width=".6" opacity=".7"><ellipse cx="32" cy="32" rx="30" ry="11"/><ellipse cx="32" cy="32" rx="30" ry="22"/><ellipse cx="32" cy="32" rx="11" ry="30"/><ellipse cx="32" cy="32" rx="22" ry="30"/><line x1="2" y1="32" x2="62" y2="32"/><line x1="32" y1="2" x2="32" y2="62"/></g>' +
      '<circle class="gd" cx="22" cy="24" r="2.4" fill="#36d27a"/><circle class="gd d2" cx="40" cy="30" r="2" fill="#36d27a"/><circle class="gd d3" cx="30" cy="42" r="1.8" fill="#36d27a"/></svg>';
  }

  /* Pull to refresh on Home.
     The header (.hm-hd: profile / store / bell) is never transformed: only the
     content under it (.hm-top children except .ptr + .hm-hd, and .hm-sheet) follows
     the finger. The spinner sits in the gap opened between the header and the content.
     Listeners are bound ONCE on the persistent #s-home (renderHome() rebuilds its
     innerHTML and calls bindPtr() again - re-binding used to stack handlers). */
  function bindPtr() {
    var sc = $("#s-home");
    if (!sc || sc._ptrBound) return;
    sc._ptrBound = true;
    var THRESH = 100, HOLD = 84, MAXPULL = 180;
    var x0 = null, y0 = null, pull = 0, shift = 0, axis = null, busy = false, spH = 28;
    /* "none" (not "contain") is what disables WebKit's rubber-band on every scroller, top AND bottom
       (no more native bounce moving the header, no black band under the content at the bottom). */
    if (!document.getElementById("ptr-nobounce-css")) {
      var nb = document.createElement("style"); nb.id = "ptr-nobounce-css";
      nb.textContent = "html,body,[id^='s-']{overscroll-behavior-y:none}";
      document.head.appendChild(nb);
    }
    /* Spinner natif Apple (UIRefreshControl) : l'app iOS le dessine, la page ne fait que lui envoyer la distance tirée. */
    var nativePtr = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpPtr);
    function ptrPost(o) { try { window.webkit.messageHandlers.larpPtr.postMessage(o); } catch (e) { } }
    function ptrEl() { return $("#ptr", sc); }
    function bodyEls() {
      var out = [], top = $(".hm-top", sc), sheet = $(".hm-sheet", sc);
      if (top) Array.prototype.forEach.call(top.children, function (c) {
        if (c.id !== "ptr" && !(c.classList && c.classList.contains("hm-hd"))) out.push(c);
      });
      if (sheet) out.push(sheet);
      return out;
    }
    /* iOS-style activity indicator: 8 rounded spokes. While pulling, each spoke fades in smoothly with the
       gesture; while loading, every spoke runs the same linear fade, phase-shifted (continuous, no stepping). */
    function ensureSpinner(ptr) {
      if (!ptr || ptr._ios) return;
      ptr._ios = true;
      if (nativePtr) { ptr.style.display = "none"; return; }
      if (!document.getElementById("ptr-ios-css")) {
        var st = document.createElement("style"); st.id = "ptr-ios-css";
        st.textContent = "@keyframes ptrFade{0%{opacity:1}100%{opacity:.14}}" +
          "#ptr .ptr-ios.load line{animation:ptrFade .8s linear infinite}";
        document.head.appendChild(st);
      }
      var sp = "";
      for (var i = 0; i < 8; i++) sp += '<line x1="16" y1="3.6" x2="16" y2="9.6" stroke="#eceef2" stroke-width="3" stroke-linecap="round" transform="rotate(' + (i * 45) + ' 16 16)" opacity="0" style="animation-delay:' + (-(0.8 - i * 0.1)).toFixed(1) + 's"/>';
      ptr.innerHTML = '<svg class="ptr-ios" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">' + sp + "</svg>";
      ptr.style.width = ptr.style.height = "32px";
      ptr.style.background = "none"; ptr.style.border = "0"; ptr.style.boxShadow = "none"; ptr.style.borderRadius = "0";
    }
    function spokes(ptr, progress, loading) {
      var sv = ptr && $(".ptr-ios", ptr); if (!sv) return;
      var L = sv.childNodes, k = Math.min(1, progress) * 8;
      sv.classList.toggle("load", !!loading);
      for (var i = 0; i < 8; i++) L[i].setAttribute("opacity", loading ? 1 : (Math.max(0, Math.min(1, k - i)) * (1 - i * 0.07)).toFixed(2));
    }
    function placePtr(ptr) {
      ensureSpinner(ptr);
      var hd = $(".hm-hd", sc);
      if (!ptr || !hd) return;
      var h = ptr.getBoundingClientRect().height; if (h > 4) spH = h;
      ptr.style.position = "absolute"; ptr.style.left = "50%"; ptr.style.right = "auto";
      ptr.style.marginLeft = -(ptr.getBoundingClientRect().width || spH) / 2 + "px";
      ptr.style.top = hd.offsetTop + hd.offsetHeight + "px";
      ptr.style.bottom = "auto"; ptr.style.zIndex = "1"; ptr.style.pointerEvents = "none";
    }
    /* Everything is driven by ONE requestAnimationFrame spring: the content follows the finger directly while
       dragging, and on release it glides (velocity preserved, no overshoot) to the hold position / back to 0. */
    var cur = 0, vel = 0, tgt = 0, raf = 0, last = 0, onDone = null, loading = false;
    function apply(s) {
      var els = bodyEls(), ptr = ptrEl(), t = s > 0.05 ? "translate3d(0," + s.toFixed(2) + "px,0)" : "";
      if (nativePtr) ptrPost({ s: "pull", y: Math.max(0, s) });
      els.forEach(function (el) {
        el.style.transition = "none";
        el.style.willChange = t ? "transform" : "";
        el.style.transform = t;
      });
      if (ptr && !nativePtr) {
        ptr.style.transition = "none";
        ptr.style.opacity = Math.min(1, s / 30).toFixed(2);
        ptr.style.transform = t ? "translate3d(0," + (s / 2 - spH / 2).toFixed(2) + "px,0)" : "";
        if (s > 0.05) spokes(ptr, s / THRESH, loading);
      }
    }
    function clearInline() {
      bodyEls().forEach(function (el) { el.style.transition = ""; el.style.transform = ""; el.style.willChange = ""; });
      var ptr = ptrEl(); if (ptr) { ptr.style.transition = ""; ptr.style.transform = ""; ptr.style.opacity = ""; }
    }
    function stopSpring() { if (raf) cancelAnimationFrame(raf); raf = 0; onDone = null; }
    function step(t) {
      var dt = Math.min(0.032, Math.max(0.001, (t - last) / 1000)); last = t;
      var K = 200, C = 2 * Math.sqrt(K);                       // critically damped: smooth, no bounce
      vel += (K * (tgt - cur) - C * vel) * dt;
      cur += vel * dt;
      if (Math.abs(tgt - cur) < 0.2 && Math.abs(vel) < 3) {
        cur = tgt; vel = 0; raf = 0; apply(cur);
        var d = onDone; onDone = null; if (d) d();
        return;
      }
      apply(cur);
      raf = requestAnimationFrame(step);
    }
    function springTo(to, done) {
      tgt = to; onDone = done || null;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    }
    function home(done) { springTo(0, function () { clearInline(); if (done) done(); }); }
    function reset() { x0 = y0 = null; pull = shift = 0; axis = null; }
    var lastT = 0;
    sc.addEventListener("touchstart", function (e) {
      if (busy || raf || e.touches.length !== 1 || sc.scrollTop > 0) { reset(); return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; pull = shift = 0; axis = null;
      cur = vel = 0; loading = false; lastT = 0;
      placePtr(ptrEl());
      if (nativePtr) { var hdr = $(".hm-hd", sc); ptrPost({ s: "start", top: hdr ? hdr.getBoundingClientRect().bottom : 0 }); }
    }, { passive: true });
    sc.addEventListener("touchmove", function (e) {
      if (y0 === null) return;
      var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (axis === null) {
        if (dx === 0 && dy === 0) return;
        /* decide on the very FIRST move: iOS starts its native pan on the first uncancelled touchmove,
           a later preventDefault would be ignored (that was the whole page bouncing, header included). */
        axis = (dy > 0 && dy >= Math.abs(dx) && sc.scrollTop <= 0) ? "y" : "x";
      }
      if (axis !== "y") return;
      if (dy <= 0 || sc.scrollTop > 0) { // finger went back up: hand over to normal scrolling
        if (cur) { cur = 0; apply(0); clearInline(); }
        pull = shift = 0; return;
      }
      pull = dy;
      var ns = MAXPULL * (1 - Math.exp(-pull / 220)), now = e.timeStamp || performance.now();
      if (lastT && now > lastT) vel = Math.max(-3000, Math.min(3000, (ns - cur) / ((now - lastT) / 1000)));
      lastT = now; shift = cur = ns;
      if (e.cancelable) e.preventDefault(); // stop WKWebView's native rubber-band so only OUR transform moves
      apply(cur);
    }, { passive: false });
    function end() {
      if (y0 === null || axis !== "y" || !shift) { reset(); return; }
      var go = shift >= THRESH;
      reset();
      if (!go) { home(); return; }
      busy = true; loading = true; hap(10);
      if (nativePtr) ptrPost({ s: "load" });
      springTo(HOLD);
      setTimeout(function () {
        if (nativePtr) ptrPost({ s: "end" });
        home(function () { loading = false; busy = false; renderHome(); });
      }, 800);
    }
    sc.addEventListener("touchend", end);
    sc.addEventListener("touchcancel", function () { var had = cur; reset(); if (had) home(); });
  }

  /* ── Orders ──────────────────────────────────────────────── */
  var oFilter = "All", oShown = 40, oQuery = "";
  var badge = function (txt, kind) { return '<span class="bdg ' + kind + '">' + esc(txt) + "</span>"; };
  function payBadge(o) {
    var m = { Paid: "neu", "Payment pending": "warn", Authorized: "warn", Refunded: "neu", "Partially refunded": "neu", Voided: "neu" };
    return badge(o.pay, m[o.pay] || "neu");
  }
  function fulBadge(o) { return o.ful === "Fulfilled" ? badge("Fulfilled", "ok") : o.ful === "Partially fulfilled" ? badge("Partially fulfilled", "att") : badge("Unfulfilled", "att"); }
  function orderMatches(o) {
    if (oFilter === "Unfulfilled" && !(o.ful !== "Fulfilled" && o.pay !== "Refunded")) return false;
    if (oFilter === "Unpaid" && !(o.pay === "Payment pending" || o.pay === "Authorized")) return false;
    if (oFilter === "Open" && o.archived) return false;
    if (oFilter === "Archived" && !o.archived) return false;
    if (oQuery) {
      var q = oQuery.toLowerCase();
      var hay = ("#" + o.n + " " + (o.c ? o.c.name + " " + o.c.email : "") + " " + o.items.map(function (x) { return x.p.title; }).join(" ")).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function orderRow(o) {
    var n = units(o);
    var fulBy = o.ful === "Fulfilled" || o.pay === "Refunded" ? L10n(o.shipM) : L10n("Fulfill by:") + " " + mdyL(o.ts + (o.shipM === "Express Shipping" ? 1 : 3) * DAY) + " \u2022 " + L10n(shipShort(o.shipM));
    return '<button class="orow" data-order="' + o.n + '"><div class="or1"><b>#' + o.n + "</b><b>" + money(o.total) + " " + esc(S.cur || "") + "</b></div>" +
      '<div class="or2"><span>' + esc(o.c ? o.c.name : "No customer") + "</span><span>" + n + " item" + (n === 1 ? "" : "s") + "</span><span>" + hmPad(o.ts) + "</span></div>" +
      '<div class="or3">' + fulBadge(o) + payBadge(o) + (o.note ? ic("note", "on") : "") + "</div>" +
      '<div class="or4">' + esc(o.ch === "Point of Sale" ? L10n("Point of Sale") : fulBy) + "</div></button>";
  }
  function orderList(list, limit) {
    var out = "", last = "";
    list.slice(0, limit).forEach(function (o) {
      var g = relDay(o.ts);
      if (g !== last) { out += '<div class="dgrp">' + esc(g) + "</div>"; last = g; }
      out += orderRow(o);
    });
    return out;
  }
  /* ── Pages claires Liquid Glass (Commandes / Produits) ── */
  var IMG = "larp-assets/shopify-mobile/img/";
  var glStatus = false;
  function glHead(title, act, btns) {
    return '<header class="gl-hd"><button class="gl-tt" data-act="' + act + '"><span>' + title + '</span><i class="gl-chev">' + ic("chev-down") + '</i></button><span class="fl"></span>' + btns + "</header>";
  }
  function glBtn(act, label, icon) { return '<button class="gl-btn" data-act="' + act + '" aria-label="' + label + '">' + ic(icon) + "</button>"; }
  function renderOrders() {
    var el = $("#s-orders");
    el.classList.add("gl-scr");
    var list = orders.filter(orderMatches);
    var none = !orders.length && !oQuery && oFilter === "All";
    var head = glHead("Orders", "locations", glBtn("neworder", "Create order", "plus-circle") + (none ? "" : glBtn("ordermore", "More", "more")));
    if (none) {
      el.innerHTML = '<div class="gl-page">' + head + '<div class="gl-body"><div class="gl-empty olist" id="olist">' +
        '<img class="gl-hero" src="' + IMG + 'orders-hero.webp" alt="" width="220" height="200">' +
        "<h2>Get your first order</h2><p>Use Quick Sale to sell anywhere, to anyone, right from your phone</p>" +
        '<button class="gl-cta" data-act="quicksale">Set up Quick Sale</button></div></div></div>';
      return;
    }
    el.innerHTML = '<div class="gl-page">' + head + '<div class="gl-body"><div class="gl-tools">' +
      '<div class="sbar"><label class="sfield">' + ic("search") + '<input id="oq" type="search" placeholder="All locations" value="' + esc(oQuery) + '" autocomplete="off"></label><button class="cb" data-act="locations" aria-label="Locations">' + ic("location") + '</button><button class="cb dot" data-act="sort" aria-label="Sort">' + ic("sort") + '</button><button class="cb" data-act="ofilter" aria-label="Filter">' + ic("filter") + "</button></div>" +
      '<div class="chips">' + ["All", "Unfulfilled", "Unpaid", "Open", "Archived"].map(function (c) { return '<button class="chip' + (c === oFilter ? " on" : "") + '" data-of="' + c + '">' + c + "</button>"; }).join("") + "</div></div>" +
      '<div class="olist" id="olist">' + (list.length ? orderList(list, oShown) : emptyState("No orders found", "Try changing the filters or search term")) + "</div></div></div>";
    $$(".chip", el).forEach(function (b) { b.addEventListener("click", function () { oFilter = b.getAttribute("data-of"); oShown = 40; hap(5); renderOrders(); }); });
    var q = $("#oq");
    q.addEventListener("input", function () { oQuery = q.value; var l = orders.filter(orderMatches); $("#olist").innerHTML = l.length ? orderList(l, oShown) : emptyState("No orders found", "Try changing the filters or search term"); });
  }
  // Date courte dans la langue de l'app (19 oct. / Oct 19), au lieu du 10/19/26 américain.
  function mdyL(t) {
    var d = L(t), loc = "en-US";
    try { if (window.I18N) window.I18N.langs.forEach(function (l) { if (l.code === window.I18N.lang) loc = l.loc; }); } catch (e) { }
    try { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: "UTC" }); } catch (e2) { return mdy(t); }
  }
  function mdy(t) { var d = L(t); return d.getUTCMonth() + 1 + "/" + d.getUTCDate() + "/" + String(d.getUTCFullYear()).slice(2); }
  function shipShort(m) { return m === "Express Shipping" ? "Express" : m === "Free Shipping" ? "Economy" : "Standard"; }
  function emptyState(t, s) { return '<div class="empty">' + ic("search") + "<b>" + esc(t) + "</b><span>" + esc(s) + "</span></div>"; }

  /* ── Products ────────────────────────────────────────────── */
  var pFilter = "All", pQuery = "";
  var pSel = null;                         // null = mode normal ; tableau = mode sélection (produits cochés)
  function prodByI(n) { for (var k = 0; k < prods.length; k++) if (prods[k].i === n) return prods[k]; return null; }
  function invLine(p) {
    var v = p.vars > 1 ? " \u00b7 " + p.vars + " variants" : "";
    if (p.inv <= 0) return '<span class="neg">0 available</span>' + v;
    return count(p.inv) + " available" + v + (p.vars > 1 && p.inv < p.vars * 6 ? ' <span class="neg">(some out of stock)</span>' : "");
  }
  function prodsSorted(l) { return EMPTY ? l.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0) || a.i - b.i; }) : l; }
  function renderProducts() {
    var el = $("#s-products");
    el.classList.add("gl-scr");
    if (pSel && !prods.length) pSel = null;
    el.classList.toggle("selecting", !!pSel);
    postSel();
    var list = prodsSorted(prods.filter(function (p) { return (pFilter === "All" || p.status === pFilter) && (!pQuery || p.title.toLowerCase().indexOf(pQuery.toLowerCase()) >= 0); }));
    var none = !prods.length && !pQuery && pFilter === "All";
    var head = glHead("Products", "prodviews", pSel ? "" : glBtn("newproduct", "Add product", "plus-circle") + (none || !EMPTY ? "" : glBtn("prodsmore", "More", "more")));
    var trial = pSel ? selBarHtml() : "";  // pastille « Subscribe to keep selling / 3 days left » retirée
    if (none) {
      el.innerHTML = '<div class="gl-page">' + head + '<div class="gl-body"><div class="gl-empty gl-empty-p">' +
        '<img class="gl-hero" src="' + IMG + 'products-hero.webp" alt="" width="143" height="143">' +
        "<h2>Add your first product</h2><p>Start by adding products to your store that your customers will love</p>" +
        '<button class="gl-cta" data-act="newproduct">Add your products</button>' +
        '<h3 class="gl-sub">Other ways to add products</h3><div class="gl-cards">' +
        '<button class="gl-card" data-act="discover"><b>Discover products to sell</b><img class="gl-c1" src="' + IMG + 'card-discover.webp" alt=""></button>' +
        '<button class="gl-card" data-act="sampleproduct"><b>Add a sample product</b><img class="gl-c2" src="' + IMG + 'card-sample.webp" alt=""></button>' +
        "</div></div></div>" + trial + "</div>";
      return;
    }
    el.classList.toggle("selecting", !!pSel);
    el.innerHTML = '<div class="gl-page">' + head + '<div class="gl-body"><div class="gl-tools">' +
      '<div class="sbar"><label class="sfield">' + ic("search") + '<input id="pq" type="search" placeholder="Filter products" value="' + esc(pQuery) + '" autocomplete="off"></label><button class="cb" data-act="sort" aria-label="Sort">' + ic("sort") + '</button><button class="cb" data-act="pfilter" aria-label="Filter">' + ic("filter") + "</button></div>" +
      '<div class="chips">' + ["All", "Active", "Draft", "Archived"].map(function (c) { return '<button class="chip' + (c === pFilter ? " on" : "") + '" data-pf="' + c + '">' + c + "</button>"; }).join("") + "</div></div>" +
      '<div class="plist" id="plist">' + (list.length ? list.map(prodRow).join("") : emptyState("No products found", "Try changing the filters or search term")) + "</div></div>" + trial + "</div>";
    $$(".chip", el).forEach(function (b) { b.addEventListener("click", function () { pFilter = b.getAttribute("data-pf"); hap(5); renderProducts(); }); });
    var q = $("#pq");
    q.addEventListener("input", function () { pQuery = q.value; var l = prodsSorted(prods.filter(function (p) { return (pFilter === "All" || p.status === pFilter) && p.title.toLowerCase().indexOf(pQuery.toLowerCase()) >= 0; })); $("#plist").innerHTML = l.length ? l.map(prodRow).join("") : emptyState("No products found", "Try changing the filters or search term"); });
  }
  function prodRow(p) {
    var on = pSel && pSel.indexOf(p) >= 0;
    return '<button class="prow' + (pSel ? " selmode" : "") + (on ? " picked" : "") + '" data-prod="' + p.i + '">' + (pSel ? '<span class="pr-ck">' + ic("check") + "</span>" : "") + thumb(p, 44) + '<div class="pr-t"><b>' + esc(p.title) + "</b><span>" + invLine(p) + "</span></div>" + '<i class="pr-dot ' + (p.status === "Active" ? "on" : p.status === "Draft" ? "dr" : p.status === "Unlisted" ? "un" : "ar") + '" role="img" aria-label="' + esc(p.status) + '"></i></button>';
  }

  /* ── Menu: drawer + sections under the ≡ tab ───────────── */
  var DRAWER = [
    ["home", "Home", "d-home"],
    ["orders", "Orders", "d-orders", ["Drafts", "Abandoned checkouts"]],
    ["products", "Products", "d-products", ["Collections", "Inventory", "Purchase orders", "Transfers", "Gift cards"]],
    ["customers", "Customers", "d-customers", ["Segments", "Companies"]],
    ["growth", "Growth", "d-growth", ["Campaigns", "Attribution", "Automations"]],
    ["discounts", "Discounts", "d-discounts"],
    ["content", "Content", "d-content", ["Metaobjects", "Files", "Menus", "Blog posts"]],
    ["markets", "Markets", "d-markets", ["Catalogs"]],
    ["finance", "Finance", "d-finance", ["Payouts", "Balance", "Billing"]],
    ["analytics", "Analytics", "d-analytics", ["Reports", "Live View"]],
  ];
  var CHANNELS = [["onlinestore", "Online Store", "d-store", ["Themes", "Pages", "Navigation", "Preferences"]], ["inbox", "Inbox", "d-inbox"], ["pos", "Point of Sale", "d-pos"], ["shop", "Shop", "d-shop"], ["social", "Facebook & Instagram", "d-social"]];
  var drawerEl = null;
  /* Barre du bas du menu en Liquid Glass natif (iOS 26) : la barre web reste dans le DOM (invisible) et sert de relais. */
  function postDrawer(open) {
    try {
      var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpDrawer;
      if (mh) mh.postMessage({ open: !!open });
    } catch (e) { }
  }
  window.__larpNativeDrawer = function (name) {
    if (!drawerEl) return;
    var sel = name === "close" ? "[data-dclose]" : '[data-go="' + name + '"]';
    var b = drawerEl.querySelector(".dr-bot " + sel);
    if (b) b.click();
  };
  function drawerRow(r, activeKey) {
    var kids = r[3];
    return '<div class="dr-item' + (r[0] === activeKey ? " cur" : "") + '"><div class="dr-row" data-go="' + r[0] + '">' + ic(r[2]) + "<span>" + esc(r[1]) + "</span>" +
      (kids ? '<button class="dr-x" aria-label="Expand">' + ic("chev-down") + "</button>" : "") + "</div>" +
      (kids ? '<div class="dr-sub">' + kids.map(function (k) { return '<button class="dr-srow" data-go="' + subGo(k) + '">' + esc(k) + "</button>"; }).join("") + (r[0] === "products" ? '<button class="dr-srow scan" data-go="scan">' + ic("barcode") + "Scan inventory</button>" : "") + "</div>" : "") + "</div>";
  }
  function subGo(k) { return { "Live View": "liveview", Reports: "analytics", Payouts: "finance", Balance: "finance", Inventory: "products", Segments: "customers" }[k] || "soon:" + k; }
  function openDrawer() {
    if (drawerEl) return;
    var active = current === "menu" ? menuView : current;
    var el = document.createElement("div");
    el.id = "drawer";
    el.innerHTML = '<div class="dr-bg"></div><div class="dr-list">' + DRAWER.map(function (r) { return drawerRow(r, active); }).join("") +
      '<button class="dr-head" data-go="soon:Sales channels">Sales channels' + ic("chev-right") + "</button>" + CHANNELS.map(function (r) { return drawerRow(r, active); }).join("") +
      '<button class="dr-add" data-go="soon:Add sales channel">' + ic("plus-circle") + "Add</button>" +
      '<button class="dr-head" data-go="soon:Apps">Apps' + ic("chev-right") + "</button>" + drawerRow(["apps", "Shopify Email", "email"], active) + drawerRow(["apps", "Shopify Flow", "apps"], active) +
      '<button class="dr-add" data-go="soon:Add app">' + ic("plus-circle") + "Add</button></div>" +
      '<div class="dr-bot"><button class="dr-c" data-go="settings" aria-label="Settings">' + ic("settings") + '</button><button class="dr-qs" data-go="quicksale">' + ic("tap") + '<span>Quick sale</span></button><button class="dr-c" data-dclose aria-label="Close">' + ic("x") + "</button></div>";
    app.appendChild(el);
    drawerEl = el;
    postDrawer(true);
    statusBar("light");
    $("#tabbar").classList.add("hide");
    try { history.pushState({ dr: 1 }, ""); } catch (e) { }
    $$(".dr-item, .dr-head, .dr-add", el).forEach(function (r, k) { r.style.setProperty("--d", Math.min(k, 16) * 14 + "ms"); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    $$(".dr-x", el).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation(); hap(4);
        var row = b.closest(".dr-item"), sub = $(".dr-sub", row), open = row.classList.toggle("open");
        sub.style.height = open ? sub.scrollHeight + "px" : "0px";
      });
    });
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-go],[data-dclose]");
      if (!t) return;
      e.stopPropagation();
      if (t.hasAttribute("data-dclose")) { hap(5); return closeDrawer(); }
      var go = t.getAttribute("data-go"); hap(5);
      closeDrawer();
      setTimeout(function () { navigate(go); }, 120);
    });
  }
  function closeDrawer(fromHistory) {
    if (!drawerEl) return;
    var el = drawerEl; drawerEl = null;
    postDrawer(false);
    statusBar(glStatus ? "dark" : "light");
    el.classList.remove("on");
    $("#tabbar").classList.toggle("hide", !!(stack.length && noTabs(stack[stack.length - 1].el)));
    if (!fromHistory) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
    setTimeout(function () { el.remove(); }, 380);
  }
  function navigate(go) {
    if (go === "home" || go === "orders" || go === "products") { closeAll(); return setTab(go, true); }
    if (go === "liveview") return openLiveView();
    if (go === "quicksale") return quickSale();
    if (go === "scan") return toast("Camera access is needed to scan barcodes");
    if (go.indexOf("soon:") === 0) { var nm = go.slice(5); return page('<div class="soon">' + ic("apps") + "<b>" + esc(nm) + "</b><span>" + esc(nm) + " for " + esc(S.name) + ".</span></div>", { title: nm }); }
    closeAll();
    menuView = go;
    rendered.menu = 0;
    setTab("menu");
  }
  var menuView = "analytics";
  /* ── Sélection multiple + suppression groupée ──────────── */
  function selBarHtml() {
    var n = pSel ? pSel.length : 0;
    return '<div class="gl-dock gl-seldock"><div class="gl-selbar" id="selbar">' +
      '<button class="sb-n" data-act="selexit" aria-label="Exit selection">' + ic("x-circle") + '<b id="selN">' + n + "</b></button><span class=\"fl\"></span>" +
      '<button class="sb-del" id="selDel" data-act="seldel"' + (n ? "" : " disabled") + ">Delete</button>" +
      '<button class="sb-more" id="selMore" data-act="selmore" aria-label="More"' + (n ? "" : " disabled") + ">" + ic("more") + "</button></div></div>";
  }
  // iOS 26 : la barre de sélection est du vrai Liquid Glass natif (GlassSelectionBar.swift) et la confirmation une UIAlertController.
  // La barre HTML ci-dessous reste le relais (invisible) et le repli hors iOS 26 / navigateur.
  var pBusy = false;
  function nativeHandler(name) {
    try { if (!document.documentElement.classList.contains("native-glass-drawer")) return null; var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[name]; return h || null; } catch (e) { return null; }
  }
  function postSel() {
    var h = nativeHandler("larpSelect"); if (!h) return;
    var shown = !!pSel && current === "products" && !stack.length;
    try { h.postMessage({ shown: shown, count: pSel ? pSel.length : 0, busy: pBusy }); } catch (e) { }
  }
  window.__larpNativeSelect = function (name) {
    if (!pSel || pBusy) return;
    if (name === "selexit") return exitSelect();
    if (!pSel.length) return;
    if (name === "seldel") return confirmDelete();
    if (name === "selmore") return selMoreSheet();
    if (name === "sel:all") return selToggleAll();
    if (name.indexOf("sel:") === 0) return runBulk(name.slice(4));
  };
  /* Actions en masse du menu « … » de la barre de sélection (Définir comme actif / brouillon / non répertorié, Archiver, balises, collections). */
  var BULK = {
    active: { st: "Active", run: "Updating products…", done: "Products updated" },
    draft: { st: "Draft", run: "Updating products…", done: "Products updated" },
    unlisted: { st: "Unlisted", run: "Updating products…", done: "Products updated" },
    archive: { st: "Archived", run: "Archiving products…", done: "Products archived" },
    tagadd: { run: "Updating tags…", done: "Tags updated" },
    tagdel: { run: "Updating tags…", done: "Tags updated" },
    coladd: { run: "Updating collections…", done: "Collections updated" },
    coldel: { run: "Updating collections…", done: "Collections updated" },
  };
  function setStatus(list, st) {
    var cfg = savedSettingsObj();
    list.forEach(function (p) {
      p.status = st;
      if (Array.isArray(cfg.products)) cfg.products.forEach(function (c) { if (c && ((p.pid && c.id === p.pid) || (!p.pid && c.title === p.title))) c.status = st; });
    });
    writeSettings(cfg);
    saveState();
  }
  function runBulk(kind) {
    var b = BULK[kind]; if (!b || !pSel || !pSel.length || pBusy) return;
    var list = pSel.slice(), bar = $("#selbar");
    pBusy = true;
    if (bar) bar.classList.add("busy");
    syncSelBar();
    hap(8);
    toast(b.run, "spin", 0);
    setTimeout(function () {
      if (b.st) setStatus(list, b.st);
      pBusy = false; pSel = null;
      rendered.products = 0; renderProducts(); rendered.products = 1;
      hap(14); toast(b.done, "ok");
    }, 900);
  }
  function selToggleAll() {
    var all = visibleProds(), every = all.length && all.every(function (p) { return pSel.indexOf(p) >= 0; });
    if (every) pSel = pSel.filter(function (p) { return all.indexOf(p) < 0; });
    else all.forEach(function (p) { if (pSel.indexOf(p) < 0) pSel.push(p); });
    $$("#plist .prow").forEach(function (r) { var q = prodByI(+r.getAttribute("data-prod")); r.classList.toggle("picked", !!q && pSel.indexOf(q) >= 0); });
    syncSelBar();
  }
  /* Appui long sur un produit : passe en mode sélection avec ce produit coché. */
  var lpAt = 0;
  (function () {
    var timer = 0, row = null, sx = 0, sy = 0, fired = false;
    function stop() { clearTimeout(timer); timer = 0; row = null; }
    document.addEventListener("touchstart", function (e) {
      stop(); fired = false;
      if (e.touches.length !== 1 || pSel || pBusy || current !== "products" || stack.length) return;
      var r = e.target.closest && e.target.closest("#plist .prow"); if (!r) return;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; row = r;
      timer = setTimeout(function () {
        var n = row ? +row.getAttribute("data-prod") : NaN; timer = 0;
        if (isNaN(n) || pSel) return;
        fired = true; lpAt = Date.now(); hap(12);
        var sc = $("#s-products"), top = sc ? sc.scrollTop : 0;
        enterSelect(); if (sc) sc.scrollTop = top;
        toggleSel(n);
      }, 420);
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!timer) return;
      var t = e.touches[0]; if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) stop();
    }, { passive: true });
    ["touchend", "touchcancel"].forEach(function (ev) { document.addEventListener(ev, function () { if (fired) lpAt = Date.now(); stop(); }, { passive: true }); });
    document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest("#plist .prow")) e.preventDefault(); });
  })();
  var confirmCb = null;
  window.__larpConfirmResult = function (id, ok) {
    var cb = confirmCb; confirmCb = null;
    if (cb && ok) cb();
  };
  function syncSelBar() {
    postSel();
    var n = pSel ? pSel.length : 0, b = $("#selbar"); if (!b) return;
    $("#selN").textContent = n;
    var busy = b.classList.contains("busy");
    $("#selDel").disabled = !n || busy; $("#selMore").disabled = !n || busy;
  }
  function enterSelect() { pSel = []; rendered.products = 0; renderProducts(); rendered.products = 1; var sc = $("#s-products"); if (sc) sc.scrollTop = 0; }
  function exitSelect() { pSel = null; renderProducts(); }
  function toggleSel(n) {
    var p = prodByI(n); if (!p || !pSel) return;
    var k = pSel.indexOf(p); if (k >= 0) pSel.splice(k, 1); else pSel.push(p);
    var row = $('#plist .prow[data-prod="' + n + '"]'); if (row) row.classList.toggle("picked", k < 0);
    hap(4); syncSelBar();
  }
  function visibleProds() { return prodsSorted(prods.filter(function (p) { return (pFilter === "All" || p.status === pFilter) && (!pQuery || p.title.toLowerCase().indexOf(pQuery.toLowerCase()) >= 0); })); }
  function actionsSheet() {
    var el = sheet("", '<h2 class="act-h">Actions</h2><div class="opts"><button class="opt act" data-o="select">' + ic("check-circle") + "<span>Select products</span></button></div>");
    $(".opt", el).addEventListener("click", function () { hap(6); pop(false); setTimeout(enterSelect, 200); });
  }
  function selMoreSheet() {
    var all = visibleProds(), every = all.length && all.every(function (p) { return pSel.indexOf(p) >= 0; });
    optSheet("Actions", [every ? "Deselect all" : "Select all"], "", function (v) {
      if (!pSel) return;
      if (every) pSel = pSel.filter(function (p) { return all.indexOf(p) < 0; });
      else all.forEach(function (p) { if (pSel.indexOf(p) < 0) pSel.push(p); });
      $$("#plist .prow").forEach(function (r) { var q = prodByI(+r.getAttribute("data-prod")); r.classList.toggle("picked", !!q && pSel.indexOf(q) >= 0); });
      syncSelBar();
    });
  }
  function confirmDelete() {
    if (!pSel || !pSel.length) return;
    var nh = nativeHandler("larpConfirm");
    if (nh) {
      var T = function (x) { try { return window.I18N ? window.I18N.tr(x) : x; } catch (e) { return x; } };
      confirmCb = function () { hap(10); setTimeout(runDelete, 120); };
      try { nh.postMessage({ id: "delprods", title: T("Delete products?"), message: T("This action cannot be undone."), cancel: T("Cancel"), confirm: T("Delete") }); return; } catch (e) { confirmCb = null; }
    }
    var el = sheet("", '<div class="al"><h3>Delete products?</h3><p>This action cannot be undone.</p><div class="al-b"><button class="al-c" data-o="c">Cancel</button><button class="al-d" data-o="d">Delete</button></div></div>', { cls: "alert" });
    $(".al-c", el).addEventListener("click", function () { hap(5); pop(false); });
    $(".al-d", el).addEventListener("click", function () { hap(10); pop(false); setTimeout(runDelete, 220); });
  }
  function runDelete() {
    if (!pSel || !pSel.length) return;
    var list = pSel.slice(), bar = $("#selbar");
    pBusy = true;
    if (bar) bar.classList.add("busy");
    syncSelBar();
    toast("Deleting products…", "spin", 0);
    setTimeout(function () {
      deleteProducts(list);
      pBusy = false; pSel = null; pFilter = "All"; pQuery = "";
      rendered.products = 0; renderProducts(); rendered.products = 1;
      hap(14); toast("Products deleted", "ok");
    }, 900);
  }

  var MV = {
    analytics: "Analytics", customers: "Customers", finance: "Finance", growth: "Growth", discounts: "Discounts", content: "Content", markets: "Markets",
    onlinestore: "Online Store", inbox: "Inbox", pos: "Point of Sale", shop: "Shop", social: "Facebook & Instagram", apps: "Apps", settings: "Settings",
  };
  function renderMenu() {
    var el = $("#s-menu");
    var head = function (title, actions) { return '<div class="tab-top"><header class="th-hd"><button class="tt" data-act="mvswitch">' + esc(title) + ic("chev-down") + '</button><span class="fl"></span>' + (actions || "") + "</header></div>"; };
    el.classList.toggle("grey", menuView === "analytics");
    if (menuView === "analytics") { el.innerHTML = head("Analytics") + '<div class="sheet-body an" id="an"></div>'; drawAnalytics(el); return; }
    if (menuView === "customers") { el.innerHTML = head("Customers", '<button class="hb" data-act="newcust" aria-label="Add customer">' + ic("plus-circle") + '</button><button class="hb" data-act="custmore" aria-label="More">' + ic("more") + "</button>") + '<div class="sheet-body">' + customersBody() + "</div>"; bindCustomers(el); return; }
    if (menuView === "finance") { el.innerHTML = head("Finance") + '<div class="sheet-body">' + financeBody() + "</div>"; return; }
    var t = MV[menuView] || "Menu";
    el.innerHTML = head(t) + '<div class="sheet-body"><div class="soon">' + ic(({ growth: "marketing", discounts: "discount", content: "content", markets: "globe", onlinestore: "store", inbox: "d-inbox", pos: "pos", shop: "shop", social: "channels", apps: "apps" })[menuView] || "settings") + "<b>" + esc(t) + "</b><span>Manage " + esc(t.toLowerCase()) + " for " + esc(S.name) + ".</span></div></div>";
  }

  /* ── Tabs ────────────────────────────────────────────────── */
  var current = "home", rendered = {};
  var RENDER = { home: renderHome, orders: renderOrders, products: renderProducts, menu: renderMenu };
  function setTab(name, keep) {
    if (!RENDER[name]) return;
    if (pSel && name !== "products") { pSel = null; pBusy = false; rendered.products = 0; postSel(); }
    if (!rendered[name] || !keep) { RENDER[name](); rendered[name] = 1; }
    current = name;
    $$(".scr").forEach(function (s) { s.classList.toggle("on", s.id === "s-" + name); });
    $$("#tabbar .tb").forEach(function (t) { t.classList.toggle("on", t.getAttribute("data-tab") === name); });
    moveInd();
    app.classList.toggle("dark-top", true);
    var gl = name === "orders" || name === "products";
    if (gl !== glStatus) {
      glStatus = gl;
      if (!document.getElementById("splash") && !document.getElementById("loading") && !document.getElementById("welcome") && !document.getElementById("login")) statusBar(gl ? "dark" : "light");
    }
  }
  function moveInd() {
    var on = $("#tabbar .tb.on"), ind = $(".tb-ind");
    if (!on || !ind) return;
    ind.style.transform = "translateX(" + on.offsetLeft + "px)";
  }
  $$("#tabbar .tb").forEach(function (t) {
    t.addEventListener("click", function () {
      var name = t.getAttribute("data-tab");
      hap(6);
      if (name === "menu") return drawerEl ? closeDrawer() : openDrawer();
      closeAll();
      if (name === current) { var sc = $("#s-" + name); if (sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); return; }
      setTab(name, true);
    });
  });

  /* ── Layers: pushed pages and sheets ─────────────────────── */
  // La barre d'onglets doit se cacher sous une page "plein écran" ET sous toute feuille (sh-wrap) :
  // sinon elle flotte par-dessus les boutons du bas ("Continuer", "Capture", options…).
  function noTabs(el) { return !!el && (el.hasAttribute("data-notabs") || el.classList.contains("sh-wrap")); }
  var stack = [];
  function push(el, kind) {
    layers.appendChild(el);
    var under = stack.length ? stack[stack.length - 1].el : $("#screens");
    stack.push({ el: el, kind: kind, under: under });
    postSel();
    try { history.pushState({ l: stack.length }, ""); } catch (e) { }
    el.getBoundingClientRect();
    requestAnimationFrame(function () {
      el.classList.add("on");
      if (kind === "page") under.classList.add("pushed");
      $("#tabbar").classList.toggle("hide", noTabs(el));
    });
  }
  // Every layer gets a history entry, so the Android back button and the
  // browser back gesture close it. Pops we start ourselves call
  // history.back() and skip the popstate that follows.
  var ignorePop = 0;
  function pop(fromHistory) {
    var top = stack.pop(); if (!top) return;
    postSel();
    if (!fromHistory) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
    top.el.classList.remove("on");
    if (top.kind === "page") top.under.classList.remove("pushed");
    var below = stack.length ? stack[stack.length - 1].el : null;
    $("#tabbar").classList.toggle("hide", noTabs(below));
    setTimeout(function () { top.el.remove(); }, 420);
    if (top.onClose) top.onClose();
  }
  function closeAll() {
    var n = stack.length;
    if (!n) return;
    while (stack.length) {
      var t = stack.pop();
      t.el.classList.remove("on");
      if (t.kind === "page") t.under.classList.remove("pushed");
      (function (e) { setTimeout(function () { e.remove(); }, 420); })(t.el);
    }
    $("#tabbar").classList.remove("hide");
    postSel();
    ignorePop++;
    try { history.go(-n); } catch (e) { ignorePop--; }
  }
  window.addEventListener("popstate", function () {
    if (ignorePop > 0) { ignorePop--; return; }
    if (skEl) return closeSidekick(true);
    if (drawerEl) return closeDrawer(true);
    if (stack.length) pop(true);
  });
  function page(body, opts) {
    opts = opts || {};
    var el = document.createElement("section");
    el.className = "page" + (opts.cls ? " " + opts.cls : "");
    if (opts.notabs) el.setAttribute("data-notabs", "");
    if (opts.modal) el.classList.add("modal");
    el.innerHTML = (opts.navHtml || ('<div class="pg-nav' + (opts.title ? " titled" : "") + '"><button class="nb-c" data-back aria-label="' + (opts.modal ? "Close" : "Back") + '">' + ic(opts.modal ? "x" : "chev-left") + "</button>" +
      (opts.title ? '<h1 class="pg-t">' + esc(opts.title) + (opts.titleChev ? ic("chev-down") : "") + "</h1>" : '<span class="fl"></span>') +
      (opts.actions || "") + "</div>")) + '<div class="pg-b">' + body + "</div>";
    $("[data-back]", el).addEventListener("click", function () { pop(false); });
    if (!opts.modal) edgeSwipe(el);
    push(el, opts.modal ? "modal" : "page");
    return el;
  }
  function edgeSwipe(el) {
    var x0 = null, y0 = 0, dx = 0, lock = null;
    el.addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = t.clientX < 24 ? t.clientX : null; y0 = t.clientY; dx = 0; lock = null; }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      if (x0 === null) return;
      var t = e.touches[0]; dx = Math.max(0, t.clientX - x0);
      if (lock === null && (Math.abs(t.clientY - y0) > 10 || dx > 10)) lock = dx > Math.abs(t.clientY - y0);
      if (!lock) return;
      el.style.transition = "none"; el.style.transform = "translateX(" + dx + "px)";
      var under = stack.length > 1 ? stack[stack.length - 2].el : $("#screens");
      under.style.transition = "none"; under.style.transform = "translateX(" + (-30 + (dx / el.clientWidth) * 30) + "%)";
    }, { passive: true });
    el.addEventListener("touchend", function () {
      if (x0 === null || !lock) { x0 = null; return; }
      x0 = null;
      var under = stack.length > 1 ? stack[stack.length - 2].el : $("#screens");
      el.style.transition = ""; el.style.transform = ""; under.style.transition = ""; under.style.transform = "";
      if (dx > el.clientWidth * 0.33) pop(false);
    });
  }
  function sheet(title, body, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "sh-wrap";
    el.innerHTML = '<div class="sh-scrim"></div><div class="sh' + (opts.cls ? " " + opts.cls : "") + '">' + (opts.navClose ? "" : '<div class="sh-grab"></div>') + (opts.navClose ? '<div class="sh-h nav"><button class="sh-x" aria-label="Close">' + ic("x") + '</button><h2>' + esc(title) + "</h2>" + (opts.actions || '<span class="sh-sp"></span>') + "</div>" : title ? '<div class="sh-h"><h2>' + esc(title) + '</h2><button class="sh-x" aria-label="Close">' + ic("x") + "</button></div>" : "") + '<div class="sh-b">' + body + "</div></div>";
    $(".sh-scrim", el).addEventListener("click", function () { pop(false); });
    var x = $(".sh-x", el); if (x) x.addEventListener("click", function () { pop(false); });
    // Drag the sheet down to dismiss.
    var sh = $(".sh", el), y0 = null, dy = 0;
    sh.addEventListener("touchstart", function (e) { var b = $(".sh-b", sh); y0 = (b.scrollTop <= 0) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    sh.addEventListener("touchmove", function (e) { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) { sh.style.transition = "none"; sh.style.transform = "translateY(" + dy + "px)"; } }, { passive: true });
    sh.addEventListener("touchend", function () { if (y0 === null) return; y0 = null; sh.style.transition = ""; sh.style.transform = ""; if (dy > 110) pop(false); });
    push(el, "sheet");
    return el;
  }
  function optSheet(title, opts, cur, cb) {
    var el = sheet(title, '<div class="opts">' + opts.map(function (o) { return '<button class="opt" data-o="' + esc(o) + '"><span>' + esc(o) + "</span>" + (o === cur ? ic("check", "ck") : "") + "</button>"; }).join("") + "</div>");
    $$(".opt", el).forEach(function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-o"); hap(6); pop(false); setTimeout(function () { cb(v); }, 180); }); });
  }

  /* ── Order page ──────────────────────────────────────────── */
  function findOrder(n) { for (var i = 0; i < orders.length; i++) if (orders[i].n === n) return orders[i]; return null; }
  function addr(o) { return [esc(o.c ? o.c.name : ""), esc(o.street), esc(S.country === "FR" ? o.zip + " " + o.city : o.city + ", " + o.reg + " " + o.zip), esc(countryName())].join("<br>"); }
  function countryName() { return S.cname || { US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia", DE: "Germany", FR: "France", NZ: "New Zealand", IE: "Ireland", ES: "Spain", IT: "Italy", NL: "Netherlands", SE: "Sweden", IN: "India", SG: "Singapore", JP: "Japan", BR: "Brazil", MX: "Mexico", AE: "United Arab Emirates" }[S.country] || "United States"; }
  function cardLabel(o) {
    if (o.gw === "PayPal") return "PayPal";
    if (o.card === "apple_pay") return "Apple Pay";
    var b = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover" }[o.card] || "Card";
    return b + " •••• " + o.l4;
  }
  function lineItems(o) {
    return o.items.map(function (x) {
      var v = x.p.vnames.length > 1 ? x.p.vnames[Math.abs(o.n + x.p.i) % x.p.vnames.length] : "";
      return '<div class="li">' + thumb(x.p, 48) + '<div class="li-t"><b>' + esc(x.p.title) + "</b>" + (v ? "<span>" + esc(v) + "</span>" : "") + "<em>" + money(x.price) + '</em></div><span class="li-q">× ' + x.q + "</span></div>";
    }).join("");
  }
  /* ── Native order page (iOS 26, Liquid Glass) ───────────────
     Same idea as the native product page: the web side only builds a plain, already-translated
     description of the order; Swift draws it. Actions come back through __larpNativeOrderAct. */
  function defaultCarrier() { return S.country === "US" ? "USPS" : S.country === "CA" ? "Canada Post" : S.country === "GB" ? "Royal Mail" : S.country === "AU" ? "Australia Post" : "DHL Express"; }
  function nativeOrderInfo(o) {
    var T = L10n, n_ = units(o), ful = o.ful === "Fulfilled", c = o.c, pos = o.ch === "Point of Sale";
    var taxSub = VAT ? T("Included") : o.reg + " " + (o.rate * 100).toFixed(o.rate * 1000 % 10 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "") + "%";
    var lines = [{ l: T("Subtotal"), s: T(n_ + " item" + (n_ === 1 ? "" : "s")), v: money(o.sub) }];
    if (o.disc) lines.push({ l: T("Discount"), s: o.code || T("Custom discount"), v: "-" + money(o.disc) });
    lines.push({ l: T("Shipping"), s: T(o.shipM), v: money(o.ship) });
    lines.push({ l: T("Taxes"), s: taxSub, v: money(o.tax) });
    var paid = [{ l: T(o.pay === "Authorized" ? "Authorized" : o.pay === "Payment pending" ? "Expected payment" : "Paid"), s: "", v: money(o.total) }];
    if (o.refunded > 0) {
      paid.push({ l: T("Refunded"), s: "", v: "-" + money(o.refunded) });
      paid.push({ l: T("Net payment"), s: "", v: money(o.total - o.refunded) });
    }
    var items = o.items.map(function (x) {
      var v = x.p.vnames.length > 1 ? x.p.vnames[Math.abs(o.n + x.p.i) % x.p.vnames.length] : "";
      return { title: x.p.title, variant: v, price: money(x.price), qty: x.q, img: x.p.img || "" };
    });
    var k = c ? Math.max(1, c.n) : 1;
    var conv = [
      { i: "cart", t: T("This is their " + ordinal(k) + " order") },
      { i: "globe", t: T("1st session was " + (o.ch === "Online Store" ? "from Google" : "from " + o.ch)) },
      { i: "clock", t: T((2 + (o.n % 4)) + " sessions over " + (1 + (o.n % 3)) + " day" + (o.n % 3 ? "s" : "")) }
    ];
    var lb = {};
    ["Items", "Payment", "Fulfillment", "Contact information", "Customer", "Notes", "Conversion summary", "Order risk", "Timeline", "Total",
      "Fulfill items", "Capture payment", "Mark as paid", "Track", "Email details", "Phone details", "Address", "Copy address", "Copied", "Print", "More actions",
      "Edit order", "Refund", "Print packing slip", "Archive", "Tracking number", "Add tracking number", "Shipping carrier",
      "Send shipment details to your customer now", "Cancel", "Order status", "No phone number", "No contact details", "No customer", "Shipping and billing address", "Products"].forEach(function (key) { lb[key] = T(key); });
    return {
      mode: "order", n: o.n, title: "#" + o.n,
      sub: T(relAt(o.ts)) + " \u2022 " + T(o.ch === "Online Store" ? "Online store" : o.ch),
      pay: T(o.pay), payKind: o.pay === "Payment pending" || o.pay === "Authorized" ? "warn" : "neu",
      ful: T(o.ful), fulKind: ful ? "ok" : "att",
      shipSub: pos ? T("Picked up in store") : T("Ship to customer \u2022 " + o.city),
      items: items, unitsCount: n_, fulfilled: ful, carrier: o.carrier || defaultCarrier(), trk: o.trk || "", defaultCarrier: defaultCarrier(),
      canCapture: o.pay === "Authorized", canMarkPaid: o.pay === "Payment pending",
      lines: lines, total: money(o.total), paid: paid,
      addr: [o.c ? o.c.name : "", o.street, S.country === "FR" ? o.zip + " " + o.city : o.city + ", " + o.reg + " " + o.zip, countryName()].filter(Boolean),
      email: c ? c.email : "", phone: c ? (c.phone || "") : "",
      customer: c ? { name: c.name, sub: T(count(c.n) + " order" + (c.n === 1 ? "" : "s")), idx: custs.indexOf(c), initials: initials(c.name) } : null,
      note: o.note || "", noEmptyNote: T("No notes from customer"),
      conv: conv, risk: o.risk, riskLabel: T(o.risk === "Low" ? "Chargeback risk is low" : o.risk === "Medium" ? "Chargeback risk is medium" : "Chargeback risk is high"),
      timeline: timeline(o).map(function (e) { return { when: T(e[0]), text: T(e[1]) }; }),
      lb: lb
    };
  }
  function nativeOrderPost(info) {
    try { window.webkit.messageHandlers.larpProduct.postMessage(info); return true; } catch (e) { return false; }
  }
  // Actions triggered from the native order page.
  window.__larpNativeOrderAct = function (m) {
    var o = findOrder(m.n), msg = "";
    if (m.act === "customer") { openCustomer(m.idx); return; }
    if (!o) return;
    if (m.act === "fulfill") {
      var carrier = m.carrier || defaultCarrier();
      o.ful = "Fulfilled"; o.fat = nowMs(); o.carrier = carrier;
      var v = String(m.trk || "").trim();
      o.trk = v || (carrier === "USPS" ? "9400 1" + rnd(3) + " " + rnd(4) + " " + rnd(4) + " " + rnd(4) + " " + rnd(2) : rnd(12));
      hap(14); msg = "Items fulfilled";
    } else if (m.act === "capture") {
      o.pay = "Paid"; creditOrder(o); hap(14); msg = "Payment captured";
    } else if (m.act === "markpaid") {
      o.pay = "Paid"; creditOrder(o); hap(10); msg = "Order marked as paid";
    } else return;
    refreshAll();
    var info = nativeOrderInfo(o); info.mode = "orderUpdate"; info.toast = L10n(msg);
    nativeOrderPost(info);
  };
  function openOrder(n) {
    var o = findOrder(n); if (!o) return;
    // iOS 26: the order page is native (Liquid Glass), laid out like the native product page.
    if (window.__LARP_NATIVE_PRODUCT__ && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpProduct) {
      if (nativeOrderPost(nativeOrderInfo(o))) return;
    }
    var n_ = units(o);
    var ful = o.ful === "Fulfilled";
    var fulSec = '<div class="sec"><div class="sec-h">' + (ful ? badge("Fulfilled", "ok") : badge(o.ful, "att")) + '<span class="fl"></span>' + ic("more", "sm") + "</div>" +
      '<div class="sec-sub">' + (o.ch === "Point of Sale" ? "Picked up in store" : "Ship to customer • " + esc(o.city)) + "</div>" +
      lineItems(o) +
      (ful ? '<div class="trk">' + ic("truck") + "<div><b>" + esc(o.carrier) + "</b><span>" + esc(o.trk) + '</span></div><button class="lnk" data-act="track">Track</button></div>'
        : '<button class="btn-p" data-fulfill="' + o.n + '">Fulfill items</button>') + "</div>";
    var refunded = o.refunded > 0;
    var paySec = '<div class="sec"><div class="sec-h">' + payBadge(o) + "</div>" +
      '<div class="kv"><div><span>Subtotal</span><span>' + n_ + " item" + (n_ === 1 ? "" : "s") + "</span><b>" + money(o.sub) + "</b></div>" +
      (o.disc ? "<div><span>Discount</span><span>" + esc(o.code || "Custom discount") + "</span><b>-" + money(o.disc) + "</b></div>" : "") +
      "<div><span>Shipping</span><span>" + esc(o.shipM) + "</span><b>" + money(o.ship) + "</b></div>" +
      (VAT ? "<div><span>Taxes</span><span>Included</span><b>" + money(o.tax) + "</b></div>" : "<div><span>Taxes</span><span>" + esc(o.reg) + " " + (o.rate * 100).toFixed(o.rate * 1000 % 10 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "") + "%</span><b>" + money(o.tax) + "</b></div>") +
      '<div class="tot"><span>Total</span><span></span><b>' + money(o.total) + "</b></div></div>" +
      '<div class="kv sep"><div><span>' + (o.pay === "Authorized" ? "Authorized" : o.pay === "Payment pending" ? "Expected payment" : "Paid") + '</span><span></span><b>' + money(o.total) + "</b></div>" +
      (refunded ? "<div><span>Refunded</span><span></span><b>-" + money(o.refunded) + "</b></div><div><span>Net payment</span><span></span><b>" + money(o.total - o.refunded) + "</b></div>" : "") + "</div>" +
      (o.pay === "Authorized" ? '<button class="btn-p" data-capture="' + o.n + '">Capture payment</button>' : o.pay === "Payment pending" ? '<button class="btn-s" data-markpaid="' + o.n + '">Mark as paid</button>' : "") + "</div>";
    var c = o.c;
    var contact = '<div class="sec"><div class="sec-h"><h3>Contact information</h3><span class="fl"></span>' + ic("more", "sm") + "</div>" +
      '<div class="two"><button class="btn-o" data-act="email">' + ic("email") + 'Email details</button><button class="btn-o" data-act="phone">' + ic("phone") + "Phone details</button></div>" +
      '<div class="addr"><div><span class="lbl">Address</span><p>' + addr(o) + '</p></div><button class="cp" data-copy="addr" aria-label="Copy">' + ic("clipboard") + "</button></div></div>";
    var cust = c ? '<div class="sec"><div class="sec-h"><h3>Customer</h3></div><button class="crow" data-cust="' + custs.indexOf(c) + '"><span class="cav">' + esc(initials(c.name)) + "</span><div><b>" + esc(c.name) + "</b><span>" + count(c.n) + " order" + (c.n === 1 ? "" : "s") + "</span></div>" + ic("chev-right", "chev") + "</button></div>" : "";
    var notes = '<div class="sec"><div class="sec-h"><h3>Notes</h3><span class="fl"></span>' + ic("edit", "sm") + "</div><p class=\"muted\">" + (o.note ? esc(o.note) : "No notes from customer") + "</p></div>";
    var conv = '<div class="sec"><div class="sec-h"><h3>Conversion summary</h3></div><div class="cs"><div>' + ic("cart") + "<span>This is their " + ordinal(c ? Math.max(1, c.n) : 1) + " order</span></div><div>" + ic("globe") + "<span>1st session was " + (o.ch === "Online Store" ? "from Google" : "from " + esc(o.ch)) + "</span></div><div>" + ic("clock") + "<span>" + (2 + (o.n % 4)) + " sessions over " + (1 + (o.n % 3)) + " day" + (o.n % 3 ? "s" : "") + "</span></div></div></div>";
    var risk = '<div class="sec"><div class="sec-h"><h3>Order risk</h3></div><div class="risk r-' + o.risk.toLowerCase() + '"><div class="rb"><i></i><i></i><i></i></div><b>' + (o.risk === "Low" ? "Chargeback risk is low" : o.risk === "Medium" ? "Chargeback risk is medium" : "Chargeback risk is high") + "</b></div></div>";
    var tl = '<div class="sec"><div class="sec-h"><h3>Timeline</h3></div><div class="tl">' + timeline(o).map(function (e) { return '<div class="tle"><i></i><div><span>' + esc(e[1]) + "</span><em>" + esc(e[0]) + "</em></div></div>"; }).join("") + "</div></div>";
    var body = '<div class="oh"><div class="oh-t"><h1>#' + o.n + "</h1>" + fulBadge(o) + payBadge(o) + '</div><p class="oh-s">' + esc(relAt(o.ts)) + " • " + esc(o.ch === "Online Store" ? "Online store" : o.ch) + "</p></div>" +
      fulSec + paySec + contact + cust + notes + conv + risk + tl;
    var el = sheet("", body, { navClose: true, cls: "notifs order", actions: '<button class="nb-c" data-act="print" aria-label="Print">' + ic("print") + '</button><button class="nb-c" data-act="ordermore" aria-label="More">' + ic("more") + "</button>" });
    el.setAttribute("data-on", o.n);
  }
  function initials(n) { var w = String(n || "").split(/\s+/).filter(Boolean); return ((w[0] || "")[0] || "") + ((w[1] || "")[0] || ""); }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function timeline(o) {
    var ev = [];
    if (o.fat) ev.push([relAt(o.fat), (o.carrier ? o.carrier + " " : "") + units(o) + " item" + (units(o) === 1 ? " was" : "s were") + " fulfilled"]);
    if (o.refunded) ev.push([relAt(o.ts + 3 * DAY), "A " + money(o.refunded) + " refund was processed"]);
    if (o.pay !== "Payment pending" && o.pay !== "Authorized") ev.push([relAt(o.ts + 2000), "A " + money(o.total) + " " + S.cur + " payment was processed on " + cardLabel(o) + "."]);
    if (o.pay === "Authorized") ev.push([relAt(o.ts + 2000), "A " + money(o.total) + " " + S.cur + " payment was authorized on " + cardLabel(o) + "."]);
    ev.push([relAt(o.ts + 1000), "Order confirmation email was sent to " + (o.c ? o.c.name + " (" + o.c.email + ")" : "the customer") + "."]);
    ev.push([relAt(o.ts), (o.c ? o.c.name : "Customer") + " placed this order on " + (o.ch === "Online Store" ? "Online Store" : o.ch) + "."]);
    return ev;
  }
  function fulfillFlow(n) {
    var o = findOrder(n); if (!o) return;
    var carrier = S.country === "US" ? "USPS" : S.country === "CA" ? "Canada Post" : S.country === "GB" ? "Royal Mail" : S.country === "AU" ? "Australia Post" : "DHL Express";
    var el = sheet("Fulfill items", '<div class="ff">' + lineItems(o) +
      '<label class="fld"><span>Tracking number</span><input id="trk" inputmode="numeric" placeholder="Add tracking number" autocomplete="off"></label>' +
      '<label class="fld"><span>Shipping carrier</span><div class="sel">' + esc(carrier) + ic("chev-down") + "</div></label>" +
      '<label class="tg"><input type="checkbox" checked><span></span>Send shipment details to your customer now</label>' +
      '<button class="btn-p" id="doFul">Fulfill items</button></div>', { cls: "fulfill" });
    $("#doFul", el).addEventListener("click", function () {
      var b = this; b.disabled = true; b.classList.add("busy");
      setTimeout(function () {
        o.ful = "Fulfilled"; o.fat = nowMs(); o.carrier = carrier;
        var v = ($("#trk", el).value || "").trim();
        o.trk = v || (carrier === "USPS" ? "9400 1" + rnd(3) + " " + rnd(4) + " " + rnd(4) + " " + rnd(4) + " " + rnd(2) : rnd(12));
        hap(14);
        pop(false);
        setTimeout(function () {
          var pg = stack.length ? stack[stack.length - 1].el : null;
          if (pg && +pg.getAttribute("data-on") === o.n) { pop(false); setTimeout(function () { openOrder(o.n); }, 60); }
          toast("Items fulfilled");
          refreshAll();
        }, 240);
      }, 700);
    });
  }
  function rnd(n) { var s = ""; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
  function capture(n) {
    var o = findOrder(n); if (!o) return;
    var el = sheet("Capture payment", '<div class="cap"><p>Capture <b>' + money(o.total) + "</b> from " + esc(cardLabel(o)) + '.</p><button class="btn-p" id="doCap">Capture ' + money(o.total) + "</button></div>");
    $("#doCap", el).addEventListener("click", function () {
      this.disabled = true; this.classList.add("busy");
      setTimeout(function () {
        o.pay = "Paid"; creditOrder(o); hap(14); pop(false);
        setTimeout(function () { var pg = stack.length ? stack[stack.length - 1].el : null; if (pg && +pg.getAttribute("data-on") === o.n) { pop(false); setTimeout(function () { openOrder(o.n); }, 60); } toast("Payment captured"); refreshAll(); }, 240);
      }, 800);
    });
  }
  function refreshAll() {
    rendered = {}; RENDER[current](); rendered[current] = 1;
  }

  /* ── Product page ────────────────────────────────────────── */
  function nativeProductInfo(p) {
    var f = Math.pow(10, S.dec != null ? S.dec : 2), real = p.vnames.length > 1 || (p.vnames[0] && p.vnames[0] !== "Default");
    return { mode: "edit", idx: p.i, id: p.pid || "", sym: S.sym, shop: S.name || "", canDelete: !!EMPTY,
      title: p.title, desc: p.desc || "", category: p.category || "", price: p.price / f, inv: p.inv,
      vendor: p.vendor || S.name || "", type: p.type && p.type !== "General" ? p.type : "", status: p.status || "Active",
      tags: p.tags || [], collections: p.collections || null, vars: real ? p.vnames.join(", ") : "", physical: p.physical !== false, img: p.img || "" };
  }
  function openProduct(i) {
    var p = prods[i]; if (!p) return;
    // iOS 26: the product page is native (Liquid Glass), like the real Shopify app.
    if (window.__LARP_NATIVE_PRODUCT__ && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpProduct) {
      try { window.webkit.messageHandlers.larpProduct.postMessage(nativeProductInfo(p)); return; } catch (e) { }
    }
    var vrows = p.vnames.length > 1 ? p.vnames.map(function (v, k) {
      var share = Math.floor(p.inv / p.vnames.length) + (k < p.inv % p.vnames.length ? 1 : 0);
      return '<div class="vr">' + thumb(p, 40) + "<div><b>" + esc(v) + "</b><span>" + count(share) + " available</span></div><em>" + money(p.price) + "</em></div>";
    }).join("") : "";
    var body = '<div class="pimg' + (p.img ? " has" : "") + '">' + (p.img ? '<img src="' + p.img + '" alt="">' : ic("image")) + "</div>" +
      '<div class="sec"><h1 class="pt">' + esc(p.title) + "</h1>" + badge(p.status, p.status === "Active" ? "ok" : "info") + "</div>" +
      '<div class="sec"><div class="sec-h"><h3>Pricing</h3></div><div class="kv"><div><span>Price</span><span></span><b>' + money(p.price) + "</b></div>" + (p.compare ? "<div><span>Compare-at price</span><span></span><b class=\"strike\">" + money(p.compare) + "</b></div>" : "") + "</div></div>" +
      '<div class="sec"><div class="sec-h"><h3>Inventory</h3></div><div class="kv"><div><span>Available</span><span></span><b>' + count(p.inv) + "</b></div><div><span>SKU</span><span></span><b>" + esc(p.sku) + "</b></div><div><span>Sold (last 30 days)</span><span></span><b>" + count(p.sold) + "</b></div></div></div>" +
      (vrows ? '<div class="sec"><div class="sec-h"><h3>Variants</h3><span class="cnt">' + p.vnames.length + "</span></div>" + vrows + "</div>" : "") +
      '<div class="sec"><div class="sec-h"><h3>Product organization</h3></div><div class="kv"><div><span>Type</span><span></span><b>' + esc(p.type || "–") + "</b></div><div><span>Vendor</span><span></span><b>" + esc(p.vendor) + "</b></div></div></div>" +
      '<div class="sec"><div class="sec-h"><h3>Sales channels</h3></div><div class="chs"><span>' + ic("store") + "Online Store</span><span>" + ic("shop") + "Shop</span><span>" + ic("pos") + "Point of Sale</span></div></div>";
    page(body, { cls: "product", actions: '<button class="nb-c" data-act="share" aria-label="Share">' + ic("share") + '</button><button class="nb-c" data-act="prodmore" aria-label="More">' + ic("more") + "</button>" });
  }

  /* ── New product ─────────────────────────────────────────── */
  function parseNum(v) {
    var t = String(v == null ? "" : v).trim().replace(",", ".");
    if (!t) return null;
    return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : NaN;
  }
  function resizeImg(file, done) {
    var rd = new FileReader();
    rd.onerror = function () { done(""); };
    rd.onload = function () {
      var im = new Image();
      im.onerror = function () { done(""); };
      im.onload = function () {
        try {
          var cv = document.createElement("canvas"), sz = 320; cv.width = sz; cv.height = sz;
          var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, sz, sz);
          var side = Math.min(im.width, im.height);
          cx.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, sz, sz);
          done(cv.toDataURL("image/jpeg", 0.8));
        } catch (e) { done(""); }
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function createProduct(d) {
    var dec = S.dec != null ? S.dec : 2, f = Math.pow(10, dec), idx = prods.length;
    var vn = splitVariants(d.vars), code = d.title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "PRD";
    var id = "p-" + Date.now(), share = Math.max(1, Math.round(100 / (idx + 1)));
    var p = { i: idx, pid: id, title: d.title, price: Math.round(d.price * f), compare: d.compare > d.price ? Math.round(d.compare * f) : 0, inv: d.inv, vars: Math.max(1, vn.length || 1), vnames: vn.length ? vn : ["Default"], type: d.type || "General", vendor: d.vendor || S.name, sku: d.sku || (code + "-" + (1000 + idx)), status: d.status, sold: 0, ts: nowMs(), hue: HUES[idx % HUES.length], img: d.img, share: share };
    p.baseInv = p.inv;
    prodExtras(p, { description: d.desc || "", category: d.category || "", tags: d.tags || [], collections: d.collections || null, physical: d.physical });
    prods.push(p);
    // Written into the saved settings too: Preferences lists it and Done keeps it.
    var cfg = savedSettingsObj();
    if (!Array.isArray(cfg.products)) cfg.products = [];
    cfg.products.push({ id: id, title: p.title, price: d.price, compare: d.compare > d.price ? d.compare : 0, allocationPct: share, inventory: d.inv, variants: vn.join(", "), image: d.img, status: p.status, type: p.type, sku: p.sku, ts: p.ts, vendor: p.vendor, description: p.desc, category: p.category, tags: p.tags, collections: p.collections, physical: p.physical });
    writeSettings(cfg);
    return p;
  }
  function openNewProduct() {
    // iOS 26 : l'écran de création est natif (Liquid Glass) ; la page reçoit le résultat via __larpNativeProductSave.
    if (window.__LARP_NATIVE_PRODUCT__ && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpProduct) {
      window.webkit.messageHandlers.larpProduct.postMessage({ sym: S.sym, vendor: S.name || "" });
      return;
    }
    var d = { img: "", status: "Active" }, saving = false, sym = esc(S.sym);
    var body = '<div class="np">' +
      '<div class="np-c"><div class="np-l">Media</div><div class="np-media"><button type="button" class="np-ph" id="npPh">' + ic("image") + "<span>Add photo</span></button><button type=\"button\" class=\"np-rm\" id=\"npRm\" hidden>Remove photo</button></div></div>" +
      '<div class="np-c"><label class="np-f"><span>Title</span><input id="npTitle" type="text" maxlength="255" placeholder="Short sleeve t-shirt" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></label>' +
      '<div class="np-f"><span>Status</span><div class="np-seg" id="npSeg"><button type="button" class="on" data-s="Active">Active</button><button type="button" data-s="Draft">Draft</button></div><em class="np-hint" id="npSegH">Visible on your store and available to buy.</em></div></div>' +
      '<div class="np-c"><div class="np-l">Pricing</div><div class="np-row"><label class="np-f"><span>Price</span><div class="np-in"><i>' + sym + '</i><input id="npPrice" inputmode="decimal" placeholder="0.00" autocomplete="off"></div></label>' +
      '<label class="np-f"><span>Compare-at price</span><div class="np-in"><i>' + sym + '</i><input id="npComp" inputmode="decimal" placeholder="0.00" autocomplete="off"></div></label></div></div>' +
      '<div class="np-c"><div class="np-l">Inventory</div><div class="np-row"><label class="np-f"><span>Quantity</span><input id="npInv" inputmode="numeric" placeholder="0" autocomplete="off"></label>' +
      '<label class="np-f"><span>SKU (optional)</span><input id="npSku" type="text" autocomplete="off" autocapitalize="characters"></label></div></div>' +
      '<div class="np-c"><div class="np-l">Variants</div><label class="np-f"><span>Options, separated by commas</span><input id="npVars" type="text" placeholder="S, M, L" autocomplete="off"></label></div>' +
      '<div class="np-c"><div class="np-l">Product organization</div><div class="np-row"><label class="np-f"><span>Product type</span><input id="npType" type="text" autocomplete="off"></label>' +
      '<label class="np-f"><span>Vendor</span><input id="npVendor" type="text" value="' + esc(S.name || "") + '" autocomplete="off"></label></div></div>' +
      '<p class="np-err" id="npErr" hidden></p><button type="button" class="btn-p np-go" id="npGo" disabled>Save product</button></div>' +
      '<input type="file" id="npFile" accept="image/*" hidden>';
    var el = page(body, { title: "Add product", modal: true, notabs: true, cls: "newprod", actions: '<button type="button" class="np-save" id="npSave" disabled>Save</button>' });
    var g = function (id) { return $("#" + id, el); };
    function read() {
      return { title: g("npTitle").value.trim(), price: parseNum(g("npPrice").value), compare: parseNum(g("npComp").value), inv: parseNum(g("npInv").value), sku: g("npSku").value.trim(), vars: g("npVars").value, type: g("npType").value.trim(), vendor: g("npVendor").value.trim() };
    }
    function check() {
      var v = read(), err = "";
      if (v.price !== null && (isNaN(v.price) || v.price < 0)) err = "Enter a valid price.";
      else if (v.compare !== null && (isNaN(v.compare) || v.compare < 0)) err = "Enter a valid compare-at price.";
      else if (v.compare !== null && v.compare > 0 && v.compare <= (v.price || 0)) err = "Compare-at price should be higher than the price.";
      else if (v.inv !== null && (isNaN(v.inv) || v.inv < 0 || Math.floor(v.inv) !== v.inv)) err = "Quantity must be a whole number.";
      var ok = !!v.title && !err;
      var eb = g("npErr"); eb.hidden = !err; eb.textContent = err;
      g("npGo").disabled = g("npSave").disabled = !ok;
      return ok ? v : null;
    }
    function save() {
      if (saving) return;
      var v = check(); if (!v) return;
      saving = true; hap(10);
      createProduct({ title: v.title, price: v.price || 0, compare: v.compare || 0, inv: v.inv || 0, sku: v.sku, vars: v.vars, type: v.type, vendor: v.vendor, status: d.status, img: d.img });
      pFilter = "All"; pQuery = ""; rendered.products = 0;
      pop(false);
      if (current === "products") renderProducts();
      setTimeout(function () { toast("Product saved"); }, 320);
    }
    el.addEventListener("input", check);
    g("npGo").addEventListener("click", save);
    g("npSave").addEventListener("click", save);
    g("npTitle").addEventListener("keydown", function (e) { if (e.key === "Enter") this.blur(); });
    $$("#npSeg button", el).forEach(function (b) {
      b.addEventListener("click", function () {
        d.status = b.getAttribute("data-s"); hap(5);
        $$("#npSeg button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
        g("npSegH").textContent = d.status === "Active" ? "Visible on your store and available to buy." : "Hidden from your store. It won’t receive orders.";
      });
    });
    function showImg() {
      var ph = g("npPh");
      ph.classList.toggle("has", !!d.img);
      ph.innerHTML = d.img ? '<img src="' + d.img + '" alt="">' : ic("image") + "<span>Add photo</span>";
      g("npRm").hidden = !d.img;
    }
    g("npPh").addEventListener("click", function () { g("npFile").value = ""; g("npFile").click(); });
    g("npRm").addEventListener("click", function () { d.img = ""; showImg(); });
    g("npFile").addEventListener("change", function () {
      var file = this.files && this.files[0]; if (!file) return;
      resizeImg(file, function (data) { if (data) { d.img = data; showImg(); } else toast("Couldn’t load that photo"); });
    });
    setTimeout(function () { try { g("npTitle").focus({ preventScroll: true }); } catch (e) { } }, 520);
  }
  window.__larpNativeProductSave = function (n) {
    createProduct({ title: n.title, price: n.price || 0, compare: 0, inv: n.inv || 0, sku: "", vars: n.vars || "", type: n.type || "", vendor: n.vendor || "", status: n.status === "Draft" ? "Draft" : "Active", img: typeof n.img === "string" ? n.img : "",
      desc: n.desc || "", category: n.category || "", tags: n.tags || [], collections: n.collections || null, physical: n.physical });
    pFilter = "All"; pQuery = ""; rendered.products = 0;
    if (current === "products") renderProducts();
    setTimeout(function () { toast("Product saved"); }, 320);
  };
  // Edits made in the native product page: applied in memory and written into the saved settings.
  window.__larpNativeProductUpdate = function (n) {
    var p = prods[n.idx]; if (!p) return;
    var f = Math.pow(10, S.dec != null ? S.dec : 2), vn = splitVariants(n.vars);
    p.title = String(n.title || p.title);
    p.price = Math.round((Number(n.price) || 0) * f);
    if (p.compare && p.compare <= p.price) p.compare = 0;
    var inv = Math.max(0, Math.round(Number(n.inv) || 0));
    if (inv !== p.inv) { p.inv = inv; p.baseInv = inv; }
    p.vnames = vn.length ? vn : ["Default"]; p.vars = Math.max(1, vn.length || 1);
    p.type = n.type || "General"; p.vendor = n.vendor || S.name;
    p.status = n.status === "Draft" || n.status === "Archived" || n.status === "Unlisted" ? n.status : "Active";
    if (typeof n.img === "string") p.img = n.img.indexOf("data:image/") === 0 ? n.img : "";
    prodExtras(p, { description: n.desc || "", category: n.category || "", tags: n.tags || [], collections: n.collections || null, physical: n.physical });
    if (p.pid) {
      var cfg = savedSettingsObj(), hit = null;
      if (!Array.isArray(cfg.products)) cfg.products = [];
      cfg.products.forEach(function (c) { if (c && c.id === p.pid) hit = c; });
      if (!hit) { hit = { id: p.pid, ts: p.ts, allocationPct: p.share }; cfg.products.push(hit); }
      hit.title = p.title; hit.price = p.price / f; hit.compare = p.compare ? p.compare / f : 0; hit.inventory = p.baseInv;
      hit.variants = p.vnames[0] === "Default" ? "" : p.vnames.join(", "); hit.image = p.img; hit.status = p.status; hit.type = p.type; hit.sku = p.sku;
      hit.vendor = p.vendor; hit.description = p.desc; hit.category = p.category; hit.tags = p.tags; hit.collections = p.collections; hit.physical = p.physical; hit.edited = true;
      writeSettings(cfg);
    }
    saveState();
    refreshAll();
  };
  // Supprime une liste de produits (mémoire + réglages sauvegardés) ; partagé par la page produit native et la sélection multiple.
  function deleteProducts(list) {
    if (!EMPTY || !list.length) return;
    var cfg = savedSettingsObj();
    if (!Array.isArray(cfg.__deleted)) cfg.__deleted = [];
    list.forEach(function (p) {
      var k = prods.indexOf(p); if (k < 0) return;
      prods.splice(k, 1);
      if (Array.isArray(cfg.products)) cfg.products = cfg.products.filter(function (c) { return !(c && ((p.pid && c.id === p.pid) || (!p.pid && c.title === p.title))); });
      cfg.__deleted.push(p.pid ? "id:" + p.pid : "t:" + p.title);
    });
    prods.forEach(function (q, k) { q.i = k; });
    writeSettings(cfg);
    saveState();
  }
  window.__larpNativeProductDelete = function (n) {
    var p = prods[n.idx]; if (!EMPTY || !p) return;
    deleteProducts([p]);
    pFilter = "All"; pQuery = "";
    refreshAll();
  };
  window.__larpNativeProductDuplicate = function (n) {
    var src = prods[n.idx]; if (!src) return;
    var f = Math.pow(10, S.dec != null ? S.dec : 2), real = src.vnames[0] !== "Default";
    var c = createProduct({ title: String(n.title || src.title), price: src.price / f, compare: src.compare / f, inv: src.inv, sku: "", vars: real ? src.vnames.join(", ") : "", type: src.type === "General" ? "" : src.type, vendor: src.vendor, status: "Draft", img: src.img,
      desc: src.desc || "", category: src.category || "", tags: src.tags || [], collections: src.collections || null, physical: src.physical });
    saveState();
    refreshAll();
  };

  /* ── Customers ───────────────────────────────────────────── */
  function lastOrderOf(c) { for (var i = 0; i < orders.length; i++) if (orders[i].c === c) return orders[i]; return null; }
  function custList() { return custs.slice().sort(function (a, b) { var la = lastOrderOf(a), lb = lastOrderOf(b); return (lb ? lb.ts : b.ts) - (la ? la.ts : a.ts); }); }
  function customersBody() {
    return '<div class="sbar"><label class="sfield">' + ic("search") + '<input type="search" id="cq" placeholder="Search customers" autocomplete="off"></label><button class="cb" data-act="sort" aria-label="Sort">' + ic("sort") + '</button><button class="cb" data-act="cfilter" aria-label="Filter">' + ic("filter") + "</button></div>" +
      '<div class="ch-n">' + count(S.custTotal) + " customers</div>" + '<div id="clist" class="customers">' + custList().slice(0, 80).map(custRow).join("") + "</div>";
  }
  function bindCustomers(el) {
    var list = custList();
    $("#cq", el).addEventListener("input", function () { var q = this.value.toLowerCase(); $("#clist", el).innerHTML = list.filter(function (c) { return (c.name + " " + c.email).toLowerCase().indexOf(q) >= 0; }).slice(0, 80).map(custRow).join(""); });
  }
  function openCustomers() { navigate("customers"); }
  function custRow(c) {
    return '<button class="crow" data-cust="' + custs.indexOf(c) + '"><span class="cav">' + esc(initials(c.name)) + "</span><div><b>" + esc(c.name) + "</b><span>" + esc(c.city + ", " + c.region) + " • " + count(c.n) + " order" + (c.n === 1 ? "" : "s") + "</span></div><em>" + money(c.spent) + "</em></button>";
  }
  function openCustomer(i) {
    var c = custs[i]; if (!c) return;
    var mine = orders.filter(function (o) { return o.c === c; });
    var body = '<div class="cust-h"><span class="cav lg">' + esc(initials(c.name)) + "</span><h1>" + esc(c.name) + "</h1><p>" + esc(c.city + ", " + c.region + ", " + countryName()) + "</p><p>Customer for " + since(c.ts) + "</p></div>" +
      '<div class="stats3"><div><span>Amount spent</span><b>' + money(c.spent) + "</b></div><div><span>Orders</span><b>" + count(c.n) + "</b></div><div><span>Customer since</span><b>" + md(c.ts) + "</b></div></div>" +
      (mine.length ? '<div class="sec"><div class="sec-h"><h3>Last order placed</h3></div>' + orderRow(mine[0]) + "</div>" : "") +
      '<div class="sec"><div class="sec-h"><h3>Contact information</h3></div><p class="kvl">' + esc(c.email) + "</p>" + (c.phone ? '<p class="kvl">' + esc(c.phone) + "</p>" : "") + '<p class="muted">' + (c.sub ? "Subscribed to email marketing" : "Not subscribed to email marketing") + "</p></div>" +
      (c.tags.length ? '<div class="sec"><div class="sec-h"><h3>Tags</h3></div><div class="tags">' + c.tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div></div>" : "");
    page(body, { cls: "customer", actions: '<button class="nb-c" data-act="custmore" aria-label="More">' + ic("more") + "</button>" });
  }
  function since(t) { var d = Math.max(1, Math.round((nowMs() - t) / DAY)); return d < 31 ? d + " day" + (d === 1 ? "" : "s") : d < 365 ? Math.round(d / 30) + " month" + (Math.round(d / 30) === 1 ? "" : "s") : Math.round(d / 365) + " year" + (Math.round(d / 365) === 1 ? "" : "s"); }

  /* ── Analytics ───────────────────────────────────────────── */
  var anRange = "today";
  function openAnalytics() { navigate("analytics"); }
  function drawAnalytics(el) {
    var R = rangeData(anRange);
    var t = R.tot, pt = R.ptot;
    var a0 = R.hourly ? (R.key === "today" ? T : T - 1) : R.a, a1 = R.hourly ? a0 : T;
    var gross = sum(D.g, a0, a1), disc = sum(D.dc, a0, a1), ret = sum(D.rt, a0, a1), sh = sum(D.sh, a0, a1), tx = VAT ? 0 : sum(D.tx, a0, a1);
    var pl = R.hourly ? a0 - 1 : R.a - R.n * R.step, pr = R.hourly ? a0 - 1 : R.a - 1;
    // Today is compared with yesterday up to the same time, so scale yesterday's totals.
    var pf = R.key === "today" && D.s[T - 1] ? pt.s / D.s[T - 1] : 1;
    var pgross = sum(D.g, pl, pr) * pf, pdisc = sum(D.dc, pl, pr) * pf, pret = sum(D.rt, pl, pr) * pf, psh = sum(D.sh, pl, pr) * pf, ptx = VAT ? 0 : sum(D.tx, pl, pr) * pf;
    var net = gross - disc - ret, pnet = pgross - pdisc - pret;
    var rc = sum(D.rc, a0, a1), oo = sum(D.o, a0, a1), prc = Math.round(sum(D.rc, pl, pr) * pf), poo = R.key === "today" ? pt.o : sum(D.o, pl, pr);
    var fulfilled = Math.round(oo * 0.9), pful = Math.round(poo * 0.9);
    var curLbl = R.hourly ? ymdStr(S.day0 + a0 * DAY + 12 * HOUR) : rangeShort(anRange), prevLbl = R.hourly ? ymdStr(S.day0 + (a0 - 1) * DAY + 12 * HOUR) : "Previous period";
    var small = function (title, val, cv, pv, key) { return '<div class="an-c sm"' + (key ? ' data-anm="' + key + '"' : "") + '><div class="an-t">' + esc(title) + '</div><div class="an-v"><b>' + val + "</b>" + chgHtml(change(cv, pv), "lt") + '</div><div class="an-sp"></div></div>'; };
    var big = function (k) { var M = MET[k]; var cv = M.v(t), pv = M.v(pt); return '<div class="an-c" data-anm="' + k + '" data-big="1"><div class="an-t">' + esc(M.t + " over time") + '</div><div class="an-v"><b>' + fmtMet(M.k, cv) + "</b>" + chgHtml(change(cv, pv), "lt") + '</div><div class="an-ch"></div><div class="an-lg"><span><i class="cur"></i>' + esc(curLbl) + '</span><span><i class="prv"></i>' + esc(prevLbl) + "</span></div></div>"; };
    var brkRow = function (lbl, v, pv, bold) { return '<div class="' + (bold ? "b" : "") + '"><span class="lk">' + lbl + "</span><b>" + money(v) + "</b>" + chgHtml(change(Math.abs(v), Math.abs(pv)), "lt") + "</div>"; };
    $("#an", el).innerHTML = '<div class="an-pills"><button class="anp" data-act="anrange">' + ic("calendar") + "<span>" + esc(rangeLabel(anRange)) + '</span></button><button class="anp" data-act="ancompare">' + ic("sort") + "<span>" + esc(prevLbl) + '</span></button><button class="anp" data-act="ancur">' + ic("cash") + "<span>" + esc(S.cur + " " + S.sym.trim()) + "</span></button></div>" +
      small("Gross sales", money(gross), gross, pgross, "gross") +
      small("Returning customer rate", pctStr(oo ? (rc / oo) * 100 : 0), oo ? rc / oo : 0, poo ? prc / poo : 0) +
      small("Orders fulfilled", count(fulfilled), fulfilled, pful) +
      small("Orders", count(oo), oo, poo, "orders") +
      big("sales") +
      '<div class="an-c"><div class="an-t">Total sales breakdown</div><div class="brk">' +
      brkRow("Gross sales", gross, pgross) + brkRow("Discounts", -disc, -pdisc) + brkRow("Returns", -ret, -pret) + brkRow("Net sales", net, pnet, 1) +
      brkRow("Shipping charges", sh, psh) + brkRow("Return fees", 0, 0) + brkRow("Taxes", tx, ptx) + brkRow("Total sales", net + sh + tx, pnet + psh + ptx, 1) + "</div></div>" +
      big("aov") +
      '<div class="an-c"><div class="an-t">Total sales by sales channel</div>' + channelRows(R) + "</div>" +
      big("sessions") + big("conv") +
      '<div class="an-c"><div class="an-t">Sessions by device type</div>' + deviceDonut(t.se) + "</div>" +
      '<div class="an-c"><div class="an-t">Total sales by product</div>' + prods.slice().sort(function (a, b) { return b.sold - a.sold; }).map(function (p) { var u = Math.round(p.sold * (R.hourly ? 1 / 30 : (R.n * R.step) / 30)); return '<div class="bar-r"><span>' + esc(p.title) + "</span><b>" + money(u * p.price) + "</b></div>"; }).join("") + "</div>" +
      '<div class="an-c lvc" data-act="liveview"><div class="an-t">Live View</div><div class="an-v"><b>' + count(live.visitors) + '</b><span class="muted">visitors right now</span></div></div>';
    $$(".an-c[data-anm]", el).forEach(function (c) {
      var k = c.getAttribute("data-anm");
      if (c.getAttribute("data-big")) { var host = $(".an-ch", c); requestAnimationFrame(function () { drawChart(host, R, k, { h: 170, anim: true }); }); }
      else { var sp = $(".an-sp", c); var vals = R.cur.map(k === "gross" ? function (x) { return x.s; } : MET[k].v); sp.innerHTML = miniLine(vals); }
    });
  }
  function miniLine(vals) {
    var n = vals.length, w = 56, h = 18;
    if (n < 2) return "";
    var mx = Math.max.apply(null, vals.concat([1]));
    var pts = vals.map(function (v, i) { return [(i / (n - 1)) * w, h - 2 - (v / mx) * (h - 4)]; });
    return '<svg width="' + w + '" height="' + h + '"><path d="' + smooth(pts) + '" fill="none" stroke="#0096de" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
  function deviceDonut(se) {
    var parts = [["Mobile", 0.74, "#0096de"], ["Desktop", 0.23, "#7ec8f0"], ["Tablet", 0.03, "#c4e6f8"]], a = -Math.PI / 2, r = 46, c = 60, out = "";
    parts.forEach(function (p) { var b = a + p[1] * Math.PI * 2, l = p[1] > 0.5 ? 1 : 0; out += '<path d="M' + (c + r * Math.cos(a)).toFixed(1) + "," + (c + r * Math.sin(a)).toFixed(1) + "A" + r + "," + r + " 0 " + l + " 1 " + (c + r * Math.cos(b)).toFixed(1) + "," + (c + r * Math.sin(b)).toFixed(1) + '" fill="none" stroke="' + p[2] + '" stroke-width="16"/>'; a = b; });
    return '<div class="donut"><svg width="120" height="120" viewBox="0 0 120 120">' + out + '<text x="60" y="58" text-anchor="middle" class="dn-v">' + compact(se) + '</text><text x="60" y="75" text-anchor="middle" class="dn-l">Sessions</text></svg><div>' + parts.map(function (p) { return '<span><i style="background:' + p[2] + '"></i>' + p[0] + "<b>" + count(se * p[1]) + "</b></span>"; }).join("") + "</div></div>";
  }
  function channelRows(R) {
    var mix = {};
    var recent = orders.filter(function (o) { return R.hourly ? dayIdx(o.ts) === (R.key === "today" ? T : T - 1) : dayIdx(o.ts) >= R.a; });
    if (!recent.length) recent = orders;
    recent.forEach(function (o) { mix[o.ch] = (mix[o.ch] || 0) + o.total; });
    var tot = Object.keys(mix).reduce(function (a, k) { return a + mix[k]; }, 0) || 1;
    var all = R.tot.s;
    return Object.keys(mix).sort(function (a, b) { return mix[b] - mix[a]; }).slice(0, 5).map(function (k) {
      return '<div class="bar-r"><span>' + esc(k) + '</span><i style="--w:' + Math.round((mix[k] / tot) * 100) + '%"></i><b>' + money((mix[k] / tot) * all, { auto: true }) + "</b></div>";
    }).join("");
  }

  /* ── Live View ───────────────────────────────────────────── */
  function openLiveView() {
    var R = rangeData("today");
    var el = sheet("Live View", '<div class="lvw"><div class="lv-top"><div class="lv-globe" id="lvglobe"></div><div class="lv-now"><span>Visitors right now</span><b id="lvN">' + count(live.visitors) + '</b></div></div>' +
      '<div class="lv-grid"><div><span>Total sales</span><b>' + money(R.tot.s) + "</b></div><div><span>Sessions</span><b>" + count(R.tot.se) + "</b></div><div><span>Orders</span><b>" + count(R.tot.o) + "</b></div><div><span>Page views</span><b>" + count(Math.round(R.tot.se * 3.4)) + "</b></div></div>" +
      '<div class="an-c"><div class="an-t">Customer behavior</div><div class="beh"><div><span>Active carts</span><b>' + count(live.carts) + "</b></div><div><span>Checking out</span><b>" + count(live.checkingOut) + "</b></div><div><span>Purchased</span><b>" + count(live.purchased) + "</b></div></div></div>" +
      '<div class="an-c"><div class="an-t">Sessions by location</div>' + locRows() + "</div></div>", { navClose: true, cls: "notifs liveview" });
    globe($("#lvglobe", el));
  }
  function locRows() {
    var m = {};
    orders.slice(0, 80).forEach(function (o) { var k = o.city + ", " + o.reg; m[k] = (m[k] || 0) + 1; });
    var keys = Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 5);
    var tot = keys.reduce(function (a, k) { return a + m[k]; }, 0) || 1;
    return keys.map(function (k) { return '<div class="bar-r"><span>' + esc(k) + '</span><i style="--w:' + Math.round((m[k] / tot) * 100) + '%"></i><b>' + Math.round((m[k] / tot) * 100) + "%</b></div>"; }).join("");
  }
  var LAND_MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA/gP8DAAAAAAAAAAAAAAAAAAAAAAD8/////wcAAAAAAAAHAAAAAAAAAAAArP/8//8fAPADAAAA4AMAAAAAAAAA4ADMh////wAABgAACADwAAAAAAAAAADwUT8A/v8PAAAAABwA/n8AOAAAAAAA+LPvD8D/fwAAAAAwIPz//wMDAADAAwD5w/4H+P8HAAAcAIP7/////z8Afv4HB//P////////8+Fv+QAAAAAAgMAPAAAAAODDB+D//x8ALAAEAAAAAAAAIPz///+///uf//v/7////////////wfw/////xE88AEAAP7+////////////gP////8HeAAcAADw5////////////ADgAf//f4AvAAAAAH78////////v8QAAAyA//8/+AcAAIBB4/////////8ADwAAAPD//9//AQAAPBT/////////A3AAAAAA/v///T8AAGD3//////////8DAwAAAMD/////AwAA+P//////////PwAAAAAA+P///2MAAAD///////////8CAAAAAAD///8/CAAA4P//////////JwAAAAAA8P///wcAAAD+/+nz/////38AAAAAAAD///8HAAAA/tgPPP//////MQAAAAAA8P//PwAAAOBH9v/n/////wcBAAAAAAD///8BAAAAPgD7f/7///8xEAAAAAAA4P//DwAAAMB5Iv//////f8YBAAAAAAD+//8AAAAA+AcA//////8jDwAAAAAAgP//AwAAAOD/Afj/////fwgAAAAAAADw/x8AAAAA/n////////8HAAAAAAAAAP4HAwAAAPD////7////fwAAAAAAAACgHyAAAACA//9/f/////8DAAAAAAAAAPQBAAAAAPz///8v////PwAAAAAAAAAAHiAAAADA/////g////8EAAAAAAAAAOAjCAAAAP7//9//4D//AgAAAAAAAAAAPAMGAADA/////Qf84BcAAAAAAAAAAAA/AAAAAPz//78fgAf+QAAAAAAAAAAAgA8AAADg////+wA4gB8EAAAAAAAAAADAAAAAAP7///8BgAP4gQAAAAAAAAAAAAgPAADA////7wAwgAwIAAAAAAAAAAAA/w8AAPj///8HAAUIAAEAAAAAAAAAAID/AQAA////fwBAAAEQAAAAAAAAAAAA+P8AAODj//8DAAA0GAAAAAAAAAAAAID/HwAAAPj/HwAAgMMBAAAAAAAAAAAA/P8BAACA//8AAAA4HwAAAAAAAAAAAMD/fwAAAPz/BwAAAOMFAQAAAAAAAAAA/P8/AACA/z8AAABgbvABAAAAAAAAAOD//w8AAPD/AwAAAAQAfAIAAAAAAAAA/P//AQAA/z8AAACAA4APAAAAAAAAAMD//x8AAPD/AwAAAAAQsAEAAAAAAAAA+P//AAAA/j8AAAAAAAAAAAAAAAAAAAD//wcAAPD/QwAAAACAIwAAAAAAAAAA8P9/AAAA/z8GAAAAAD8GAAAAAAAAAAD8/wcAAPD/cQAAAAD4fwAAAAAAAAAAgP8/AAAA/w8HAAAAgP8PAAAAAAAAAAD4/wMAAOD/MAAAAAD//wEAAAAAAAAAgP8fAAAA/g8DAAAA+P8/AAAAAAAAAAD4PwAAAOB/MAAAAID//wMAAAAAAAAAwP8DAAAA/gcAAAAA+P9/AAAAAAAAAAD8HwAAAMA/AAAAAID//wcAAAAAAAAAwP8BAAAA+AEAAAAA8P9/AAAAAAAAAAD8DwAAAIAPAAAAAAAf/gMAAAAAAAAAwH8AAAAAAAAAAAAAEIA/AAAAAAAAAAD+AwAAAAAAAAAAAAAA8AEgAAAAAAAA4A8AAAAAAAAAAAAAAAAAAAYAAAAAAAB+AAAAAAAAAAAAAAAAgAAwAAAAAAAA4AMAAAAAAAAAAAAAAAAIgAEAAAAAAAAeAAAAAAAAAAAAAAAAAAAOAAAAAAAA8AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAD8APj///8HAAAAAAAAAAA0AAAAAADA/f/h/////w8AAAAAAAAA4AcAAED5////z///////fwAAAAAAvAb+AADA//////////////8HAAD4/////wMAAP7/////////////HwCA+f////8BAID///////////////8AAPL/////BwAO////////////////HwAA/v/////vePj//////////////38AAOD/////////////////////////PwAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  // A dotted globe that turns slowly, with visitor pings on recent cities.
  var CITY = { "Los Angeles": [34, -118], "New York": [40.7, -74], Brooklyn: [40.6, -73.9], Chicago: [41.9, -87.6], Houston: [29.8, -95.4], Dallas: [32.8, -96.8], Austin: [30.3, -97.7], Miami: [25.8, -80.2], Orlando: [28.5, -81.4], Atlanta: [33.7, -84.4], Phoenix: [33.4, -112], Seattle: [47.6, -122.3], "San Diego": [32.7, -117.2], "San Francisco": [37.8, -122.4], Denver: [39.7, -105], Boston: [42.4, -71], Nashville: [36.2, -86.8], Charlotte: [35.2, -80.8], "Las Vegas": [36.2, -115.1], Portland: [45.5, -122.7], Columbus: [40, -83], Philadelphia: [40, -75.2], Minneapolis: [45, -93.3], Tampa: [28, -82.5], "San Antonio": [29.4, -98.5], Detroit: [42.3, -83], Raleigh: [35.8, -78.6], "Salt Lake City": [40.8, -111.9], Newark: [40.7, -74.2], Sacramento: [38.6, -121.5], Toronto: [43.7, -79.4], Vancouver: [49.3, -123.1], Montreal: [45.5, -73.6], Calgary: [51, -114], Ottawa: [45.4, -75.7], Edmonton: [53.5, -113.5], Mississauga: [43.6, -79.6], Winnipeg: [49.9, -97.1], London: [51.5, -0.1], Manchester: [53.5, -2.2], Birmingham: [52.5, -1.9], Leeds: [53.8, -1.5], Glasgow: [55.9, -4.3], Bristol: [51.5, -2.6], Liverpool: [53.4, -3], Edinburgh: [56, -3.2], Sydney: [-33.9, 151.2], Melbourne: [-37.8, 145], Brisbane: [-27.5, 153], Perth: [-32, 115.9], Adelaide: [-34.9, 138.6], "Gold Coast": [-28, 153.4], Berlin: [52.5, 13.4], Munich: [48.1, 11.6], Hamburg: [53.6, 10], Cologne: [50.9, 7], Frankfurt: [50.1, 8.7], Paris: [48.9, 2.35], Lyon: [45.8, 4.8], Marseille: [43.3, 5.4], Toulouse: [43.6, 1.4], Nice: [43.7, 7.3], Nantes: [47.2, -1.55], Montpellier: [43.6, 3.9], Strasbourg: [48.6, 7.75], Bordeaux: [44.8, -0.6], Lille: [50.6, 3.05], Rennes: [48.1, -1.7], Grenoble: [45.2, 5.7], Dijon: [47.3, 5], Rouen: [49.45, 1.1], Toulon: [43.1, 5.9], Angers: [47.5, -0.55], Reims: [49.25, 4.05], Tours: [47.4, 0.7] };
  // Metropolitan France + Corsica outline ([lat, lon]), used to draw a zoomed, dotted map of France in Live View.
  var FR_OUT = [[51.05, 2.37], [50.95, 1.85], [50.7, 1.6], [50.2, 1.55], [49.93, 1.08], [49.5, 0.1], [49.4, -0.2], [49.3, -1.1], [49.7, -1.6], [49.2, -1.6], [48.65, -1.55], [48.65, -2], [48.8, -3.4], [48.7, -4.3], [48.4, -4.75], [48.05, -4.7], [47.85, -3.9], [47.7, -3.4], [47.5, -3.1], [47.5, -2.5], [47.25, -2.2], [47, -2.2], [46.4, -1.2], [46.15, -1.15], [45.55, -1.05], [44.65, -1.25], [43.6, -1.45], [43.35, -1.78], [42.8, -0.7], [42.8, 0.7], [42.85, 1.4], [42.45, 1.7], [42.5, 2], [42.43, 3.17], [42.7, 3.05], [43.1, 3.05], [43.4, 3.7], [43.4, 4.6], [43.3, 5.35], [43.1, 6], [43.4, 6.75], [43.65, 7], [43.78, 7.5], [44.1, 7.7], [44.4, 6.9], [44.85, 6.65], [45.1, 7.05], [45.5, 6.85], [46.2, 6.1], [46.45, 6], [47, 7], [47.55, 7.6], [48, 7.55], [48.6, 8.2], [49, 8.2], [49.2, 7], [49.5, 6.35], [49.55, 5.4], [49.9, 4.85], [50.15, 4.2], [50.3, 3.6], [50.7, 3.2], [50.85, 2.9]];
  var CORSICA_OUT = [[43, 9.45], [42.65, 9.5], [41.9, 9.4], [41.4, 9.2], [41.4, 8.8], [41.9, 8.6], [42.5, 8.6], [42.95, 9.35]];
  function inPoly(lat, lon, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[0] > lat) !== (b[0] > lat) && lon < ((b[1] - a[1]) * (lat - a[0])) / (b[0] - a[0]) + a[1]) c = !c;
    }
    return c;
  }
  function globe(host) {
    var size = Math.min(host.clientWidth || 300, 320);
    var cv = document.createElement("canvas"), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px";
    host.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var pts = orders.slice(0, 40).map(function (o) { return CITY[o.city]; }).filter(Boolean);
    var home = pts[0] || [39, -98];
    var lon0 = -home[1] - 10, R = size / 2 - 6, cx = size / 2, cy = size / 2;
    var dots = [], FR = S.country === "FR", Z = FR ? 8.6 : 1;   // France: zoomed in on a dotted map of the country
    if (FR) for (var fla = 41; fla <= 51.4; fla += 0.35) for (var flo = -5.4; flo <= 9.8; flo += 0.5) if (inPoly(fla, flo, FR_OUT) || inPoly(fla, flo, CORSICA_OUT)) dots.push([fla, flo]);
    // Land dots come from a 2-degree land mask of Natural Earth's 110m land
    // (world-atlas), bit-packed: 180 columns from 180W, 90 rows from 90N.
    var bits = atob(LAND_MASK);
    for (var r = 0; r < (FR ? 0 : 90); r++) {
      var la = 89 - r * 2;
      if (la < -58) continue;
      for (var cIdx = 0; cIdx < 180; cIdx++) {
        var k = r * 180 + cIdx;
        if (bits.charCodeAt(k >> 3) & (1 << (k & 7))) dots.push([la, -179 + cIdx * 2]);
      }
    }
    var tilt = FR ? 0.81 : 0.32;
    function proj(lat, lon, rot) {
      var p = (lat * Math.PI) / 180, l = ((lon + rot) * Math.PI) / 180;
      var x = Math.cos(p) * Math.sin(l), y = Math.sin(p), z = Math.cos(p) * Math.cos(l);
      var y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * R * Z, cy - y2 * R * Z, z2];
    }
    var rot = FR ? -2.5 : lon0, last = performance.now(), alive = true;
    function frame(now) {
      if (!host.isConnected) { alive = false; return; }
      var dt = now - last; last = now;
      if (FR) rot = -2.5 + (reduce ? 0 : Math.sin(now / 3500) * 1.1);   // France stays in view, only a gentle sway
      else if (!reduce) rot += dt * 0.004;
      ctx.clearRect(0, 0, size, size);
      var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#eef0f3");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      if (FR) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); }
      var ds = FR ? 3.2 : 1.8;
      for (var i = 0; i < dots.length; i++) {
        var q = proj(dots[i][0], dots[i][1], rot);
        if (q[2] <= 0) continue;
        ctx.fillStyle = "rgba(118,126,138," + (0.3 + q[2] * 0.6).toFixed(2) + ")";
        ctx.fillRect(q[0] - ds / 2, q[1] - ds / 2, ds, ds);
      }
      var tt = now / 1000;
      for (var k = 0; k < pts.length; k++) {
        var c = proj(pts[k][0], pts[k][1], rot);
        if (c[2] <= 0.05) continue;
        // The first few are this hour's orders (purple, ring burst); the rest are visitors (blue, fading in and out).
        var isOrder = k < 4, ph = (tt * (isOrder ? 0.5 : 0.35) + k * 0.37) % 1;
        if (isOrder) {
          ctx.strokeStyle = "rgba(128,81,255," + (0.7 * (1 - ph)).toFixed(2) + ")"; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(c[0], c[1], 3.5 + ph * 12, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#8051ff"; ctx.beginPath(); ctx.arc(c[0], c[1], 3.6, 0, Math.PI * 2); ctx.fill();
        } else {
          var a = Math.sin(ph * Math.PI);
          ctx.fillStyle = "rgba(0,148,213," + (0.25 + a * 0.75).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(c[0], c[1], 2.4 + a, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (FR) ctx.restore();
      if (alive) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ── Payouts ─────────────────────────────────────────────── */
  /* Every paid order lands in the balance (S.payout, in cents). "Transfer" sends it to a bank account. */
  function payBal() { return Math.max(0, S.payout || 0); }
  function creditOrder(o) {
    if (!o || o.credited || o.pay !== "Paid") return;
    o.credited = true;
    S.payout = (S.payout || 0) + o.total;
    syncPayCard();
  }
  function maskMail(e) { var m = String(e || "").split("@"); return m[0].slice(0, 1) + "***@" + (m[1] || ""); }
  function payChip() {
    var a = payAccts.filter(function (x) { return x.id === paySel; })[0] || payAccts[0];
    if (a) return bankLabel(a.iban);
    if (payPal) return "PayPal " + maskMail(payPal);
    return "No bank account yet";
  }
  function bankLabel(iban) { var t = String(iban || "").replace(/\s+/g, "").toUpperCase(); return t.slice(0, 4) + " •••• " + t.slice(-4); }
  function payStatus(p) {
    if (p.bank) return (nowMs() - p.ts) > 2 * DAY ? "Paid" : "In transit";
    return p.st === "In transit" ? "In transit" : "Paid";
  }
  function payList() { return payouts.filter(function (p) { return p.st !== "Scheduled"; }).sort(function (a, b) { return b.ts - a.ts; }); }
  var ARW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  var BAG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 11H7L6 8zM9 8V7a3 3 0 016 0v1"/></svg>';
  var BANK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>';
  function payRowHtml(p, k) {
    var st = payStatus(p), tr = st === "In transit";
    var sub = p.bank ? "<span>" + esc(mdLong(p.ts)) + " • " + esc(p.bank) + "</span>" : "<span>" + esc(mdLong(p.ts)) + " • " + count(p.n) + " order" + (p.n === 1 ? "" : "s") + "</span>";
    return '<button class="pv-r pv-x" style="--d:' + (0.32 + Math.min(k, 8) * 0.06) + 's" data-po="' + k + '"><span class="pv-ic' + (p.bank ? "" : " o") + (tr ? " tr" : "") + '">' + (p.bank ? ARW : BAG) + '</span><div><b>' + (p.bank ? (p.kind === "paypal" ? "PayPal" : "Bank transfer") : "Payout") + "</b>" + sub + '</div><div class="po-a"><b>' + money(p.amt) + "</b>" + badge(st, tr ? "info" : "ok") + "</div></button>";
  }
  function payoutsHtml() {
    var np = nextPayout(), bal = payBal(), list = payList();
    var sent = transfers.reduce(function (a, t) { return a + t.amt; }, 0);
    var moving = transfers.filter(function (t) { return payStatus(t) === "In transit"; }).reduce(function (a, t) { return a + t.amt; }, 0);
    var hero = '<div class="pv-hero pv-x"><div class="pv-top"><span class="pv-lb"><i></i>Available balance</span>' + (np ? '<span class="pv-chip">Estimated ' + md(np.ts) + "</span>" : "") + "</div>" +
      '<b class="pv-bal" id="pvBal">' + money(bal) + "</b>" +
      '<div class="pv-acc">' + BANK + "<span>" + esc(payChip()) + "</span></div>" +
      '<button class="pv-go" data-act="transfer"' + (bal > 0 ? "" : " disabled") + ">" + ARW + "<span>Transfer</span></button></div>";
    var stats = transfers.length ? '<div class="pv-stats pv-x" style="--d:.2s"><div><span>In transit</span><b>' + money(moving) + "</b></div><div><span>Transferred</span><b>" + money(sent) + "</b></div></div>" : "";
    var rows = list.length ? list.slice(0, 30).map(payRowHtml).join("") :
      '<div class="pv-empty pv-x" style="--d:.3s"><span class="pv-eic">' + ARW + "</span><b>No payouts yet</b><span>Your transfers will show up here.</span></div>";
    return hero + stats + '<div class="pv-list pv-x" style="--d:.28s"><h3>Payouts</h3>' + rows + "</div>";
  }
  function financeBody() { return payoutsHtml(); }
  function bindPayouts(el) {
    $$("[data-po]", el).forEach(function (b) {
      b.addEventListener("click", function () { var p = payList()[+b.getAttribute("data-po")]; if (p) payDetail(p); });
    });
  }
  function openPayouts() {
    payEl = sheet("Payouts", payoutsHtml(), { navClose: true, cls: "notifs payouts" });
    bindPayouts(payEl);
    var sb = $(".sh-b", payEl); sb.classList.add("pv-in");
    setTimeout(function () { sb.classList.remove("pv-in"); }, 1800);
    var bn = $("#pvBal", payEl); if (bn && payBal() > 0) countTo(bn, 0, payBal(), money, 1000);
    setTimeout(function () { hap("light"); }, 120);
  }
  function payDetail(p) {
    var st = payStatus(p);
    var kv = p.bank
      ? '<div class="kv"><div><span>Destination</span><span></span><b>' + esc(p.bank) + "</b></div>" + (p.holder ? "<div><span>Account holder</span><span></span><b>" + esc(p.holder) + "</b></div>" : "") +
        (p.fees > 0 ? "<div><span>Amount</span><span></span><b>" + money(p.gross) + "</b></div><div><span>Withdrawal fee</span><span></span><b>-" + money(p.fees) + "</b></div>" : "") +
        '<div class="tot"><span>Total</span><span></span><b>' + money(p.amt) + "</b></div></div>"
      : '<div class="kv"><div><span>Orders</span><span>' + count(p.n) + "</span><b>" + money(p.gross) + "</b></div><div><span>Fees</span><span></span><b>-" + money(p.fees) + '</b></div><div class="tot"><span>Total</span><span></span><b>' + money(p.amt) + "</b></div></div>";
    sheet("Payout", '<div class="po-d"><span>' + esc(mdLong(p.ts)) + "</span><h1>" + money(p.amt) + "</h1>" + badge(st, st === "In transit" ? "info" : "ok") + '</div><div class="sec">' + kv + "</div>", { navClose: true, cls: "notifs payout" });
  }
  // Keep every place that shows the balance in step (home card, Payouts sheet, Finance menu).
  function syncPayCard() {
    try {
      var b = $('#s-home [data-act="payouts"] b'), want = payBal() > 0, home = $("#s-home");
      if (b && want) b.textContent = money(payBal());
      else if (home && home.innerHTML && !!b !== want) {
        rendered.home = 0;
        if (current === "home" && !stack.length) { RENDER.home(); rendered.home = 1; }
      }
      rendered.menu = 0;
      if (payEl && payEl.isConnected) { $(".sh-b", payEl).innerHTML = payoutsHtml(); bindPayouts(payEl); }
    } catch (e) { }
  }
  // Bottom sheet shown once a transfer is sent: animated check + a little haptic choreography.
  function paySuccess(amt, bank, kind) {
    var body = '<div class="ok-w"><div class="ok-ic"><i class="ok-pulse"></i><i class="ok-pulse p2"></i>' +
      '<svg viewBox="0 0 72 72" width="88" height="88"><circle class="ok-c" cx="36" cy="36" r="30" fill="none" stroke="#1a9d54" stroke-width="4" stroke-linecap="round"/>' +
      '<path class="ok-k" d="M23 37.5l9.5 9.5L50 27" fill="none" stroke="#1a9d54" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h2 class="ok-t">Transfer sent</h2><b class="ok-a">' + money(amt) + '</b>' +
      '<p class="ok-s"><span>' + (kind === "paypal" ? "PayPal" : "Bank transfer") + '</span> <span>' + esc(bank) + '</span></p>' +
      '<button class="btn-p ok-b" id="okDone"><span>Done</span></button></div>';
    var el = sheet("", body, { cls: "tr-ok" });
    $("#okDone", el).addEventListener("click", function () { hap("light"); pop(false); });
    // heavy thud as it opens, light ticks while the ring draws, success burst when the check lands
    hap("heavy");
    [160, 280, 400].forEach(function (t) { setTimeout(function () { hap("light"); }, t); });
    setTimeout(function () { hap("success"); }, 620);
    setTimeout(function () { hap("selection"); }, 900);
  }
  var TRASH = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  var WAL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 012-2h11v4M4 7v10a2 2 0 002 2h13a1 1 0 001-1V9a1 1 0 00-1-1H6a2 2 0 01-2-1zM16 14h2"/></svg>';
  var BKS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>';
  var SWA = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var SWC = '<svg class="sl-ck" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11a1 1 0 011 1v10a1 1 0 01-1 1H9l-6-6 6-6zM12 10l5 4M17 10l-5 4"/></svg>';
  // Transfer flow in 3 steps: 1/3 method (bank / PayPal), 2/3 amount (keypad), 3/3 account (saved banks or PayPal email).
  function openTransfer() {
    var bal = payBal();
    if (bal <= 0) return toast("Nothing to transfer");
    var dec = S.dec == null ? 2 : S.dec, sep = (1.1).toLocaleString(S.loc || "en-US").charAt(1);
    var toStr = function (c) { return (c / Math.pow(10, dec)).toFixed(dec).replace(".", sep); };
    var toCents = function (v) { var n = parseFloat(String(v).replace(sep, ".")); return isFinite(n) ? Math.round(n * Math.pow(10, dec)) : 0; };
    var T = { step: 1, method: payAccts.length || !payPal ? "bank" : "paypal", amt: "", sel: paySel || (payAccts[0] ? payAccts[0].id : ""), adding: !payAccts.length, email: payPal };
    var el = sheet("Transfer", '<div class="tr-prog"><i></i><i></i><i></i></div><div class="tr-wrap" id="trW"></div>', { navClose: true, cls: "notifs transfer", actions: '<span class="tr-step" id="trStep">1/3</span>' });
    var x = $(".sh-x", el), nx = x.cloneNode(true); x.parentNode.replaceChild(nx, x);
    nx.addEventListener("click", function () { if (T.step > 1) { hap("selection"); T.step -= 1; render(-1); } else pop(false); });
    var W = $("#trW", el);
    W.innerHTML = '<div class="tr-panes"></div><div class="tr-footw"></div>';
    function acc() { return payAccts.filter(function (a) { return a.id === T.sel; })[0]; }
    function showErr(m) { var e = $("#trErr", el); if (e) { e.textContent = m; e.hidden = !m; } if (m) hap("warning"); }
    function foot(btn) { return '<div class="tr-foot">' + btn + "</div>"; }
    function stepHtml() {
      if (T.step === 4) return recapHtml();
      if (T.step === 1) {
        return '<h3 class="tr-h">Withdrawal method</h3><p class="tr-p">Choose how you want to receive your money.</p>' +
          '<button class="tr-opt' + (T.method === "bank" ? " sel" : "") + '" data-m="bank"><span class="pv-ic">' + BKS + '</span><div><b>Bank account</b><span>1 to 2 business days</span></div><span class="rd"></span></button>' +
          '<button class="tr-opt' + (T.method === "paypal" ? " sel" : "") + '" data-m="paypal"><span class="pv-ic">' + WAL + '</span><div><b>PayPal</b><span>Usually within minutes</span></div><span class="rd"></span></button>' +
          foot('<button class="btn-p" id="trNext"><span>Continue</span></button>');
      }
      if (T.step === 2) {
        var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", dec > 0 ? sep : "", "0", "del"].map(function (k) {
          return k === "" ? "<span></span>" : '<button class="tr-k" data-k="' + k + '"' + (k === "del" ? ' aria-label="Delete">' + DEL : ">" + k) + "</button>";
        }).join("");
        return '<div class="tr-amt2" id="trBox"><span class="cur">' + esc(S.sym) + '</span><b id="trAmtV">0</b></div>' +
          '<div class="tr-chips"><span class="tr-chip">' + (T.method === "bank" ? BKS : WAL) + "<span>" + (T.method === "bank" ? "Bank account" : "PayPal") + '</span></span><button class="tr-chip" id="trMax"><b>' + money(bal) + "</b><span>Available</span></button></div>" +
          '<div class="tr-pad">' + keys + "</div>" +
          foot('<button class="btn-p" id="trNext" disabled><span>Continue</span><b id="trNextA"></b></button>');
      }
      var amtB = "<b>" + money(toCents(T.amt)) + "</b>";
      if (T.method === "paypal") {
        return '<h3 class="tr-h">PayPal email</h3><p class="tr-p">Enter the email linked to your PayPal account.</p>' +
          '<div class="ff"><label class="fld"><span>PayPal email</span><input id="trMail" type="email" inputmode="email" autocapitalize="off" autocomplete="email" spellcheck="false" placeholder="name@example.com" value="' + esc(T.email) + '"></label></div><p class="tr-err" id="trErr" hidden></p>' +
          foot('<button class="btn-p" id="trGo"><span>Transfer</span>' + amtB + "</button>");
      }
      var list = payAccts.map(function (a) {
        return '<div class="tr-acc' + (a.id === T.sel && !T.adding ? " sel" : "") + '" data-id="' + esc(a.id) + '"><span class="rd"></span><span class="pv-ic">' + BKS + "</span><div><b>" + esc(a.holder) + "</b><span>" + esc(bankLabel(a.iban)) + '</span></div><button class="tr-del" data-del="' + esc(a.id) + '" aria-label="Remove">' + TRASH + "</button></div>";
      }).join("");
      var form = T.adding ? '<div class="tr-form ff"><label class="fld"><span>Account holder</span><input id="trName" autocomplete="name"></label>' +
        '<label class="fld"><span>IBAN</span><input id="trIban" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="FR76 0000 0000 0000 0000 0000 000"></label>' +
        '<p class="tr-err" id="trErr" hidden></p><button class="btn-p" id="trSave"><span>Save account</span></button>' + (payAccts.length ? '<button class="tr-lk" id="trCancel">Cancel</button>' : "") + "</div>"
        : '<button class="tr-addrow" id="trAdd">' + PLUS + "<span>Add a bank account</span></button><p class=\"tr-err\" id=\"trErr\" hidden></p>";
      return '<h3 class="tr-h">Choose an account</h3><p class="tr-p">Select where to send ' + money(toCents(T.amt)) + ".</p>" + list + form +
        foot('<button class="btn-p" id="trGo"' + (T.adding ? " disabled" : "") + "><span>Transfer</span>" + amtB + "</button>");
    }
    function updAmt() {
      var c = toCents(T.amt), over = c > bal, box = $("#trBox", el), nx2 = $("#trNext", el);
      $("#trAmtV", el).textContent = T.amt || "0";
      $("#trAmtV", el).style.fontSize = (T.amt.length > 9 ? 40 : T.amt.length > 7 ? 48 : "") + (T.amt.length > 7 ? "px" : "");
      box.classList.toggle("over", over);
      nx2.disabled = !(c > 0 && !over);
      $("#trNextA", el).textContent = c > 0 ? money(c) : "";
    }
    function bind() {
      $$(".tr-opt", el).forEach(function (b) { b.addEventListener("click", function () { T.method = b.getAttribute("data-m"); hap("selection"); $$(".tr-opt", el).forEach(function (o) { o.classList.toggle("sel", o === b); }); }); });
      var next = $("#trNext", el);
      if (next) next.addEventListener("click", function () { hap("light"); T.step += 1; render(1); });
      if (T.step === 2) {
        updAmt();
        $$(".tr-k", el).forEach(function (k) {
          k.addEventListener("click", function () {
            var v = k.getAttribute("data-k"), before = T.amt;
            if (v === "del") T.amt = T.amt.slice(0, -1);
            else if (v === sep) { if (T.amt.indexOf(sep) < 0) T.amt += (T.amt ? "" : "0") + sep; }
            else {
              var dp = T.amt.split(sep)[1];
              if (dp !== undefined && dp.length >= dec) return hap("warning");
              if (T.amt.replace(sep, "").length >= 9) return hap("warning");
              T.amt = T.amt === "0" ? v : T.amt + v;
            }
            if (T.amt === before) return;
            hap("selection"); updAmt();
            if (toCents(T.amt) > bal) { var bx = $("#trBox", el); bx.classList.remove("shake"); void bx.offsetWidth; bx.classList.add("shake"); hap("warning"); }
          });
        });
        $("#trMax", el).addEventListener("click", function () { T.amt = toStr(bal); hap("light"); updAmt(); });
      }
      if (T.step === 3) {
        $$(".tr-acc", el).forEach(function (r) { r.addEventListener("click", function () { T.sel = r.getAttribute("data-id"); T.adding = false; hap("selection"); render(0); }); });
        $$(".tr-del", el).forEach(function (d) {
          d.addEventListener("click", function (e) {
            e.stopPropagation();
            var id = d.getAttribute("data-del");
            payAccts = payAccts.filter(function (a) { return a.id !== id; });
            if (T.sel === id) T.sel = payAccts[0] ? payAccts[0].id : "";
            if (paySel === id) paySel = T.sel;
            if (!payAccts.length) T.adding = true;
            hap("medium"); saveState(); syncPayCard(); render(0); toast("Account removed");
          });
        });
        var add = $("#trAdd", el); if (add) add.addEventListener("click", function () { T.adding = true; hap("light"); render(0); var n = $("#trName", el); if (n) n.focus(); });
        var cn = $("#trCancel", el); if (cn) cn.addEventListener("click", function () { T.adding = false; render(0); });
        var sv = $("#trSave", el);
        if (sv) sv.addEventListener("click", function () {
          var name = $("#trName", el).value.trim(), iban = $("#trIban", el).value.replace(/\s+/g, "").toUpperCase();
          if (!name) return showErr("Enter the account holder's name");
          if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return showErr("Enter a valid IBAN");
          var a = { id: "a" + Date.now(), holder: name, iban: iban };
          payAccts.push(a); T.sel = a.id; paySel = a.id; T.adding = false;
          hap("success"); saveState(); syncPayCard(); render(0); toast("Account added");
        });
        var go = $("#trGo", el);
        if (go) go.addEventListener("click", function () {
          var dest;
          if (T.method === "paypal") {
            var em = $("#trMail", el).value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return showErr("Enter a valid email address");
            T.email = em; dest = { kind: "paypal", label: "PayPal " + maskMail(em), holder: "" };
          } else {
            var a2 = acc(); if (!a2) return showErr("Select an account");
            dest = { kind: "bank", label: bankLabel(a2.iban), holder: a2.holder };
          }
          var c = toCents(T.amt); if (c <= 0 || c > payBal()) return showErr("Amount is higher than your balance");
          var fee = feeFor(c, T.method);
          if (c <= fee) return showErr("Amount too low to cover the fees");
          T.dest = dest; T.fee = fee; hap("light"); T.step = 4; render(1);
        });
      }
      if (T.step === 4) bindSwipe();
    }
    function feeFor(c, method) {
      var u = Math.pow(10, dec - 2);
      return method === "paypal" ? Math.max(Math.round(10 * u), Math.round(c * 0.01)) : Math.round(25 * u);
    }
    function recapHtml() {
      var c = toCents(T.amt), fee = T.fee || 0, d = T.dest || {};
      return '<h3 class="tr-h">Review transfer</h3><p class="tr-p">Check the details before sending.</p>' +
        '<div class="tr-rc">' +
        '<div><span>Amount</span><b>' + money(c) + "</b></div>" +
        '<div><span>Withdrawal fee</span><b>' + (fee > 0 ? "-" + money(fee) : "Free") + "</b></div>" +
        '<div><span>To</span><b>' + esc(d.label || "") + "</b></div>" +
        (d.holder ? '<div><span>Account holder</span><b>' + esc(d.holder) + "</b></div>" : "") +
        '<div><span>Arrival</span><b>' + (T.method === "paypal" ? "Usually within minutes" : "1 to 2 business days") + "</b></div>" +
        '<div class="tot"><span>You receive</span><b>' + money(c - fee) + "</b></div></div>" +
        '<p class="tr-err" id="trErr" hidden></p>' +
        foot('<div class="sl" id="slr"><div class="sl-fill"></div><span class="sl-t">Swipe to send</span><div class="sl-k" id="slK">' + SWA + "</div></div>");
    }
    // A burst of haptics (native iOS generators in quick succession, or a vibration pattern in a browser).
    function burst() {
      var native = false;
      try { native = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpHaptic); } catch (e) { }
      if (!native) { try { if (navigator.vibrate) navigator.vibrate([30, 20, 30, 20, 30, 20, 30, 20, 30, 20, 60, 20, 60, 20, 90]); } catch (e2) { } return; }
      var seq = ["heavy", "medium", "heavy", "light", "heavy", "medium", "heavy", "heavy", "medium", "heavy", "light", "heavy", "medium", "heavy", "heavy", "heavy", "medium", "heavy"];
      seq.forEach(function (k, i) { setTimeout(function () { hap(k); }, i * 45); });
      setTimeout(function () { hap("success"); }, seq.length * 45 + 40);
    }
    function send() {
      var c = toCents(T.amt), dest = T.dest, fee = T.fee || 0;
      if (c > payBal()) c = payBal();
      S.payout = payBal() - c;
      if (dest.kind === "paypal") payPal = T.email; else paySel = T.sel;
      var row = { ts: nowMs(), amt: Math.max(0, c - fee), st: "In transit", n: 0, fees: fee, gross: c, bank: dest.label, holder: dest.holder, kind: dest.kind };
      transfers.unshift(row); payouts.unshift(row);
      pop(false);
      saveState(); syncPayCard();
      setTimeout(function () { paySuccess(row.amt, row.bank, row.kind); notifyPayout(row); }, 260);
    }
    function bindSwipe() {
      var sw = $("#slr", el), k = $("#slK", el), fill = $(".sl-fill", el), txt = $(".sl-t", el);
      var x0 = null, cur = 0, max = 0, lastTick = 0, done = false;
      // keep the sheet's drag-to-dismiss out of the way
      ["touchstart", "touchmove"].forEach(function (ev) { sw.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
      function set(px) {
        cur = px; k.style.transform = "translateX(" + px + "px)";
        fill.style.width = (px + k.offsetWidth + 4) + "px";
        txt.style.opacity = Math.max(0, 1 - px / (max * 0.55));
      }
      k.addEventListener("pointerdown", function (e) {
        if (done) return;
        max = sw.clientWidth - k.offsetWidth - 8; x0 = e.clientX - cur; lastTick = 0;
        try { k.setPointerCapture(e.pointerId); } catch (e1) { }
        k.style.transition = "none"; fill.style.transition = "none"; sw.classList.add("drag"); hap("light");
      });
      k.addEventListener("pointermove", function (e) {
        if (x0 === null || done) return;
        var px = Math.max(0, Math.min(max, e.clientX - x0)); set(px);
        var p = px / max, tick = Math.floor(p * 14);
        if (tick !== lastTick) { lastTick = tick; hap(p > 0.85 ? "medium" : p > 0.5 ? "light" : "selection"); }
      });
      function end() {
        if (x0 === null) return;
        x0 = null; sw.classList.remove("drag");
        if (cur / max >= 0.88) {
          done = true; k.style.transition = "transform .2s var(--ease)"; fill.style.transition = "width .2s var(--ease)"; set(max);
          sw.classList.add("done"); txt.textContent = "Sending…"; txt.style.opacity = 1; k.innerHTML = '<span class="sl-spin"></span>';
          burst();
          var wait = 2000 + Math.random() * 3000;   // loading lasts a random 2 to 5 seconds
          setTimeout(function () { k.innerHTML = SWC; sw.classList.add("ok"); hap("success"); }, wait - 350);
          setTimeout(send, wait);
        } else {
          k.style.transition = "transform .45s var(--ease)"; fill.style.transition = "width .45s var(--ease)"; set(0); hap("light");
        }
      }
      k.addEventListener("pointerup", end); k.addEventListener("pointercancel", end);
    }
    // Le bas de page (Continuer / Transférer / curseur) est FIXE, hors du volet qui glisse : le bouton de verre natif
    // ne bouge donc pas (et n'est jamais recréé, ce qui le faisait remonter depuis le bas). Seul le contenu glisse :
    // étape suivante = de droite vers la gauche, retour = de gauche vers la droite.
    function render(dir) {
      var html = stepHtml(), fi = html.lastIndexOf('<div class="tr-foot">');
      var body = fi < 0 ? html : html.slice(0, fi), ft = fi < 0 ? "" : html.slice(fi);
      var P = $(".tr-panes", W), F = $(".tr-footw", W), old = P.lastElementChild, np;
      if (dir && old) {
        old.classList.remove("in", "back"); old.classList.add("out"); if (dir < 0) old.classList.add("back");
        setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 460);
        np = document.createElement("div"); np.className = "tr-pane in" + (dir < 0 ? " back" : ""); np.innerHTML = body; P.appendChild(np);
      } else if (old) { old.innerHTML = body; }
      else { np = document.createElement("div"); np.className = "tr-pane"; np.innerHTML = body; P.appendChild(np); }
      F.innerHTML = ft;
      $$(".tr-prog i", el).forEach(function (b, i) { b.classList.toggle("on", i < Math.min(T.step, 3)); });
      $("#trStep", el).textContent = Math.min(T.step, 3) + "/3";
      nx.innerHTML = T.step > 1 ? ic("chev-left") : ic("x");
      nx.setAttribute("aria-label", T.step > 1 ? "Back" : "Close");
      bind();
    }
    render(0);
  }

  /* ── Notifications, search, Sidekick ─────────────────────── */
  function openNotifs() {
    var body = notifs.slice(0, 40).map(function (x) {
      if (x.kind === "payout") return '<button class="nrow' + (x.read ? "" : " unr") + '" data-act="payouts"><span class="napp pay"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="nr1"><b>Transfer sent</b><em>' + esc(pushTime(x.ts)) + "</em></div><span>" + esc(payoutBody(x.t)) + "</span></div></button>";
      var o = x.o;
      return '<button class="nrow' + (x.read ? "" : " unr") + '" data-order="' + o.n + '"><span class="napp">' + ic("bag-color") + '</span><div><div class="nr1"><b>Order #' + o.n + "</b><em>" + esc(pushTime(x.ts)) + "</em></div><span>" + esc(pushBody(o)) + "</span></div></button>";
    }).join("");
    sheet("Notifications", body || emptyState("No notifications", ""), { navClose: true, cls: "notifs", actions: '<button class="nb-c" data-act="notifsettings" aria-label="Settings">' + ic("settings") + "</button>" });
    notifs.forEach(function (x) { x.read = true; });
    unread = 0; setBell();
  }
  var recentQ = (function () { try { return JSON.parse(localStorage.getItem("sh-recent") || "[]"); } catch (e) { return []; } })();
  function openSearch() {
    var cat = "All";
    var nav = '<div class="pg-nav sr-nav"><label class="sfield">' + ic("search") + '<input type="search" id="gq" placeholder="Search" autocomplete="off" enterkeyhint="search"><button type="button" class="sr-scan" data-act="scan" aria-label="Scan">' + ic("barcode") + "</button></label>" +
      '<button class="nb-c sr-x" data-back aria-label="Close">' + ic("x") + "</button></div>";
    var body = '<div class="srch">' +
      '<div class="chips" id="gchips">' + [["All", "Everything"], ["Orders", "Orders"], ["Products", "Products"], ["Customers", "Customers"]].map(function (c) { return '<button class="chip' + (c[0] === cat ? " on" : "") + '" data-gc="' + c[0] + '">' + c[1] + "</button>"; }).join("") +
      '<button class="chip flt" id="gflt" aria-label="Filters">' + ic("filter") + "</button></div>" +
      '<div id="gres"></div></div>';
    var el = page(body, { cls: "search", modal: true, notabs: true, navHtml: nav });
    var inp = $("#gq", el), res = $("#gres", el);
    function idle() {
      var r = recentQ.slice(0, 6);
      res.innerHTML = r.length ?
        '<div class="mh"><span>Recent searches</span><button class="lnk" id="gclr">Clear</button></div>' + r.map(function (q) { return '<button class="srow" data-q="' + esc(q) + '">' + ic("recent") + "<span>" + esc(q) + "</span></button>"; }).join("") :
        '<div class="empty sr-empty">' + ic("search") + "<b>No recent searches</b></div>";
      var c = $("#gclr", res); if (c) c.addEventListener("click", function () { recentQ = []; try { localStorage.removeItem("sh-recent"); } catch (e) { } idle(); });
      $$("[data-q]", res).forEach(function (b) { b.addEventListener("click", function () { inp.value = b.getAttribute("data-q"); run(); }); });
    }
    function run() {
      var q = inp.value.trim().toLowerCase();
      if (!q) return idle();
      var os = cat === "All" || cat === "Orders" ? orders.filter(function (o) { return ("#" + o.n + " " + o.n + " " + (o.c ? o.c.name + " " + o.c.email : "")).toLowerCase().indexOf(q) >= 0; }).slice(0, cat === "All" ? 5 : 30) : [];
      var ps = cat === "All" || cat === "Products" ? prods.filter(function (p) { return (p.title + " " + p.sku + " " + p.type).toLowerCase().indexOf(q) >= 0; }).slice(0, 10) : [];
      var cs = cat === "All" || cat === "Customers" ? custs.filter(function (c) { return (c.name + " " + c.email).toLowerCase().indexOf(q) >= 0; }).slice(0, cat === "All" ? 5 : 30) : [];
      res.innerHTML = (os.length ? '<div class="mh"><span>Orders</span></div>' + os.map(orderRow).join("") : "") + (ps.length ? '<div class="mh"><span>Products</span></div>' + ps.map(prodRow).join("") : "") + (cs.length ? '<div class="mh"><span>Customers</span></div>' + cs.map(custRow).join("") : "") || emptyState("No results for \u201c" + inp.value.trim() + "\u201d", "Try a different search term");
    }
    $$("[data-gc]", el).forEach(function (b) { b.addEventListener("click", function () { cat = b.getAttribute("data-gc"); $$("[data-gc]", el).forEach(function (x) { x.classList.toggle("on", x === b); }); hap(4); run(); }); });
    $("#gflt", el).addEventListener("click", function () { hap(4); toast("Filters are not available yet"); });
    inp.addEventListener("input", run);
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var v = inp.value.trim(); if (!v) return;
      recentQ = [v].concat(recentQ.filter(function (x) { return x !== v; })).slice(0, 8);
      try { localStorage.setItem("sh-recent", JSON.stringify(recentQ)); } catch (er) { }
      inp.blur();
    });
    idle();
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { } }, 320);
  }
  var skThread = [];
  function skAnswer(q) {
  var R = rangeData("30d"), Rt = rangeData("today");
  if (/^\s*(salut|bonjour|bonsoir|coucou|hello|hi|hey|hola|hallo|yo)\b/i.test(q)) return "Hi! Good to see you again \ud83d\ude0a Want to make progress on your store today?";
    var ql = ((window.I18N ? window.I18N.en(q) : q) + " " + q).toLowerCase(), top = prods.slice().sort(function (x, y) { return y.sold - x.sold; });
    var c30 = change(R.tot.s, R.ptot.s);
    if (/today|sales|doing|revenue|aujourd|ventes|chiffre|hoy|ventas|heute|umsatz|verk/.test(ql)) return "Today you\u2019ve made " + money(Rt.tot.s) + " from " + count(Rt.tot.o) + " order" + (Rt.tot.o === 1 ? "" : "s") + ". Over the last 30 days, total sales are " + money(R.tot.s) + (c30 !== null ? ", " + (c30 >= 0 ? "up " : "down ") + Math.abs(Math.round(c30)) + "% from the 30 days before." : ".");
    if (/best|top|seller|product|meilleur|produit|mejor|producto|beste|produkt/.test(ql)) return "Your best seller over the last 30 days is " + top[0].title + " with " + count(top[0].sold) + " units sold" + (top[1] ? ", followed by " + top[1].title + " (" + count(top[1].sold) + ")." : ".");
    if (/attention|order|fulfill|commande|traiter|pedido|preparar|bestell|erfüll/.test(ql)) { var u = unfulfilled(), c = toCapture().length; return "You have " + u.length + " order" + (u.length === 1 ? "" : "s") + " to fulfill" + (c ? " and " + c + " payment" + (c === 1 ? "" : "s") + " to capture" : "") + ". The oldest unfulfilled order is #" + (u.slice(-1)[0] || { n: S.lastN }).n + "."; }
    if (/description|write|rédig|écri|escrib|schreib|beschreib/.test(ql)) return "Here\u2019s a draft for " + top[0].title + ":\n\nMade for everyday wear, the " + top[0].title + " pairs a clean silhouette with materials that hold up wash after wash. It\u2019s the piece you\u2019ll reach for first.";
    return "Your store has " + count(S.custTotal) + " customers and " + count(R.tot.o) + " orders in the last 30 days. I can dig into sales, products, orders or customers, or help you write and edit content.";
  }
  function openSidekickChat(first, replay) {
    var R = rangeData("30d"), Rt = rangeData("today");
    var sugg = ["How are sales today?", "What are my best sellers?", "Which orders need attention?", "Write a product description"];
    var g = greeting().replace("!", "");
    var body = '<div class="sk"><div class="sk-hi" id="skhi"><span class="sk-mascot">' + mascot() + '</span><p class="sk-g">' + esc(g) + '</p><h1>How can I help?</h1><button class="sk-new" data-act="sknews"><i></i>What\u2019s new?</button></div>' +
      '<div class="sk-log" id="sklog"></div>' +
      '<div class="sk-sug" id="sksug">' + sugg.map(function (x) { return '<button class="sk-s">' + esc(x) + "</button>"; }).join("") + "</div>" +
      '<div class="sk-bar"><input id="skq" placeholder="Ask anything..." autocomplete="off" enterkeyhint="send"><button class="sk-plus" aria-label="Attach">' + ic("plus") + '</button><button class="sk-go" id="skgo" aria-label="Voice"><span class="wave"><i></i><i></i><i></i><i></i></span></button></div></div>';
    var el = page(body, { cls: "sidekick", title: "New conversation", titleChev: true, notabs: true, actions: '<button class="nb-c" data-act="sknew" aria-label="Private chat">' + ic("view") + "</button>" });
    var log = $("#sklog", el), qi = $("#skq", el), go = $("#skgo", el);
    function ask(q) {
      if (!q) return;
      $("#sksug", el).classList.add("gone"); $("#skhi", el).classList.add("gone");
      log.insertAdjacentHTML("beforeend", '<div class="sk-u">' + esc(q) + "</div>");
      var b = document.createElement("div"); b.className = "sk-a typing"; b.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(b);
      var pb = $(".pg-b", el); pb.scrollTop = pb.scrollHeight;
      setTimeout(function () {
        var txt = skAnswer(q), k = 0; if (window.I18N) txt = window.I18N.tr(txt); skThread.push({ q: q, a: txt }); b.classList.remove("typing"); b.textContent = "";
        var timer = setInterval(function () {
          k += 2 + Math.floor(Math.random() * 3); b.textContent = txt.slice(0, k); pb.scrollTop = pb.scrollHeight;
          if (k >= txt.length) { clearInterval(timer); b.insertAdjacentHTML("afterend", '<div class="sk-fb"><button aria-label="Good response">' + ic("thumb-up") + '</button><button aria-label="Bad response">' + ic("thumb-down") + "</button></div>"); }
        }, 22);
      }, 1100);
    }
    function sync() { var has = !!qi.value.trim(); go.classList.toggle("send", has); go.innerHTML = has ? ic("arrow-up") : '<span class="wave"><i></i><i></i><i></i><i></i></span>'; }
    $$(".sk-s", el).forEach(function (x) { x.addEventListener("click", function () { hap(5); ask(x.textContent); }); });
    qi.addEventListener("input", sync);
    qi.addEventListener("keydown", function (e) { if (e.key === "Enter") { ask(qi.value.trim()); qi.value = ""; sync(); } });
    go.addEventListener("click", function () { if (qi.value.trim()) { ask(qi.value.trim()); qi.value = ""; sync(); } else toast("Listening\u2026"); });
    if (replay && replay.length) {
      $("#sksug", el).classList.add("gone"); $("#skhi", el).classList.add("gone");
      replay.forEach(function (m) { log.insertAdjacentHTML("beforeend", '<div class="sk-u">' + esc(m.q) + '</div><div class="sk-a">' + esc(m.a) + "</div>"); });
    }
    if (first) setTimeout(function () { ask(first); }, 480);
  }
  /* Sidekick : barre flottante au-dessus du clavier (bouton droit de la barre d'onglets) */
  var skEl = null;
  function openSidekick() {
    if (skEl) return;
    var el = document.createElement("div");
    el.className = "sk-ov" + (skThread.length ? " has-thread" : "");
    el.innerHTML = '<div class="sk-ov-scrim" data-skclose></div><div class="sk-ov-dock">' +
      '<span class="sk-grab"></span><div class="sk-ans" id="skov-ans"></div>' +
      '<div class="sk-ov-top"><button class="sk-glass sk-hist" data-skhist>' + ic("recent") + "<span>Chat history</span></button>" +
      '<button class="sk-glass sk-circ sk-opts" data-skopts aria-label="Options">' + ic("filter") + "</button></div>" +
      '<button class="sk-glass sk-chev" data-skexpand aria-label="Expand">' + ic("chev-down") + "</button>" +
      '<div class="sk-ov-row"><div class="sk-glass sk-card"><input id="skov-q" placeholder="Work with Sidekick" autocomplete="off" enterkeyhint="send">' +
      '<div class="sk-card-bar"><span class="sk-face">' + mascot() + '</span><span class="sk-fill"></span>' +
      '<button class="sk-ib" data-skplus aria-label="Attach">' + ic("plus") + '</button><button class="sk-ib" id="skov-go" aria-label="Voice">' + ic("mic") + "</button></div>" +
      '<div class="sk-think"><span class="sk-face">' + mascot() + '</span><span class="sk-thinking">Thinking</span><span class="sk-fill"></span>' +
      '<button class="sk-ib" data-skplus aria-label="Attach">' + ic("plus") + '</button><button class="sk-ib sk-stop" data-skstop aria-label="Stop"><i></i></button></div></div>' +
      '<button class="sk-glass sk-circ sk-x" data-skclose aria-label="Close">' + ic("x") + "</button></div></div>";
    app.appendChild(el);
    skEl = el;
    $("#tabbar").classList.add("hide");
    try { history.pushState({ sk: 1 }, ""); } catch (e) { }
    var qi = $("#skov-q", el), go = $("#skov-go", el), ans = $("#skov-ans", el), timer = null, typer = null;
    function sync() { var has = !!qi.value.trim(); go.classList.toggle("send", has); go.innerHTML = has ? ic("arrow-up") : ic("mic"); }
    function reset() { clearTimeout(timer); clearInterval(typer); el.classList.remove("thinking", "answered"); }
    function send() {
      var q = qi.value.trim(); if (!q) return;
      hap(5); reset(); qi.value = ""; sync(); qi.blur();
      el.classList.add("thinking");
      timer = setTimeout(function () {
        var txt = skAnswer(q), k = 0; if (window.I18N) txt = window.I18N.tr(txt);
        skThread.push({ q: q, a: txt });
        el.classList.remove("thinking"); el.classList.add("answered", "has-thread"); ans.textContent = "";
        typer = setInterval(function () { k += 2 + Math.floor(Math.random() * 3); ans.textContent = txt.slice(0, k); if (k >= txt.length) clearInterval(typer); }, 22);
      }, 1700);
    }
    qi.addEventListener("input", sync);
    qi.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    go.addEventListener("click", function () { if (qi.value.trim()) send(); else toast("Listening\u2026"); });
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-skclose],[data-skhist],[data-skopts],[data-skplus],[data-skstop],[data-skexpand]");
      if (!t) return;
      if (t.hasAttribute("data-skclose")) { hap(4); return closeSidekick(); }
      if (t.hasAttribute("data-skstop")) { hap(4); reset(); return setTimeout(function () { try { qi.focus({ preventScroll: true }); } catch (er) { } }, 80); }
      if (t.hasAttribute("data-skexpand")) { hap(5); closeSidekick(); return setTimeout(function () { openSidekickChat(null, skThread); }, 360); }
      if (t.hasAttribute("data-skhist")) { hap(4); return toast("No previous chats"); }
      if (t.hasAttribute("data-skopts")) { hap(4); return toast("Private chat"); }
      if (t.hasAttribute("data-skplus")) { hap(4); return toast("Attachments are not available yet"); }
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    setTimeout(function () { try { qi.focus({ preventScroll: true }); } catch (e) { } }, 120);
  }
  function closeSidekick(fromHistory) {
    if (!skEl) return;
    var el = skEl; skEl = null;
    try { var ae = document.activeElement; if (ae && ae.blur) ae.blur(); } catch (e) { }
    el.classList.remove("on");
    $("#tabbar").classList.toggle("hide", !!(stack.length && noTabs(stack[stack.length - 1].el)));
    if (!fromHistory) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
    setTimeout(function () { el.remove(); }, 340);
  }
  // Sidekick's mascot: white face, navy hair, purple mask.
  function mascot() {
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#f4f1ff"/><path d="M8 17c0-7 5.5-11 12-11s12 4 12 11v3H8z" fill="#1e2a5a"/><ellipse cx="20" cy="23" rx="11.5" ry="11" fill="#fff"/><path d="M8.5 20.5h23v6.5H8.5z" fill="#6e3ff3" rx="3"/><circle cx="15" cy="23.6" r="2.6" fill="#fff"/><circle cx="25" cy="23.6" r="2.6" fill="#fff"/><circle cx="15.4" cy="23.8" r="1.2" fill="#1e2a5a"/><circle cx="25.4" cy="23.8" r="1.2" fill="#1e2a5a"/><path d="M17 29.5c1.8 1.3 4.2 1.3 6 0" stroke="#1e2a5a" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';
  }

  /* ── Live orders ─────────────────────────────────────────── */
  var audio = null, audioOk = false;
  function unlockAudio() {
    if (audioOk) return;
    try { audio = new Audio(A + "/cha-ching.wav"); audio.volume = 0.8; audio.load(); audioOk = true; } catch (e) { }
  }
  ["touchstart", "mousedown", "keydown"].forEach(function (ev) { window.addEventListener(ev, unlockAudio, { once: true, passive: true }); });
  function chaChing() { if (!audioOk || !audio) return; try { audio.currentTime = 0; var p = audio.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
  function setBell() { var b = $("#nb"); if (!b) return; b.textContent = unread > 99 ? "99+" : unread; b.hidden = !unread; }
  function weighted(list) { var t = list.reduce(function (a, x) { return a + x[1]; }, 0), r = Math.random() * t; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return list[i][0]; } return list[0][0]; }
  function sellable() { return prods.filter(function (p) { return p.status === "Active" && p.inv > 0; }); }
  function userLines(pool) {
    pool = pool || prods;
    var total = pool.reduce(function (a, p) { return a + (p.share > 0 ? p.share : 1); }, 0);
    function pick() {
      var r = Math.random() * total;
      for (var i = 0; i < pool.length; i++) { r -= pool[i].share > 0 ? pool[i].share : 1; if (r <= 0) return pool[i]; }
      return pool[pool.length - 1];
    }
    var n = Math.random() < 0.22 && pool.length > 1 ? 2 : 1, lines = [], used = {};
    for (var k = 0; k < n; k++) {
      var p = pick();
      if (used[p.title]) continue;
      used[p.title] = 1;
      lines.push([p, weighted([[1, 62], [2, 26], [3, 12]])]);
    }
    return lines;
  }
  function freshOrder(o, ts) {
    o.ts = ts; o.n = orders[0] ? orders[0].n + 1 : S.lastN + 1;
    o.ful = "Unfulfilled"; o.pay = Math.random() < 0.05 ? "Authorized" : "Paid"; o.fat = 0; o.carrier = ""; o.trk = ""; o.refunded = 0; o.archived = false; o.note = "";
    return o;
  }
  function makeOrder(lines, ts, srcIdx) {
    var src = P.ord[srcIdx != null ? srcIdx : Math.floor(Math.random() * Math.min(P.ord.length, 60))];
    if (!src) return null;
    var o = mkOrder(src);
    if (lines && lines.length) {
      var ratio = (src[4] - src[5]) > 0 ? src[9] / (src[4] - src[5]) : 0;
      o.items = lines.map(function (l) { return { p: l[0], q: l[1], price: l[0].price }; });
      o.sub = o.items.reduce(function (a, x) { return a + x.price * x.q; }, 0);
      o.disc = 0; o.code = "";
      o.tax = Math.round(o.sub * ratio);
      o.total = o.sub + o.ship + o.tax;
    }
    return freshOrder(o, ts);
  }
  function commitOrder(o, quiet) {
    // A fresh shopper most of the time.
    var pool = custs.slice(0, 40);
    o.c = Math.random() < 0.7 || !pool.length ? newCustomer() : pool[Math.floor(Math.random() * pool.length)];
    o.c.n += 1; o.c.spent += o.total;
    o.ch = weighted([["Online Store", 74], ["Shop", 10], ["Instagram", 5], ["TikTok", 5], ["Facebook", 3], ["Google & YouTube", 3]]);
    orders.unshift(o);
    // The numbers move with it.
    var h = L(o.ts).getUTCHours();
    D.s[T] += o.total; D.o[T] += 1; D.g[T] += o.sub; D.dc[T] += o.disc; D.sh[T] += o.ship; D.tx[T] += o.tax; D.u[T] += units(o);
    var addSe = 1 + Math.floor(Math.random() * 3); D.se[T] += addSe;
    pend.sales += o.total / Math.pow(10, S.dec != null ? S.dec : 2); pend.orders += 1; pend.sess += addSe;
    HR.t[0][h] += o.total; HR.t[1][h] += 1; HR.t[2][h] += 1;
    live.purchased += 1;
    creditOrder(o);
    if (live.visitors < 2) live.visitors = 2 + Math.floor(Math.random() * 4);   // someone is on the store when an order lands
    o.items.forEach(function (x) { if (x.p && x.p.i >= 0) { x.p.inv = Math.max(0, x.p.inv - x.q); x.p.sold += x.q; } });
    if (quiet) return;
    notifs.unshift({ kind: "order", o: o, ts: o.ts, read: false });
    unread += 1; setBell();
    // The owner can switch the pop-ups off; the order still lands quietly.
    if (S.pops !== false) {
      nativeOrderPush(o);
      if (!window.__CHECKER_NATIVE__) chaChing();
      hap([12, 40, 12]);
    }
    bumpHome(o);
    if (current === "orders" && !stack.length) {
      var list = $("#olist");
      if (list && orderMatches(o)) { renderOrders(); var row = $('[data-order="' + o.n + '"]', $("#s-orders")); if (row) row.classList.add("fresh"); }
    } else rendered.orders = 0;
    if (current === "products" && !stack.length) rendered.products = 0;
  }
  function newOrder() {
    // No products in the store => nobody can buy anything: never fall back to the demo products.
    if (!prods.length) return;
    var pool = sellable();
    if (!pool.length) return;            // everything is a draft or sold out: nothing to buy
    var lines = userLines(pool);
    var o = makeOrder(lines, nowMs());
    if (o) commitOrder(o, false);
  }
  // Fake orders queued in Preferences are created once, silently, when the app opens.
  function consumeQueue() {
    var cfg = savedSettingsObj(), q = cfg.__queue;
    if (!Array.isArray(q) || !q.length) return;
    if (!prods.length) { delete cfg.__queue; writeSettings(cfg); return; }   // no products: nothing to queue
    delete cfg.__queue;            // clear first so a crash can never replay it
    writeSettings(cfg);
    var jobs = [];
    q.forEach(function (it) {
      var p = it.title && it.title !== "*" ? prods.filter(function (x) { return x.title === it.title; })[0] || null : null;
      var times = Math.max(1, Math.min(500, Math.round(Number(it.times) || 1))), qty = Math.max(1, Math.min(999, Math.round(Number(it.qty) || 1)));
      for (var k = 0; k < times; k++) jobs.push([p, qty]);
    });
    if (!jobs.length) return;
    var now = nowMs(), d = L(now);
    var sinceMidnight = d.getUTCHours() * HOUR + d.getUTCMinutes() * 60000 + d.getUTCSeconds() * 1000;
    var span = Math.max(60000, Math.min(2 * HOUR, sinceMidnight));
    var stamps = jobs.map(function () { return now - Math.random() * span; }).sort(function (a, b) { return a - b; });
    jobs.forEach(function (j, k) {
      var p = j[0] || userLines(sellable().length ? sellable() : prods)[0][0];
      var o = makeOrder([[p, j[1]]], stamps[k]);
      if (o) commitOrder(o, true);
    });
    saveState();
  }
  /* ── Orders while the app is closed ─────────────────────────
     iOS freezes the page in the background, so those orders are planned in advance: each one becomes a local
     notification (native side, with the cha-ching sound) AND a spec saved in the settings (__bg). When the app
     opens again, the orders whose time has passed are created for real with the same number and amount. */
  var BG_PACE = { exploding: [45, 10, 150], growing: [600, 90, 1500], steady: [1500, 300, 3600], declining: [2400, 600, 5400], newstore: [3600, 900, 7200], highrisk: [700, 60, 3000] };   // [mean, min, max] seconds between orders
  var lastPlan = 0;
  function nativeBg(items) {
    try { window.webkit.messageHandlers.shopifySchedule.postMessage({ items: items }); return true; } catch (e) { return false; }
  }
  function planBg() {
    if (Date.now() - lastPlan < 3000) return;
    lastPlan = Date.now();
    try {
      var cfg = savedSettingsObj(), pool = prods.length ? sellable() : [];
      if (S.pops === false || !pool.length) { if (cfg.__bg) { delete cfg.__bg; writeSettings(cfg); } nativeBg([]); return; }
      var vibe = larpVibe(), pc = BG_PACE[vibe] || BG_PACE.growing;
      var base = orders[0] ? orders[0].n : S.lastN, at = Date.now() + (vibe === "exploding" ? 12 + Math.random() * 20 : 25 + Math.random() * 50) * 1000;
      var specs = [], items = [];
      for (var i = 0; i < 60; i++) {
        var lines = userLines(pool), idx = Math.floor(Math.random() * Math.min(P.ord.length, 60));
        var o = makeOrder(lines, 0, idx); if (!o) break;
        o.n = base + 1 + i;
        o.ch = weighted([["Online Store", 74], ["Shop", 10], ["Instagram", 5], ["TikTok", 5], ["Facebook", 3], ["Google & YouTube", 3]]);
        specs.push({ at: Math.round(at), n: o.n, src: idx, lines: lines.map(function (l) { return [l[0].title, l[1]]; }), pay: o.pay, ch: o.ch });
        items.push({ at: Math.round(at), title: L10n("Order #" + o.n), body: L10n(pushBody(o)) });
        at += 1000 * Math.min(pc[2], Math.max(pc[1], -Math.log(1 - Math.random()) * pc[0]));
      }
      cfg.__bg = specs; writeSettings(cfg);
      nativeBg(items);
    } catch (e) { }
  }
  function consumeBg(resumed) {
    var cfg = savedSettingsObj(), q = cfg.__bg;
    if (!Array.isArray(q) || !q.length) return;
    delete cfg.__bg;                 // clear first so it can never replay twice
    writeSettings(cfg);
    nativeBg([]);                    // whatever has not fired yet is cancelled: the live page takes over again
    lastPlan = 0;
    var now = Date.now(), done = 0;
    q.filter(function (sp) { return sp.at <= now; }).sort(function (a, b) { return a.at - b.at; }).forEach(function (sp) {
      if (orders.some(function (x) { return x.n === sp.n; })) return;
      var lines = (sp.lines || []).map(function (l) { var p = prods.filter(function (x) { return x.title === l[0]; })[0]; return p ? [p, l[1]] : null; }).filter(Boolean);
      if (!lines.length) return;
      var o = makeOrder(lines, nowMs() - (now - sp.at), sp.src);
      if (!o) return;
      o.n = sp.n; if (sp.pay) o.pay = sp.pay;
      commitOrder(o, true);
      if (sp.ch) o.ch = sp.ch;
      notifs.unshift({ kind: "order", o: o, ts: o.ts, read: false }); unread += 1;
      done++;
    });
    if (!done) return;
    setBell(); saveState();
    if (resumed) {
      hap("success");
      ["home", "orders", "products", "menu"].forEach(function (k) { rendered[k] = 0; });
      if (!stack.length && RENDER[current]) { RENDER[current](); rendered[current] = 1; }
    }
  }
  window.__larpPlanBg = planBg;
  window.__larpConsumeBg = function () { consumeBg(true); };
  document.addEventListener("visibilitychange", function () { if (document.hidden) planBg(); else consumeBg(true); });
  var FN = ["Ava", "Liam", "Mia", "Noah", "Zoe", "Ethan", "Chloe", "Lucas", "Isla", "Mason", "Aria", "Leo", "Nora", "Kai", "Ruby", "Owen", "Maya", "Eli"];
  var LN = ["Turner", "Brooks", "Reed", "Price", "Ward", "Hayes", "Ross", "Cole", "Gray", "James", "Bell", "Ortiz", "Diaz", "Long", "Patel", "Kim", "Nguyen", "Shah"];
  function newCustomer() {
    var f = FN[Math.floor(Math.random() * FN.length)], l = LN[Math.floor(Math.random() * LN.length)];
    var src = custs[Math.floor(Math.random() * custs.length)] || { city: "Austin", region: "TX" };
    var c = { name: f + " " + l, email: (f + "." + l).toLowerCase() + Math.floor(Math.random() * 90 + 10) + "@gmail.com", phone: "", city: src.city, region: src.region, ts: nowMs(), n: 0, spent: 0, sub: Math.random() < 0.6, tags: [] };
    custs.unshift(c);
    S.custTotal = (S.custTotal || 0) + 1;
    pend.cust += 1;
    return c;
  }
  function bumpHome(o) {
    if (!$("#s-home").innerHTML) return;
    var R = rangeData(homeRange);
    if (homeRange === "yday") return;
    $$(".met.on .mv").forEach(function (mv) {
      var M = MET[homeMet], to = M.v(R.tot);
      var from = M.v({ s: R.tot.s - o.total, o: R.tot.o - 1, se: R.tot.se - 1, rc: 0 });
      mv.parentNode.parentNode.classList.add("bump");
      setTimeout(function () { mv.parentNode.parentNode.classList.remove("bump"); }, 700);
      countTo(mv, from, to, function (x) { return fmtMet(M.k, x, true); }, 1100);
    });
    $$(".met[data-met]:not(.on) .mv").forEach(function (el) { var k = el.closest(".met").getAttribute("data-met"); el.textContent = fmtMet(MET[k].k, MET[k].v(R.tot), true); });
    var host = $("#hchart");
    if (host && host._g) drawChart(host, R, homeMet, { h: CH });
    var acts = $(".act[data-act=fulfill] b"); if (acts) { var u = unfulfilled().length; acts.textContent = u > 50 ? "50+" : u; }
  }
  function banner(o) {
    var b = document.createElement("button");
    b.className = "bn";
    b.setAttribute("data-order", o.n);
    b.innerHTML = '<span class="napp">' + ic("bag-color") + '</span><div><div class="nr1"><b>Order #' + o.n + '</b><em>now</em></div><span>' + esc(pushBody(o)) + "</span></div>";
    bannerEl.appendChild(b);
    requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.add("on"); }); });
    var y0 = null;
    b.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    b.addEventListener("touchmove", function (e) { if (y0 === null) return; var dy = Math.min(0, e.touches[0].clientY - y0); b.style.transition = "none"; b.style.transform = "translateY(" + dy + "px)"; }, { passive: true });
    b.addEventListener("touchend", function (e) { if (y0 === null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; b.style.transition = ""; b.style.transform = ""; if (dy < -30) gone(); });
    var gone = function () { b.classList.remove("on"); b.classList.add("out"); setTimeout(function () { b.remove(); }, 450); };
    setTimeout(gone, 5200);
  }
  function larpVibe() {
    var vibe = S.vibe;
    if (!vibe) { try { vibe = (readCfgFresh() || {}).vibe; } catch (e) { } }
    return vibe;
  }
  function scheduleOrder(first) {
    // EXPLODING = spam mode: an order every 0.6-3 s, often in bursts of 1-3.
    if (larpVibe() === "exploding") {
      var w = first ? 1 : 0.6 + Math.random() * 2.4;
      setTimeout(function () {
        if (!document.hidden) {
          var n = 1 + Math.floor(Math.random() * 3);
          for (var i = 0; i < n; i++) newOrder();
        }
        scheduleOrder(false);
      }, w * 1000);
      return;
    }
    // Other vibes: each one has its own pace, independent of the (possibly empty) history, so orders keep coming.
    //   mean  = average seconds between orders        min = never faster than this
    //   max   = never wait longer than this (no long dead silences)
    //   burst = chance that an order arrives together with 1-2 more (shoppers rarely arrive one by one)
    var PACE = {
      newstore: { mean: 75, min: 12, max: 180, burst: 0.05 },
      declining: { mean: 50, min: 10, max: 150, burst: 0.08 },
      steady: { mean: 32, min: 8, max: 100, burst: 0.12 },
      growing: { mean: 20, min: 5, max: 70, burst: 0.18 }
    };
    var vibe = larpVibe(), wait, burstN = 1;
    if (first) {
      wait = 4 + Math.random() * 4;                       // the first order shows up within seconds
    } else if (vibe === "highrisk") {
      // Choppy: flurries of fast orders, then quiet stretches.
      if (Math.random() < 0.35) { wait = 2 + Math.random() * 4; burstN = 1 + Math.floor(Math.random() * 2); }
      else wait = 28 + Math.random() * 45;
    } else {
      var pc = PACE[vibe] || PACE.growing;
      wait = Math.min(pc.max, Math.max(pc.min, -Math.log(1 - Math.random()) * pc.mean));
      if (Math.random() < pc.burst) burstN = 2 + Math.floor(Math.random() * 2);
    }
    setTimeout(function () {
      if (!document.hidden) { for (var i = 0; i < burstN; i++) newOrder(); }
      scheduleOrder(false);
    }, wait * 1000);
  }
  // Visitors right now drift a little (EXPLODING: they climb fast, every ~1.2 s).
  function showVisitors() {
    var a = $("#liveN"); if (a) { a.textContent = count(live.visitors); a.parentNode.classList.add("tick"); setTimeout(function () { a.parentNode.classList.remove("tick"); }, 400); }
    var b = $("#lvN"); if (b) b.textContent = count(live.visitors);
  }
  setInterval(function () {
    var v = live.visitors;
    if (v <= 0 && larpVibe() !== "exploding") return;
    if (larpVibe() === "exploding") {
      // 88% up (+3 to +3+6% of current), 12% small dip -> strong upward trend
      if (Math.random() < 0.88) live.visitors = v + 3 + Math.ceil(Math.random() * (3 + v * 0.06));
      else live.visitors = Math.max(1, v - Math.ceil(Math.random() * Math.max(2, v * 0.02)));
      showVisitors();
      return;
    }
    var d = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.55) return;
    live.visitors = Math.max(1, v + d * (v > 40 ? Math.ceil(Math.random() * v * 0.04) : 1));
    showVisitors();
  }, 1200);

  /* ── Actions ─────────────────────────────────────────────── */
  function copyText(s) { try { navigator.clipboard.writeText(s); } catch (e) { } toast("Copied"); }
  var SOON = { growth: "Growth", discounts: "Discounts", content: "Content", markets: "Markets", onlinestore: "Online Store", pos: "Point of Sale", shop: "Shop", social: "Facebook & Instagram", apps: "Apps", settings: "Settings", help: "Help Center", finance: "Finance" };
  document.addEventListener("click", function (e) {
    if (Date.now() - lpAt < 700) { e.preventDefault(); e.stopPropagation(); return; }
    var t = e.target.closest("button, [data-act], [data-order], [data-prod], [data-cust]");
    if (!t) return;
    if (t.hasAttribute("data-order") && !t.hasAttribute("data-act")) { hap(5); if (t.classList.contains("bn")) { t.classList.remove("on"); t.classList.add("out"); } closeSheets(); return openOrder(+t.getAttribute("data-order")); }
    if (t.hasAttribute("data-prod")) { if (pSel) return toggleSel(+t.getAttribute("data-prod")); hap(5); return openProduct(+t.getAttribute("data-prod")); }
    if (t.hasAttribute("data-cust")) { hap(5); return openCustomer(+t.getAttribute("data-cust")); }
    if (t.hasAttribute("data-fulfill")) { hap(8); return fulfillFlow(+t.getAttribute("data-fulfill")); }
    if (t.hasAttribute("data-capture")) { hap(8); return capture(+t.getAttribute("data-capture")); }
    if (t.hasAttribute("data-markpaid")) { var mo = findOrder(+t.getAttribute("data-markpaid")); if (mo) { mo.pay = "Paid"; creditOrder(mo); hap(10); pop(false); setTimeout(function () { openOrder(mo.n); toast("Order marked as paid"); }, 60); } return; }
    if (t.hasAttribute("data-pulse")) {
      var k = t.getAttribute("data-pulse");
      if (k === "inventory") { setTab("products", true); return; }
      if (k === "analytics") return openAnalytics();
      return toast("Sidekick is working on it");
    }
    if (t.hasAttribute("data-copy")) { var pg = t.closest(".page, .sh-wrap"); var p = pg ? $(".addr p", pg) : null; return copyText(p ? p.innerText : ""); }
    var a = t.getAttribute("data-act");
    if (!a) return;
    hap(5);
    if (a.indexOf("soon:") === 0) { var nm = a.slice(5); return page('<div class="soon">' + ic("apps") + "<b>" + esc(nm) + "</b><span>" + esc(nm) + " for " + esc(S.name) + ".</span></div>", { title: nm }); }
    switch (a) {
      case "search": return openSearch();
      case "sidekick": return openSidekick();
      case "notifs": return openNotifs();
      case "liveview": return openLiveView();
      case "payouts": return openPayouts();
      case "transfer": return openTransfer();
      case "analytics": return openAnalytics();
      case "customers": return openCustomers();
      case "fulfill": closeAll(); oFilter = "Unfulfilled"; oShown = 40; setTab("orders"); return;
      case "capture": closeAll(); oFilter = "Unpaid"; oShown = 40; setTab("orders"); return;
      case "inventory": closeAll(); pFilter = "All"; setTab("products"); return;
      case "range": return rangeSheet();
      case "anrange": return optSheet("Date range", RANGES.map(function (r) { return r[1]; }), rangeLabel(anRange), function (v) {
        RANGES.forEach(function (r) { if (r[1] === v) anRange = r[0]; });
        drawAnalytics($("#s-menu"));
      });
      case "stores": return storePop();
      case "mvswitch": return optSheet(MV[menuView] || "Menu", menuView === "analytics" ? ["Analytics", "Reports", "Live View"] : [MV[menuView] || "Menu"], MV[menuView], function (v) { if (v === "Live View") openLiveView(); else if (v === "Reports") toast("Reports"); });
      case "prodsmore": return actionsSheet();
      case "selexit": return exitSelect();
      case "seldel": return confirmDelete();
      case "selmore": return selMoreSheet();
      case "ancompare": return optSheet("Compare to", ["Previous period", "Previous year", "No comparison"], "Previous period", function () { });
      case "ancur": return optSheet("Currency", [S.tag || S.cur + " " + S.sym.trim()], S.tag || S.cur + " " + S.sym.trim(), function () { });
      case "account": return acctPop();
      case "account-old": return sheet("", '<div class="acct"><span class="av lg">' + ic("person") + "</span><b>" + esc(S.name) + ' owner</b><span class="muted">' + esc(S.handle) + '.myshopify.com</span><div class="mgroup">' + [["Manage account", "person", ""], ["Notifications", "bell", ""], ["Preferences", "settings", "larp-prefs"], ["Log out", "exit", ""]].map(function (r) { var act = r[2] ? ' data-act="' + r[2] + '"' : ""; return '<button class="mrow"' + act + ">" + ic(r[1]) + "<span>" + r[0] + "</span>" + ic("chev-right", "chev") + "</button>"; }).join("") + "</div></div>");
      case "larp-prefs": closeSheets(); closeAll(); location.href = "./editor.html"; return;
      case "locations": return optSheet("Location", ["All locations", "Shop location", "Warehouse"], "All locations", function () { });
      case "sort": return optSheet("Sort by", ["Date (newest first)", "Date (oldest first)", "Order number", "Total price"], "Date (newest first)", function () { });
      case "ofilter": return optSheet("Filter orders", ["All", "Unfulfilled", "Unpaid", "Open", "Archived"], oFilter, function (v) { oFilter = v; renderOrders(); });
      case "pfilter": return optSheet("Filter products", ["All", "Active", "Draft", "Archived"], pFilter, function (v) { pFilter = v; renderProducts(); });
      case "prodviews": return optSheet("Products", ["Products", "Collections", "Inventory", "Purchase orders", "Transfers", "Gift cards"], "Products", function (v) { if (v !== "Products") toast(v + " opens on the full admin"); });
      case "neworder": return optSheet("Create", ["Create order", "Create draft order"], "", function (v) { toast(v + " started"); });
      case "newproduct": return openNewProduct();
      case "discover": return toast("Product sourcing opens on the full admin");
      case "trial": return toast("Choose a plan on the full admin");
      case "sampleproduct":
        hap(8);
        createProduct({ title: "Sample product", price: 29, compare: 0, inv: 25, vars: "", type: "General", status: "Active", img: "" });
        pFilter = "All"; pQuery = ""; rendered.products = 0; renderProducts();
        return toast("Sample product added");
      case "scan": return toast("Camera access is needed to scan barcodes");
      case "print": return toast("Preparing packing slip…");
      case "track": return toast("Opening tracking…");
      case "email": case "phone": var pgc = t.closest(".page, .sh-wrap"); var on = pgc ? findOrder(+pgc.getAttribute("data-on")) : null; return toast(on && on.c ? (a === "email" ? on.c.email : on.c.phone || "No phone number") : "No contact details");
      case "ordermore": case "prodmore": case "custmore": return optSheet("More actions", a === "prodmore" ? ["Duplicate", "Archive product", "View on Online Store"] : a === "custmore" ? ["Edit customer", "Send account invite"] : ["Edit order", "Refund", "Print packing slip", "Archive"], "", function (v) { toast(v); });
      case "notifsettings": return toast("Notification settings");
      case "quicksale": return quickSale();
      case "sknew": return toast("Private mode on");
      case "sknews": return toast("Sidekick can now edit your theme from your phone");
      case "addchannel": return toast("Add a sales channel");
      default:
        if (a === "finance") return openPayouts();
        if (SOON[a]) return page('<div class="soon">' + ic({ pos: "pos", onlinestore: "store", growth: "marketing", discounts: "discount", content: "content", help: "help", apps: "apps", markets: "globe", shop: "shop", social: "channels" }[a] || "settings") + "<b>" + esc(SOON[a]) + "</b><span>Manage " + esc(SOON[a].toLowerCase()) + " for " + esc(S.name) + ".</span></div>", { title: SOON[a] });
    }
  });
  function quickSale() {
    var amt = "0";
    var el = page('<div class="qs"><div class="qs-amt" id="qsa">' + S.sym + '0</div><p class="qs-s">Custom amount</p><div class="qs-pad">' +
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "\u232b"].map(function (k) { return '<button data-k="' + k + '">' + k + "</button>"; }).join("") +
      '</div><button class="btn-p" id="qsgo">Charge ' + S.sym + "0.00</button></div>", { title: "Quick sale", modal: true, notabs: true });
    var show = function () { var v = parseFloat(amt) || 0; $("#qsa", el).textContent = S.sym + (amt.indexOf(".") >= 0 ? amt : Number(amt).toLocaleString(S.loc || "en-US")); $("#qsgo", el).textContent = "Charge " + money(Math.round(v * 100)); };
    $$("[data-k]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-k"); hap(4);
        if (k === "\u232b") amt = amt.length > 1 ? amt.slice(0, -1) : "0";
        else if (k === ".") { if (amt.indexOf(".") < 0) amt += "."; }
        else if (!(amt.split(".")[1] && amt.split(".")[1].length >= 2) && amt.replace(".", "").length < 7) amt = amt === "0" ? k : amt + k;
        var a2 = $("#qsa", el); a2.classList.remove("pop"); void a2.offsetWidth; a2.classList.add("pop");
        show();
      });
    });
    $("#qsgo", el).addEventListener("click", function () { if (!(parseFloat(amt) > 0)) return toast("Enter an amount"); toast("Hold the card near the top of your phone"); });
  }
  // Tapping the store name drops a card from the top: the store, Add store, Edit store.
  function storePop() {
    var el = document.createElement("div");
    el.className = "spop";
    el.innerHTML = '<div class="sp-scrim"></div><div class="sp-card"><div class="sp-r on">' + logoTile(true) + "<div><b>" + esc(S.name) + "</b><span>" + esc(S.handle) + ".myshopify.com</span></div></div>" +
      '<button class="sp-r">' + ic("plus-circle") + "<span>Add store</span></button><button class=\"sp-r\" data-edit-store>" + ic("edit") + "<span>Edit store</span></button></div>";
    app.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".sp-r");
      var edit = b && b.hasAttribute("data-edit-store");
      if (b && !b.classList.contains("on") && !edit) toast(b.textContent);
      el.classList.remove("on"); setTimeout(function () { el.remove(); }, 300);
      if (edit) setTimeout(openEditStore, 120);
    });
  }

  // Profile (first name, last name, email, phone, photo) lives in the saved settings.
  function profileOf(cfg) {
    cfg = cfg || savedSettingsObj();
    var first = cfg.accountFirst, last = cfg.accountLast;
    if (first == null && last == null) {
      if (cfg.accountName) { var parts = String(cfg.accountName).split(/\s+/); first = parts.shift() || ""; last = parts.join(" "); }
      else { first = "Malo"; last = "Laboussole"; }
    }
    return { first: first || "", last: last || "", email: cfg.accountEmail != null ? cfg.accountEmail : "m.laboussole@icloud.com", phone: cfg.accountPhone || "", photo: cfg.accountPhoto || "" };
  }
  function avHTML() { var pr = profileOf(); return pr.photo ? '<img src="' + esc(pr.photo) + '" alt="">' : ic("person"); }
  // Tapping the profile photo (top left): account card, Add account, and "..." with Profile + Preferences.
  function acctPop() {
    var pr = profileOf(), nm = (pr.first + " " + pr.last).trim() || "Mon compte";
    var el = document.createElement("div");
    el.className = "spop acpop";
    el.innerHTML = '<div class="sp-scrim"></div><div class="sp-card ac-card"><div class="ac-r on"><span class="av">' + avHTML() + '</span><div class="ac-t"><b>' + esc(nm) + "</b><span>" + esc(pr.email) + '</span></div>' +
      '<button type="button" class="ac-more" aria-label="Plus" aria-haspopup="true">' + ic("more") + '</button></div>' +
      '<button type="button" class="ac-r ac-add">' + ic("plus-circle") + "<b>Ajouter un compte</b></button>" +
      '<div class="ac-menu" hidden><button type="button" class="ac-pref" data-go="profile">' + ic("person") + "<span>Modifier le profil</span></button>" +
      '<button type="button" class="ac-pref" data-go="prefs">' + ic("settings") + "<span>Préférences</span></button>" +
      '<button type="button" class="ac-pref" data-go="lang">' + ic("globe") + "<span>Language</span></button></div></div>";
    app.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    function close() { el.classList.remove("on"); setTimeout(function () { el.remove(); }, 300); }
    el.addEventListener("click", function (e) {
      var menu = $(".ac-menu", el);
      if (e.target.closest(".ac-more")) { menu.hidden = !menu.hidden; hap(4); return; }
      var it = e.target.closest(".ac-pref");
      if (it) {
        close();
        if (it.getAttribute("data-go") === "profile") setTimeout(openEditProfile, 120);
        else if (it.getAttribute("data-go") === "lang") setTimeout(openLang, 120);
        else setTimeout(function () { closeSheets(); closeAll(); location.href = "./editor.html"; }, 180);
        return;
      }
      if (e.target.closest(".ac-menu")) return;
      if (!menu.hidden && !e.target.closest(".ac-r")) { menu.hidden = true; return; }
      if (e.target.closest(".ac-add")) toast("Ajouter un compte");
      close();
    });
  }
  // Language picker: the whole app is translated on the fly by i18n.js, so switching is instant.
  function openLang() {
    if (!window.I18N) return;
    var cur = window.I18N.lang;
    var el = sheet("Language", '<div class="opts">' + window.I18N.langs.map(function (l) {
      return '<button class="opt" data-lang="' + l.code + '" data-no-i18n><span>' + esc(l.name) + "</span>" + (l.code === cur ? ic("check", "ck") : "") + "</button>";
    }).join("") + "</div>");
    $$(".opt", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var code = b.getAttribute("data-lang"); hap(6); pop(false);
        setTimeout(function () { window.I18N.set(code); }, 180);
      });
    });
  }
  function openEditProfile() {
    var pr = profileOf(), d = { photo: pr.photo }, saving = false;
    var body = '<div class="np">' +
      '<div class="np-c"><div class="np-l">Photo de profil</div><div class="np-media"><button type="button" class="np-ph round" id="epPh"></button><button type="button" class="np-rm" id="epRm" hidden>Supprimer la photo</button></div></div>' +
      '<div class="np-c"><div class="np-l">Informations</div><div class="np-row">' +
      '<label class="np-f"><span>Prénom</span><input id="epFirst" type="text" maxlength="40" value="' + esc(pr.first) + '" autocomplete="off" autocapitalize="words"></label>' +
      '<label class="np-f"><span>Nom</span><input id="epLast" type="text" maxlength="40" value="' + esc(pr.last) + '" autocomplete="off" autocapitalize="words"></label></div>' +
      '<label class="np-f"><span>Adresse e-mail</span><input id="epMail" type="email" inputmode="email" maxlength="80" value="' + esc(pr.email) + '" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
      '<label class="np-f"><span>Téléphone (facultatif)</span><input id="epTel" type="tel" inputmode="tel" maxlength="30" value="' + esc(pr.phone) + '" autocomplete="off"></label></div>' +
      '<p class="np-err" id="epErr" hidden></p><button type="button" class="btn-p np-go" id="epGo">Enregistrer</button></div>' +
      '<input type="file" id="epFile" accept="image/*" hidden>';
    var el = page(body, { title: "Modifier le profil", modal: true, notabs: true, cls: "newprod", actions: '<button type="button" class="np-save" id="epSave">Enregistrer</button>' });
    var g = function (id) { return $("#" + id, el); };
    function showPh() {
      var ph = g("epPh");
      ph.classList.toggle("has", !!d.photo);
      ph.innerHTML = d.photo ? '<img src="' + esc(d.photo) + '" alt="">' : ic("person") + "<span>Ajouter une photo</span>";
      g("epRm").hidden = !d.photo;
    }
    showPh();
    g("epPh").addEventListener("click", function () { g("epFile").value = ""; g("epFile").click(); });
    g("epRm").addEventListener("click", function () { d.photo = ""; showPh(); });
    g("epFile").addEventListener("change", function () {
      var file = this.files && this.files[0]; if (!file) return;
      resizeImg(file, function (data) { if (data) { d.photo = data; showPh(); } else toast("Impossible de charger cette photo"); });
    });
    function fail(m) { var eb = g("epErr"); eb.hidden = !m; eb.textContent = m || ""; if (m) hap("error"); }
    function save() {
      if (saving) return;
      var first = g("epFirst").value.trim(), last = g("epLast").value.trim(), mail = g("epMail").value.trim(), tel = g("epTel").value.trim();
      if (!first && !last) return fail("Entre au moins un prénom ou un nom.");
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return fail("Adresse e-mail invalide.");
      fail(""); saving = true; hap("success");
      var cfg = savedSettingsObj();
      cfg.accountFirst = first; cfg.accountLast = last; cfg.accountEmail = mail; cfg.accountPhone = tel; cfg.accountPhoto = d.photo;
      writeSettings(cfg);
      $$(".av[data-act=account]").forEach(function (a) { a.innerHTML = avHTML(); });
      pop(false);
      setTimeout(function () { toast("Profil enregistré"); }, 320);
    }
    g("epGo").addEventListener("click", save);
    g("epSave").addEventListener("click", save);
  }

  /* ── Edit store: name, photo, URL, currency, region ─────────── */
  var ES_CURS = [["USD", "$", "USD $", 2, "en-US", "US Dollar"], ["EUR", "\u20AC", "EUR \u20AC", 2, "de-DE", "Euro"], ["GBP", "\u00A3", "GBP \u00A3", 2, "en-GB", "British Pound"], ["JPY", "\u00A5", "JPY \u00A5", 0, "ja-JP", "Japanese Yen"], ["CAD", "$", "CAD $", 2, "en-CA", "Canadian Dollar"], ["AUD", "$", "AUD $", 2, "en-AU", "Australian Dollar"]];
  var ES_FX = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.72, AUD: 0.65, JPY: 0.0067 };
  var ES_COUNTRIES = [["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"], ["IE", "Ireland"], ["CH", "Switzerland"], ["NZ", "New Zealand"], ["JP", "Japan"]];
  function esSlug(t) { return String(t || "").toLowerCase().replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); }
  function esFx(v, from, to) {
    if (from === to || !(v > 0)) return v;
    var usd = v * (ES_FX[from] || 1), r = usd / (ES_FX[to] || 1);
    return to === "JPY" ? Math.round(r) : Math.round(r * 100) / 100;
  }
  function openEditStore() {
    var d = { logo: S.logo || "", cur: S.cur || "USD", country: S.country || "US" }, saving = false, handleTouched = false;
    var curOpts = ES_CURS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === d.cur ? " selected" : "") + ">" + c[0] + " " + c[1] + " \u00B7 " + c[5] + "</option>"; }).join("");
    var cOpts = ES_COUNTRIES.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === d.country ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("");
    var body = '<div class="np">' +
      '<div class="np-c"><div class="np-l">Store profile</div><div class="np-media"><button type="button" class="np-ph" id="esPh"></button><button type="button" class="np-rm" id="esRm" hidden>Remove photo</button></div>' +
      '<label class="np-f"><span>Store name</span><input id="esName" type="text" maxlength="80" value="' + esc(S.name) + '" autocomplete="off" autocapitalize="words" enterkeyhint="done"></label></div>' +
      '<div class="np-c"><div class="np-l">Store URL</div><label class="np-f"><span>Web address</span><div class="np-in"><input id="esUrl" type="text" value="' + esc(S.handle) + '" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url"><i>.myshopify.com</i></div></label></div>' +
      '<div class="np-c"><div class="np-l">Currency and region</div>' +
      '<label class="np-f"><span>Store currency</span><select id="esCur">' + curOpts + "</select></label>" +
      '<label class="np-f"><span>Region</span><select id="esCountry">' + cOpts + "</select></label>" +
      '<em class="np-hint" id="esHint"></em></div>' +
      '<p class="np-err" id="esErr" hidden></p><button type="button" class="btn-p np-go" id="esGo">Save</button></div>' +
      '<input type="file" id="esFile" accept="image/*" hidden>';
    var el = page(body, { title: "Edit store", modal: true, notabs: true, cls: "newprod", actions: '<button type="button" class="np-save" id="esSave">Save</button>' });
    var g = function (id) { return $("#" + id, el); };
    function showLogo() {
      var ph = g("esPh");
      ph.classList.toggle("has", !!d.logo);
      ph.innerHTML = d.logo ? '<img src="' + esc(d.logo) + '" alt="">' : ic("image") + "<span>Add store photo</span>";
      g("esRm").hidden = !d.logo;
    }
    function hint() {
      var c = g("esCur").value;
      g("esHint").textContent = c !== S.cur ? "Changing currency rebuilds the store with the new currency: orders start fresh and amounts are converted." : "";
    }
    showLogo(); hint();
    g("esPh").addEventListener("click", function () { g("esFile").value = ""; g("esFile").click(); });
    g("esRm").addEventListener("click", function () { d.logo = ""; showLogo(); });
    g("esFile").addEventListener("change", function () {
      var file = this.files && this.files[0]; if (!file) return;
      resizeImg(file, function (data) { if (data) { d.logo = data; showLogo(); } else toast("Couldn\u2019t load that photo"); });
    });
    g("esUrl").addEventListener("input", function () { handleTouched = true; });
    g("esName").addEventListener("keydown", function (e) { if (e.key === "Enter") this.blur(); });
    g("esCur").addEventListener("change", hint);
    function fail(m) { var eb = g("esErr"); eb.hidden = !m; eb.textContent = m || ""; if (m) hap("error"); }
    function save() {
      if (saving) return;
      var name = g("esName").value.trim(), handle = esSlug(g("esUrl").value), cur = g("esCur").value, country = g("esCountry").value;
      if (!name) return fail("Enter a store name.");
      if (!handle) return fail("Enter a valid web address (letters, numbers and dashes).");
      fail("");
      saving = true; hap("success"); frozen = true;
      var cfg = savedSettingsObj(), from = cfg.currency || S.cur || "USD";
      cfg.storeName = name; cfg.storeHandle = handle; cfg.storeLogo = d.logo; cfg.country = country; cfg.currency = cur;
      if (cur !== from) {
        if (cfg.convertFx !== false) {
          cfg.totalSales = esFx(Number(cfg.totalSales) || 0, from, cur);
          cfg.payoutBalance = esFx(Number(cfg.payoutBalance) || 0, from, cur);
          if (Array.isArray(cfg.products)) cfg.products = cfg.products.map(function (p) { var q = Object.assign({}, p); q.price = esFx(Number(p.price) || 0, from, cur); if (p.compare > 0) q.compare = esFx(Number(p.compare), from, cur); return q; });
        }
        delete cfg.__state; delete cfg.__zero; delete cfg.__sig;   // old amounts are in the old currency: start the history again
      }
      writeSettings(cfg);
      toast("Saving store\u2026");
      setTimeout(function () { location.href = "./editor.html#apply"; }, 250);
    }
    g("esGo").addEventListener("click", save);
    g("esSave").addEventListener("click", save);
  }
  function closeSheets() { while (stack.length && stack[stack.length - 1].kind === "sheet") pop(false); }

  /* ── Boot ────────────────────────────────────────────────── */
  consumeBg(false);
  consumeQueue();
  setTab("home");
  // Pre-render the other tabs while idle so the first switch is instant.
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
  idle(function () { ["orders", "products", "menu"].forEach(function (k) { if (!rendered[k]) { RENDER[k](); rendered[k] = 1; } }); });
  window.addEventListener("resize", function () { moveInd(); if (current === "home") { var h = $("#hchart"); if (h && h._g) drawChart(h, h._g.R, homeMet, { h: CH }); } });
  var sp = $("#splash"), seen = false;
  try { seen = sessionStorage.getItem("sh-splash") === "1"; sessionStorage.setItem("sh-splash", "1"); } catch (e) { }
  // Launch: white screen with the Shopify bag (1 s) -> spinner on a white sheet -> numbers shimmer for a moment.
  function statusBar(mode) { try { window.webkit.messageHandlers.larpStatusBar.postMessage(mode); } catch (e) { } }
  function shimmer(ms) { app.classList.add("skel"); setTimeout(function () { app.classList.remove("skel"); }, ms); }
  /* Welcome page: shown once, the first time the app is opened (after the launch screens). */
  function welcomeSeen() {
    try { if (localStorage.getItem("sh-welcome") === "1") return true; } catch (e) { }
    try { return !!(readCfgFresh() || {}).__welcome; } catch (e2) { return false; }
  }
  function markWelcome() {
    try { localStorage.setItem("sh-welcome", "1"); } catch (e) { }
    try { var cfg = savedSettingsObj(); cfg.__welcome = 1; writeSettings(cfg); } catch (e2) { }
  }
  var WL_ART = '<svg viewBox="0 0 240 240" aria-hidden="true"><defs><clipPath id="wlc"><rect x="0" y="0" width="240" height="214"/></clipPath></defs>' +
    '<circle cx="120" cy="130" r="100" fill="#f0f1f2"/><g clip-path="url(#wlc)">' +
    '<rect x="72" y="34" width="96" height="200" rx="16" fill="#454a4f"/><rect x="79" y="46" width="82" height="190" rx="8" fill="#eceef0"/>' +
    '<rect x="86" y="54" width="68" height="76" rx="2" fill="#f4f5f6"/>' +
    '<path d="M96 124l7-42h36l7 42z" fill="#008060"/><path d="M96 124l7-42h10l-5 42z" fill="#00543f"/>' +
    '<path d="M113 82v-7a8 8 0 0116 0v7" fill="none" stroke="#006e52" stroke-width="4" stroke-linecap="round"/><path d="M121 82v-7a8 8 0 0116 0v7" fill="none" stroke="#00543f" stroke-width="4" stroke-linecap="round" opacity=".55"/>' +
    '<rect x="128" y="92" width="13" height="17" rx="3.5" fill="#fff"/><rect x="86" y="124" width="68" height="8" fill="#e8b05a"/>' +
    '<rect x="88" y="145" width="30" height="8" rx="4" fill="#1a8a68"/><rect x="88" y="160" width="56" height="6" rx="3" fill="#e2e4e6"/><rect x="88" y="172" width="42" height="6" rx="3" fill="#e2e4e6"/></g></svg>';
  function showWelcome(onContinue) {
    var w = document.createElement("div");
    w.id = "welcome";
    w.innerHTML = '<div class="wl-logo wl-x" style="--d:.05s">' + ic("bag-color") + "</div>" +
      '<div class="wl-art wl-x" style="--d:.15s">' + WL_ART + "</div>" +
      '<div class="wl-txt"><h1 class="wl-x" style="--d:.3s">Set up fast. Sell faster.</h1>' +
      '<p class="wl-x" style="--d:.4s">Create your store in minutes and make your first sale today</p>' +
      '<ul><li class="wl-x" style="--d:.55s">Create your online store</li><li class="wl-x" style="--d:.65s">Grow your audience</li><li class="wl-x" style="--d:.75s">Accept payments in person</li></ul></div>' +
      '<button class="wl-go wl-x" style="--d:.9s" id="wlGo"><span>Continue</span></button>';
    app.appendChild(w);
    statusBar("dark");
    var done = false;
    $("#wlGo", w).addEventListener("click", function () {
      if (done) return; done = true;
      hap("medium"); markWelcome();
      Array.prototype.forEach.call(w.children, function (c) { c.style.transition = "opacity .15s ease"; c.style.animation = "none"; c.style.opacity = "0"; });
      showLogin(onContinue);   // le login se fond par-dessus le welcome : l'accueil n'est jamais visible
      setTimeout(function () { w.remove(); }, 600);
    });
    requestAnimationFrame(function () { w.classList.add("in"); });
  }
  /* Login step: shown right after the welcome screen's Continue, before the first reveal. */
  function showLogin(onContinue) {
    var w = document.createElement("div");
    w.id = "login";
    var initial = (S.name || "?").trim().charAt(0).toUpperCase() || "?";
    w.innerHTML = '<div class="lg-top"><div class="lg-logo">' + ic("bag-color") + '</div></div>' +
      '<div class="lg-card">' +
      '<h1>Se connecter</h1>' +
      '<p>Continuer vers ' + esc(S.name) + ' Mobile</p>' +
      '<div class="lg-steps">' +
      '<div class="lg-step" id="lgStepEmail">' +
      '<span class="lg-stepno">\u00c9tape 1 sur 2</span>' +
      '<label class="np-f"><span>E-mail</span><input id="lgEmail" type="email" value="" placeholder="exemple@exemple.com" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
      '<p class="lg-err" id="lgErrEmail" role="alert" hidden></p>' +
      '<button type="button" class="btn-p" id="lgNext"><span>Continuer avec l\u2019e-mail</span></button>' +
      '<div class="lg-div">ou</div>' +
      '<button type="button" class="lg-key" id="lgKey">' + ic("key") + '<span>Se connecter avec une cl\u00e9 d\u2019acc\u00e8s</span><span class="lg-badge">Derni\u00e8re utilisation</span></button>' +
      '<div class="lg-alt">' +
      '<button type="button" aria-label="E-mail">' + ic("mail") + '</button>' +
      '<button type="button" aria-label="T\u00e9l\u00e9phone">' + ic("phone") + '</button>' +
      '<button type="button" aria-label="Identifiant biom\u00e9trique">' + ic("fid") + '</button>' +
      '<button type="button" aria-label="Assistance">' + ic("chat") + '</button>' +
      '</div>' +
      '<p class="lg-new">Nouveau\u00a0? <b>D\u00e9marrer \u2192</b></p>' +
      '</div>' +
      '<div class="lg-step" id="lgStepPass" hidden>' +
      '<span class="lg-stepno">\u00c9tape 2 sur 2</span>' +
      '<div class="lg-acct"><span id="lgEmailShown"></span><button type="button" id="lgChange">Changer d\u2019e-mail</button></div>' +
      '<label class="np-f"><span>Mot de passe</span><span class="lg-pw"><input id="lgPass" type="password" value="" placeholder="Mot de passe" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false"><button type="button" class="lg-eye" id="lgEye" aria-label="Afficher le mot de passe">' + ic("eye") + '</button></span></label>' +
      '<p class="lg-err" id="lgErrPass" role="alert" hidden></p>' +
      '<a href="javascript:void(0)" class="lg-forgot" id="lgForgot">Mot de passe oubli\u00e9\u00a0?</a>' +
      '<button type="button" class="btn-p" id="lgGo"><span>Se connecter</span></button>' +
      '</div>' +
      '</div>' +
      '<p class="lg-help">Besoin d\u2019aide\u00a0?</p>' +
      '</div>';
    app.appendChild(w);
    var lgKey = $("#lgKey", w);
    if (lgKey) lgKey.addEventListener("click", function () { hap("light"); });
    $$(".lg-alt button", w).forEach(function (b) { b.addEventListener("click", function () { hap("light"); }); });
    statusBar("dark");
    var done = false;
    /* Slides the current step out and the next step in, instead of a hard hidden-attribute swap. */
    function swapStep(fromEl, toEl, dir) {
      fromEl.classList.add(dir > 0 ? "lg-hide-l" : "lg-hide-r");
      setTimeout(function () {
        fromEl.hidden = true;
        fromEl.classList.remove("lg-hide-l", "lg-hide-r");
        toEl.hidden = false;
        toEl.classList.add(dir > 0 ? "lg-hide-r" : "lg-hide-l");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { toEl.classList.remove("lg-hide-l", "lg-hide-r"); });
        });
      }, 220);
    }
    var OK_EMAIL = "exemple@exemple.com", OK_PASS = "101014";
    function setErr(id, msg) {
      var el = $(id, w); if (!el) return;
      if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; el.textContent = ""; }
    }
    function goNext() {
      var email = $("#lgEmail", w).value.trim();
      if (!email) { setErr("#lgErrEmail", "Saisis ton adresse e-mail."); hap("light"); return; }
      if (email.toLowerCase() !== OK_EMAIL) { setErr("#lgErrEmail", "Adresse e-mail incorrecte."); hap("light"); return; }
      setErr("#lgErrEmail", "");
      $("#lgEmailShown", w).textContent = email;
      swapStep($("#lgStepEmail", w), $("#lgStepPass", w), 1);
      hap("light");
    }
    $("#lgNext", w).addEventListener("click", goNext);
    $("#lgEmail", w).addEventListener("input", function () { setErr("#lgErrEmail", ""); });
    $("#lgEmail", w).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); goNext(); } });
    $("#lgPass", w).addEventListener("input", function () { setErr("#lgErrPass", ""); });
    $("#lgPass", w).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#lgGo", w).click(); } });
    $("#lgChange", w).addEventListener("click", function () {
      setErr("#lgErrPass", ""); $("#lgPass", w).value = "";
      swapStep($("#lgStepPass", w), $("#lgStepEmail", w), -1);
      hap("light");
    });
    $("#lgEye", w).addEventListener("click", function () {
      var inp = $("#lgPass", w), shown = inp.type === "text";
      inp.type = shown ? "password" : "text";
      this.classList.toggle("on", !shown);
      hap("light");
    });
    $("#lgForgot", w).addEventListener("click", function () { hap("light"); });
    $("#lgGo", w).addEventListener("click", function () {
      if (done) return;
      var pw = $("#lgPass", w).value;
      if (!pw) { setErr("#lgErrPass", "Saisis ton mot de passe."); hap("light"); return; }
      if (pw !== OK_PASS) { setErr("#lgErrPass", "Mot de passe incorrect."); hap("light"); return; }
      done = true;
      hap("medium");
      w.classList.add("out");
      setTimeout(function () { w.remove(); }, 400);
      onContinue();
    });
    requestAnimationFrame(function () { w.classList.add("in"); });
  }
  var wSeen = welcomeSeen();
  try { if (/[?&]welcome=1/.test(location.search)) wSeen = false; } catch (e) { }
  if (seen) {
    sp.remove();
    if (wSeen) shimmer(1100);
    else { app.classList.add("skel"); showWelcome(function () { statusBar("light"); setTimeout(function () { app.classList.remove("skel"); }, 1200); }); }
  }
  else {
    var spokes = "";
    var BARS = 8;   // number of bars of the spinner
    for (var k = 0; k < BARS; k++) spokes += '<rect x="13.7" y="2" width="2.8" height="8" rx="1.4" transform="rotate(' + (k * 360 / BARS) + ' 15 15)" fill="#8e8e93" opacity="' + (0.18 + 0.82 * (k / (BARS - 1))).toFixed(2) + '"/>';
    var ld = document.createElement("div");
    ld.id = "loading";
    ld.innerHTML = '<div class="ld-sheet"><svg viewBox="0 0 30 30" aria-hidden="true">' + spokes + "</svg></div>";
    app.appendChild(ld);
    statusBar("dark");
    app.classList.add("skel");
    setTimeout(function () {
      statusBar("light");
      sp.classList.add("out"); setTimeout(function () { sp.remove(); }, 420);   // reveals the spinner screen
      setTimeout(function () {
        if (!wSeen) {
          // New here: the welcome page takes over from the spinner; the home is revealed on "Continue".
          showWelcome(function () { statusBar("light"); setTimeout(function () { app.classList.remove("skel"); }, 1200); });
          setTimeout(function () { ld.remove(); }, 450);
          return;
        }
        ld.classList.add("out"); setTimeout(function () { ld.remove(); }, 380);  // reveals the home with shimmering numbers
        setTimeout(function () { app.classList.remove("skel"); }, 1200);
      }, 900);
    }, 1000);
  }
  /* Pont vers la barre d'onglets Liquid Glass native (iOS 26) : la barre web reste dans le DOM (invisible) et sert de relais. */
  (function () {
    var tbEl = document.getElementById("tabbar"), appEl = document.getElementById("app");
    if (!tbEl) return;
    function post() {
      try {
        var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpTabbar;
        if (!mh) return;
        var on = tbEl.querySelector(".tb.on");
        var cover = !!(document.getElementById("splash") || document.getElementById("loading") || document.getElementById("welcome") || document.getElementById("login"));
        mh.postMessage({ active: on ? on.getAttribute("data-tab") : "home", hidden: cover || tbEl.classList.contains("hide") });
      } catch (e) { }
    }
    try { new MutationObserver(post).observe(tbEl, { attributes: true, attributeFilter: ["class"], subtree: true }); } catch (e) { }
    try { if (appEl) new MutationObserver(post).observe(appEl, { childList: true }); } catch (e) { }
    window.__larpNativeTab = function (name) { var b = tbEl.querySelector('.tb[data-tab="' + name + '"]'); if (b) b.click(); };
    window.__larpNativeAct = function (name) { var b = tbEl.querySelector('[data-act="' + name + '"]'); if (b) b.click(); };
    post();
  })();

  /* Pont Liquid Glass natif (iOS 26) : boutons, recherche et filtres des pages Commandes / Produits
     et boutons de la fiche commande. Les éléments web restent dans le DOM (invisibles) et servent de relais. */
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("native-glass-hdr")) return;
    var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpGlass;
    if (!mh) return;
    var last = "", until = 0, running = false;
    function rect(el) { var r = el.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }
    function iconOf(el) {
      var i = el.querySelector(".ic"); if (!i) return "";
      var m = /\bi-([\w-]+)/.exec(i.className); return m ? m[1] : "";
    }
    function mk(id, kind, el, extra) {
      el.setAttribute("data-gid", id);
      var o = rect(el); o.id = id; o.kind = kind;
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    // Groupe de boutons dans une seule capsule : rectangle commun + position de chaque bouton (relative à la capsule).
    function grp(id, els, pre, extra, lead) {
      var all = lead ? [lead].concat(els) : els, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      all.forEach(function (el) { var r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
      var o = { id: id, kind: "group", x: +x0.toFixed(1), y: +y0.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1), parts: [] };
      els.forEach(function (el, n) {
        var pid = pre + (el.getAttribute("data-act") || n); el.setAttribute("data-gid", pid);
        var r = el.getBoundingClientRect();
        o.parts.push({ id: pid, icon: iconOf(el), dot: el.classList.contains("dot"), x: +(r.left - x0).toFixed(1), y: +(r.top - y0).toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
      });
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    function covered() {
      if (document.getElementById("splash") || document.getElementById("loading") || document.getElementById("welcome") || document.getElementById("login")) return true;
      if (app.querySelector(".sk-ov") || document.querySelector(".dr-bot")) return true;
      return false;
    }
    var ORD_SEL = ".sh.notifs.payouts, .sh.notifs.transfer";
    // Verre « épinglé » : pendant un défilement / un rebond, la page web bouge mais le verre natif garde
    // la position qu'il avait au repos (sinon il suit la page avec un temps de retard et tremble).
    var pin = {}, touching = false, lastMove = 0;
    function pinned(o, scr) {
      var key = (scr.id || scr.getAttribute("data-tab") || "") + "|" + o.id, p = pin[key];
      var st = scr.scrollTop, over = st < -0.5 || st > scr.scrollHeight - scr.clientHeight + 0.5;
      var busy = touching || over || (performance.now() - lastMove < 180);
      if (busy && p && Math.abs(p.w - o.w) < 1 && Math.abs(p.h - o.h) < 1) { o.x = p.x; o.y = p.y; }
      else pin[key] = { x: o.x, y: o.y, w: o.w, h: o.h };
      return o;
    }
    function collect() {
      var items = [];
      if (covered()) return { items: items, cover: true };
      var lays = Array.prototype.slice.call(layers.children);
      var top = lays.length ? lays[lays.length - 1] : null;
      var cut = Infinity, cutTop = Infinity, dim = 0, ord = null, ordLay = null, below = false;
      if (top) {
        // Une couche sans feuille (page plein écran) recouvre tout, même si elle n'est pas tout en haut.
        for (var li = 0; li < lays.length; li++) {
          var shi = lays[li].querySelector(".sh");
          if (!shi) return { items: items, cover: true };
          cut = Math.min(cut, shi.getBoundingClientRect().top);   // ce qui est sous une feuille est masqué
        }
        var sh = top.querySelector(".sh");
        var sc = top.querySelector(".sh-scrim");
        dim = sc ? (parseFloat(getComputedStyle(sc).opacity) || 0) * 0.4 : 0;
        cutTop = sh.getBoundingClientRect().top;
        ord = top.querySelector(ORD_SEL); ordLay = ord ? top : null;
        if (!ord) {
          // Feuille posée au-dessus d'une fiche commande (ex. « Traiter les articles ») :
          // la fiche garde ses boutons de verre (assombris), l'en-tête de la page Commandes reste masqué.
          for (var lj = lays.length - 2; lj >= 0; lj--) {
            var o2 = lays[lj].querySelector(ORD_SEL);
            if (o2) { ord = o2; ordLay = lays[lj]; below = true; break; }
          }
        }
      }
      var scr = document.querySelector("#screens .scr.on.gl-scr");
      if (scr) {
        var chev = scr.querySelector(".gl-hd .gl-chev");
        if (chev) items.push(pinned(mk("h:title", "mini", chev, { icon: "chev-down" }), scr));
        // Boutons d'en-tête (+ et …) : une seule capsule de verre, comme sur Shopify.
        var hbtns = $$(".gl-hd .gl-btn", scr), hround = hbtns.filter(function (b) { return !b.classList.contains("txt"); });
        var grouped = hround.length >= 2;
        if (grouped) items.push(pinned(grp("g:hdr", hround, "h:", { tone: "ink" }), scr));
        hbtns.forEach(function (b, n) {
          if (grouped && hround.indexOf(b) >= 0) return;
          var id = "h:" + (b.getAttribute("data-act") || n);
          if (b.classList.contains("txt")) items.push(pinned(mk(id, "txt", b, { title: b.textContent.trim() }), scr));
          else items.push(pinned(mk(id, "btn", b, { icon: iconOf(b) }), scr));
        });
        // Recherche + localisation / trier / filtrer : une seule capsule de verre.
        var sf = scr.querySelector(".sfield input"), cbs = $$(".sbar .cb", scr).filter(function (b) { return b.getAttribute("data-act") !== "locations"; });
        if (sf && cbs.length) {
          sf.parentNode.setAttribute("data-gid", "s:search");
          items.push(pinned(grp("g:sbar", cbs, "s:", { tone: "gray", placeholder: sf.placeholder || "", text: sf.value || "" }, sf.parentNode), scr));
        } else {
          if (sf) items.push(pinned(mk("s:search", "search", sf.parentNode, { placeholder: sf.placeholder || "", text: sf.value || "" }), scr));
          cbs.forEach(function (b, n) {
            items.push(pinned(mk("s:" + (b.getAttribute("data-act") || n), "btn", b, { icon: iconOf(b), dot: b.classList.contains("dot") }), scr));
          });
        }
        var ch = scr.querySelector(".chips");
        if (ch) {
          var chips = $$(".chip", ch), sel = -1;
          chips.forEach(function (c, n) { if (c.classList.contains("on")) sel = n; });
          var o = mk("c:chips", "chips", ch, { labels: chips.map(function (c) { return c.textContent.trim(); }), sel: sel });
          if (chips.length) { var fr = chips[0].getBoundingClientRect(), cr = ch.getBoundingClientRect(); o.y = +fr.top.toFixed(1); o.h = +fr.height.toFixed(1); o.lead = +(fr.left - cr.left).toFixed(1); }
          items.push(pinned(o, scr));
        }
        items = items.filter(function (i) { return i.y + i.h <= cut + 0.5; });
        var dd = +dim.toFixed(3);
        items.forEach(function (i) { i.dim = dd; });
      }
      if (ord) {
        // Positions FINALES (sans la translation de la feuille) : le natif anime lui-même la montée / descente,
        // sans attendre la page (sinon les boutons traînent derrière la feuille).
        var shEl = ord, tr = 0;
        try { tr = new DOMMatrix(getComputedStyle(shEl).transform).m42 || 0; } catch (e) { }
        var dragging = shEl.style.transition === "none";
        var closing = !ordLay.classList.contains("on");
        var target = closing ? window.innerHeight : (dragging ? Math.max(0, tr) : 0);
        var first = items.length;
        var addO = function (id, b, ic) {
          var o = mk(id, "btn", b, { icon: ic, target: Math.round(target), drag: dragging });
          o.y = Math.round(o.y - tr);
          items.push(o);
        };
        var x = ord.querySelector(".sh-h.nav .sh-x");
        if (x) addO("o:x", x, iconOf(x) || "x");
        $$(".sh-h.nav .nb-c", ord).forEach(function (b, n) { addO("o:" + (b.getAttribute("data-act") || n), b, iconOf(b)); });
        // Gros boutons sombres (Transférer, Continuer…) : verre teinté.
        $$(".pv-go, .btn-p", ord).forEach(function (b, n) {
          if (!b.getBoundingClientRect().width || b.closest(".tr-pane.out")) return;
          var o = mk("o:cta" + n, "cta", b, { title: b.textContent.replace(/\s+/g, " ").trim(), icon: b.classList.contains("pv-go") ? "arrow-ur" : "", disabled: !!b.disabled, target: Math.round(target), drag: dragging });
          o.y = Math.round(o.y - tr);
          items.push(o);
        });
        if (below) {
          // Sous une autre feuille : seuls les boutons encore visibles au-dessus d'elle restent, assombris par son voile.
          var dd2 = +dim.toFixed(3), mine = items.slice(first);
          items = items.slice(0, first).concat(mine.filter(function (i) { return i.y + i.h <= cutTop + 0.5; }));
          items.forEach(function (i) { if (i.id.indexOf("o:") === 0) i.dim = dd2; });
        }
      }
      return { items: items, cover: false };
    }
    function tick() {
      var d; try { d = collect(); } catch (e) { return; }
      var j = JSON.stringify(d);
      if (j !== last) {
        last = j;
        root.classList.toggle("glass-cover", !!d.cover);
        try { mh.postMessage(d); } catch (e) { }
      }
    }
    function loop() {
      tick();
      if (performance.now() < until) requestAnimationFrame(loop); else running = false;
    }
    function kick(ms) {
      until = Math.max(until, performance.now() + (ms || 900));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    window.addEventListener("touchstart", function () { touching = true; }, { capture: true, passive: true });
    ["touchend", "touchcancel"].forEach(function (ev) { window.addEventListener(ev, function () { touching = false; lastMove = performance.now(); kick(); }, { capture: true, passive: true }); });
    window.addEventListener("scroll", function () { lastMove = performance.now(); }, { capture: true, passive: true });
    ["resize", "orientationchange"].forEach(function (ev) { window.addEventListener(ev, function () { pin = {}; }); });
    ["scroll", "resize", "click", "touchstart", "touchend", "transitionend", "animationend", "input"].forEach(function (ev) {
      window.addEventListener(ev, function () { kick(); }, true);
    });
    try {
      var mo = new MutationObserver(function () { kick(); });
      mo.observe(document.getElementById("screens"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      mo.observe(layers, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      mo.observe(app, { childList: true });
    } catch (e) { }
    setInterval(tick, 400);
    window.addEventListener("touchmove", function () {
      var sh = layers.lastElementChild && layers.lastElementChild.querySelector(".sh.notifs.order");
      if (!sh || sh.style.transition !== "none") return;
      var m = /translateY\(([-\d.]+)px\)/.exec(sh.style.transform || "");
      if (m) { try { mh.postMessage({ dy: parseFloat(m[1]) }); } catch (e) { } }
    }, { passive: true });
    window.__larpGlassTap = function (id, idx) {
      var el = document.querySelector('[data-gid="' + id + '"]'); if (!el) return;
      if (id === "c:chips") { var c = $$(".chip", el)[idx]; if (c) c.click(); return; }
      if (id === "h:title") { var t = el.closest(".gl-tt"); if (t) t.click(); return; }
      el.click(); kick();
    };
    window.__larpGlassText = function (id, text) {
      var el = document.querySelector('[data-gid="' + id + '"]'); if (!el) return;
      var inp = el.querySelector("input"); if (!inp) return;
      inp.value = text; inp.dispatchEvent(new Event("input", { bubbles: true }));
    };
    kick(1500);
  })();
  /* Tirer pour rafraîchir sur Commandes / Produits.
     Plus de rebond natif (il faisait trembler le titre : l'en-tête était recalé à chaque événement de scroll) :
     on désactive le rubber-band, l'en-tête + la recherche + les filtres restent fixes, et seule la liste suit le doigt
     (ressort critique), avec le spinner natif Apple dans l'espace ouvert sous les filtres. Relâcher au-delà du seuil
     relance le rendu de la page. */
  (function () {
    if (!document.getElementById("glptr-css")) {
      var st = document.createElement("style"); st.id = "glptr-css";
      st.textContent = "html.checker-native .scr.gl-scr,.scr.gl-scr{overscroll-behavior-y:none}";
      document.head.appendChild(st);
    }
    var nativePtr = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.larpPtr);
    function post(o) { if (nativePtr) { try { window.webkit.messageHandlers.larpPtr.postMessage(o); } catch (e) { } } }
    function bind(id, name) {
      var sc = document.getElementById(id);
      if (!sc || sc._glPtr) return;
      sc._glPtr = true;
      var THRESH = 90, HOLD = 70, MAXPULL = 170;
      var x0 = null, y0 = null, axis = null, busy = false, shift = 0;
      var cur = 0, vel = 0, tgt = 0, raf = 0, last = 0, onDone = null, lastT = 0;
      function active() { return current === name && !(typeof stack !== "undefined" && stack.length) && !(typeof pSel !== "undefined" && pSel && name === "products"); }
      function els() {
        var body = sc.querySelector(".gl-body"), out = [];
        if (body) Array.prototype.forEach.call(body.children, function (c) { if (!c.classList.contains("gl-tools")) out.push(c); });
        return out;
      }
      function apply(v) {
        var t = v > 0.05 ? "translate3d(0," + v.toFixed(2) + "px,0)" : "";
        post({ s: "pull", y: Math.max(0, v) });
        els().forEach(function (el) { el.style.transition = "none"; el.style.willChange = t ? "transform" : ""; el.style.transform = t; });
      }
      function clear() { els().forEach(function (el) { el.style.transition = ""; el.style.transform = ""; el.style.willChange = ""; }); }
      function step(t) {
        var dt = Math.min(0.032, Math.max(0.001, (t - last) / 1000)); last = t;
        var K = 200, C = 2 * Math.sqrt(K);
        vel += (K * (tgt - cur) - C * vel) * dt; cur += vel * dt;
        if (Math.abs(tgt - cur) < 0.2 && Math.abs(vel) < 3) { cur = tgt; vel = 0; raf = 0; apply(cur); var d = onDone; onDone = null; if (d) d(); return; }
        apply(cur); raf = requestAnimationFrame(step);
      }
      function springTo(to, done) { tgt = to; onDone = done || null; if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
      function home(done) { springTo(0, function () { clear(); if (done) done(); }); }
      function reset() { x0 = y0 = null; axis = null; shift = 0; }
      sc.addEventListener("touchstart", function (e) {
        if (busy || raf || e.touches.length !== 1 || sc.scrollTop > 0 || !active()) { reset(); return; }
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; axis = null; shift = 0; cur = vel = 0; lastT = 0;
        var anchor = sc.querySelector(".gl-tools") || sc.querySelector(".gl-hd");
        post({ s: "start", top: anchor ? anchor.getBoundingClientRect().bottom : 0, light: true });
      }, { passive: true });
      sc.addEventListener("touchmove", function (e) {
        if (y0 === null) return;
        var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
        if (axis === null) {
          if (dx === 0 && dy === 0) return;
          axis = (dy > 0 && dy >= Math.abs(dx) && sc.scrollTop <= 0) ? "y" : "x";
        }
        if (axis !== "y") return;
        if (dy <= 0 || sc.scrollTop > 0) { if (cur) { cur = 0; apply(0); clear(); } shift = 0; return; }
        var ns = MAXPULL * (1 - Math.exp(-dy / 220)), now = e.timeStamp || performance.now();
        if (lastT && now > lastT) vel = Math.max(-3000, Math.min(3000, (ns - cur) / ((now - lastT) / 1000)));
        lastT = now; shift = cur = ns;
        if (e.cancelable) e.preventDefault();
        apply(cur);
      }, { passive: false });
      function end() {
        if (y0 === null || axis !== "y" || !shift) { reset(); return; }
        var go = shift >= THRESH; reset();
        if (!go) { home(); return; }
        busy = true; hap(10); post({ s: "load" });
        springTo(HOLD);
        setTimeout(function () {
          post({ s: "end" });
          home(function () { busy = false; try { refreshAll(); } catch (e) { } });
        }, 800);
      }
      sc.addEventListener("touchend", end);
      sc.addEventListener("touchcancel", function () { var had = cur; reset(); if (had) home(); });
    }
    bind("s-orders", "orders"); bind("s-products", "products");
  })();
  /* Rebond en BAS de l'accueil : le rubber-band natif est désactivé sur cette page (il ferait bouger l'en-tête en haut),
     donc on le recrée en bas : en tirant au-delà de la fin la page suit le doigt avec une résistance, et en arrivant
     en bas sur un lancer la page « tape » puis revient en douceur (ressort). */
  (function () {
    var sc = document.getElementById("s-home"); if (!sc || sc._btmBounce) return;
    sc._btmBounce = true;
    var MAXB = 90, cur = 0, vel = 0, raf = 0, last = 0, dragging = false, anchor = null, y0 = null, x0 = null, axis = null;
    var lastTop = 0, lastTs = 0, sv = 0;
    function kids() { return Array.prototype.slice.call(sc.children); }
    function atBottom() { return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1; }
    function apply(v) {
      var t = v < -0.05 ? "translate3d(0," + v.toFixed(2) + "px,0)" : "";
      if (t) sc.style.setProperty("background", "#fff", "important"); else sc.style.removeProperty("background");
      kids().forEach(function (el) { el.style.transition = "none"; el.style.willChange = t ? "transform" : ""; el.style.transform = t; });
    }
    function step(ts) {
      var dt = Math.min(0.032, Math.max(0.001, (ts - last) / 1000)); last = ts;
      var K = 190, C = 2 * Math.sqrt(K) * 0.9;
      vel += (K * (0 - cur) - C * vel) * dt; cur += vel * dt;
      if (cur > 0) { cur = 0; if (vel > 0) vel = 0; }
      if (Math.abs(cur) < 0.2 && Math.abs(vel) < 3) { cur = 0; vel = 0; raf = 0; apply(0); kids().forEach(function (el) { el.style.transition = ""; el.style.transform = ""; el.style.willChange = ""; }); return; }
      apply(cur); raf = requestAnimationFrame(step);
    }
    function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
    sc.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || !sc.classList.contains("on")) { y0 = null; return; }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      dragging = true; anchor = null; axis = null; vel = 0;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; cur = 0; apply(0);
    }, { passive: true });
    sc.addEventListener("touchmove", function (e) {
      if (y0 === null) return;
      var y = e.touches[0].clientY;
      if (axis === null) {
        var dx = e.touches[0].clientX - x0, dy = y - y0; if (!dx && !dy) return;
        axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      }
      if (axis !== "y") return;
      if (!atBottom()) { anchor = null; return; }
      if (anchor === null) anchor = y;
      var over = anchor - y;
      if (over <= 0) { anchor = y; if (cur) { cur = 0; apply(0); } return; }
      cur = -MAXB * (1 - Math.exp(-over / 160));
      if (e.cancelable) e.preventDefault();
      apply(cur);
    }, { passive: false });
    function release() { dragging = false; y0 = null; anchor = null; if (cur) { vel = 0; run(); } }
    sc.addEventListener("touchend", release);
    sc.addEventListener("touchcancel", release);
    sc.addEventListener("scroll", function () {
      var now = performance.now(), top = sc.scrollTop;
      if (lastTs && now > lastTs) { var v = (top - lastTop) / ((now - lastTs) / 1000); sv = sv * 0.5 + v * 0.5; }
      lastTop = top; lastTs = now;
      if (!dragging && sv > 350 && atBottom() && !cur) {
        cur = 0; vel = -Math.min(1100, sv * 0.7); sv = 0; run();
      }
    }, { passive: true });
  })();
  /* Hauteur du clavier -> --kb (relais natif via Swift, repli visualViewport sur le web) */
  (function () {
    var vv = window.visualViewport; if (!vv) return;
    function upd() {
      var kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (kb < 80) kb = 0;
      if (document.documentElement.getAttribute("data-native-kb")) return;
      document.documentElement.style.setProperty("--kb", kb + "px");
    }
    vv.addEventListener("resize", upd); vv.addEventListener("scroll", upd);
  })();
  scheduleOrder(true);
})();
