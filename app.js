// ═══════════════════════════════════════════════════
//   سفره سبز (Sofreh Sabz) - app.js (نسخه کامل)
// ═══════════════════════════════════════════════════

// ================= اتصال به دیتابیس آنلاین (Supabase) =================
// این بخش جایگزین حافظه محلی (localStorage) شده است
const SUPABASE_URL = "https://znblebezgplnzjexdjx.supabase.co";
const SUPABASE_KEY = "sb_publishable_vCrEbmQ7YalZ9_rvnPIrqA_hBGL_TI_";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// تعریف یک DB شبیه‌سازی‌شده تا کدهای پایین‌تر اپت بدون خطا کار کنن
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

// ============ حالت کاربر ============
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

// ============ تب‌ها ============
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

// ============ نمایش غذاها ============
async function renderFoods() {
  const { data: items, error } = await db.from('listings').select('*').order('created_at', { ascending: false });
const { data: sellers } = await db.from('sellers').select('*');
  const wrap = $('#foodsList');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">🍽️</span>هنوز آگهی‌ای ثبت نشده.<br>اگه فروشنده‌ای، از حالت فروشنده غذا اضافه کن!</div>';
    return;
  }
  wrap.innerHTML = '<div class="food-table">' + items.slice().reverse().map(l => {
    const s = sellers.find(x => x.id === l.sellerId);
    const disc = calcDiscount(l.originalPrice, l.discountedPrice);
    const out = l.quantity <= 0;
    const rating = l.rating || 0;
    const img = l.image ? `<img src="${l.image}" onerror="this.outerHTML='🍲'">` : '🍲';
    return `
      <div class="food-row" onclick="openFoodDetail('${l.id}')">
        <div class="food-thumb">${img}${disc ? `<span class="discount-tag">${disc}٪</span>` : ''}</div>
        <div class="food-info">
          <div class="food-title">${l.title}</div>
          <div class="food-meta"><span>🏪 ${s ? s.name : 'ناشناس'}</span><span class="dot">•</span><span>📍 ${s ? (s.address || '').slice(0,20) : '—'}</span></div>
          <div class="food-meta"><span>⏱️ ${l.deliveryTime} دقیقه</span><span class="dot">•</span><span>📦 ${out ? 'تمام شد' : l.quantity + ' پرس'}</span></div>
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
  const img = l.image ? `<img src="${l.image}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px">` : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:60px;margin-bottom:12px">🍲</div>`;

  const sellerPhone = s && s.phone ? s.phone : '';
  const contactButtons = sellerPhone ? `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;margin-top:12px">
      <p style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:8px">📞 راه‌های تماس:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn small" style="background:linear-gradient(135deg,#25D366,#128C7E);margin:0" onclick="contactSeller('${l.id}','whatsapp')">💬 واتساپ</button>
        <button class="btn small blue" style="margin:0" onclick="contactSeller('${l.id}','telegram')">✈️ تلگرام</button>
        <button class="btn small" style="background:linear-gradient(135deg,#f59e0b,#d97706);margin:0" onclick="contactSeller('${l.id}','sms')">📨 پیامک</button>
        <button class="btn small danger" style="margin:0" onclick="contactSeller('${l.id}','call')">📞 تماس</button>
      </div>
    </div>
  ` : '';

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
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:13px;font-weight:600">⭐ امتیاز:</span>
      <span class="stars">${renderStars(l.rating || 0)}</span>
      <span style="font-size:12px;color:#6b7280">(${l.ratingCount || 0} نظر)</span>
    </div>
    ${contactButtons}
    <button class="btn small blue" onclick="openReviewModal('${l.id}');closeFoodDetail()" style="margin-top:10px">💬 ثبت نظر</button>
    <button class="btn small gray" onclick="openCommentsModal('${l.id}')">📖 نظرات</button>
    ${out ? `<button class="btn" disabled>❌ ناموجود</button>` : `<button class="btn" onclick="addToCart('${l.id}');closeFoodDetail()" style="margin-top:12px">🛒 افزودن به سبد</button>`}
  `;
  $('#foodDetailModal').classList.add('show');
};

window.closeFoodDetail = function() { $('#foodDetailModal').classList.remove('show'); };
$('#closeFoodDetail')?.addEventListener('click', closeFoodDetail);

// ============ تماس امن ============
window.contactSeller = function(listingId, method) {
  const l = DB.listings.find(x => x.id === listingId);
  const s = DB.sellers.find(x => x.id === l.sellerId);
  if (!s || !s.phone) { toast('❌ فروشنده شماره ندارد', true); return; }
  const phone = s.phone.replace(/[^0-9]/g, '');
  const message = `سلام 👋\nاز اپ سفره سبز مزاحم می‌شم.\nدرباره‌ی «${l.title}» سوال داشتم.\nممنون! 🍲`;

  if (method === 'whatsapp') {
    let wa = phone.startsWith('0') ? '98' + phone.slice(1) : phone;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank');
  } else if (method === 'sms') {
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  } else if (method === 'call') {
    window.location.href = `tel:${phone}`;
  } else if (method === 'telegram') {
    window.open(`https://t.me/+98${phone.slice(1)}`, '_blank');
  }
};

