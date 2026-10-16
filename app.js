/* ═══════════════════════════════════════════════════
   سفره سبز (Sofreh Sabz) - app.js
   Designed & Developed by alavi1405
   Copyright © ۱۴۰۵ - All Rights Reserved
   اثر انگشت: SAFREH-SABZ-1405-ALAVI-A1B2C3D4
═══════════════════════════════════════════════════ */

const DB = {
  get sellers() { return JSON.parse(localStorage.getItem('safreh_sellers') || '[]'); },
  set sellers(v) { localStorage.setItem('safreh_sellers', JSON.stringify(v)); },
  get listings() { return JSON.parse(localStorage.getItem('safreh_listings') || '[]'); },
  set listings(v) { localStorage.setItem('safreh_listings', JSON.stringify(v)); },
  get orders() { return JSON.parse(localStorage.getItem('safreh_orders') || '[]'); },
  set orders(v) { localStorage.setItem('safreh_orders', JSON.stringify(v)); },
  get cart() { return JSON.parse(localStorage.getItem('safreh_cart') || '[]'); },
  set cart(v) { localStorage.setItem('safreh_cart', JSON.stringify(v)); }
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function toast(msg, isError) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function toman(n) { return Number(n).toLocaleString('fa-IR'); }

function calcDiscount(oldP, newP) {
  if (!oldP || oldP <= newP) return 0;
  return Math.round((1 - newP / oldP) * 100);
}

function typeLabel(t) {
  return { home: 'خانگی', restaurant: 'رستوران', fastfood: 'فست‌فود', catering: 'کترینگ' }[t] || t;
}

function renderStars(rating) {
  const r = Number(rating) || 0;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  let s = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) s += '★';
    else if (i === full && half) s += '⯨';
    else s += '☆';
  }
  return s;
}

function getComments(id) { return JSON.parse(localStorage.getItem('safreh_comments_' + id) || '[]'); }
function saveComments(id, c) { localStorage.setItem('safreh_comments_' + id, JSON.stringify(c)); }

function recalcRating(id) {
  const cs = getComments(id);
  const l = DB.listings.find(x => x.id === id);
  if (!l) return;
  if (!cs.length) { l.rating = 0; l.ratingCount = 0; }
  else {
    const sum = cs.reduce((s, c) => s + c.rating, 0);
    l.rating = (sum / cs.length).toFixed(1);
    l.ratingCount = cs.length;
  }
  DB.listings = DB.listings;
}

let currentMode = 'customer';

$$('.mode-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.mode-switch button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    if (currentMode === 'customer') {
      $('#tabsCustomer').style.display = 'flex';
      $('#tabsSeller').style.display = 'none';
      $$('#tabsCustomer button').forEach(b => b.classList.remove('active'));
      $$('section.tab').forEach(s => s.classList.remove('active'));
      $('#tabsCustomer button[data-tab="foods"]').classList.add('active');
      $('#tab-foods').classList.add('active');
      renderFoods();
    } else {
      $('#tabsCustomer').style.display = 'none';
      $('#tabsSeller').style.display = 'flex';
      $$('#tabsSeller button').forEach(b => b.classList.remove('active'));
      $$('section.tab').forEach(s => s.classList.remove('active'));
      $('#tabsSeller button[data-tab="newlisting"]').classList.add('active');
      $('#tab-newlisting').classList.add('active');
      fillSellerSelect();
    }
  });
});

$$('nav.tabs').forEach(nav => {
  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('section.tab').forEach(s => s.classList.remove('active'));
      $('#tab-' + btn.dataset.tab).classList.add('active');
      const t = btn.dataset.tab;
      if (t === 'foods') renderFoods();
      if (t === 'cart') renderCart();
      if (t === 'myorders') renderMyOrders();
      if (t === 'newlisting') fillSellerSelect();
      if (t === 'sellerorders') renderSellerOrders();
      if (t === 'mysellers') renderSellers();
    });
  });
});

let searchQuery = '';

