/* WKWebView file URLs do not run type=module. Classic script. */
(function () {
  try {
const SHOPIFY_VIBES = [
  { id: 'growing', title: 'Growing', desc: 'Steady upward sales. An order every ~20s.' },
  { id: 'steady', title: 'Steady', desc: 'Flat-ish, established store. An order every ~30s.' },
  { id: 'exploding', title: 'Exploding', desc: 'Hockey stick. Orders pouring in every 1-3s.' },
  { id: 'declining', title: 'Declining', desc: 'Sales trending down. An order every ~50s.' },
  { id: 'newstore', title: 'New store', desc: 'Just launched. An order every ~75s.' },
  { id: 'highrisk', title: 'High risk', desc: 'Choppy: flurries, then quiet spells.' },
]

const SHOPIFY_CURRENCIES = [
  { code: 'USD', label: 'USD $ · US Dollar', sym: '$', tag: 'USD $', dec: 2, loc: 'en-US' },
  { code: 'EUR', label: 'EUR € · Euro', sym: '€', tag: 'EUR €', dec: 2, loc: 'de-DE' },
  { code: 'GBP', label: 'GBP £ · British Pound', sym: '£', tag: 'GBP £', dec: 2, loc: 'en-GB' },
  { code: 'CAD', label: 'CAD $ · Canadian Dollar', sym: '$', tag: 'CAD $', dec: 2, loc: 'en-CA' },
  { code: 'AUD', label: 'AUD $ · Australian Dollar', sym: '$', tag: 'AUD $', dec: 2, loc: 'en-AU' },
  { code: 'JPY', label: 'JPY ¥ · Japanese Yen', sym: '¥', tag: 'JPY ¥', dec: 0, loc: 'ja-JP' },
]

const SHOPIFY_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
]

const FX_TO_USD = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.72, AUD: 0.65, JPY: 0.0067 }
const COUNTRY_NAMES = Object.fromEntries(SHOPIFY_COUNTRIES.map(c => [c.code, c.name]))
const STORAGE_KEY = 'checker.settings.shopifyLarp'

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

const DEFAULT_SHOPIFY_LARP = {
  internalName: '123',
  storeName: "ddhhd's Store",
  currency: 'USD',
  country: 'US',
  convertFx: true,
  totalSales: 0,
  orders: 0,
  customers: 0,
  sessions: 0,
  conversionRate: 0,
  returningCustomersPct: 0,
  payoutBalance: 0,
  vibe: 'growing',
  liveOrders: true,
  productsV: 2,
  products: [],
}

function readSavedSettings(raw) {
  if (!raw) return null
  try {
    const saved = JSON.parse(raw)
    const merged = { ...DEFAULT_SHOPIFY_LARP, ...saved }
    if (!Array.isArray(merged.products)) merged.products = []
    if (saved.productsV !== 2) {
      // the old built-in demo products are no longer pre-filled
      const demo = ['Classic Tee', 'Everyday Hoodie', 'Canvas Tote']
      if (merged.products.length && merged.products.every(p => demo.includes(p.title) && /^p[123]$/.test(String(p.id || '')))) merged.products = []
      merged.productsV = 2
    }
    merged.products = merged.products.map(p => ({ compare: 0, variants: '', image: '', ...p }))
    return merged
  } catch {
    return null
  }
}

function loadSettings() {
  let stored = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* file storage may be blocked */ }
  // The native layer injects the settings it had when the web view was created: they can be older than what the
  // shop saved since (new orders, grown totals). Whichever copy carries the newest __ts wins.
  const injected = readSavedSettings(globalThis.__LARP_SAVED_SETTINGS__)
  const local = readSavedSettings(stored)
  if (injected && local) return (Number(local.__ts) || 0) > (Number(injected.__ts) || 0) ? local : injected
  return injected || local || cloneData(DEFAULT_SHOPIFY_LARP)
}

const PAYLOAD_KEY = 'checker.shopifyLarp.payload'

