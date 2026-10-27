export const SHOPIFY_VIBES = [
  { id: 'growing', title: 'Growing', desc: 'Steady upward sales. Healthy store.' },
  { id: 'steady', title: 'Steady', desc: 'Flat-ish — established store cruising.' },
  { id: 'exploding', title: 'Exploding', desc: 'Hockey stick. Orders pouring in.' },
  { id: 'declining', title: 'Declining', desc: 'Sales trending down.' },
  { id: 'newstore', title: 'New store', desc: 'Tiny numbers, just launched.' },
  { id: 'highrisk', title: 'High risk', desc: 'Choppy sales, lots of pending.' },
  { id: 'visitors', title: 'Visitors only', desc: 'People browse the store, but no order ever comes in.' },
  { id: 'dead', title: 'Dead quiet', desc: 'No visitors and no orders at all.' },
]

export const SHOPIFY_CURRENCIES = [
  { code: 'USD', label: 'USD $ · US Dollar', sym: '$', tag: 'USD $', dec: 2, loc: 'en-US' },
  { code: 'EUR', label: 'EUR € · Euro', sym: '€', tag: 'EUR €', dec: 2, loc: 'de-DE' },
  { code: 'GBP', label: 'GBP £ · British Pound', sym: '£', tag: 'GBP £', dec: 2, loc: 'en-GB' },
  { code: 'CAD', label: 'CAD $ · Canadian Dollar', sym: '$', tag: 'CAD $', dec: 2, loc: 'en-CA' },
  { code: 'AUD', label: 'AUD $ · Australian Dollar', sym: '$', tag: 'AUD $', dec: 2, loc: 'en-AU' },
  { code: 'JPY', label: 'JPY ¥ · Japanese Yen', sym: '¥', tag: 'JPY ¥', dec: 0, loc: 'ja-JP' },
]

export const SHOPIFY_COUNTRIES = [
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

export const DEFAULT_SHOPIFY_LARP = {
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
  products: [
    { id: 'p1', title: 'Classic Tee', price: 28, allocationPct: 40, inventory: 420 },
    { id: 'p2', title: 'Everyday Hoodie', price: 54, allocationPct: 30, inventory: 180 },
    { id: 'p3', title: 'Canvas Tote', price: 19, allocationPct: 30, inventory: 260 },
  ],
}

function readSavedSettings(raw) {
  if (!raw) return null
  try {
    const merged = { ...DEFAULT_SHOPIFY_LARP, ...JSON.parse(raw) }
    if (!Array.isArray(merged.products) || !merged.products.length) {
      merged.products = cloneData(DEFAULT_SHOPIFY_LARP.products)
    }
    return merged
  } catch {
    return null
  }
}

export function loadSettings() {
  let stored = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* file storage may be blocked */ }
  return readSavedSettings(globalThis.__LARP_SAVED_SETTINGS__) || readSavedSettings(stored) || cloneData(DEFAULT_SHOPIFY_LARP)
}

const PAYLOAD_KEY = 'checker.shopifyLarp.payload'

function nativeStore() {
  return globalThis.webkit?.messageHandlers?.larpStore
}

export function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* private mode */ }
}

export function convertShopifyMoney(amount, from, to) {
  if (from === to) return amount
  const usd = amount * (FX_TO_USD[from] ?? 1)
  const toRate = FX_TO_USD[to] ?? 1
  const meta = SHOPIFY_CURRENCIES.find(c => c.code === to)
  const dec = meta?.dec ?? 2
  return dec === 0 ? Math.round(usd / toRate) : Math.round((usd / toRate) * 100) / 100
}

export function slugifyStoreHandle(name) {
  return (
    name
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'my-store'
  )
}

export function normalizeProductAllocations(products) {
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

export function averageOrderItemValue(products) {
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

export function applyShopifyLarpSettings(base, settings) {
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
  st.vibe = settings.vibe
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
  const hues = [233, 18, 142, 88, 201]
  payload.pro = products.map((p, i) => {
    const prev = basePros[i]
    const priceCents = moneyToCents(p.price, settings.currency)
    const sold = Math.max(1, Math.round(ordersTarget * (p.allocationPct / 100) * 1.4))
    return [
      p.title,
      priceCents,
      prev?.[2] ?? 0,
      Math.round(p.inventory),
      prev?.[4] ?? 1,
      prev?.[5] ?? ['Default'],
      prev?.[6] ?? 'Apparel',
      settings.storeName,
      prev?.[8] ?? `SKU-${1000 + i}`,
      'Active',
      sold,
      prev?.[11] ?? Date.now() - 86400000 * 30,
      prev?.[12] ?? hues[i % hues.length],
    ]
  })
  return payload
}

export function loadShopifyLarpBase() {
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

export function buildShopifyLarpPayload(settings) {
  return applyShopifyLarpSettings(loadShopifyLarpBase(), settings)
}

export function applyAndOpenApp(settings) {
  settings = { ...settings }
  delete settings.__state
  delete settings.__zero
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