function renderFoods() {
  const items = DB.listings;
  const sellers = DB.sellers;
  const wrap = $('#foodsList');
  if (!wrap) return;

  let filtered = items;
  if (searchQuery) {
    filtered = items.filter(l => {
      const s = sellers.find(x => x.id === l.sellerId);
      const text = (l.title + ' ' + (l.description || '') + ' ' + (s ? s.name + ' ' + s.address : '')).toLowerCase();
      return text.includes(searchQuery);
    });
  }

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">🍽️</span>هنوز آگهی‌ای ثبت نشده.<br>اگه فروشنده‌ای، از حالت فروشنده غذا اضافه کن!</div>';
    return;
  }

  wrap.innerHTML = '<div class="food-table">' + filtered.slice().reverse().map(l => {
    const s = sellers.find(x => x.id === l.sellerId);
    const disc = calcDiscount(l.originalPrice, l.discountedPrice);
    const out = l.quantity <= 0;
    const rating = l.rating || 0;
    const img = l.image
      ? `<img src="${l.image}" alt="${l.title}" onerror="this.outerHTML='🍲'">`
      : '🍲';
    return `
      <div class="food-row" onclick="openFoodDetail('${l.id}')">
        <div class="food-thumb">
          ${img}
          ${disc ? `<span class="discount-tag">${disc}٪</span>` : ''}
        </div>
        <div class="food-info">
          <div class="food-title">${l.title}</div>
          <div class="food-meta">
            <span>🏪 ${s ? s.name : 'ناشناس'}</span>
            <span class="dot">•</span>
            <span>📍 ${s ? (s.address || '').slice(0,22) : '—'}</span>
          </div>
          <div class="food-meta">
            <span>⏱️ ${l.deliveryTime} دقیقه</span>
            <span class="dot">•</span>
            <span>📦 ${out ? 'تمام شد' : l.quantity + ' پرس'}</span>
          </div>
        </div>
        <div class="food-price">
          <span class="old">${toman(l.originalPrice)}</span>
          <span class="new">${toman(l.discountedPrice)} ت</span>
          <span class="stars-mini">${renderStars(rating)} (${l.ratingCount || 0})</span>
        </div>
      </div>`;
  }).join('') + '</div>';
}

window.openFoodDetail = function(id) {
  const l = DB.listings.find(x => x.id === id);
  if (!l) return;
  const s = DB.sellers.find(x => x.id === l.sellerId);
  const disc = calcDiscount(l.originalPrice, l.discountedPrice);
  const out = l.quantity <= 0;
  const img = l.image
    ? `<img src="${l.image}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px" onerror="this.style.display='none'">`
    : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:60px;margin-bottom:12px">🍲</div>`;
  $('#foodDetailContent').innerHTML = `
    ${img}
    <h3 style="color:#15803d;font-size:18px;margin-bottom:8px">${l.title}</h3>
    <p style="font-size:13px;color:#374151;margin-bottom:8px">${l.description || ''}</p>
    <div class="price-row">
      <span class="old-price">${toman(l.originalPrice)} ت</span>
      <span class="new-price">${toman(l.discountedPrice)} ت</span>
      ${disc ? `<span class="discount-badge">${disc}٪ تخفیف</span>` : ''}
    </div>
    <div class="meta" style="margin-bottom:10px">
      <span class="chip ${out ? 'red' : 'green'}">📦 ${out ? 'تمام شد' : l.quantity + ' پرس'}</span>
      <span class="chip">⏱️ ${l.deliveryTime} دقیقه</span>
      <span class="chip blue">🏪 ${s ? s.name : 'ناشناس'}</span>
      <span class="chip">📍 ${s ? s.address : '—'}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:13px;font-weight:600">⭐ امتیاز:</span>
      <span class="stars">${renderStars(l.rating || 0)}</span>
      <span style="font-size:12px;color:#6b7280">(${l.ratingCount || 0} نظر)</span>
    </div>
    <button class="btn small blue" onclick="openReviewModal('${l.id}');closeFoodDetail()">💬 ثبت نظر</button>
    <button class="btn small gray" onclick="openCommentsModal('${l.id}')">📖 نظرات</button>
    ${out
      ? `<button class="btn" disabled>❌ ناموجود</button>`
      : `<button class="btn" onclick="addToCart('${l.id}');closeFoodDetail()">🛒 افزودن به سبد</button>`}
  `;
  $('#foodDetailModal').classList.add('show');
};

window.closeFoodDetail = function() {
  $('#foodDetailModal').classList.remove('show');
};

const closeFoodDetailBtn = $('#closeFoodDetail');
if (closeFoodDetailBtn) closeFoodDetailBtn.addEventListener('click', closeFoodDetail);

