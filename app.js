/* ============================================================
   سفره سبز — v3 unified client (Final)
   ============================================================ */
(() => {
'use strict';
const SUPABASE_URL = 'https://znblebezgplnzjexdjjx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vCrEbmQ7YalZ9_rvnPlrqA_hBGL_TlY';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  db: null, sellers: [], foods: [], cart: [], position: null,
  authUser: null, mySeller: null, isAdmin: false,
};

const categoryNames = { restaurant:'رستوران', fastfood:'فست‌فود', catering:'کترینگ', home:'خانگی' };
const statusNames = {
  pending:'در انتظار پذیرش', accepted:'پذیرفته‌شده', preparing:'در حال آماده‌سازی',
  ready:'آماده تحویل', completed:'تحویل‌شده', cancelled:'لغو‌شده',
};

const money = (n) => `${Number(n||0).toLocaleString('fa-IR')} تومان`;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toAsciiDigits(s) {
  const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
  return String(s ?? '').replace(/[۰-۹٠-٩]/g, (d) => {
    const i = fa.indexOf(d);
    return i >= 0 ? String(i) : String(ar.indexOf(d));
  });
}
const normalizePhone = (v) => toAsciiDigits(v).replace(/[^\d+]/g, '').trim();

function normalizePersian(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ي/g,'ی').replace(/ك/g,'ک')
    .replace(/[\u200c\u200d]/g,' ')
    .replace(/[ًٌٍَُِّْـ]/g,'')
    .replace(/\s+/g,' ').trim();
}
function discount(f) {
  return f.original_price > f.discounted_price
    ? Math.round((1 - f.discounted_price/f.original_price) * 100) : 0;
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function notice(msg, error = false) {
  const el = $('#notice');
  el.textContent = msg;
  el.classList.remove('hidden','error');
  if (error) el.classList.add('error');
  window.scrollTo({ top:0, behavior:'smooth' });
  clearTimeout(notice._t);
  notice._t = setTimeout(() => el.classList.add('hidden'), 7000);
}
function connection(msg, error = false) {
  const el = $('#connection');
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle('error', error);
}
function showView(name) {
  $$('main section[id^="view-"]').forEach((el) => el.classList.add('hidden'));
  const target = $(`#view-${name}`);
  if (!target) return;
  target.classList.remove('hidden');
  if (name === 'cart') renderCart();
  if (name === 'seller') renderSellerView();
  if (name === 'admin') renderAdminView();
  if (name === 'orders') renderLocalOrders();
}

async function loadData() {
  try {
    const [sr, fr] = await Promise.all([
      state.db.from('sellers')
        .select('id,name,phone,address,type,image_url,latitude,longitude,courier_mode,courier_cost,subscription_until')
        .eq('is_active', true).order('created_at',{ascending:false}),
      state.db.from('listings')
        .select('id,seller_id,title,description,category,original_price,discounted_price,quantity,delivery_minutes,image_url,drinks,created_at')
        .eq('is_active', true).gt('quantity', 0).order('created_at',{ascending:false}),
    ]);
    if (sr.error) throw sr.error;
    if (fr.error) throw fr.error;
    state.sellers = sr.data || [];
    state.foods   = fr.data || [];
    connection(`اتصال برقرار است؛ ${state.foods.length.toLocaleString('fa-IR')} غذای موجود.`);
    renderFoods();
  } catch (err) {
    console.error(err);
    connection('اتصال به دیتابیس برقرار نشد.', true);
    if($('#foodList')) $('#foodList').innerHTML = '<div class="card">دریافت غذاها ناموفق بود.</div>';
  }
}
const sellerOf = (food) => state.sellers.find((s) => s.id === food.seller_id);

function currentCartSeller() {
  if (!state.cart.length) return null;
  const f = state.foods.find((x) => x.id === state.cart[0].id);
  return f ? sellerOf(f) : null;
}
function cartTotals() {
  let items = 0;
  for (const it of state.cart) {
    const f = state.foods.find((x) => x.id === it.id);
    if (f) items += Number(f.discounted_price) * it.qty;
  }
  const seller = currentCartSeller();
  const method = $('#delivery')?.value || 'pickup';
  let shipping = 0, canCourier = false, mode = 'none';
  if (seller) {
    mode = seller.courier_mode || 'none';
    canCourier = mode !== 'none';
    if (method === 'courier' && canCourier && mode === 'paid') shipping = Number(seller.courier_cost || 0);
  }
  return { items, shipping, total: items + shipping, canCourier, mode, seller };
}

function renderFoods() {
  const searchEl = $('#search'), catEl = $('#category');
  if(!searchEl || !catEl) return;
  
  const q = normalizePersian(searchEl.value);
  const cat = catEl.value;

  let list = state.foods.filter((f) => {
    const s = sellerOf(f);
    const hay = normalizePersian([f.title, f.description, s?.name, s?.address, categoryNames[f.category]].join(' '));
    return (!cat || f.category === cat) && (!q || hay.includes(q));
  });

  if (state.position) {
    list.sort((a,b) => {
      const sa = sellerOf(a), sb = sellerOf(b);
      const da = sa?.latitude != null ? distanceKm(state.position.latitude, state.position.longitude, sa.latitude, sa.longitude) : Infinity;
      const db = sb?.latitude != null ? distanceKm(state.position.latitude, state.position.longitude, sb.latitude, sb.longitude) : Infinity;
      return da - db;
    });
  }

  const wrap = $('#foodList');
  if (!list.length) { wrap.innerHTML = '<div class="card">غذایی با این مشخصات پیدا نشد.</div>'; return; }

  wrap.innerHTML = list.map((f) => {
    const s = sellerOf(f);
    const d = discount(f);
    let distTxt = '';
    if (state.position && s?.latitude != null) {
      const km = distanceKm(state.position.latitude, state.position.longitude, s.latitude, s.longitude);
      distTxt = ` · ${km.toFixed(1)} کیلومتر`;
    }
    const courierNote = s?.courier_mode === 'free' ? ' · ارسال رایگان'
      : s?.courier_mode === 'paid' ? ` · کرایه ${money(s.courier_cost)}` : '';
    return `<article class="card">
      ${f.image_url
        ? `<img class="food-img" loading="lazy" src="${escapeHtml(f.image_url)}" alt="${escapeHtml(f.title)}" onerror="this.style.display='none'">`
        : `<div class="food-img">🍲</div>`}
      <h3>${escapeHtml(f.title)}</h3>
      <p class="muted">${escapeHtml(s?.name || 'فروشنده')} · ${escapeHtml(categoryNames[f.category] || f.category)}${escapeHtml(distTxt)}${escapeHtml(courierNote)}</p>
      <p>${escapeHtml(f.description || '')}</p>
      ${f.drinks ? `<p class="muted">🥤 نوشیدنی‌ها: ${escapeHtml(f.drinks)}</p>` : ''}
      <p><span class="old">${money(f.original_price)}</span> <span class="price">${money(f.discounted_price)}</span> ${d ? `<span class="badge">${d.toLocaleString('fa-IR')}٪ تخفیف</span>` : ''}</p>
      <p class="muted">موجودی: ${Number(f.quantity).toLocaleString('fa-IR')} پرس · آماده‌سازی: ${Number(f.delivery_minutes || 0).toLocaleString('fa-IR')} دقیقه</p>
      <p class="muted">📍 ${escapeHtml(s?.address || 'نشانی ثبت نشده')}</p>
      <div class="row">
        <button data-add="${f.id}" ${f.quantity < 1 ? 'disabled' : ''}>افزودن به سبد</button>
        ${s?.phone ? `<a class="btn secondary fixed" style="text-decoration:none" href="tel:${encodeURIComponent(s.phone)}">📞 تماس</a>` : ''}
      </div>
    </article>`;
  }).join('');

  wrap.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addCart(b.dataset.add)));
}