function nativeStore() {
  return globalThis.webkit?.messageHandlers?.larpStore
}

function saveSettings(settings) {
  settings.__ts = Date.now()
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* private mode */ }
}

function convertShopifyMoney(amount, from, to) {
  if (from === to) return amount
  const usd = amount * (FX_TO_USD[from] ?? 1)
  const toRate = FX_TO_USD[to] ?? 1
  const meta = SHOPIFY_CURRENCIES.find(c => c.code === to)
  const dec = meta?.dec ?? 2
  return dec === 0 ? Math.round(usd / toRate) : Math.round((usd / toRate) * 100) / 100
}

function slugifyStoreHandle(name) {
  return (
    name
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'my-store'
  )
}

function normalizeProductAllocations(products) {
  if (!products.length) return products
  const sum = products.reduce((a, p) => a + Math.max(0, p.allocationPct), 0)
  if (sum <= 0) {
    const even = Math.round(100 / products.length)
    return products.map((p, i) => ({
      ...p,
      allocationPct: i === products.length - 1 ? 100 - even * (products.length - 1) : even,
    }))
  }
  if (Math.abs(sum - 100) < 0.01) return products
  return products.map(p => ({ ...p, allocationPct: Math.round((p.allocationPct / sum) * 1000) / 10 }))
}

function averageOrderItemValue(products) {
  const normalized = normalizeProductAllocations(products)
  const totalPct = normalized.reduce((a, p) => a + p.allocationPct, 0) || 100
  return Math.round(normalized.reduce((a, p) => a + p.price * (p.allocationPct / totalPct), 0) * 100) / 100
}

function sumSlice(arr, from, to) {
  let s = 0
  for (let i = from; i <= to; i++) s += arr[i] || 0
  return s
}

function scaleSeries(series, from, to, target, weights) {
  let weighted = 0
  for (let i = from; i <= to; i++) weighted += (series[i] || 0) * (weights[i - from] ?? 1)
  if (weighted <= 0) return
  const factor = target / weighted
  for (let i = from; i <= to; i++) {
    const w = weights[i - from] ?? 1
    series[i] = Math.max(0, Math.round((series[i] || 0) * w * factor))
  }
}

function vibeWeights(vibe, days) {
  const out = []
  for (let i = 0; i < days; i++) {
    const t = days <= 1 ? 1 : i / (days - 1)
    let w = 1
    if (vibe === 'growing') w = 0.72 + t * 0.56
    else if (vibe === 'steady') w = 0.94 + Math.sin(i * 0.7) * 0.06
    else if (vibe === 'exploding') w = 0.35 + t ** 2.2 * 1.25
    else if (vibe === 'declining') w = 1.22 - t * 0.52
    else if (vibe === 'newstore') w = 0.25 + t * 0.35
    else if (vibe === 'highrisk') w = 0.65 + (i % 5 === 0 ? 0.85 : 0) + Math.sin(i * 1.9) * 0.2
    out.push(w)
  }
  return out
}

function moneyToCents(amount, currency) {
  const meta = SHOPIFY_CURRENCIES.find(c => c.code === currency) ?? SHOPIFY_CURRENCIES[0]
  return Math.round(amount * (meta.dec === 0 ? 1 : 100))
}