window.addToCart = function(listingId) {
  const listing = DB.listings.find(l => l.id === listingId);
  if (!listing) return;
  if (listing.quantity <= 0) { toast('❌ این غذا موجود نیست', true); return; }
  const cart = DB.cart;
  const existing = cart.find(c => c.listingId === listingId);
  if (existing) {
    if (existing.qty >= listing.quantity) { toast('❌ بیشتر از موجودی نمی‌تونی', true); return; }
    existing.qty++;
  } else {
    cart.push({ listingId, qty: 1 });
  }
  DB.cart = cart;
  updateCartCount();
  toast('✅ به سبد اضافه شد');
};

function updateCartCount() {
  const count = DB.cart.reduce((s, c) => s + c.qty, 0);
  const el = $('#cartCount');
  if (!el) return;
  el.textContent = count;
  el.style.display = count ? 'inline-block' : 'none';
}

window.changeQty = function(listingId, delta) {
  const cart = DB.cart;
  const item = cart.find(c => c.listingId === listingId);
  if (!item) return;
  const l = DB.listings.find(x => x.id === listingId);
  const newQty = item.qty + delta;
  if (newQty <= 0) { removeFromCart(listingId); return; }
  if (newQty > l.quantity) { toast('❌ بیشتر از موجودی', true); return; }
  item.qty = newQty;
  DB.cart = cart;
  updateCartCount();
  renderCart();
};

window.removeFromCart = function(listingId) {
  DB.cart = DB.cart.filter(c => c.listingId !== listingId);
  updateCartCount();
  renderCart();
};

function renderCart() {
  const cart = DB.cart;
  const listings = DB.listings;
  const sellers = DB.sellers;
  const wrap = $('#cartList');
  const summary = $('#cartSummary');
  if (!wrap) return;
  if (!cart.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">🛒</span>سبد خریدت خالیه</div>';
    summary.innerHTML = '';
    return;
  }
  let total = 0, totalOriginal = 0;
  wrap.innerHTML = cart.map(c => {
    const l = listings.find(x => x.id === c.listingId);
    if (!l) return '';
    const s = sellers.find(x => x.id === l.sellerId);
    total += l.discountedPrice * c.qty;
    totalOriginal += l.originalPrice * c.qty;
    return `
      <div class="card">
        <h3>${l.title}</h3>
        <p style="font-size:12px">🏪 ${s ? s.name : 'ناشناس'}</p>
        <div class="price-row">
          <span class="new-price">${toman(l.discountedPrice)} ت</span>
          <span style="font-size:12px;color:#6b7280">× ${c.qty} = ${toman(l.discountedPrice * c.qty)} ت</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <button class="btn small blue" onclick="changeQty('${l.id}', -1)">−</button>
          <b>${c.qty}</b>
          <button class="btn small" onclick="changeQty('${l.id}', 1)">+</button>
          <button class="btn small danger" onclick="removeFromCart('${l.id}')">حذف</button>
        </div>
      </div>`;
  }).join('');
  const savings = totalOriginal - total;
  summary.innerHTML = `
    <div class="card" style="background:#f0fdf4">
      <h3>💰 جمع سفارش</h3>
      <p>مجموع: <span class="old-price">${toman(totalOriginal)} ت</span></p>
      <p style="color:#16a34a;font-weight:800">قابل پرداخت: ${toman(total)} ت</p>
      ${savings > 0 ? `<p style="color:#dc2626;font-size:12px">🎉 صرفه‌جویی: ${toman(savings)} ت</p>` : ''}
      <button class="btn" onclick="openOrderModal()">✅ نهایی کردن</button>
    </div>`;
}

window.openOrderModal = function() {
  if (!DB.cart.length) return;
  const listings = DB.listings;
  let total = 0;
  const info = DB.cart.map(c => {
    const l = listings.find(x => x.id === c.listingId);
    if (!l) return '';
    total += l.discountedPrice * c.qty;
    return `<div style="font-size:12px;color:#374151">🍽️ ${l.title} × ${c.qty} = ${toman(l.discountedPrice * c.qty)} ت</div>`;
  }).join('');
  $('#orderFoodInfo').innerHTML = `
    <div style="background:#f0fdf4;padding:10px;border-radius:10px;margin-bottom:10px">
      ${info}
      <div style="border-top:1px solid #dcfce7;margin-top:8px;padding-top:8px;font-weight:700;color:#16a34a">
        جمع: ${toman(total)} تومان
      </div>
    </div>`;
  $('#orderModal').classList.add('show');
};

