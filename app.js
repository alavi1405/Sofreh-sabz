const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
function toast(msg, isError) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.toggle('error', !!isError); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
function toman(n) { return Number(n).toLocaleString('fa-IR'); }
function calcDiscount(oldP, newP) { if (!oldP || oldP <= newP) return 0; return Math.round((1 - newP / oldP) * 100); }
function typeLabel(t) { return { home: 'خانگی', restaurant: 'رستوران', fastfood: 'فست‌فود', catering: 'کترینگ' }[t] || t; }
function renderStars(rating) { const r = Number(rating) || 0; const full = Math.floor(r); const half = r - full >= 0.5; let s = ''; for (let i = 0; i < 5; i++) { if (i < full) s += '★'; else if (i === full && half) s += '⯨'; else s += '☆'; } return s; }

let currentMode = 'customer';
let searchQuery = '';

$$('.mode-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.mode-switch button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    if (currentMode === 'customer') {
      $('#tabsCustomer').style.display = 'flex'; $('#tabsSeller').style.display = 'none';
      $$('#tabsCustomer button').forEach(b => b.classList.remove('active')); $$('section.tab').forEach(s => s.classList.remove('active'));
      $('#tabsCustomer button[data-tab="foods"]').classList.add('active'); $('#tab-foods').classList.add('active'); loadFoods();
    } else {
      $('#tabsCustomer').style.display = 'none'; $('#tabsSeller').style.display = 'flex';
      $$('#tabsSeller button').forEach(b => b.classList.remove('active')); $$('section.tab').forEach(s => s.classList.remove('active'));
      $('#tabsSeller button[data-tab="newlisting"]').classList.add('active'); $('#tab-newlisting').classList.add('active'); loadSellerSelect();
    }
  });
});

$$('nav.tabs').forEach(nav => {
  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach(b => b.classList.remove('active')); btn.classList.add('active');
      $$('section.tab').forEach(s => s.classList.remove('active')); $('#tab-' + btn.dataset.tab).classList.add('active');
      const t = btn.dataset.tab;
      if (t === 'foods') loadFoods(); if (t === 'cart') renderCart(); if (t === 'myorders') loadMyOrders();
      if (t === 'newlisting') loadSellerSelect(); if (t === 'sellerorders') loadSellerOrders(); if (t === 'mysellers') loadSellers();
    });
  });
});

const searchInp = $('#searchInput');
if (searchInp) searchInp.addEventListener('input', e => { searchQuery = e.target.value.trim().toLowerCase(); loadFoods(); });
const searchBtn = $('#searchBtn');
if (searchBtn) searchBtn.addEventListener('click', () => { searchQuery = ($('#searchInput')?.value || '').trim().toLowerCase(); loadFoods(); });

async function loadFoods() {
  const wrap = $('#foodsList'); if (!wrap) return; wrap.innerHTML = '<div class="empty">⏳ در حال دریافت...</div>';
  const { data: listings, error } = await db.from('listings').select('*').order('created_at', { ascending: false });
  if (error) { wrap.innerHTML = '<div class="empty">❌ خطا در دریافت</div>'; return; }
  const { data: sellers } = await db.from('sellers').select('*');
  let filtered = listings || [];
  if (searchQuery) {
    filtered = filtered.filter(l => { const s = (sellers || []).find(x => x.id === l.seller_id); const text = (l.title + ' ' + (l.description || '') + ' ' + (s ? s.name + ' ' + s.address : '')).toLowerCase(); return text.includes(searchQuery); });
  }
  if (!filtered.length) { wrap.innerHTML = `<div class="empty"><span class="empty-icon">🍽️</span>${searchQuery ? 'نتیجه‌ای پیدا نشد' : 'هنوز آگهی‌ای نیست.'}</div>`; return; }
  wrap.innerHTML = '<div class="food-table">' + filtered.map(l => {
    const s = (sellers || []).find(x => x.id === l.seller_id); const disc = calcDiscount(l.original_price, l.discounted_price); const out = l.quantity <= 0; const rating = l.rating || 0;
    const img = l.image ? `<img src="${l.image}" onerror="this.outerHTML='🍲'">` : '🍲';
    return `<div class="food-row" onclick="openFoodDetail('${l.id}')"><div class="food-thumb">${img}${disc ? `<span class="discount-tag">${disc}٪</span>` : ''}</div><div class="food-info"><div class="food-title">${l.title}</div><div class="food-meta"><span>🏪 ${s ? s.name : 'ناشناس'}</span><span class="dot">•</span><span>📍 ${s ? (s.address || '').slice(0,20) : '—'}</span></div><div class="food-meta"><span>⏱️ ${l.delivery_time} دقیقه</span><span class="dot">•</span><span>📦 ${out ? 'تمام شد' : l.quantity + ' پرس'}</span></div></div><div class="food-price"><span class="old">${toman(l.original_price)}</span><span class="new">${toman(l.discounted_price)} ت</span><span class="stars-mini">${renderStars(rating)} (${l.rating_count || 0})</span></div></div>`;
  }).join('') + '</div>';
}