function applyShopifyLarpSettings(base, settings) {
  const payload = cloneData(base)
  const st = payload.st
  const d = payload.d
  const n = Number(st.n)
  const to = Math.max(0, n - 1)
  const from = Math.max(0, to - 29)
  const weights = vibeWeights(settings.vibe, to - from + 1)
  const cur = SHOPIFY_CURRENCIES.find(c => c.code === settings.currency) ?? SHOPIFY_CURRENCIES[0]
  const handle = settings.storeHandle || slugifyStoreHandle(settings.storeName)
  const initials =
    settings.storeName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('') || 'ST'

  st.name = settings.storeName
  st.ini = initials
  st.handle = handle
  st.logo = settings.storeLogo || ''
  st.cur = cur.code
  st.sym = cur.sym
  st.tag = cur.tag
  st.dec = cur.dec
  st.loc = cur.loc
  st.country = settings.country
  st.cname = COUNTRY_NAMES[settings.country] ?? settings.country
  st.custTotal = Math.round(settings.customers)
  const payoutCents = moneyToCents(settings.payoutBalance, settings.currency)
  st.payout = payoutCents
  if (Array.isArray(payload.pay)) {
    let scheduled = payload.pay.find(row => row[2] === 'Scheduled')
    if (!scheduled) {
      scheduled = [Date.now() + 3 * 86400000, payoutCents, 'Scheduled', 1, 0, payoutCents]
      payload.pay.unshift(scheduled)
    }
    const previous = Number(scheduled[1]) || payoutCents
    const ratio = previous > 0 ? payoutCents / previous : 1
    scheduled[1] = payoutCents
    scheduled[5] = Math.max(payoutCents, Math.round((Number(scheduled[5]) || payoutCents) * ratio))
    scheduled[4] = Math.max(0, scheduled[5] - payoutCents)
  }
  st.pops = settings.liveOrders
  st.now = Date.now()

  const salesTarget = moneyToCents(settings.totalSales, settings.currency)
  const ordersTarget = Math.round(settings.orders)
  const sessionsTarget = Math.round(settings.sessions)

  scaleSeries(d.s, from, to, salesTarget, weights)
  scaleSeries(d.o, from, to, ordersTarget, weights)
  scaleSeries(d.se, from, to, sessionsTarget, weights)

  const actualOrders = sumSlice(d.o, from, to)
  const actualSessions = sumSlice(d.se, from, to)
  if (actualSessions > 0 && settings.conversionRate > 0) {
    const wantOrders = Math.round(actualSessions * (settings.conversionRate / 100))
    if (wantOrders > 0 && actualOrders > 0) scaleSeries(d.o, from, to, wantOrders, weights.map(() => 1))
  }

  const rcTarget = Math.round(settings.customers * (settings.returningCustomersPct / 100))
  if (Array.isArray(d.rc)) scaleSeries(d.rc, from, to, Math.max(0, rcTarget), weights.map(() => 1))

  const products = normalizeProductAllocations(settings.products)
  const basePros = payload.pro ?? []
  payload.demoPro = cloneData(basePros) // hidden templates used to build realistic orders
  const hues = [233, 18, 142, 88, 201]
  payload.pro = products.map((p, i) => {
    const variants = String(p.variants || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 12)
    const code = String(p.title || 'PRD').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'PRD'
    return [
      p.title || 'Untitled product',
      moneyToCents(p.price, settings.currency),
      p.compare > 0 ? moneyToCents(p.compare, settings.currency) : 0,
      Math.max(0, Math.round(p.inventory)),
      Math.max(1, variants.length || 1),
      variants.length ? variants : ['Default'],
      p.type || 'General',
      settings.storeName,
      p.sku || `${code}-${1000 + i}`,
      p.status || 'Active',
      Math.round(ordersTarget * (p.allocationPct / 100)),
      Number(p.ts) || Date.now() - 86400000 * 3,
      hues[i % hues.length],
      p.image || '',
      p.allocationPct,
      p.id || '',
    ]
  })
  return payload
}

function loadShopifyLarpBase() {
  const embedded = globalThis.__LARP_BASE__
  if (embedded && embedded.st && embedded.d) return cloneData(embedded)
  try {
    const cached = sessionStorage.getItem('checker.shopifyLarp.baseRaw')
    if (cached) return JSON.parse(cached)
  } catch { /* read the file */ }
  const xhr = new XMLHttpRequest()
  xhr.open('GET', './shopify-larp-base.json', false)
  try { xhr.send(null) } catch { throw new Error('shopify-larp-base.json missing') }
  if (!xhr.responseText) throw new Error('shopify-larp-base.json missing')
  const parsed = JSON.parse(xhr.responseText)
  try { sessionStorage.setItem('checker.shopifyLarp.baseRaw', xhr.responseText) } catch { /* cache is optional */ }
  return parsed
}