function addCart(id) {
  const f = state.foods.find((x) => x.id === id);
  if (!f || f.quantity < 1) return notice('این غذا دیگر موجود نیست.', true);
  const firstSeller = state.cart[0] ? sellerOf(state.foods.find((x) => x.id === state.cart[0].id)) : null;
  if (firstSeller && firstSeller.id !== f.seller_id) {
    return notice('برای جلوگیری از اشتباه در ارسال، هر سفارش باید از یک فروشگاه باشد.', true);
  }
  const item = state.cart.find((x) => x.id === id);
  if (item) {
    if (item.qty >= f.quantity) return notice('تعداد انتخابی از موجودی بیشتر است.', true);
    item.qty++;
  } else {
    state.cart.push({ id, qty: 1 });
  }
  updateCartCount();
  notice('غذا به سبد اضافه شد.');
}
function updateCartCount() {
  const el = $('#cartCount');
  if(el) el.textContent = state.cart.reduce((a,x) => a + x.qty, 0).toLocaleString('fa-IR');
  localStorage.setItem('sofreh_cart', JSON.stringify(state.cart));
}
function renderCart() {
  const wrap = $('#cartList');
  const checkout = $('#checkout');
  if (!state.cart.length) {
    wrap.innerHTML = 'سبد خرید خالی است.';
    checkout.classList.add('hidden');
    return;
  }
  wrap.innerHTML = state.cart.map((item) => {
    const f = state.foods.find((x) => x.id === item.id);
    if (!f) return '';
    return `<div class="cart-line">
      <div><b>${escapeHtml(f.title)}</b><div class="muted">${money(f.discounted_price)} × ${item.qty.toLocaleString('fa-IR')}</div></div>
      <div class="row fixed">
        <button class="secondary fixed" data-dec="${f.id}">−</button>
        <button class="secondary fixed" data-inc="${f.id}">+</button>
        <button class="danger fixed" data-remove="${f.id}">حذف</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => setQty(b.dataset.dec, -1)));
  wrap.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => setQty(b.dataset.inc, 1)));
  wrap.querySelectorAll('[data-remove]').forEach((b) => (b.onclick = () => {
    state.cart = state.cart.filter((x) => x.id !== b.dataset.remove);
    updateCartCount(); renderCart();
  }));

  const t = cartTotals();
  const deliverySel = $('#delivery');
  const hint = $('#deliveryHint');

  if (!t.canCourier) {
    deliverySel.value = 'pickup';
    Array.from(deliverySel.options).forEach((o) => { if (o.value === 'courier') o.disabled = true; });
    hint.textContent = 'این فروشنده پیک ندارد؛ فقط تحویل حضوری.';
  } else {
    Array.from(deliverySel.options).forEach((o) => { if (o.value === 'courier') o.disabled = false; });
    hint.textContent = t.mode === 'free' ? 'ارسال رایگان توسط این فروشگاه.' : `هزینه پیک: ${money(t.seller?.courier_cost || 0)}`;
  }

  $('#orderTotal').innerHTML = `جمع غذاها: <b>${money(t.items)}</b>`
    + (t.shipping ? ` + پیک: <b>${money(t.shipping)}</b>` : '')
    + ` ⇒ قابل پرداخت: <b>${money(t.total)}</b>`;
  checkout.classList.remove('hidden');
}
function setQty(id, delta) {
  const item = state.cart.find((x) => x.id === id);
  const f = state.foods.find((x) => x.id === id);
  if (!item || !f) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((x) => x.id !== id);
  else if (item.qty > f.quantity) { item.qty = f.quantity; notice('تعداد از موجودی بیشتر است.', true); }
  updateCartCount(); renderCart();
}

$('#orderForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.cart.length) return notice('سبد خرید خالی است.', true);
  if (!$('#healthCheck') || !$('#healthCheck').checked) {
    return notice('لطفاً تیک تایید سلامت غذا را بزنید.', true);
  }
  const form = e.currentTarget;
  const btn = $('#submitOrder');
  btn.disabled = true;
  try {
    const customer_name    = $('#customerName').value.trim();
    const customer_phone   = normalizePhone($('#customerPhone').value);
    const customer_address = $('#customerAddress').value.trim();
    if (customer_name.length < 2 || customer_phone.length < 5 || customer_address.length < 3) {
      throw Error('نام، شماره تماس و نشانی را کامل وارد کنید.');
    }
    const items = state.cart.map((x) => ({ listing_id: x.id, quantity: x.qty }));
    const { data, error } = await state.db.rpc('place_order', {
      p_customer_name: customer_name,
      p_customer_phone: customer_phone,
      p_customer_address: customer_address,
      p_delivery_method: $('#delivery').value,
      p_note: $('#orderNote').value.trim(),
      p_items: items,
    });
    if (error) throw error;

    const orderId = data?.order_id;
    const pin     = data?.lookup_pin;
    if (!orderId || !pin) throw new Error('پاسخ سرور نامعتبر است.');

    try {
      const saved = JSON.parse(localStorage.getItem('sofreh_orders') || '[]');
      saved.unshift({ orderId, pin, phone: customer_phone, at: Date.now() });
      localStorage.setItem('sofreh_orders', JSON.stringify(saved.slice(0, 50)));
    } catch (_) {}

    state.cart = []; updateCartCount();
    form.reset();
    await loadData();
    showView('orders');
    $('#lookupPhone').value = customer_phone;
    $('#lookupPin').value = pin;
    await lookupOrders();
    notice(`سفارش ثبت شد. شماره: ${String(orderId).slice(0,8)} — پین شما: ${pin}`, false);
  } catch (err) {
    console.error(err);
    notice('سفارش ثبت نشد: ' + (err.message || 'خطای دیتابیس'), true);
    await loadData();
  } finally {
    btn.disabled = false;
  }
});

async function lookupOrders() {
  const phone = normalizePhone($('#lookupPhone').value);
  const pin   = toAsciiDigits($('#lookupPin').value).replace(/\D/g, '');
  const wrap  = $('#ordersList');
  if (phone.length < 5) { wrap.textContent = 'شماره تماس معتبر وارد کنید.'; return; }
  if (!/^\d{6}$/.test(pin)) { wrap.textContent = 'پین ۶ رقمی را وارد کنید.'; return; }
  wrap.textContent = 'در حال جستجو…';
  try {
    const { data, error } = await state.db.rpc('lookup_orders', { p_phone: phone, p_pin: pin });
    if (error) throw error;
    if (!data?.length) { wrap.innerHTML = '<div class="card">سفارشی با این مشخصات پیدا نشد.</div>'; return; }
    wrap.innerHTML = data.map(renderOrderCard).join('');
  } catch (err) {
    console.error(err);
    wrap.textContent = 'جستجو انجام نشد. ' + (err.message || '');
  }
}
function renderOrderCard(o) {
  const items = o.items || [];
  const phones = Array.from(new Set(items.map((i) => i.seller_phone).filter(Boolean)));
  return `<article class="card">
    <b>سفارش ${escapeHtml(String(o.id).slice(0,8))}</b>
    <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')} · وضعیت: <b>${escapeHtml(statusNames[o.status] || o.status)}</b></p>
    <p class="price">${money(o.total_amount)}</p>
    ${items.map((i) => `<p class="muted">${escapeHtml(i.title)} × ${i.quantity} — ${money(i.unit_price)} · ${escapeHtml(i.seller_name)}</p>`).join('')}
    ${phones.length ? `<p class="muted">تماس فروشنده: ${phones.map((p) => `<a href="tel:${encodeURIComponent(p)}">${escapeHtml(p)}</a>`).join('، ')}</p>` : ''}
  </article>`;
}
function renderLocalOrders() {
  const el = $('#localOrders');
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('sofreh_orders') || '[]'); } catch (_) {}
  if (!saved.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card">
    <b>سفارش‌های این دستگاه</b>
    ${saved.map((s) => `<button class="ghost" style="width:100%;text-align:right;margin:4px 0" data-local="${escapeHtml(s.orderId)}" data-pin="${escapeHtml(s.pin)}" data-phone="${escapeHtml(s.phone)}">
      ${String(s.orderId).slice(0,8)} — پین ${escapeHtml(s.pin)}
    </button>`).join('')}
  </div>`;
  el.querySelectorAll('[data-local]').forEach((b) => b.onclick = () => {
    $('#lookupPhone').value = b.dataset.phone;
    $('#lookupPin').value   = b.dataset.pin;
    lookupOrders();
  });
}

$('#gps')?.addEventListener('click', () => {
  if (!navigator.geolocation) return notice('مرورگر از مکان‌یابی پشتیبانی نمی‌کند.', true);
  $('#locationStatus').textContent = 'در حال دریافت موقعیت…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.position = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      $('#locationStatus').textContent = `موقعیت دریافت شد.`;
      notice('موقعیت دریافت شد.');
      renderFoods();
    },
    (err) => {
      $('#locationStatus').textContent = 'مکان‌یابی ناموفق.';
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
});

$('#search')?.addEventListener('input', renderFoods);
$('#category')?.addEventListener('change', renderFoods);
$$('[data-show]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.show)));
$('#lookupOrders')?.addEventListener('click', lookupOrders);

async function refreshAuth() {
  const { data: { user } } = await state.db.auth.getUser();
  state.authUser = user || null;
  state.isAdmin  = false;
  state.mySeller = null;
  if (!user) return;
  const { data: admin } = await state.db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  state.isAdmin = !!admin;
  const { data: seller } = await state.db.from('sellers').select('*').eq('user_id', user.id).maybeSingle();
  state.mySeller = seller || null;
}

async function renderSellerView() {
  await refreshAuth();
  const authBlock = $('#seller-auth');
  const regBlock  = $('#seller-register');
  const dashBlock = $('#seller-dashboard');
  authBlock.classList.add('hidden');
  regBlock.classList.add('hidden');
  dashBlock.classList.add('hidden');

  if (!state.authUser)      { authBlock.classList.remove('hidden'); return; }
  if (!state.mySeller)      { regBlock.classList.remove('hidden'); return; }
  dashBlock.classList.remove('hidden');
  await loadSellerOrders();
  await loadSellerListings();
}
async function renderAdminView() {
  await refreshAuth();
  const authBlock = $('#admin-auth');
  const dashBlock = $('#admin-dashboard');
  authBlock.classList.add('hidden');
  dashBlock.classList.add('hidden');
  if (!state.authUser || !state.isAdmin) { authBlock.classList.remove('hidden'); return; }
  dashBlock.classList.remove('hidden');
  await loadAdminOrders();
}

let authMode = 'signin';
$('#authToggle')?.addEventListener('click', () => {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  $('#authSubmit').textContent = authMode === 'signin' ? 'ورود' : 'ثبت‌نام';
  $('#authToggle').textContent = authMode === 'signin' ? 'ثبت‌نام' : 'ورود';
});
$('#authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const btn = $('#authSubmit');
  btn.disabled = true;
  try {
    if (authMode === 'signup') {
      const { error } = await state.db.auth.signUp({ email, password });
      if (error) throw error;
      notice('ثبت‌نام انجام شد.');
    } else {
      const { error } = await state.db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      notice('خوش آمدید.');
    }
    await renderSellerView();
  } catch (err) {
    notice('خطا: ' + (err.message || ''), true);
  } finally {
    btn.disabled = false;
  }
});

$('#courierMode')?.addEventListener('change', (e) => {
  const cost = $('#courierCost');
  cost.disabled = e.target.value !== 'paid';
  if (e.target.value !== 'paid') cost.value = 0;
});

$('#sellerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = e.submitter || form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    if (!state.authUser) throw new Error('ابتدا وارد شوید.');
    const d = Object.fromEntries(new FormData(form));
    const payload = {
      user_id: state.authUser.id,
      name: d.name.trim(),
      phone: normalizePhone(d.phone),
      address: d.address.trim(),
      type: d.type,
      image_url: d.image_url?.trim() || null,
      courier_mode: d.courier_mode,
      courier_cost: d.courier_mode === 'paid' ? Number(d.courier_cost || 0) : 0,
      latitude:  d.latitude  ? Number(d.latitude)  : null,
      longitude: d.longitude ? Number(d.longitude) : null,
    };
    const { error } = await state.db.from('sellers').insert(payload);
    if (error) throw error;
    form.reset();
    notice('فروشگاه ثبت شد.');
    await loadData();
    await renderSellerView();
  } catch (err) {
    notice('ثبت فروشنده انجام نشد: ' + (err.message || ''), true);
  } finally {
    btn.disabled = false;
  }
});