window.openFoodDetail = async function(id) {
  const { data: l } = await db.from('listings').select('*').eq('id', id).single();
  const { data: s } = await db.from('sellers').select('*').eq('id', l.seller_id).single();
  if (!l) return;
  const disc = calcDiscount(l.original_price, l.discounted_price); const out = l.quantity <= 0;
  const img = l.image ? `<img src="${l.image}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px">` : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:60px;margin-bottom:12px">🍲</div>`;
  const sellerPhone = s && s.phone ? s.phone : '';
  const contactButtons = sellerPhone ? `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;margin-top:12px"><p style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:8px">📞 راه‌های تماس:</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><button class="btn small" style="background:linear-gradient(135deg,#25D366,#128C7E);margin:0" onclick="contactSeller('${l.id}','whatsapp')">💬 واتساپ</button><button class="btn small blue" style="margin:0" onclick="contactSeller('${l.id}','telegram')">✈️ تلگرام</button><button class="btn small" style="background:linear-gradient(135deg,#f59e0b,#d97706);margin:0" onclick="contactSeller('${l.id}','sms')">📨 پیامک</button><button class="btn small danger" style="margin:0" onclick="contactSeller('${l.id}','call')">📞 تماس</button></div></div>` : '';
  $('#foodDetailContent').innerHTML = `${img}<h3 style="color:#15803d;font-size:18px;margin-bottom:8px">${l.title}</h3><p style="font-size:13px;color:#374151;margin-bottom:8px">${l.description || ''}</p><div class="price-row"><span class="old-price">${toman(l.original_price)} ت</span><span class="new-price">${toman(l.discounted_price)} ت</span>${disc ? `<span class="discount-badge">${disc}٪ تخفیف</span>` : ''}</div><div class="meta" style="margin-bottom:10px"><span class="chip ${out ? 'red' : 'green'}">📦 ${out ? 'تمام شد' : l.quantity + ' پرس'}</span><span class="chip">⏱️ ${l.delivery_time} دقیقه</span><span class="chip blue">🏪 ${s ? s.name : 'ناشناس'}</span></div><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:13px;font-weight:600">⭐ امتیاز:</span><span class="stars">${renderStars(l.rating || 0)}</span><span style="font-size:12px;color:#6b7280">(${l.rating_count || 0} نظر)</span></div>${contactButtons}<button class="btn small blue" onclick="openReviewModal('${l.id}');closeFoodDetail()" style="margin-top:10px">💬 ثبت نظر</button><button class="btn small gray" onclick="openCommentsModal('${l.id}')">📖 نظرات</button>${out ? `<button class="btn" disabled>❌ ناموجود</button>` : `<button class="btn" onclick="addToCart('${l.id}');closeFoodDetail()" style="margin-top:12px">🛒 افزودن به سبد</button>`}`;
  $('#foodDetailModal').classList.add('show');
};
window.closeFoodDetail = function() { $('#foodDetailModal').classList.remove('show'); };
$('#closeFoodDetail')?.addEventListener('click', closeFoodDetail);