function buildShopifyLarpPayload(settings) {
  return applyShopifyLarpSettings(loadShopifyLarpBase(), settings)
}

function sigOf(c) {
  // Payout balance, country, products, name, vibe, live orders... apply on their own and never reset the store.
  return [c.totalSales, c.orders, c.customers, c.sessions, c.conversionRate, c.returningCustomersPct]
    .map(v => String(+(Number(v) || 0).toFixed(2)))
    .concat([String(c.currency == null ? '' : c.currency)])
    .join('|')
}

function applyAndOpenApp(settings) {
  settings = { ...settings }
  // Same headline numbers as the running store => keep its orders; otherwise start fresh from the new numbers.
  const keep = !!settings.__state && !!settings.__sig && settings.__sig === sigOf(settings)
  if (!keep) {
    delete settings.__state
    delete settings.__zero
    delete settings.__sig
  }
  saveSettings(settings)
  const payload = buildShopifyLarpPayload(settings)
  const payloadRaw = JSON.stringify(payload)
  const settingsRaw = JSON.stringify(settings)
  try {
    sessionStorage.setItem(PAYLOAD_KEY, payloadRaw)
    localStorage.setItem(PAYLOAD_KEY, payloadRaw)
  } catch { /* native copy below still opens the shop */ }
  const handler = nativeStore()
  if (handler) {
    try {
      handler.postMessage({ settings: settingsRaw, payload: payloadRaw, open: true })
    } catch {
      location.href = './index.html'
      return
    }
    setTimeout(() => {
      if (String(location.href).indexOf('editor.html') !== -1) location.href = './index.html'
    }, 700)
    return
  }
  location.href = './index.html'
}

let s = loadSettings()
// Baseline: the numbers the running store shows right now. Done only rebuilds the store if one of them is edited.
if (s.__state) s.__sig = sigOf(s)

const $ = id => document.getElementById(id)

function bindSelects() {
  $('salesChips').innerHTML = [1000, 10000, 100000, 1000000]
    .map(n => `<button type="button" class="chip" data-v="${n}">$${n >= 1e6 ? '1M' : n / 1000 + 'K'}</button>`)
    .join('')
}

function readForm() {
  s.internalName = $('internalName').value
  s.totalSales = Number($('totalSales').value) || 0
  s.orders = Number($('orders').value) || 0
  s.customers = Number($('customers').value) || 0
  s.sessions = Number($('sessions').value) || 0
  s.conversionRate = Number($('conversionRate').value) || 0
  s.returningCustomersPct = Number($('returningCustomersPct').value) || 0
  s.payoutBalance = Number($('payoutBalance').value) || 0
  s.liveOrders = $('liveOrders').checked
  saveSettings(s)
}

function writeForm() {
  $('internalName').value = s.internalName
  $('totalSales').value = s.totalSales
  $('orders').value = s.orders
  $('customers').value = s.customers
  $('sessions').value = s.sessions
  $('conversionRate').value = s.conversionRate
  $('returningCustomersPct').value = s.returningCustomersPct
  $('payoutBalance').value = s.payoutBalance
  $('liveOrders').checked = s.liveOrders
  renderVibes()
  renderProducts()
}

function renderVibes() {
  $('vibes').innerHTML = SHOPIFY_VIBES.map(
    v => `<button type="button" class="vibe${s.vibe === v.id ? ' on' : ''}" data-v="${v.id}"><strong>${v.title}</strong><span>${v.desc}</span></button>`,
  ).join('')
}