const closeOrderModalBtn = $('#closeOrderModal');
if (closeOrderModalBtn) closeOrderModalBtn.addEventListener('click', () => $('#orderModal').classList.remove('show'));

const orderFormEl = $('#orderForm');
if (orderFormEl) {
  orderFormEl.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f);
    const listings = DB.listings;
    const newOrders = [];
    DB.cart.forEach(c => {
      const l = listings.find(x => x.id === c.listingId);
      if (!l) return;
      l.quantity = Math.max(0, l.quantity - c.qty);
      l.orderCount = (l.orderCount || 0) + c.qty;
      newOrders.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        listingId: l.id,
        listingTitle: l.title,
        sellerId: l.sellerId,
        sellerName: (DB.sellers.find(s => s.id === l.sellerId) || {}).name || 'ناشناس',
        qty: c.qty,
        unitPrice: l.discountedPrice,
        totalPrice: l.discountedPrice * c.qty,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        note: data.note || '',
        status: 'pending',
        createdAt: Date.now()
      });
    });
    DB.listings = listings;
    const orders = DB.orders;
    orders.push(...newOrders);
    DB.orders = orders;
    DB.cart = [];
    updateCartCount();
    $('#orderModal').classList.remove('show');
    e.target.reset();
    toast('✅ سفارش ثبت شد!');
    $$('#tabsCustomer button').forEach(b => b.classList.remove('active'));
    $$('section.tab').forEach(s => s.classList.remove('active'));
    $('#tabsCustomer button[data-tab="myorders"]').classList.add('active');
    $('#tab-myorders').classList.add('active');
    renderMyOrders();
  });
}

function renderMyOrders() {
  const orders = DB.orders.slice().reverse();
  const wrap = $('#myOrdersList');
  if (!wrap) return;
  if (!orders.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">📦</span>هنوز سفارشی ثبت نکردی</div>';
    return;
  }
  const statusMap = {
    pending: { label: '⏳ در انتظار', cls: 'orange' },
    accepted: { label: '✅ تأیید شده', cls: 'green' },
    delivering: { label: '🛵 در حال ارسال', cls: 'blue' },
    delivered: { label: '🎉 تحویل داده شد', cls: 'green' },
    rejected: { label: '❌ رد شده', cls: 'red' }
  };
  wrap.innerHTML = orders.map(o => {
    const st = statusMap[o.status] || statusMap.pending;
    return `
      <div class="card">
        <h3>${o.listingTitle}</h3>
        <div class="meta">
          <span class="chip ${st.cls}">${st.label}</span>
          <span class="chip">🏪 ${o.sellerName}</span>
          <span class="chip green">📦 ${o.qty} پرس</span>
        </div>
        <p style="margin-top:8px;font-size:13px;color:#16a34a;font-weight:700">مبلغ: ${toman(o.totalPrice)} تومان</p>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">${new Date(o.createdAt).toLocaleString('fa-IR')}</div>
      </div>`;
  }).join('');
}

