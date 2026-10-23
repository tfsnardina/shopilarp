import {
  SHOPIFY_VIBES,
  SHOPIFY_CURRENCIES,
  SHOPIFY_COUNTRIES,
  DEFAULT_SHOPIFY_LARP,
  loadSettings,
  saveSettings,
  convertShopifyMoney,
  normalizeProductAllocations,
  averageOrderItemValue,
  applyAndOpenApp,
  slugifyStoreHandle,
} from './larp-settings.mjs'

let s = loadSettings()

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

function renderProducts() {
  s.products = normalizeProductAllocations(s.products)
  $('products').innerHTML = s.products
    .map(
      (p, i) =>
        `<div class="prod" data-i="${i}"><input data-f="title" placeholder="Name" value="${escAttr(p.title)}"><input data-f="price" type="number" inputmode="decimal" step="0.01" placeholder="Price" value="${escAttr(p.price)}"><input data-f="allocationPct" type="number" inputmode="numeric" placeholder="%" value="${escAttr(p.allocationPct)}"><input data-f="inventory" type="number" inputmode="numeric" placeholder="Stock" value="${escAttr(p.inventory)}"></div>`,
    )
    .join('')
  $('prodMeta').textContent = `Average item $${averageOrderItemValue(s.products).toFixed(2)}`
}

bindSelects()
writeForm()

document.body.addEventListener('input', e => {
  const t = e.target
  if (t.closest('.prod')) {
    const row = t.closest('.prod')
    const i = Number(row.dataset.i)
    const f = t.dataset.f
    if (f) s.products[i][f] = f === 'title' ? t.value : Number(t.value) || 0
  }
  readForm()
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
  s.products.push({ id: `p-${Date.now()}`, title: 'New product', price: 25, allocationPct: 10, inventory: 100 })
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