function escAttr(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function currencySym() {
  const c = SHOPIFY_CURRENCIES.find(x => x.code === s.currency)
  return c ? c.sym : '$'
}

function renderProducts() {
  s.products = normalizeProductAllocations(s.products)
  const sym = currencySym()
  $('products').innerHTML = s.products.length
    ? s.products
        .map(
          (p, i) =>
            `<div class="prod" data-i="${i}"><button type="button" class="pimg" data-act="img" aria-label="Choose photo">${p.image ? `<img src="${p.image}" alt="">` : '+'}</button><div class="pf"><input data-f="title" placeholder="Product name" value="${escAttr(p.title)}"><div class="p2"><div><small>Price (${sym})</small><input data-f="price" type="number" inputmode="decimal" step="0.01" value="${escAttr(p.price)}"></div><div><small>Compare-at</small><input data-f="compare" type="number" inputmode="decimal" step="0.01" placeholder="optional" value="${p.compare > 0 ? escAttr(p.compare) : ''}"></div></div><div class="p2"><div><small>Stock</small><input data-f="inventory" type="number" inputmode="numeric" value="${escAttr(p.inventory)}"></div><div><small>Sales share %</small><input data-f="allocationPct" type="number" inputmode="numeric" value="${escAttr(p.allocationPct)}"></div></div><input data-f="variants" placeholder="Variants (S, M, L)" value="${escAttr(p.variants || '')}">${p.image ? '<button type="button" class="plink" data-act="rmimg">Remove photo</button>' : ''}</div><button type="button" class="pdel" data-act="del" aria-label="Delete product">\u2715</button></div>`,
        )
        .join('')
    : '<p class="empty">No products yet. Tap \u201cAdd product\u201d.</p>'
  $('prodMeta').textContent = s.products.length ? `Average item ${sym}${averageOrderItemValue(s.products).toFixed(2)}` : ''
  renderFakeOrders()
}

function renderFakeOrders() {
  const sel = $('foProduct')
  const prev = sel.value || '*'
  sel.innerHTML = '<option value="*">Any product</option>' + s.products.map(p => `<option value="${escAttr(p.title)}">${escAttr(p.title || 'Untitled product')}</option>`).join('')
  sel.value = Array.from(sel.options).some(o => o.value === prev) ? prev : '*'
  const q = Array.isArray(s.__queue) ? s.__queue : []
  $('foList').innerHTML = q
    .map((it, i) => `<div class="fq"><span>${it.times} order${it.times > 1 ? 's' : ''} \u00b7 ${it.qty} item${it.qty > 1 ? 's' : ''} each \u00b7 ${it.title === '*' ? 'Any product' : escAttr(it.title)}</span><button type="button" data-q="${i}" aria-label="Remove">\u2715</button></div>`)
    .join('')
  const total = q.reduce((a, it) => a + it.times, 0)
  $('foMeta').textContent = total ? `${total} order${total > 1 ? 's' : ''} queued. They are created when you tap Done.` : 'Queued orders are created in your store when you tap Done.'
}

function resizeImage(file, done) {
  const reader = new FileReader()
  reader.onerror = () => done('')
  reader.onload = () => {
    const img = new Image()
    img.onerror = () => done('')
    img.onload = () => {
      try {
        const size = 320
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, size, size)
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        done(canvas.toDataURL('image/jpeg', 0.8))
      } catch { done('') }
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}

bindSelects()
writeForm()

document.body.addEventListener('input', e => {
  const t = e.target
  const row = t.closest ? t.closest('.prod') : null
  if (row) {
    const i = Number(row.dataset.i)
    const f = t.dataset.f
    if (f && s.products[i]) {
      s.products[i][f] = f === 'title' || f === 'variants' ? t.value : Number(t.value) || 0
      if (f === 'title') renderFakeOrders()
    }
  }
  readForm()
})

let pickIdx = -1
let armTimer = null
$('products').addEventListener('click', e => {
  const b = e.target.closest('[data-act]')
  if (!b) return
  const row = b.closest('.prod')
  const i = Number(row.dataset.i)
  const act = b.dataset.act
  if (act === 'img') {
    pickIdx = i
    $('imgPick').value = ''
    $('imgPick').click()
  } else if (act === 'rmimg') {
    s.products[i].image = ''
    readForm()
    writeForm()
  } else if (act === 'del') {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed')
      b.textContent = 'Delete?'
      clearTimeout(armTimer)
      armTimer = setTimeout(() => {
        b.classList.remove('armed')
        b.textContent = '\u2715'
      }, 2500)
      return
    }
    s.products.splice(i, 1)
    s.products = normalizeProductAllocations(s.products)
    if (Array.isArray(s.__queue)) s.__queue = s.__queue.filter(q => q.title === '*' || s.products.some(p => p.title === q.title))
    readForm()
    writeForm()
  }
})

$('imgPick').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0]
  const idx = pickIdx
  if (!file || idx < 0 || !s.products[idx]) return
  resizeImage(file, data => {
    if (data && s.products[idx]) {
      s.products[idx].image = data
      readForm()
      writeForm()
    }
  })
})