// ============ سبد خرید ============
window.addToCart = function(listingId) {
  const listing = DB.listings.find(l => l.id === listingId);
  if (!listing) return;
  if (listing.quantity <= 0) { toast('❌ این غذا موجود نیست', true); return; }
  const cart = DB.cart;
  const existing = cart.find(c => c.listingId === listingId);
  if (existing) {
    if (existing.qty >= listing.quantity) { toast('❌ بیشتر از موجودی', true); return; }
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
  if (el) { el.textContent = count; el.style.display = count ? 'inline-block' : 'none'; }
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
  const wrap = $('#cartList');
  const summary = $('#cartSummary');
  if (!wrap) return;
  if (!cart.length) {
    wrap.innerHTML = '<div class="empty"><span class="empty-icon">🛒</span>سبد خریدت خالیه</div>';
    summary.innerHTML = '';
    return;
  }
  let total = 0;
  wrap.innerHTML = cart.map(c => {
    const l = listings.find(x => x.id === c.listingId);
    if (!l) return '';
    total += l.discountedPrice * c.qty;
    return `
      <div class="card">
        <h3>${l.title}</h3>
        <div class="price-row"><span class="new-price">${toman(l.discountedPrice)} ت</span></div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn small blue" onclick="changeQty('${l.id}', -1)">−</button>
          <b>${c.qty}</b>
          <button class="btn small" onclick="changeQty('${l.id}', 1)">+</button>
          <button class="btn small danger" onclick="removeFromCart('${l.id}')">حذف</button>
        </div>
      </div>`;
  }).join('');
  summary.innerHTML = `
    <div class="card" style="background:#f0fdf4">
      <p style="color:#16a34a;font-weight:800">قابل پرداخت: ${toman(total)} ت</p>
      <button class="btn" onclick="openOrderModal()">✅ نهایی کردن</button>
    </div>`;
}

// ============ ثبت سفارش ============
window.openOrderModal = function() { $('#orderModal').classList.add('show'); };
$('#closeOrderModal')?.addEventListener('click', () => $('#orderModal').classList.remove('show'));

$('#orderForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const cart = DB.cart;
  const orders = DB.orders;
  
  cart.forEach(c => {
    const l = DB.listings.find(x => x.id === c.listingId);
    if (l) {
      l.quantity -= c.qty;
      const s = DB.sellers.find(x => x.id === l.sellerId);
      orders.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2,6),
        listingTitle: l.title, sellerName: s?.name || 'ناشناس', sellerPhone: s?.phone || '',
        qty: c.qty, totalPrice: l.discountedPrice * c.qty,
        customerName: data.customerName, customerPhone: data.customerPhone,
        customerAddress: data.customerAddress, status: 'pending', createdAt: Date.now()
      });
    }
  });
  
  DB.orders = orders;
  DB.listings = DB.listings;
  DB.cart = [];
  updateCartCount();
  $('#orderModal').classList.remove('show');
  e.target.reset();
  showHealthModal();
});

window.showHealthModal = function() { $('#healthModal').classList.add('show'); };
window.closeHealthModal = function() {
  $('#healthModal').classList.remove('show');
  $$('#tabsCustomer button').forEach(b => b.classList.remove('active'));
  $$('section.tab').forEach(s => s.classList.remove('active'));
  $('#tabsCustomer button[data-tab="myorders"]').classList.add('active');
  $('#tab-myorders').classList.add('active');
  renderMyOrders();
  toast('✅ سفارش ثبت شد!');
};

// ============ سفارش‌ها ============
function renderMyOrders() {
  const wrap = $('#myOrdersList');
  if (!wrap) return;
  if (!DB.orders.length) { wrap.innerHTML = '<div class="empty">📦 سفارشی نیست</div>'; return; }
  wrap.innerHTML = DB.orders.slice().reverse().map(o => `
    <div class="card">
      <h3>${o.listingTitle}</h3>
      <p style="font-size:13px;font-weight:700;color:#16a34a">${toman(o.totalPrice)} ت</p>
    </div>
  `).join('');
}

function renderSellerOrders() {
  const wrap = $('#sellerOrdersList');
  if (!wrap) return;
  if (!DB.orders.length) { wrap.innerHTML = '<div class="empty">📥 سفارشی نیست</div>'; return; }
  wrap.innerHTML = DB.orders.slice().reverse().map(o => `
    <div class="card">
      <h3>${o.listingTitle}</h3>
      <p style="font-size:13px">👤 ${o.customerName} - 📞 ${o.customerPhone}</p>
      <p style="font-size:13px">📍 ${o.customerAddress}</p>
    </div>
  `).join('');
}

// ============ ثبت فروشنده و آگهی ============
function fillSellerSelect() {
  const sel = $('#sellerSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— انتخاب —</option>' + DB.sellers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

$('#sellerForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const sellers = DB.sellers;
  sellers.push({ id: Date.now().toString(), name: data.name, phone: data.phone, address: data.address });
  DB.sellers = sellers;
  e.target.reset(); toast('✅ فروشنده ثبت شد'); renderSellers(); fillSellerSelect();
});
  // ارسال اطلاعات به دیتابیس آنلاین (Supabase)
  const { error } = await db.from('listings').insert([{
    id: Date.now().toString(),
    title: data.title,
    original_price: Number(data.originalPrice || data.price || 0),
    discounted_price: Number(data.discountedPrice || data.price || 0),
    quantity: Number(data.quantity || 1),
    image: data.image || '',
    created_at: Date.now()
  }]);

  if (error) {
    toast('❌ خطا در ثبت غذا: ' + error.message, true);
    return;
  }

});
  
function renderSellers() {
  const wrap = $('#sellersList');
  if (!wrap) return;
  wrap.innerHTML = DB.sellers.map(s => `<div style="padding:10px;border-bottom:1px solid #eee"><b>${s.name}</b> - ${s.phone}</div>`).join('');
}

// ============ نظرات (ساده شده) ============
window.openReviewModal = function() { toast('ثبت نظر به زودی...'); };
window.openCommentsModal = function() { toast('نظرات به زودی...'); };

// ============ شروع ============
updateCartCount();
renderFoods();