$$('[data-sellertab]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-sellertab]').forEach((x) => x.classList.toggle('active', x === b));
  ['orders','listings','new'].forEach((t) => $(`#seller-tab-${t}`)?.classList.toggle('hidden', t !== b.dataset.sellertab));
}));

async function loadSellerOrders() {
  const wrap = $('#sellerOrders');
  wrap.textContent = 'در حال بارگذاری…';
  try {
    const { data, error } = await state.db.rpc('seller_orders', { p_seller_id: state.mySeller.id });
    if (error) throw error;
    if (!data?.length) { wrap.innerHTML = '<div class="card">سفارشی ثبت نشده.</div>'; return; }
    wrap.innerHTML = data.map((o) => `<article class="card">
      <b>${escapeHtml(String(o.id).slice(0,8))}</b>
      <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')}</p>
      <div class="kv">
        <span>مشتری:</span><span>${escapeHtml(o.customer_name)} — <a href="tel:${encodeURIComponent(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></span>
        <span>مبلغ:</span><span class="price">${money(o.total_amount)}</span>
      </div>
      <div class="row" style="margin-top:8px">
        ${['accepted','preparing','ready','completed','cancelled'].map((s) =>
          `<button class="secondary fixed" data-status="${s}" data-order="${o.id}" ${o.status === s ? 'disabled' : ''}>${escapeHtml(statusNames[s])}</button>`
        ).join('')}
      </div>
    </article>`).join('');
    wrap.querySelectorAll('[data-status]').forEach((b) => b.onclick = () => changeOrderStatus(b.dataset.order, b.dataset.status, loadSellerOrders));
  } catch (err) {
    wrap.textContent = 'بارگذاری سفارش‌ها ناموفق: ' + (err.message || '');
  }
}