window.contactSeller = async function(listingId, method) {
  const { data: l } = await db.from('listings').select('*').eq('id', listingId).single();
  const { data: s } = await db.from('sellers').select('*').eq('id', l.seller_id).single();
  if (!s || !s.phone) { toast('❌ فروشنده شماره ندارد', true); return; }
  const phone = s.phone.replace(/[^0-9]/g, ''); const message = `سلام 👋\nاز اپ سفره سبز مزاحم می‌شم.\nدرباره‌ی «${l.title}» سوال داشتم.\nممنون! 🍲`;
  if (method === 'whatsapp') { let wa = phone.startsWith('0') ? '98' + phone.slice(1) : phone; window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank'); }
  else if (method === 'sms') window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  else if (method === 'call') window.location.href = `tel:${phone}`;
  else if (method === 'telegram') window.open(`https://t.me/+98${phone.slice(1)}`, '_blank');
};

function getCart() { return JSON.parse(localStorage.getItem('safreh_cart') || '[]'); }
function setCart(v) { localStorage.setItem('safreh_cart', JSON.stringify(v)); updateCartCount(); }
window.addToCart = async function(id) {
  const { data: l } = await db.from('listings').select('*').eq('id', id).single();
  if (!l || l.quantity <= 0) { toast('❌ ناموجود', true); return; }
  const cart = getCart(); const existing = cart.find(c => c.listingId === id);
  if (existing) existing.qty++; else cart.push({ listingId: id, qty: 1 });
  setCart(cart); toast('✅ به سبد اضافه شد');
};
function updateCartCount() { const count = getCart().reduce((s, c) => s + c.qty, 0); const el = $('#cartCount'); if (el) { el.textContent = count; el.style.display = count ? 'inline-block' : 'none'; } }
window.changeQty = function(id, delta) { let cart = getCart(); const item = cart.find(c => c.listingId === id); if (!item) return; item.qty += delta; if (item.qty <= 0) cart = cart.filter(c => c.listingId !== id); setCart(cart); renderCart(); };
window.removeFromCart = function(id) { setCart(getCart().filter(c => c.listingId !== id)); renderCart(); };

async function renderCart() {
  const cart = getCart(); const wrap = $('#cartList'); const summary = $('#cartSummary');
  if (!cart.length) { wrap.innerHTML = '<div class="empty"><span class="empty-icon">🛒</span>سبد خالیه</div>'; summary.innerHTML = ''; return; }
  const { data: listings } = await db.from('listings').select('*'); let total = 0, totalOrig = 0;
  wrap.innerHTML = cart.map(c => {
    const l = (listings || []).find(x => x.id === c.listingId); if (!l) return '';
    total += l.discounted_price * c.qty; totalOrig += l.original_price * c.qty;
    return `<div class="card"><h3>${l.title}</h3><div class="price-row"><span class="new-price">${toman(l.discounted_price)} ت</span><span style="font-size:12px">× ${c.qty} = ${toman(l.discounted_price * c.qty)} ت</span></div><div style="display:flex;gap:8px;margin-top:6px"><button class="btn small blue" onclick="changeQty('${l.id}',-1)">−</button><b>${c.qty}</b><button class="btn small" onclick="changeQty('${l.id}',1)">+</button><button class="btn small danger" onclick="removeFromCart('${l.id}')">حذف</button></div></div>`;
  }).join('');
  summary.innerHTML = `<div class="card" style="background:#f0fdf4"><p style="color:#16a34a;font-weight:800">قابل پرداخت: ${toman(total)} ت</p><button class="btn" onclick="openOrderModal()">✅ نهایی کردن</button></div>`;
}

window.openOrderModal = function() { $('#orderModal').classList.add('show'); };
$('#closeOrderModal')?.addEventListener('click', () => $('#orderModal').classList.remove('show'));
$('#orderForm')?.addEventListener('submit', async e => {
  e.preventDefault(); const f = new FormData(e.target); const data = Object.fromEntries(f); const cart = getCart();
  const { data: listings } = await db.from('listings').select('*'); const newOrders = [];
  for (const c of cart) {
    const l = listings.find(x => x.id === c.listingId); if (!l) continue;
    const { data: s } = await db.from('sellers').select('name, phone').eq('id', l.seller_id).single();
    newOrders.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), listing_id: l.id, listing_title: l.title, seller_id: l.seller_id, seller_name: s?.name || 'ناشناس', seller_phone: s?.phone || '', qty: c.qty, unit_price: l.discounted_price, total_price: l.discounted_price * c.qty, customer_name: data.customerName, customer_phone: data.customerPhone, customer_address: data.customerAddress, note: data.note || '', status: 'pending', created_at: Date.now() });
    await db.from('listings').update({ quantity: l.quantity - c.qty }).eq('id', l.id);
  }
  await db.from('orders').insert(newOrders); setCart([]); $('#orderModal').classList.remove('show'); e.target.reset(); showHealthModal();
});

window.showHealthModal = function() { $('#healthModal').classList.add('show'); };
window.closeHealthModal = function() { $('#healthModal').classList.remove('show'); $$('#tabsCustomer button').forEach(b => b.classList.remove('active')); $$('section.tab').forEach(s => s.classList.remove('active')); $('#tabsCustomer button[data-tab="myorders"]').classList.add('active'); $('#tab-myorders').classList.add('active'); loadMyOrders(); toast('✅ سفارش ثبت شد!'); };

async function loadMyOrders() {
  const wrap = $('#myOrdersList'); if (!wrap) return;
  const { data: orders } = await db.from('orders').select('*').order('created_at', { ascending: false });
  if (!orders || !orders.length) { wrap.innerHTML = '<div class="empty">📦 هنوز سفارشی ثبت نکردی</div>'; return; }
  wrap.innerHTML = orders.map(o => `<div class="card"><h3>${o.listing_title}</h3><div class="meta"><span class="chip orange">${o.status}</span><span class="chip">📦 ${o.qty} پرس</span></div><p style="margin-top:8px;font-weight:700;color:#16a34a">${toman(o.total_price)} ت</p></div>`).join('');
}

