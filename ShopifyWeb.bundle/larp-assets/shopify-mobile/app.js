/* Shopify app (2025 design): renders every screen from the store payload. */
(function () {
  "use strict";
  var P = JSON.parse(document.getElementById("payload").textContent || "{}");
  var S = P.st, D = P.d;
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
  function hap(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { } }
  var toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2400);
  }

  /* ── Data ────────────────────────────────────────────────── */
  var custs = EMPTY ? [] : P.cus.map(function (c) { return { name: c[0], email: c[1], phone: c[2], city: c[3], region: c[4], ts: c[5], n: c[6], spent: c[7], sub: !!c[8], tags: c[9] || [] }; });
  var demoRaw = P.demoPro || P.pro, userRaw = P.demoPro ? P.pro : [];
  function mkProd(x, i, hidden) {
    var img = typeof x[13] === "string" && x[13].indexOf("data:image/") === 0 ? x[13] : "";
    return { i: hidden ? -1 - i : i, title: x[0], price: x[1], compare: x[2], inv: x[3], vars: x[4], vnames: x[5] || [], type: x[6], vendor: x[7], sku: x[8], status: x[9], sold: x[10], ts: x[11], hue: x[12], img: img, share: x[14] > 0 ? x[14] : 0, pid: x[15] || "" };
  }
  var allProds = demoRaw.map(function (x, i) { return mkProd(x, i, EMPTY); });   // templates for generated orders
  var prods = EMPTY ? userRaw.map(function (x, i) { return mkProd(x, i, false); }) : allProds;
  prods.forEach(function (p) { p.baseInv = p.inv; });
  var HUES = [233, 18, 142, 88, 201];
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
      if (m) { used[m.i] = 1; return; }
      var vn = splitVariants(c.variants), idx = prods.length, title = String(c.title || "Untitled product");
      var code = title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "PRD";
      var np = { i: idx, pid: c.id || "", title: title, price: Math.round((Number(c.price) || 0) * f), compare: c.compare > 0 ? Math.round(c.compare * f) : 0, inv: Math.max(0, Math.round(Number(c.inventory) || 0)), vars: Math.max(1, vn.length || 1), vnames: vn.length ? vn : ["Default"], type: c.type || "General", vendor: S.name, sku: c.sku || (code + "-" + (1000 + idx)), status: c.status || "Active", sold: 0, ts: Number(c.ts) || (S.now - 3 * DAY), hue: HUES[idx % HUES.length], img: typeof c.image === "string" && c.image.indexOf("data:image/") === 0 ? c.image : "", share: c.allocationPct > 0 ? c.allocationPct : 0 };
      np.baseInv = np.inv; used[idx] = 1; prods.push(np);
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
  function saveState() {
    if (!EMPTY) return;
    try {
      var list = orders.slice(0, 300), cl = [];
      list.forEach(function (o) { if (o.c && cl.indexOf(o.c) < 0) cl.push(o.c); });
      var inv = {};
      prods.forEach(function (p) { inv[p.title] = [p.inv, p.baseInv, p.sold]; });
      var snap = {
        v: STATE_V, D: D, hrT: HR.t, purchased: live.purchased, custTotal: S.custTotal, custs: cl, inv: inv,
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
  setInterval(saveState, 3000);
  window.addEventListener("pagehide", saveState);
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveState(); });
  var unread = 0;
  var notifs = [];
  orders.slice(0, 30).forEach(function (o) { notifs.push({ kind: "order", o: o, ts: o.ts, read: (S.now - o.ts) > 10 * HOUR }); });
  notifs.forEach(function (x) { if (!x.read) unread++; });
  unread = Math.min(unread, 12);
  var units = function (o) { return o.items.reduce(function (a, x) { return a + x.q; }, 0); };
  function chName(ch) { return ch === "Instagram" || ch === "Facebook" ? "Facebook & Instagram" : ch; }
  // Current push format: "Order #1013" / "$92.00, 1 item from Online Store • Store".
  function pushBody(o) { var n = units(o); return money(o.total) + ", " + n + " item" + (n === 1 ? "" : "s") + " from " + chName(o.ch) + " \u2022 " + S.name; }
  function nativeOrderPush(o) {
    var payload = { type: "shopify_order", title: "Order #" + o.n, body: pushBody(o), orderNumber: o.n };
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
  function fmtMet(k, v, strip) {
    return k === "money" ? (strip ? money(v, { auto: true }) : money(v)) : k === "pct" ? pctStr(v) : count(v);
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
    var scheduled = payouts.filter(function (p) { return p.st === "Scheduled"; })[0];
    if (scheduled) return scheduled;
    if (S.payout) return { ts: nowMs() + 3 * DAY, amt: S.payout, st: "Scheduled", n: 0, fees: 0, gross: S.payout };
    return null;
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
      '<header class="hm-hd"><button class="av" data-act="account" aria-label="Account">' + ic("person") + '</button>' +
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
        var k = b.getAttribute("data-met"); if (k === homeMet) { hap(5); $(".hm-top").classList.toggle("fold"); return; }
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
  function bindMetButtons() {
    $$(".met[data-met]", $("#s-home")).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-met"); if (k === homeMet) { hap(5); $(".hm-top").classList.toggle("fold"); return; }
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
    tip.innerHTML = '<div><i class="sw cur"></i><span>' + esc(lbl) + "</span><b>" + (cur == null ? "–" : fmtMet(M.k, cur)) + '</b></div><div><i class="sw prv"></i><span>' + esc(plbl) + "</span><b>" + (pv == null ? "–" : fmtMet(M.k, pv)) + "</b></div>";
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
      els.forEach(function (el) {
        el.style.transition = "none";
        el.style.willChange = t ? "transform" : "";
        el.style.transform = t;
      });
      if (ptr) {
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
      springTo(HOLD);
      setTimeout(function () {
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
    return '<button class="orow" data-order="' + o.n + '"><div class="or1"><b>#' + o.n + "</b><b>" + money(o.total) + "</b></div>" +
      '<div class="or2">' + esc(o.c ? o.c.name : "No customer") + " • " + n + " item" + (n === 1 ? "" : "s") + " • " + hmPad(o.ts) + "</div>" +
      '<div class="or3">' + fulBadge(o) + payBadge(o) + (o.note ? ic("note", "on") : "") + "</div>" +
      '<div class="or4">' + esc(o.ch === "Point of Sale" ? "Point of Sale" : o.ful === "Fulfilled" || o.pay === "Refunded" ? o.shipM : "Fulfill by: " + mdy(o.ts + (o.shipM === "Express Shipping" ? 1 : 3) * DAY) + " \u2022 " + shipShort(o.shipM)) + "</div></button>";
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
  function renderOrders() {
    var el = $("#s-orders");
    var list = orders.filter(orderMatches);
    el.innerHTML = '<div class="tab-top"><header class="th-hd"><button class="tt" data-act="locations">Orders' + ic("chev-down") + '</button><span class="fl"></span><button class="hb" data-act="neworder" aria-label="Create order">' + ic("plus-circle") + '</button><button class="hb" data-act="ordermore" aria-label="More">' + ic("more") + "</button></header></div>" +
      '<div class="sheet-body">' +
      '<div class="sbar"><label class="sfield">' + ic("search") + '<input id="oq" type="search" placeholder="All locations" value="' + esc(oQuery) + '" autocomplete="off"></label><button class="cb" data-act="locations" aria-label="Locations">' + ic("location") + '</button><button class="cb dot" data-act="sort" aria-label="Sort">' + ic("sort") + '</button><button class="cb" data-act="ofilter" aria-label="Filter">' + ic("filter") + "</button></div>" +
      '<div class="chips">' + ["All", "Unfulfilled", "Unpaid", "Open", "Archived"].map(function (c) { return '<button class="chip' + (c === oFilter ? " on" : "") + '" data-of="' + c + '">' + c + "</button>"; }).join("") + "</div>" +
      '<div class="olist" id="olist">' + (list.length ? orderList(list, oShown) : emptyState("No orders found", "Try changing the filters or search term")) + "</div></div>";
    $$(".chip", el).forEach(function (b) { b.addEventListener("click", function () { oFilter = b.getAttribute("data-of"); oShown = 40; hap(5); renderOrders(); }); });
    var q = $("#oq");
    q.addEventListener("input", function () { oQuery = q.value; var l = orders.filter(orderMatches); $("#olist").innerHTML = l.length ? orderList(l, oShown) : emptyState("No orders found", "Try changing the filters or search term"); });
  }
  function mdy(t) { var d = L(t); return d.getUTCMonth() + 1 + "/" + d.getUTCDate() + "/" + String(d.getUTCFullYear()).slice(2); }
  function shipShort(m) { return m === "Express Shipping" ? "Express" : m === "Free Shipping" ? "Economy" : "Standard"; }
  function emptyState(t, s) { return '<div class="empty">' + ic("search") + "<b>" + esc(t) + "</b><span>" + esc(s) + "</span></div>"; }

  /* ── Products ────────────────────────────────────────────── */
  var pFilter = "All", pQuery = "";
  function invLine(p) {
    var v = p.vars > 1 ? " \u00b7 " + p.vars + " variants" : "";
    if (p.inv <= 0) return '<span class="neg">0 available</span>' + v;
    return count(p.inv) + " available" + v + (p.vars > 1 && p.inv < p.vars * 6 ? ' <span class="neg">(some out of stock)</span>' : "");
  }
  function prodsSorted(l) { return EMPTY ? l.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0) || a.i - b.i; }) : l; }
  function renderProducts() {
    var el = $("#s-products");
    var list = prodsSorted(prods.filter(function (p) { return (pFilter === "All" || p.status === pFilter) && (!pQuery || p.title.toLowerCase().indexOf(pQuery.toLowerCase()) >= 0); }));
    el.innerHTML = '<div class="tab-top"><header class="th-hd"><button class="tt" data-act="prodviews">Products' + ic("chev-down") + '</button><span class="fl"></span><button class="hb" data-act="newproduct" aria-label="Add product">' + ic("plus-circle") + '</button><button class="hb txt" data-act="select">Select</button></header></div>' +
      '<div class="sheet-body">' +
      '<div class="sbar"><label class="sfield">' + ic("search") + '<input id="pq" type="search" placeholder="Filter products" value="' + esc(pQuery) + '" autocomplete="off"></label><button class="cb" data-act="sort" aria-label="Sort">' + ic("sort") + '</button><button class="cb" data-act="pfilter" aria-label="Filter">' + ic("filter") + "</button></div>" +
      '<div class="chips">' + ["All", "Active", "Draft", "Archived"].map(function (c) { return '<button class="chip' + (c === pFilter ? " on" : "") + '" data-pf="' + c + '">' + c + "</button>"; }).join("") + "</div>" +
      '<div class="plist" id="plist">' + (list.length ? list.map(prodRow).join("") : emptyState("No products found", "Try changing the filters or search term")) + "</div></div>";
    $$(".chip", el).forEach(function (b) { b.addEventListener("click", function () { pFilter = b.getAttribute("data-pf"); hap(5); renderProducts(); }); });
    var q = $("#pq");
    q.addEventListener("input", function () { pQuery = q.value; var l = prodsSorted(prods.filter(function (p) { return (pFilter === "All" || p.status === pFilter) && p.title.toLowerCase().indexOf(pQuery.toLowerCase()) >= 0; })); $("#plist").innerHTML = l.length ? l.map(prodRow).join("") : emptyState("No products found", "Try changing the filters or search term"); });
  }
  function prodRow(p) {
    return '<button class="prow" data-prod="' + p.i + '">' + thumb(p, 44) + '<div class="pr-t"><b>' + esc(p.title) + "</b><span>" + invLine(p) + "</span></div>" + badge(p.status, p.status === "Active" ? "ok" : p.status === "Draft" ? "info" : "neu") + "</button>";
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
    el.classList.remove("on");
    $("#tabbar").classList.toggle("hide", !!(stack.length && stack[stack.length - 1].el.hasAttribute("data-notabs")));
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
    if (!rendered[name] || !keep) { RENDER[name](); rendered[name] = 1; }
    current = name;
    $$(".scr").forEach(function (s) { s.classList.toggle("on", s.id === "s-" + name); });
    $$("#tabbar .tb").forEach(function (t) { t.classList.toggle("on", t.getAttribute("data-tab") === name); });
    moveInd();
    app.classList.toggle("dark-top", true);
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
  var stack = [];
  function push(el, kind) {
    layers.appendChild(el);
    var under = stack.length ? stack[stack.length - 1].el : $("#screens");
    stack.push({ el: el, kind: kind, under: under });
    try { history.pushState({ l: stack.length }, ""); } catch (e) { }
    el.getBoundingClientRect();
    requestAnimationFrame(function () {
      el.classList.add("on");
      if (kind === "page") under.classList.add("pushed");
      if (kind === "page" || kind === "modal") $("#tabbar").classList.toggle("hide", !!el.hasAttribute("data-notabs"));
    });
  }
  // Every layer gets a history entry, so the Android back button and the
  // browser back gesture close it. Pops we start ourselves call
  // history.back() and skip the popstate that follows.
  var ignorePop = 0;
  function pop(fromHistory) {
    var top = stack.pop(); if (!top) return;
    if (!fromHistory) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
    top.el.classList.remove("on");
    if (top.kind === "page") top.under.classList.remove("pushed");
    var below = stack.length ? stack[stack.length - 1].el : null;
    $("#tabbar").classList.toggle("hide", !!(below && below.hasAttribute("data-notabs")));
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
    ignorePop++;
    try { history.go(-n); } catch (e) { ignorePop--; }
  }
  window.addEventListener("popstate", function () {
    if (ignorePop > 0) { ignorePop--; return; }
    if (drawerEl) return closeDrawer(true);
    if (stack.length) pop(true);
  });
  function page(body, opts) {
    opts = opts || {};
    var el = document.createElement("section");
    el.className = "page" + (opts.cls ? " " + opts.cls : "");
    if (opts.notabs) el.setAttribute("data-notabs", "");
    if (opts.modal) el.classList.add("modal");
    el.innerHTML = '<div class="pg-nav' + (opts.title ? " titled" : "") + '"><button class="nb-c" data-back aria-label="' + (opts.modal ? "Close" : "Back") + '">' + ic(opts.modal ? "x" : "chev-left") + "</button>" +
      (opts.title ? '<h1 class="pg-t">' + esc(opts.title) + (opts.titleChev ? ic("chev-down") : "") + "</h1>" : '<span class="fl"></span>') +
      (opts.actions || "") + '</div><div class="pg-b">' + body + "</div>";
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
    el.innerHTML = '<div class="sh-scrim"></div><div class="sh' + (opts.cls ? " " + opts.cls : "") + '"><div class="sh-grab"></div>' + (title ? '<div class="sh-h"><h2>' + esc(title) + '</h2><button class="sh-x" aria-label="Close">' + ic("x") + "</button></div>" : "") + '<div class="sh-b">' + body + "</div></div>";
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
  function addr(o) { return [esc(o.c ? o.c.name : ""), esc(o.street), esc(o.city + ", " + o.reg + " " + o.zip), esc(countryName())].join("<br>"); }
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
  function openOrder(n) {
    var o = findOrder(n); if (!o) return;
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
    var el = page(body, { cls: "order", actions: '<button class="nb-c" data-act="print" aria-label="Print">' + ic("print") + '</button><button class="nb-c" data-act="ordermore" aria-label="More">' + ic("more") + "</button>" });
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
      '<button class="btn-p" id="doFul">Fulfill items</button></div>', { cls: "tall" });
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
        o.pay = "Paid"; hap(14); pop(false);
        setTimeout(function () { var pg = stack.length ? stack[stack.length - 1].el : null; if (pg && +pg.getAttribute("data-on") === o.n) { pop(false); setTimeout(function () { openOrder(o.n); }, 60); } toast("Payment captured"); refreshAll(); }, 240);
      }, 800);
    });
  }
  function refreshAll() {
    rendered = {}; RENDER[current](); rendered[current] = 1;
  }

  /* ── Product page ────────────────────────────────────────── */
  function openProduct(i) {
    var p = prods[i]; if (!p) return;
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
    prods.push(p);
    // Written into the saved settings too: Preferences lists it and Done keeps it.
    var cfg = savedSettingsObj();
    if (!Array.isArray(cfg.products)) cfg.products = [];
    cfg.products.push({ id: id, title: p.title, price: d.price, compare: d.compare > d.price ? d.compare : 0, allocationPct: share, inventory: d.inv, variants: vn.join(", "), image: d.img, status: p.status, type: p.type, sku: p.sku, ts: p.ts });
    writeSettings(cfg);
    return p;
  }
  function openNewProduct() {
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
    var el = page('<div class="lvw"><div class="lv-top"><div class="lv-globe" id="lvglobe"></div><div class="lv-now"><span>Visitors right now</span><b id="lvN">' + count(live.visitors) + '</b></div></div>' +
      '<div class="lv-grid"><div><span>Total sales</span><b>' + money(R.tot.s) + "</b></div><div><span>Sessions</span><b>" + count(R.tot.se) + "</b></div><div><span>Orders</span><b>" + count(R.tot.o) + "</b></div><div><span>Page views</span><b>" + count(Math.round(R.tot.se * 3.4)) + "</b></div></div>" +
      '<div class="an-c"><div class="an-t">Customer behavior</div><div class="beh"><div><span>Active carts</span><b>' + count(live.carts) + "</b></div><div><span>Checking out</span><b>" + count(live.checkingOut) + "</b></div><div><span>Purchased</span><b>" + count(live.purchased) + "</b></div></div></div>" +
      '<div class="an-c"><div class="an-t">Sessions by location</div>' + locRows() + "</div></div>", { title: "Live View", cls: "liveview", notabs: true });
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
  var CITY = { "Los Angeles": [34, -118], "New York": [40.7, -74], Brooklyn: [40.6, -73.9], Chicago: [41.9, -87.6], Houston: [29.8, -95.4], Dallas: [32.8, -96.8], Austin: [30.3, -97.7], Miami: [25.8, -80.2], Orlando: [28.5, -81.4], Atlanta: [33.7, -84.4], Phoenix: [33.4, -112], Seattle: [47.6, -122.3], "San Diego": [32.7, -117.2], "San Francisco": [37.8, -122.4], Denver: [39.7, -105], Boston: [42.4, -71], Nashville: [36.2, -86.8], Charlotte: [35.2, -80.8], "Las Vegas": [36.2, -115.1], Portland: [45.5, -122.7], Columbus: [40, -83], Philadelphia: [40, -75.2], Minneapolis: [45, -93.3], Tampa: [28, -82.5], "San Antonio": [29.4, -98.5], Detroit: [42.3, -83], Raleigh: [35.8, -78.6], "Salt Lake City": [40.8, -111.9], Newark: [40.7, -74.2], Sacramento: [38.6, -121.5], Toronto: [43.7, -79.4], Vancouver: [49.3, -123.1], Montreal: [45.5, -73.6], Calgary: [51, -114], Ottawa: [45.4, -75.7], Edmonton: [53.5, -113.5], Mississauga: [43.6, -79.6], Winnipeg: [49.9, -97.1], London: [51.5, -0.1], Manchester: [53.5, -2.2], Birmingham: [52.5, -1.9], Leeds: [53.8, -1.5], Glasgow: [55.9, -4.3], Bristol: [51.5, -2.6], Liverpool: [53.4, -3], Edinburgh: [56, -3.2], Sydney: [-33.9, 151.2], Melbourne: [-37.8, 145], Brisbane: [-27.5, 153], Perth: [-32, 115.9], Adelaide: [-34.9, 138.6], "Gold Coast": [-28, 153.4], Berlin: [52.5, 13.4], Munich: [48.1, 11.6], Hamburg: [53.6, 10], Cologne: [50.9, 7], Frankfurt: [50.1, 8.7], Paris: [48.9, 2.35], Lyon: [45.8, 4.8], Marseille: [43.3, 5.4], Toulouse: [43.6, 1.4], Nice: [43.7, 7.3] };
  function globe(host) {
    var size = Math.min(host.clientWidth || 300, 320);
    var cv = document.createElement("canvas"), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px";
    host.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var pts = orders.slice(0, 40).map(function (o) { return CITY[o.city]; }).filter(Boolean);
    var home = pts[0] || [39, -98];
    var lon0 = -home[1] - 10, R = size / 2 - 6, cx = size / 2, cy = size / 2;
    var dots = [];
    // Land dots come from a 2-degree land mask of Natural Earth's 110m land
    // (world-atlas), bit-packed: 180 columns from 180W, 90 rows from 90N.
    var bits = atob(LAND_MASK);
    for (var r = 0; r < 90; r++) {
      var la = 89 - r * 2;
      if (la < -58) continue;
      for (var cIdx = 0; cIdx < 180; cIdx++) {
        var k = r * 180 + cIdx;
        if (bits.charCodeAt(k >> 3) & (1 << (k & 7))) dots.push([la, -179 + cIdx * 2]);
      }
    }
    var tilt = 0.32;
    function proj(lat, lon, rot) {
      var p = (lat * Math.PI) / 180, l = ((lon + rot) * Math.PI) / 180;
      var x = Math.cos(p) * Math.sin(l), y = Math.sin(p), z = Math.cos(p) * Math.cos(l);
      var y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * R, cy - y2 * R, z2];
    }
    var rot = lon0, last = performance.now(), alive = true;
    function frame(now) {
      if (!host.isConnected) { alive = false; return; }
      var dt = now - last; last = now;
      if (!reduce) rot += dt * 0.004;
      ctx.clearRect(0, 0, size, size);
      var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#eef0f3");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      for (var i = 0; i < dots.length; i++) {
        var q = proj(dots[i][0], dots[i][1], rot);
        if (q[2] <= 0) continue;
        ctx.fillStyle = "rgba(118,126,138," + (0.3 + q[2] * 0.6).toFixed(2) + ")";
        ctx.fillRect(q[0] - 0.9, q[1] - 0.9, 1.8, 1.8);
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
      if (alive) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ── Payouts ─────────────────────────────────────────────── */
  function financeBody() {
    var np = nextPayout();
    var paid = payouts.filter(function (p) { return p.st !== "Scheduled"; });
    return (np ? '<div class="po-next"><span>Payout balance</span><b>' + money(np.amt) + "</b><em>Next payout " + md(np.ts) + " to the account ending in " + String(1000 + (S.lastN * 7) % 9000).slice(-4) + "</em></div>" : "") +
      '<div class="sec po"><div class="sec-h"><h3>Recent payouts</h3></div>' + paid.slice(0, 20).map(function (p, k) {
        return '<button class="po-r" data-po="' + k + '"><div><b>' + esc(mdLong(p.ts)) + "</b><span>" + count(p.n) + " order" + (p.n === 1 ? "" : "s") + '</span></div><div class="po-a"><b>' + money(p.amt) + "</b>" + badge(p.st === "In transit" ? "In transit" : "Paid", p.st === "In transit" ? "info" : "ok") + "</div></button>";
      }).join("") + "</div>";
  }
  function openPayouts() {
    var np = nextPayout();
    var paid = payouts.filter(function (p) { return p.st !== "Scheduled"; });
    var body = (np ? '<div class="po-next"><span>Next payout</span><b>' + money(np.amt) + "</b><em>Estimated " + md(np.ts) + "</em></div>" : "") +
      '<div class="sec"><div class="sec-h"><h3>Payouts</h3></div>' + paid.slice(0, 30).map(function (p, k) {
        return '<button class="po-r" data-po="' + k + '"><div><b>' + esc(mdLong(p.ts)) + "</b><span>" + count(p.n) + " order" + (p.n === 1 ? "" : "s") + "</span></div><div class=\"po-a\"><b>" + money(p.amt) + "</b>" + badge(p.st === "In transit" ? "In transit" : "Paid", p.st === "In transit" ? "info" : "ok") + "</div></button>";
      }).join("") + "</div>";
    var el = page(body, { title: "Payouts", cls: "payouts" });
    $$("[data-po]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var p = paid[+b.getAttribute("data-po")];
        page('<div class="po-d"><span>' + esc(mdLong(p.ts)) + "</span><h1>" + money(p.amt) + "</h1>" + badge(p.st === "In transit" ? "In transit" : "Paid", p.st === "In transit" ? "info" : "ok") + "</div>" +
          '<div class="sec"><div class="kv"><div><span>Orders</span><span>' + count(p.n) + "</span><b>" + money(p.gross) + "</b></div><div><span>Fees</span><span></span><b>-" + money(p.fees) + '</b></div><div class="tot"><span>Total</span><span></span><b>' + money(p.amt) + "</b></div></div></div>", { title: "Payout", cls: "payout" });
      });
    });
  }

  /* ── Notifications, search, Sidekick ─────────────────────── */
  function openNotifs() {
    var body = notifs.slice(0, 40).map(function (x) {
      var o = x.o;
      return '<button class="nrow' + (x.read ? "" : " unr") + '" data-order="' + o.n + '"><span class="napp">' + ic("bag-color") + '</span><div><div class="nr1"><b>Order #' + o.n + "</b><em>" + esc(pushTime(x.ts)) + "</em></div><span>" + esc(pushBody(o)) + "</span></div></button>";
    }).join("");
    page(body || emptyState("No notifications", ""), { title: "Notifications", cls: "notifs", actions: '<button class="nb-c" data-act="notifsettings" aria-label="Settings">' + ic("settings") + "</button>" });
    notifs.forEach(function (x) { x.read = true; });
    unread = 0; setBell();
  }
  var recentQ = (function () { try { return JSON.parse(localStorage.getItem("sh-recent") || "[]"); } catch (e) { return []; } })();
  function openSearch() {
    var cat = "All";
    var body = '<div class="srch"><div class="sbar"><label class="sfield">' + ic("search") + '<input type="search" id="gq" placeholder="Search" autocomplete="off" enterkeyhint="search"></label><button class="cb" data-act="scan" aria-label="Scan">' + ic("barcode") + "</button></div>" +
      '<div class="chips" id="gchips">' + ["All", "Orders", "Products", "Customers"].map(function (c) { return '<button class="chip' + (c === cat ? " on" : "") + '" data-gc="' + c + '">' + c + "</button>"; }).join("") + "</div>" +
      '<div id="gres"></div></div>';
    var el = page(body, { cls: "search", title: "Search" });
    var inp = $("#gq", el), res = $("#gres", el);
    function idle() {
      var r = recentQ.slice(0, 6);
      res.innerHTML = (r.length ? '<div class="mh"><span>Recent searches</span><button class="lnk" id="gclr">Clear</button></div>' + r.map(function (q) { return '<button class="srow" data-q="' + esc(q) + '">' + ic("recent") + "<span>" + esc(q) + "</span></button>"; }).join("") : "") +
        '<div class="mh"><span>Suggested</span></div>' + [["Unfulfilled orders", "fulfill"], ["Low inventory", "inventory"], ["Customers", "customers"]].map(function (x) { return '<button class="srow" data-act="' + x[1] + '">' + ic("search") + "<span>" + x[0] + "</span></button>"; }).join("") +
        '<div class="slinks"><button class="lnk" data-act="soon:Shopify App Store">Search the Shopify App Store</button><button class="lnk" data-act="help">Search the Help Center</button></div>';
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
    inp.addEventListener("input", run);
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var v = inp.value.trim(); if (!v) return;
      recentQ = [v].concat(recentQ.filter(function (x) { return x !== v; })).slice(0, 8);
      try { localStorage.setItem("sh-recent", JSON.stringify(recentQ)); } catch (er) { }
      inp.blur();
    });
    idle();
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { } }, 420);
  }
  function openSidekick() {
    var R = rangeData("30d"), Rt = rangeData("today");
    var sugg = ["How are sales today?", "What are my best sellers?", "Which orders need attention?", "Write a product description"];
    var g = greeting().replace("!", "");
    var body = '<div class="sk"><div class="sk-hi" id="skhi"><span class="sk-mascot">' + mascot() + '</span><p class="sk-g">' + esc(g) + '</p><h1>How can I help?</h1><button class="sk-new" data-act="sknews"><i></i>What\u2019s new?</button></div>' +
      '<div class="sk-log" id="sklog"></div>' +
      '<div class="sk-sug" id="sksug">' + sugg.map(function (x) { return '<button class="sk-s">' + esc(x) + "</button>"; }).join("") + "</div>" +
      '<div class="sk-bar"><input id="skq" placeholder="Ask anything..." autocomplete="off" enterkeyhint="send"><button class="sk-plus" aria-label="Attach">' + ic("plus") + '</button><button class="sk-go" id="skgo" aria-label="Voice"><span class="wave"><i></i><i></i><i></i><i></i></span></button></div></div>';
    var el = page(body, { cls: "sidekick", title: "New conversation", titleChev: true, notabs: true, actions: '<button class="nb-c" data-act="sknew" aria-label="Private chat">' + ic("view") + "</button>" });
    var log = $("#sklog", el), qi = $("#skq", el), go = $("#skgo", el);
    function answer(q) {
      var ql = q.toLowerCase(), top = prods.slice().sort(function (x, y) { return y.sold - x.sold; });
      var c30 = change(R.tot.s, R.ptot.s);
      if (/today|sales|doing|revenue/.test(ql)) return "Today you\u2019ve made " + money(Rt.tot.s) + " from " + count(Rt.tot.o) + " order" + (Rt.tot.o === 1 ? "" : "s") + ". Over the last 30 days, total sales are " + money(R.tot.s) + (c30 !== null ? ", " + (c30 >= 0 ? "up " : "down ") + Math.abs(Math.round(c30)) + "% from the 30 days before." : ".");
      if (/best|top|seller|product/.test(ql)) return "Your best seller over the last 30 days is " + top[0].title + " with " + count(top[0].sold) + " units sold" + (top[1] ? ", followed by " + top[1].title + " (" + count(top[1].sold) + ")." : ".");
      if (/attention|order|fulfill/.test(ql)) { var u = unfulfilled(), c = toCapture().length; return "You have " + u.length + " order" + (u.length === 1 ? "" : "s") + " to fulfill" + (c ? " and " + c + " payment" + (c === 1 ? "" : "s") + " to capture" : "") + ". The oldest unfulfilled order is #" + (u.slice(-1)[0] || { n: S.lastN }).n + "."; }
      if (/description|write/.test(ql)) return "Here\u2019s a draft for " + top[0].title + ":\n\nMade for everyday wear, the " + top[0].title + " pairs a clean silhouette with materials that hold up wash after wash. It\u2019s the piece you\u2019ll reach for first.";
      return "Your store has " + count(S.custTotal) + " customers and " + count(R.tot.o) + " orders in the last 30 days. I can dig into sales, products, orders or customers, or help you write and edit content.";
    }
    function ask(q) {
      if (!q) return;
      $("#sksug", el).classList.add("gone"); $("#skhi", el).classList.add("gone");
      log.insertAdjacentHTML("beforeend", '<div class="sk-u">' + esc(q) + "</div>");
      var b = document.createElement("div"); b.className = "sk-a typing"; b.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(b);
      var pb = $(".pg-b", el); pb.scrollTop = pb.scrollHeight;
      setTimeout(function () {
        var txt = answer(q), k = 0; b.classList.remove("typing"); b.textContent = "";
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
  function makeOrder(lines, ts) {
    var src = P.ord[Math.floor(Math.random() * Math.min(P.ord.length, 60))];
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
    var lines = null;
    if (prods.length) {
      var pool = sellable();
      if (!pool.length) return;          // everything is a draft or sold out: nothing to buy
      lines = userLines(pool);
    }
    var o = makeOrder(lines, nowMs());
    if (o) commitOrder(o, false);
  }
  // Fake orders queued in Preferences are created once, silently, when the app opens.
  function consumeQueue() {
    var cfg = savedSettingsObj(), q = cfg.__queue;
    if (!Array.isArray(q) || !q.length) return;
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
      var p = j[0] || (prods.length ? userLines(sellable().length ? sellable() : prods)[0][0] : null);
      var o = makeOrder(p ? [[p, j[1]]] : null, stamps[k]);
      if (o) commitOrder(o, true);
    });
    saveState();
  }
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
    var t = e.target.closest("button, [data-act], [data-order], [data-prod], [data-cust]");
    if (!t) return;
    if (t.hasAttribute("data-order") && !t.hasAttribute("data-act")) { hap(5); if (t.classList.contains("bn")) { t.classList.remove("on"); t.classList.add("out"); } closeSheets(); return openOrder(+t.getAttribute("data-order")); }
    if (t.hasAttribute("data-prod")) { hap(5); return openProduct(+t.getAttribute("data-prod")); }
    if (t.hasAttribute("data-cust")) { hap(5); return openCustomer(+t.getAttribute("data-cust")); }
    if (t.hasAttribute("data-fulfill")) { hap(8); return fulfillFlow(+t.getAttribute("data-fulfill")); }
    if (t.hasAttribute("data-capture")) { hap(8); return capture(+t.getAttribute("data-capture")); }
    if (t.hasAttribute("data-markpaid")) { var mo = findOrder(+t.getAttribute("data-markpaid")); if (mo) { mo.pay = "Paid"; hap(10); pop(false); setTimeout(function () { openOrder(mo.n); toast("Order marked as paid"); }, 60); } return; }
    if (t.hasAttribute("data-pulse")) {
      var k = t.getAttribute("data-pulse");
      if (k === "inventory") { setTab("products", true); return; }
      if (k === "analytics") return openAnalytics();
      return toast("Sidekick is working on it");
    }
    if (t.hasAttribute("data-copy")) { var pg = t.closest(".page"); var p = pg ? $(".addr p", pg) : null; return copyText(p ? p.innerText : ""); }
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
      case "select": return toast("Select products");
      case "ancompare": return optSheet("Compare to", ["Previous period", "Previous year", "No comparison"], "Previous period", function () { });
      case "ancur": return optSheet("Currency", [S.tag || S.cur + " " + S.sym.trim()], S.tag || S.cur + " " + S.sym.trim(), function () { });
      case "account": return sheet("", '<div class="acct"><span class="av lg">' + ic("person") + "</span><b>" + esc(S.name) + ' owner</b><span class="muted">' + esc(S.handle) + '.myshopify.com</span><div class="mgroup">' + [["Manage account", "person", ""], ["Notifications", "bell", ""], ["Preferences", "settings", "larp-prefs"], ["Log out", "exit", ""]].map(function (r) { var act = r[2] ? ' data-act="' + r[2] + '"' : ""; return '<button class="mrow"' + act + ">" + ic(r[1]) + "<span>" + r[0] + "</span>" + ic("chev-right", "chev") + "</button>"; }).join("") + "</div></div>");
      case "larp-prefs": closeSheets(); closeAll(); location.href = "./editor.html"; return;
      case "locations": return optSheet("Location", ["All locations", "Shop location", "Warehouse"], "All locations", function () { });
      case "sort": return optSheet("Sort by", ["Date (newest first)", "Date (oldest first)", "Order number", "Total price"], "Date (newest first)", function () { });
      case "ofilter": return optSheet("Filter orders", ["All", "Unfulfilled", "Unpaid", "Open", "Archived"], oFilter, function (v) { oFilter = v; renderOrders(); });
      case "pfilter": return optSheet("Filter products", ["All", "Active", "Draft", "Archived"], pFilter, function (v) { pFilter = v; renderProducts(); });
      case "prodviews": return optSheet("Products", ["Products", "Collections", "Inventory", "Purchase orders", "Transfers", "Gift cards"], "Products", function (v) { if (v !== "Products") toast(v + " opens on the full admin"); });
      case "neworder": return optSheet("Create", ["Create order", "Create draft order"], "", function (v) { toast(v + " started"); });
      case "newproduct": return openNewProduct();
      case "scan": return toast("Camera access is needed to scan barcodes");
      case "print": return toast("Preparing packing slip…");
      case "track": return toast("Opening tracking…");
      case "email": case "phone": var pgc = t.closest(".page"); var on = pgc ? findOrder(+pgc.getAttribute("data-on")) : null; return toast(on && on.c ? (a === "email" ? on.c.email : on.c.phone || "No phone number") : "No contact details");
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
  // Tapping the store name drops a card from the top: the store, Add store, Edit stores.
  function storePop() {
    var el = document.createElement("div");
    el.className = "spop";
    el.innerHTML = '<div class="sp-scrim"></div><div class="sp-card"><div class="sp-r on">' + logoTile(true) + "<div><b>" + esc(S.name) + "</b><span>" + esc(S.handle.slice(0, 10)) + "-" + String(S.lastN * 13 % 99) + ".myshopify.com</span></div></div>" +
      '<button class="sp-r">' + ic("plus-circle") + "<span>Add store</span></button><button class=\"sp-r\">" + ic("edit") + "<span>Edit stores</span></button></div>";
    app.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    el.addEventListener("click", function (e) {
      var b = e.target.closest(".sp-r");
      if (b && !b.classList.contains("on")) toast(b.textContent);
      el.classList.remove("on"); setTimeout(function () { el.remove(); }, 300);
    });
  }
  function closeSheets() { while (stack.length && stack[stack.length - 1].kind === "sheet") pop(false); }

  /* ── Boot ────────────────────────────────────────────────── */
  consumeQueue();
  setTab("home");
  // Pre-render the other tabs while idle so the first switch is instant.
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
  idle(function () { ["orders", "products", "menu"].forEach(function (k) { if (!rendered[k]) { RENDER[k](); rendered[k] = 1; } }); });
  window.addEventListener("resize", function () { moveInd(); if (current === "home") { var h = $("#hchart"); if (h && h._g) drawChart(h, h._g.R, homeMet, { h: CH }); } });
  var sp = $("#splash"), seen = false;
  try { seen = sessionStorage.getItem("sh-splash") === "1"; sessionStorage.setItem("sh-splash", "1"); } catch (e) { }
  if (seen || reduce) sp.remove(); else setTimeout(function () { sp.classList.add("out"); setTimeout(function () { sp.remove(); }, 420); }, 650);
  scheduleOrder(true);
})();