async function loadSellerListings() {
  const wrap = $('#sellerListings');
  wrap.textContent = 'در حال بارگذاری…';
  const { data, error } = await state.db.from('listings').select('*').eq('seller_id', state.mySeller.id).order('created_at',{ascending:false});
  if (error) { wrap.textContent = 'خطا: ' + error.message; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="card">هنوز غذایی ثبت نکرده‌اید.</div>'; return; }
  wrap.innerHTML = data.map((f) => `<div class="card">
    <b>${escapeHtml(f.title)}</b>
    <p class="muted">${categoryNames[f.category] || f.category} · موجودی ${f.quantity} · ${f.is_active ? 'فعال' : 'غیرفعال'}</p>
    <p class="price">${money(f.discounted_price)}</p>
    <div class="row" style="margin-top:6px">
      <button class="secondary fixed" data-del="${f.id}">حذف</button>
    </div>
  </div>`).join('');
  wrap.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('حذف این غذا؟')) return;
    const { error } = await state.db.from('listings').delete().eq('id', b.dataset.del);
    if (error) return notice('حذف ناموفق: ' + error.message, true);
    notice('حذف شد.'); await loadSellerListings(); await loadData();
  });
}

$('#foodForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = e.submitter || form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    if (!state.mySeller) throw new Error('فروشنده یافت نشد.');
    
    const subUntil = state.mySeller.subscription_until ? new Date(state.mySeller.subscription_until) : null;
    if (!subUntil || subUntil < new Date()) {
      throw new Error('اشتراک شما به پایان رسیده است. لطفاً برای تمدید با مدیر سیستم تماس بگیرید.');
    }

    const d = Object.fromEntries(new FormData(form));
    const original = Number(toAsciiDigits(d.original_price));
    const price    = Number(toAsciiDigits(d.discounted_price));
    const qty      = Number(toAsciiDigits(d.quantity));
    const mins     = Number(toAsciiDigits(d.delivery_minutes || 30));
    
    if (!Number.isSafeInteger(original) || original <= 0) throw new Error('قیمت اصلی نامعتبر.');
    if (!Number.isSafeInteger(price) || price <= 0 || price > original) throw new Error('قیمت تخفیفی معتبر نیست.');
    if (!Number.isInteger(qty) || qty < 0) throw new Error('موجودی نامعتبر.');
    
    const payload = {
      seller_id: state.mySeller.id,
      title: d.title.trim(),
      drinks: d.drinks ? d.drinks.trim() : null,
      description: d.description.trim(),
      category: d.category,
      original_price: original,
      discounted_price: price,
      quantity: qty,
      delivery_minutes: Math.max(0, mins),
      image_url: d.image_url.trim() || null,
    };
    
    const { error } = await state.db.from('listings').insert(payload);
    if (error) throw error;
    
    form.reset();
    notice('غذا ثبت شد.');
    await loadData();
    await loadSellerListings();
    
    $$('[data-sellertab]').forEach((x) => x.classList.toggle('active', x.dataset.sellertab === 'listings'));
    ['orders','listings','new'].forEach((t) => $(`#seller-tab-${t}`)?.classList.toggle('hidden', t !== 'listings'));
  } catch (err) {
    notice('ثبت غذا نامعتبر: ' + (err.message || ''), true);
  } finally {
    btn.disabled = false;
  }
});