function renderSellerOrders() {
  const orders = DB.orders.slice().reverse();
  const wrap = $('#sellerOrdersList');
  if (!wrap) return;
  if (!orders.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">📥</span>هنوز سفارشی دریافت نکردی</div>';
    return;
  }
  const statusMap = {
    pending: '⏳ در انتظار',
    accepted: '✅ تأیید شده',
    delivering: '🛵 در حال ارسال',
    delivered: '🎉 تحویل شده',
    rejected: '❌ رد شده'
  };
  wrap.innerHTML = orders.map(o => `
    <div class="card">
      <h3>${o.listingTitle}</h3>
      <div class="meta">
        <span class="chip orange">${statusMap[o.status]}</span>
        <span class="chip green">📦 ${o.qty} پرس</span>
        <span class="chip blue">💰 ${toman(o.totalPrice)} ت</span>
      </div>
      <div style="margin-top:10px;font-size:13px;background:#f9fafb;padding:10px;border-radius:10px">
        <p>👤 <b>${o.customerName}</b></p>
        <p>📞 <a href="tel:${o.customerPhone}" style="color:#0969da">${o.customerPhone}</a></p>
        <p>📍 ${o.customerAddress}</p>
        ${o.note ? `<p>📝 ${o.note}</p>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        <button class="btn small" onclick="updateOrderStatus('${o.id}','accepted')">✅ تأیید</button>
        <button class="btn small blue" onclick="updateOrderStatus('${o.id}','delivering')">🛵 ارسال</button>
        <button class="btn small" style="background:linear-gradient(135deg,#15803d,#16a34a)" onclick="updateOrderStatus('${o.id}','delivered')">🎉 تحویل</button>
        <button class="btn small danger" onclick="updateOrderStatus('${o.id}','rejected')">❌ رد</button>
      </div>
    </div>
  `).join('');
}

window.updateOrderStatus = function(orderId, status) {
  const orders = DB.orders;
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.status = status;
  DB.orders = orders;
  toast('✅ وضعیت به‌روزرسانی شد');
  renderSellerOrders();
};

function fillSellerSelect() {
  const sel = $('#sellerSelect');
  if (!sel) return;
  const sellers = DB.sellers;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— انتخاب فروشنده —</option>' +
    sellers.map(s => `<option value="${s.id}">${s.name} (${typeLabel(s.type)})</option>`).join('');
  sel.value = cur;
}

const listingFormEl = $('#listingForm');
if (listingFormEl) {
  listingFormEl.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f);
    const item = {
      id: Date.now().toString(),
      title: data.title,
      sellerId: data.sellerId,
      description: data.description || '',
      image: data.image || '',
      originalPrice: Number(data.originalPrice),
      discountedPrice: Number(data.discountedPrice),
      quantity: Number(data.quantity),
      deliveryType: data.deliveryType,
      courierCost: Number(data.courierCost) || 0,
      deliveryTime: Number(data.deliveryTime),
      orderCount: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: Date.now()
    };
    if (item.discountedPrice > item.originalPrice) {
      toast('❌ قیمت تخفیف نمی‌تونه بیشتر از اصلی باشه', true);
      return;
    }
    const arr = DB.listings;
    arr.push(item);
    DB.listings = arr;
    e.target.reset();
    toast('✅ آگهی ثبت شد!');
  });
}

function updateLicenseField() {
  const sellerTypeEl = $('#sellerType');
  if (!sellerTypeEl) return;
  const type = sellerTypeEl.value;
  const needs = ['restaurant', 'fastfood', 'catering'].includes(type);
  const label = $('#licenseLabel');
  const input = $('#licenseInput');
  if (!label || !input) return;
  if (needs) {
    label.textContent = 'شماره جواز کسب (وزارت بهداشت)';
    label.classList.add('required');
    input.required = true;
  } else {
    label.textContent = 'شماره جواز (اختیاری)';
    label.classList.remove('required');
    input.required = false;
  }
}

const sellerTypeEl = $('#sellerType');
if (sellerTypeEl) {
  sellerTypeEl.addEventListener('change', updateLicenseField);
  updateLicenseField();
}

const gpsBtnEl = $('#gpsBtn');
if (gpsBtnEl) {
  gpsBtnEl.addEventListener('click', () => {
    const status = $('#gpsStatus');
    if (!status) return;
    if (!navigator.geolocation) { status.textContent = '❌ GPS پشتیبانی نمی‌شه'; return; }
    status.textContent = '⏳ در حال دریافت...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        $('#latInput').value = pos.coords.latitude.toFixed(6);
        $('#lngInput').value = pos.coords.longitude.toFixed(6);
        status.textContent = `✅ ثبت شد (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
      },
      () => { status.textContent = '❌ دسترسی رد شد'; }
    );
  });
}

const sellerFormEl = $('#sellerForm');
if (sellerFormEl) {
  sellerFormEl.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f);
    const seller = {
      id: Date.now().toString(),
      name: data.name,
      type: data.type,
      phone: data.phone || '',
      license: data.license || '',
      address: data.address,
      lat: data.lat || '',
      lng: data.lng || '',
      createdAt: Date.now()
    };
    const arr = DB.sellers;
    arr.push(seller);
    DB.sellers = arr;
    e.target.reset();
    updateLicenseField();
    $('#gpsStatus').textContent = '';
    toast('✅ فروشنده ثبت شد!');
    renderSellers();
    fillSellerSelect();
  });
}

function renderSellers() {
  const wrap = $('#sellersList');
  if (!wrap) return;
  const arr = DB.sellers;
  if (!arr.length) { wrap.innerHTML = '<div class="empty">هنوز فروشنده‌ای نیست.</div>'; return; }
  wrap.innerHTML = arr.slice().reverse().map(s => `
    <div style="border-bottom:1px solid #eee;padding:10px 0">
      <b>${s.name}</b> <span class="chip green">${typeLabel(s.type)}</span>
      ${s.license ? `<span class="chip">📜 ${s.license}</span>` : ''}
      <p style="font-size:12px;color:#6b7280;margin-top:4px">📍 ${s.address}${s.lat ? ` (${s.lat}, ${s.lng})` : ''}</p>
      ${s.phone ? `<p style="font-size:12px;color:#6b7280">📞 ${s.phone}</p>` : ''}
    </div>
  `).join('');
}