$('foAdd').addEventListener('click', () => {
  const qty = Math.max(1, Math.min(999, Math.round(Number($('foQty').value) || 1)))
  const times = Math.max(1, Math.min(500, Math.round(Number($('foTimes').value) || 1)))
  if (!Array.isArray(s.__queue)) s.__queue = []
  s.__queue.push({ title: $('foProduct').value || '*', qty, times })
  readForm()
  renderFakeOrders()
})

$('foList').addEventListener('click', e => {
  const b = e.target.closest('[data-q]')
  if (!b || !Array.isArray(s.__queue)) return
  s.__queue.splice(Number(b.dataset.q), 1)
  readForm()
  renderFakeOrders()
})

$('vibes').addEventListener('click', e => {
  const b = e.target.closest('.vibe')
  if (!b) return
  s.vibe = b.dataset.v
  readForm()
  writeForm()
})

$('salesChips').addEventListener('click', e => {
  const b = e.target.closest('.chip')
  if (!b) return
  s.totalSales = Number(b.dataset.v)
  writeForm()
  readForm()
})

$('addProduct').addEventListener('click', () => {
  s.products.push({ id: `p-${Date.now()}`, title: 'New product', price: 25, compare: 0, allocationPct: 10, inventory: 100, variants: '', image: '' })
  s.products = normalizeProductAllocations(s.products)
  writeForm()
  readForm()
})

$('exportBtn').addEventListener('click', () => {
  readForm()
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${slugifyStoreHandle(s.internalName || s.storeName)}-shopify-larp.json`
  a.click()
})

let finishing = false
function finish() {
  if (finishing) return
  finishing = true
  const buttons = Array.from(document.querySelectorAll('.js-done'))
  buttons.forEach(btn => {
    btn.disabled = true
    btn.textContent = 'Saving'
  })
  try {
    readForm()
    applyAndOpenApp(s)
  } catch (error) {
    finishing = false
    buttons.forEach(btn => {
      btn.disabled = false
      btn.textContent = 'Done'
    })
    const message = error && error.message ? error.message : 'Could not save'
    const meta = $('prodMeta')
    if (meta) meta.textContent = message
    const banner = $('doneError')
    if (banner) {
      banner.style.display = 'block'
      banner.textContent = message
    }
  }
}
window.__larpApply = finish
// Opened by "Edit store" in the app: apply the saved settings right away and go back to the shop.
if (location.hash === '#apply') {
  document.documentElement.style.visibility = 'hidden'
  setTimeout(finish, 0)
}

  } catch (error) {
    var message = error && error.message ? error.message : String(error)
    var meta = document.getElementById('prodMeta')
    if (meta) meta.textContent = message
    var banner = document.getElementById('doneError')
    if (banner) {
      banner.style.display = 'block'
      banner.textContent = message
    }
  }
})()