$('#signOut')?.addEventListener('click', async () => {
  await state.db.auth.signOut();
  await renderSellerView();
});
$('#adminSignOut')?.addEventListener('click', async () => {
  await state.db.auth.signOut();
  await renderAdminView();
});

$('#adminAuthForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const { error } = await state.db.auth.signInWithPassword({
      email: $('#adminEmail').value.trim(),
      password: $('#adminPassword').value,
    });
    if (error) throw error;
    await renderAdminView();
    if (!state.isAdmin) notice('این حساب دسترسی مدیریت ندارد.', true);
  } catch (err) {
    notice('ورود ناموفق: ' + (err.message || ''), true);
  } finally {
    btn.disabled = false;
  }
});

async function loadAdminOrders() {
  const wrap = $('#adminOrders');
  wrap.textContent = 'در حال بارگذاری…';
  try {
    const { data, error } = await state.db.rpc('admin_list_orders', { p_limit: 200 });
    if (!error && data?.length) {
      wrap.innerHTML = data.map((o) => `<article class="card">
        <b>${escapeHtml(String(o.id).slice(0,8))}</b> · ${escapeHtml(o.seller_name || '')}
        <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')} | وضعیت: ${escapeHtml(statusNames[o.status] || o.status)}</p>
        <div class="row" style="margin-top:6px">
          ${['pending','accepted','preparing','ready','completed','cancelled'].map((s) =>
            `<button class="secondary fixed" data-status="${s}" data-order="${o.id}" ${o.status === s ? 'disabled' : ''}>${escapeHtml(statusNames[s])}</button>`
          ).join('')}
        </div>
      </article>`).join('');
      wrap.querySelectorAll('[data-status]').forEach((b) => b.onclick = () => changeOrderStatus(b.dataset.order, b.dataset.status, loadAdminOrders));
    } else {
      wrap.innerHTML = '<div class="card">سفارشی نیست.</div>';
    }
  } catch (err) {
    wrap.textContent = 'خطا در بارگذاری سفارش‌ها';
  }

  const sWrap = $('#adminSellers');
  if (sWrap) {
    try {
      const { data: sData } = await state.db.from('sellers').select('*').order('created_at', {ascending: false});
      if (sData) {
        sWrap.innerHTML = '<h3>فروشندگان و وضعیت اشتراک</h3>' + sData.map(s => `
          <div class="card" style="margin-bottom:8px">
            <b>${escapeHtml(s.name)}</b> - ${escapeHtml(categoryNames[s.type] || s.type)}<br>
            <span class="muted">اعتبار اشتراک: ${s.subscription_until ? new Date(s.subscription_until).toLocaleDateString('fa-IR') : 'ندارد'}</span><br>
            <button class="secondary" style="margin-top:5px" onclick="renewSub('${s.id}')">تمدید ۳۰ روزه</button>
          </div>
        `).join('');
      }
    } catch(e) { console.error(e); }
  }
}