let currentReviewListingId = null;
let currentRating = 0;

window.openReviewModal = function(listingId) {
  currentReviewListingId = listingId;
  currentRating = 0;
  const l = DB.listings.find(x => x.id === listingId);
  if (!l) return;
  $('#reviewFoodInfo').innerHTML = `<div style="background:#f0fdf4;padding:10px;border-radius:10px;margin-bottom:10px;font-size:13px">🍽️ <b>${l.title}</b></div>`;
  updateStarPicker();
  $('#ratingInput').value = '';
  $('#reviewModal').classList.add('show');
};

function updateStarPicker() {
  $$('#starPicker span').forEach(s => {
    const v = Number(s.dataset.star);
    s.style.color = v <= currentRating ? '#f59e0b' : '#d1d5db';
  });
}

$$('#starPicker span').forEach(s => {
  s.addEventListener('click', () => {
    currentRating = Number(s.dataset.star);
    $('#ratingInput').value = currentRating;
    updateStarPicker();
  });
});

const closeReviewModalBtn = $('#closeReviewModal');
if (closeReviewModalBtn) closeReviewModalBtn.addEventListener('click', () => $('#reviewModal').classList.remove('show'));

const reviewFormEl = $('#reviewForm');
if (reviewFormEl) {
  reviewFormEl.addEventListener('submit', e => {
    e.preventDefault();
    if (!currentRating) { toast('❌ لطفاً امتیاز بده', true); return; }
    const f = new FormData(e.target);
    const data = Object.fromEntries(f);
    const comment = {
      id: Date.now().toString(),
      name: data.customerName,
      rating: Number(data.rating),
      text: data.text,
      createdAt: Date.now()
    };
    const comments = getComments(currentReviewListingId);
    comments.push(comment);
    saveComments(currentReviewListingId, comments);
    recalcRating(currentReviewListingId);
    e.target.reset();
    currentRating = 0;
    updateStarPicker();
    $('#reviewModal').classList.remove('show');
    toast('✅ نظر ثبت شد!');
    renderFoods();
  });
}

window.openCommentsModal = function(listingId) {
  const comments = getComments(listingId).slice().reverse();
  const wrap = $('#commentsList');
  if (!wrap) return;
  if (!comments.length) { wrap.innerHTML = '<div class="empty">هنوز نظری نیست. اولین نفر باش!</div>'; }
  else {
    wrap.innerHTML = comments.map(c => `
      <div style="border-bottom:1px solid #eaeef2;padding:10px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:14px">👤 ${c.name}</b>
          <span class="stars">${renderStars(c.rating)}</span>
        </div>
        <p style="font-size:13px;color:#374151;margin-top:4px">${c.text}</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:4px">${new Date(c.createdAt).toLocaleString('fa-IR')}</p>
      </div>
    `).join('');
  }
  $('#commentsModal').classList.add('show');
};

const closeCommentsModalBtn = $('#closeCommentsModal');
if (closeCommentsModalBtn) closeCommentsModalBtn.addEventListener('click', () => $('#commentsModal').classList.remove('show'));

const searchInputEl = $('#searchInput');
if (searchInputEl) {
  searchInputEl.addEventListener('input', e => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderFoods();
  });
}
const searchBtnEl = $('#searchBtn');
if (searchBtnEl) {
  searchBtnEl.addEventListener('click', () => {
    searchQuery = $('#searchInput').value.trim().toLowerCase();
    renderFoods();
  });
}

/* ═══════════ شروع ═══════════ */
updateCartCount();
renderFoods();

document.body.insertAdjacentHTML('beforeend', `
  <footer>
    © ۱۴۰۵ <b>سفره سبز</b> — تمامی حقوق محفوظ است<br>
    <span style="font-size:11px">سفره سبز، پلی برای استفاده بهینه از غذا</span><br>
    طراحی و توسعه: <a href="https://github.com/alavi1405">alavi1405</a>
    <span class="fingerprint">SAFREH-SABZ-1405-ALAVI-A1B2C3D4</span>
  </footer>
`);