async function loadSellerOrders() {
  const wrap = $('#sellerOrdersList'); if (!wrap) return;
  const { data: orders } = await db.from('orders').select('*').order('created_at', { ascending: false });
  if (!orders || !orders.length) { wrap.innerHTML = '<div class="empty">📥 سفارشی نیست</div>'; return; }
  wrap.innerHTML = orders.map(o => `<div class="card"><h3>${o.listing_title}</h3><div class="meta"><span class="chip orange">${o.status}</span><span class="chip green">📦 ${o.qty}</span></div><div style="font-size:13px;background:#f9fafb;padding:10px;border-radius:10px;margin-top:8px"><p>👤 ${o.customer_name}</p><p>📞 ${o.customer_phone}</p><p>📍 ${o.customer_address}</p></div></div>`).join('');
}

async function loadSellerSelect() {
  const sel = $('#sellerSelect'); if (!sel) return;
  const { data: sellers } = await db.from('sellers').select('*');
  sel.innerHTML = '<option value="">— انتخاب —</option>' + (sellers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

$('#sellerForm')?.addEventListener('submit', async e => {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
  await db.from('sellers').insert([{ id: Date.now().toString(), name: data.name, type: data.type, phone: data.phone || '', license: data.license || '', address: data.address, created_at: Date.now() }]);
  e.target.reset(); toast('✅ فروشنده ثبت شد'); loadSellers();
});

$('#listingForm')?.addEventListener('submit', async e => {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
  await db.from('listings').insert([{ id: Date.now().toString(), title: data.title, seller_id: data.sellerId, description: data.description || '', image: data.image || '', original_price: Number(data.originalPrice), discounted_price: Number(data.discountedPrice), quantity: Number(data.quantity), delivery_type: data.deliveryType, courier_cost: Number(data.courierCost) || 0, delivery_time: Number(data.deliveryTime), created_at: Date.now() }]);
  e.target.reset(); toast('✅ آگهی ثبت شد');
});

async function loadSellers() {
  const wrap = $('#sellersList'); if (!wrap) return;
  const { data: sellers } = await db.from('sellers').select('*');
  wrap.innerHTML = (sellers || []).map(s => `<div style="padding:10px;border-bottom:1px solid #eee"><b>${s.name}</b> - ${s.phone || ''}</div>`).join('');
}

let currentReviewId = null, currentRating = 0;
window.openReviewModal = function(id) { currentReviewId = id; currentRating = 0; updateStarPicker(); $('#reviewModal').classList.add('show'); };
function updateStarPicker() { $$('#starPicker span').forEach(s => { s.style.color = Number(s.dataset.star) <= currentRating ? '#f59e0b' : '#d1d5db'; }); }
$$('#starPicker span').forEach(s => s.addEventListener('click', () => { currentRating = Number(s.dataset.star); $('#ratingInput').value = currentRating; updateStarPicker(); }));
$('#closeReviewModal')?.addEventListener('click', () => $('#reviewModal').classList.remove('show'));

$('#reviewForm')?.addEventListener('submit', async e => {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
  await db.from('comments').insert([{ listing_id: currentReviewId, customer_name: data.customerName, rating: currentRating, text: data.text, created_at: Date.now() }]);
  $('#reviewModal').classList.remove('show'); toast('✅ نظر ثبت شد');
});

window.openCommentsModal = async function(id) {
  const { data: comments } = await db.from('comments').select('*').eq('listing_id', id);
  const wrap = $('#commentsList');
  wrap.innerHTML = (comments || []).length ? comments.map(c => `<div style="padding:10px;border-bottom:1px solid #eee"><b>${c.customer_name}</b> - ${renderStars(c.rating)}<br>${c.text}</div>`).join('') : '<div class="empty">نظری نیست</div>';
  $('#commentsModal').classList.add('show');
};
$('#closeCommentsModal')?.addEventListener('click', () => $('#commentsModal').classList.remove('show'));

document.body.insertAdjacentHTML('beforeend', `
  <footer>
    © ۱۴۰۵ <b>سفره سبز</b> — تمامی حقوق محفوظ است<br>
    <span style="font-size:11px">سفره سبز، پلی برای استفاده بهینه از غذا</span><br>
    طراحی و توسعه: <a href="https://github.com/alavi1405">alavi1405</a>
    <span class="fingerprint">SAFREH-SABZ-1405-ALAVI-A1B2C3D4</span>
  </footer>
`);

updateCartCount();
loadFoods();