window.renewSub = async (id) => {
  const newDate = new Date();
  newDate.setDate(newDate.getDate() + 30);
  const { error } = await state.db.from('sellers').update({ subscription_until: newDate.toISOString() }).eq('id', id);
  if (error) return notice('خطا در تمدید: ' + error.message, true);
  notice('اشتراک با موفقیت ۳۰ روز تمدید شد.');
  await loadAdminOrders();
};

async function changeOrderStatus(orderId, status, reloadFn) {
  const { error } = await state.db.from('orders').update({ status }).eq('id', orderId);
  if (error) return notice('تغییر وضعیت ناموفق', true);
  notice('وضعیت به‌روزرسانی شد.');
  await reloadFn();
}

// OTP Section (Kept for future Edge Functions integration)
const OTP = {
  phone: '', token: null,
  el: { step1: () => $('#otpStep1'), step2: () => $('#otpStep2'), step3: () => $('#otpStep3'), welcome: () => $('#otpWelcomePhone'), timer: () => $('#otpTimer') },
  go(step) { [['step1', this.el.step1()], ['step2', this.el.step2()], ['step3', this.el.step3()]].forEach(([k, e]) => e && e.classList.toggle('hidden', k !== step)); },
  async requestOtp() {
    const phone = normalizePhone($('#otpPhone').value);
    if (phone.length < 10) return notice('شماره تلفن معتبر نیست.', true);
    const btn = $('#otpRequest'); btn.disabled = true;
    try {
      const res = await fetch(`${FUNCTIONS_URL}/request-otp`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY }, body: JSON.stringify({ phone }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      this.phone = phone; this.go('step2'); startOtpCountdown(180);
      notice('کد پیامک شد.');
    } catch (e) { notice('ارسال کد ناموفق: ' + (e.message || ''), true); } finally { btn.disabled = false; }
  },
  async verifyOtp() {
    const code = toAsciiDigits($('#otpCode').value).replace(/\D/g, '');
    if (code.length !== 5) return notice('کد باید ۵ رقم باشد.', true);
    const btn = $('#otpVerify'); btn.disabled = true;
    try {
      const res = await fetch(`${FUNCTIONS_URL}/verify-otp`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY }, body: JSON.stringify({ phone: this.phone, code }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      this.token = j.token; localStorage.setItem('sofreh_otp_session', JSON.stringify({ token: j.token, phone: j.phone, expires_at: j.expires_at }));
      this.go('step3'); this.el.welcome().textContent = j.phone;
      await this.loadMyOrders();
    } catch (e) { notice('تأیید ناموفق: ' + (e.message || ''), true); } finally { btn.disabled = false; }
  },
  async loadMyOrders() {
    const wrap = $('#ordersList'); wrap.textContent = 'در حال بارگذاری…';
    try {
      const { data, error } = await state.db.rpc('my_orders', { p_token: this.token });
      if (error) throw error;
      if (!data?.length) { wrap.innerHTML = '<div class="card">سفارشی نیست.</div>'; return; }
      wrap.innerHTML = data.map(renderOrderCard).join('');
    } catch (e) { wrap.textContent = 'خطا در دریافت سفارش‌ها'; }
  },
  logout() { this.token = null; this.phone = ''; localStorage.removeItem('sofreh_otp_session'); this.go('step1'); $('#ordersList').innerHTML = ''; },
  restore() {
    try {
      const s = JSON.parse(localStorage.getItem('sofreh_otp_session') || 'null');
      if (!s || new Date(s.expires_at).getTime() < Date.now()) return false;
      this.token = s.token; this.phone = s.phone; this.el.welcome().textContent = s.phone; this.go('step3'); this.loadMyOrders(); return true;
    } catch { return false; }
  },
};
let otpTimerInterval = null;
function startOtpCountdown(seconds) {
  clearInterval(otpTimerInterval);
  const el = OTP.el.timer(); let remain = seconds;
  otpTimerInterval = setInterval(() => { if (remain <= 0) { el.textContent = 'منقضی شد'; clearInterval(otpTimerInterval); return; } remain--; el.textContent = `زمان: ${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}`; }, 1000);
}
function wireOtp() {
  if (!$('#otpRequest')) return;
  $('#otpRequest').addEventListener('click', () => OTP.requestOtp());
  $('#otpVerify').addEventListener('click', () => OTP.verifyOtp());
  $('#otpBack').addEventListener('click', () => { OTP.go('step1'); clearInterval(otpTimerInterval); });
  $('#otpLogout').addEventListener('click', () => OTP.logout());
  OTP.restore();
}

async function init() {
  if (!window.supabase?.createClient) return connection('کتابخانه Supabase بارگذاری نشد.', true);
  
  state.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  
  try { state.cart = JSON.parse(localStorage.getItem('sofreh_cart') || '[]'); } catch(e) { state.cart = []; }
  updateCartCount();

  state.db.auth.onAuthStateChange(() => {
    refreshAuth().then(() => {
      if (!$('#view-seller').classList.contains('hidden')) renderSellerView();
      if (!$('#view-admin').classList.contains('hidden')) renderAdminView();
    });
  });
  
  await loadData();
  await refreshAuth();
  wireOtp();
  
  const v = new URLSearchParams(location.search).get('v');
  if (v) showView(v);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
init();
})();
