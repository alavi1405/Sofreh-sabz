(() => {
'use strict';
const SUPABASE_URL = "https://znblebezgplnzjexdjjx.supabase.co";
const SUPABASE_KEY = "sb_publishable_vCrEbmQ7YalZ9_rvnPlrqA_hBGL_TlY";

const CONFIG = { TRIAL_MODE: true, ZARINPAL_MERCHANT: "", SMS_API_KEY: "" };

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const state = { db:null, sellers:[], foods:[], cart:[], position:null, authUser:null, mySeller:null, isAdmin:false, currentOrderForChat:null, selectedSellerId:null };

const catNames = { restaurant:'رستوران', fastfood:'فست‌فود', catering:'کترینگ', home:'خانگی' };
const statusNames = { pending:'در انتظار پذیرش', accepted:'پذیرفته‌شده', preparing:'در حال آماده‌سازی', ready:'آماده تحویل', completed:'تحویل‌شده', cancelled:'لغو‌شده' };
const money = (n) => `${Number(n||0).toLocaleString('fa-IR')} تومان`;

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toAscii = (s) => String(s??'').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const normPhone = (v) => toAscii(v).replace(/[^\d+]/g,'').trim();
const normPersian = (s) => String(s??'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d]/g,' ').replace(/\s+/g,' ').trim();
const discount = (f) => f.original_price > f.discounted_price ? Math.round((1-f.discounted_price/f.original_price)*100) : 0;

function distanceKm(a,b,c,d){const R=6371,t=x=>x*Math.PI/180;const dLat=t(c-a),dLon=t(d-b);const x=Math.sin(dLat/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));}

function notice(msg, error=false){
  const el=$('#notice'); if(!el){alert(msg);return;}
  el.textContent=msg; el.classList.remove('hidden','error');
  if(error) el.classList.add('error');
  window.scrollTo({top:0,behavior:'smooth'});
  clearTimeout(notice._t); notice._t=setTimeout(()=>el.classList.add('hidden'),7000);
}
function connection(msg, error=false){
  const el=$('#connection'); if(!el)return; 
  if(!msg){ el.classList.add('hidden'); return; }
  el.textContent=msg; el.classList.remove('hidden'); el.classList.toggle('error',error);
}

function showView(name){
  $$('main section[id^="view-"]').forEach(e=>e.classList.add('hidden'));
  const t=$(`#view-${name}`); if(!t) return;
  t.classList.remove('hidden');
  if(name==='cart') renderCart();
  if(name==='orders') renderLocalOrders();
  if(name==='seller') renderSellerView();
  if(name==='admin') renderAdminView();
  if(name==='restaurants') renderRestaurants();
  if(name==='foods') {
      renderFoods(); 
      $('#backToRestaurants')?.classList.toggle('hidden', !state.selectedSellerId);
      $('#search').placeholder = state.selectedSellerId ? 'جستجو در منوی این فروشگاه…' : 'جستجو در نام غذا، توضیحات یا فروشگاه…';
  }
}

async function loadData(){
  try {
    const [sr,fr] = await Promise.all([
      state.db.from('sellers').select('id,name,phone,address,type,image_url,latitude,longitude,courier_mode,courier_cost,license_approved,guild_approved,subscription_until').eq('is_active',true).order('created_at',{ascending:false}),
      state.db.from('listings').select('id,seller_id,title,description,category,original_price,discounted_price,quantity,delivery_minutes,image_url,drinks,extras,created_at').eq('is_active',true).gt('quantity',0).order('created_at',{ascending:false})
    ]);
    if(sr.error) throw sr.error; if(fr.error) throw fr.error;
    state.sellers = sr.data||[]; state.foods = fr.data||[];
    connection(''); 
    if(!$('#view-foods').classList.contains('hidden')) renderFoods();
    if(!$('#view-restaurants').classList.contains('hidden')) renderRestaurants();
  } catch(err){ 
    console.error(err); 
    connection('اتصال به دیتابیس برقرار نشد.',true); 
    if($('#foodList')) $('#foodList').innerHTML=''; 
    if($('#restaurantList')) $('#restaurantList').innerHTML=''; 
  }
}

const sellerOf = (food) => state.sellers.find(s => s.id === food.seller_id);
function currentCartSeller(){ if(!state.cart.length) return null; const f = state.foods.find(x => x.id===state.cart[0].id); return f?sellerOf(f):null; }

function cartTotals(){
  let items=0;
  for(const it of state.cart){
    const f = state.foods.find(x=>x.id===it.id);
    if(!f) continue;
    let price = Number(f.discounted_price);
    if(it.extras && it.extras.length){ for(const ex of it.extras) price += Number(ex.price||0); }
    items += price * it.qty;
  }
  const seller = currentCartSeller();
  const method = $('#delivery')?.value || 'pickup';
  let shipping=0, canCourier=false, mode='none';
  if(seller){ mode=seller.courier_mode||'none'; canCourier = mode!=='none'; if(method==='courier'&&canCourier&&mode==='paid') shipping=Number(seller.courier_cost||0); }
  return { items, shipping, total: items+shipping, canCourier, mode, seller };
}

function renderRestaurants() {
    const wrap = $('#restaurantList'); if(!wrap) return;
    if (!state.sellers.length) { wrap.innerHTML = '<div class="card">هیچ فروشنده‌ای ثبت نشده است.</div>'; return; }
    let list = [...state.sellers];
    if (state.position) {
        list.sort((a, b) => {
            const da = a.latitude != null ? distanceKm(state.position.latitude, state.position.longitude, a.latitude, a.longitude) : Infinity;
            const db = b.latitude != null ? distanceKm(state.position.latitude, state.position.longitude, b.latitude, b.longitude) : Infinity;
            return da - db;
        });
    }
    wrap.innerHTML = list.map(s => {
        let distTxt = '';
        if (state.position && s.latitude != null) { const km = distanceKm(state.position.latitude, state.position.longitude, s.latitude, s.longitude); distTxt = ` · ${km.toFixed(1)} کیلومتر`; }
        return `<article class="card" style="cursor:pointer">
            ${s.image_url ? `<img class="food-img" src="${escapeHtml(s.image_url)}" alt="${escapeHtml(s.name)}">` : `<div class="food-img">🏪</div>`}
            <h3>${escapeHtml(s.name)}</h3>
            <p class="muted">${escapeHtml(catNames[s.type] || s.type)}${escapeHtml(distTxt)}</p>
            <p class="muted">📍 ${escapeHtml(s.address || '')}</p>
            <div class="row" style="margin-top:10px">
                <button class="secondary fixed" style="flex:1" onclick="event.stopPropagation(); openRestaurantMenu('${s.id}')">مشاهده منو</button>
                <a href="https://www.google.com/maps/search/?api=1&query=${s.latitude && s.longitude ? `${s.latitude},${s.longitude}` : encodeURIComponent(s.address || s.name)}" target="_blank" class="btn secondary" style="flex:1;text-align:center;text-decoration:none" onclick="event.stopPropagation()">📍 مسیریابی</a>
            </div>
        </article>`;
    }).join('');
}

window.openRestaurantMenu = (sellerId) => {
    state.selectedSellerId = sellerId;
    showView('foods');
};

$('#backToRestaurants')?.addEventListener('click', () => {
    state.selectedSellerId = null;
    showView('restaurants');
});

$('#gpsRestaurants')?.addEventListener('click', () => {
    if(!navigator.geolocation) return notice('GPS پشتیبانی نمی‌شود.',true);
    $('#restaurantLocationStatus').textContent='در حال دریافت…';
    navigator.geolocation.getCurrentPosition(
        pos => { state.position={latitude:pos.coords.latitude,longitude:pos.coords.longitude}; $('#restaurantLocationStatus').textContent='موقعیت دریافت شد.'; notice('موقعیت دریافت شد.'); renderRestaurants(); },
        err => { $('#restaurantLocationStatus').textContent='ناموفق.'; },
        { enableHighAccuracy:true, timeout:12000, maximumAge:60000 }
    );
});

function renderFoods(){
  const sEl=$('#search'), cEl=$('#category'); if(!sEl||!cEl) return;
  const q=normPersian(sEl.value), cat=cEl.value;
  let list = state.foods.filter(f => {
      if (state.selectedSellerId && f.seller_id !== state.selectedSellerId) return false;
      const s = sellerOf(f);
      const hay = normPersian([f.title,f.description,s?.name,s?.address,catNames[f.category]].join(' '));
      return (!cat || f.category===cat) && (!q || hay.includes(q));
  });
  if(state.position){
    list.sort((a,b)=>{
      const sa=sellerOf(a), sb=sellerOf(b);
      const da = sa?.latitude!=null ? distanceKm(state.position.latitude,state.position.longitude,sa.latitude,sa.longitude) : Infinity;
      const db = sb?.latitude!=null ? distanceKm(state.position.latitude,state.position.longitude,sb.latitude,sb.longitude) : Infinity;
      return da-db;
    });
  }
  const wrap=$('#foodList');
  if(!list.length){ wrap.innerHTML='<div class="card">غذایی با این مشخصات پیدا نشد.</div>'; return; }
  wrap.innerHTML = list.map(f=>{
    const s=sellerOf(f), d=discount(f);
    let distTxt='';
    if(state.position && s?.latitude!=null){ const km=distanceKm(state.position.latitude,state.position.longitude,s.latitude,s.longitude); distTxt=` · ${km.toFixed(1)} کیلومتر`; }
    const courierNote = s?.courier_mode==='free' ? ' · ارسال رایگان' : s?.courier_mode==='paid' ? ` · کرایه ${money(s.courier_cost)}` : '';
    
    let extrasList = f.extras;
    if (typeof extrasList === 'string') { try { extrasList = JSON.parse(extrasList); } catch(e) { extrasList = []; } }
    const extrasCount = Array.isArray(extrasList) ? extrasList.length : 0;
    
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${s.latitude && s.longitude ? `${s.latitude},${s.longitude}` : encodeURIComponent(s.address || s.name)}`;

    return `<article class="card">
      ${f.image_url ? `<img class="food-img" src="${escapeHtml(f.image_url)}" alt="${escapeHtml(f.title)}" loading="lazy">` : `<div class="food-img">🍲</div>`}
      <h3>${escapeHtml(f.title)}</h3>
      <p class="muted">${escapeHtml(s?.name||'فروشنده')} · ${escapeHtml(catNames[f.category]||f.category)}${escapeHtml(distTxt)}${escapeHtml(courierNote)}</p>
      <p>${escapeHtml(f.description||'')}</p>
      ${f.drinks ? `<p class="muted">🥤 ${escapeHtml(f.drinks)}</p>` : ''}
      ${extrasCount ? `<p class="muted">➕ ${extrasCount} افزودنی اختیاری</p>` : ''}
      <p><span class="old">${money(f.original_price)}</span> <span class="price">${money(f.discounted_price)}</span> ${d?`<span class="badge">${d.toLocaleString('fa-IR')}٪</span>`:''}</p>
      <p class="muted">موجودی: ${Number(f.quantity).toLocaleString('fa-IR')} · آماده‌سازی: ${Number(f.delivery_minutes||0).toLocaleString('fa-IR')} دقیقه</p>
      <p class="muted">📍 ${escapeHtml(s?.address||'نشانی ثبت نشده')}</p>
      <div class="row" style="margin-bottom:8px">
        <button data-add="${f.id}" ${f.quantity<1?'disabled':''}>
            ${extrasCount > 0 ? '➕ انتخاب افزودنی' : 'افزودن به سبد'}
        </button>
      </div>
      <div class="row">
        ${s?.phone?`<a href="tel:${encodeURIComponent(s.phone)}" class="btn secondary" style="text-align:center;text-decoration:none">📞 تماس</a>`:''}
        ${s?.latitude || s?.address ? `<a href="${mapUrl}" target="_blank" class="btn secondary" style="text-align:center;text-decoration:none">📍 مسیریابی</a>` : ''}
      </div>
    </article>`;
  }).join('');
  wrap.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>openExtrasModal(b.dataset.add)));
}

function openExtrasModal(foodId){
  const f = state.foods.find(x=>x.id===foodId);
  if(!f) return;
  let extras = f.extras;
  if (typeof extras === 'string') { try { extras = JSON.parse(extras); } catch(e) { extras = []; } }
  if (!Array.isArray(extras)) extras = [];
  
  if(!extras.length){ return addCart(foodId, []); }
  const modal = document.createElement('div');
  modal.className='modal-bg';
  modal.innerHTML = `<div class="modal">
    <h3>افزودنی‌های اختیاری</h3>
    <p class="muted">${escapeHtml(f.title)}</p>
    ${extras.map((ex,i)=>`
      <label class="ext-item">
        <input type="checkbox" data-ex="${i}">
        <span>${escapeHtml(ex.name)} — ${money(ex.price)}</span>
      </label>`).join('')}
    <div class="row" style="margin-top:12px">
      <button id="exConfirm" class="fixed">افزودن به سبد</button>
      <button id="exCancel" class="secondary fixed">لغو</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#exCancel').onclick = () => modal.remove();
  modal.querySelector('#exConfirm').onclick = () => {
    const selected = Array.from(modal.querySelectorAll('[data-ex]:checked')).map(cb => extras[Number(cb.dataset.ex)]);
    modal.remove();
    addCart(foodId, selected);
  };
}

function addCart(id, extras){
  const f = state.foods.find(x=>x.id===id);
  if(!f || f.quantity<1) return notice('این غذا دیگر موجود نیست.', true);
  const firstSeller = state.cart[0] ? sellerOf(state.foods.find(x=>x.id===state.cart[0].id)) : null;
  if(firstSeller && firstSeller.id!==f.seller_id) return notice('برای جلوگیری از اشتباه در ارسال، هر سفارش باید از یک فروشگاه باشد.', true);
  const key = id + '|' + JSON.stringify((extras||[]).map(e=>e.name));
  const existing = state.cart.find(x=>x.key===key);
  if(existing){ if(existing.qty >= f.quantity) return notice('تعداد از موجودی بیشتر است.', true); existing.qty++; }
  else state.cart.push({ key, id, qty:1, extras: extras||[] });
  updateCartCount(); notice('غذا به سبد اضافه شد.');
  if(!$('#view-cart').classList.contains('hidden')) renderCart();
}

function updateCartCount(){
  const el=$('#cartCount'); if(el) el.textContent = state.cart.reduce((a,x)=>a+x.qty,0).toLocaleString('fa-IR');
  localStorage.setItem('sofreh_cart', JSON.stringify(state.cart));
}

function renderCart(){
  const wrap=$('#cartList'), checkout=$('#checkout');
  state.cart = state.cart.filter(it => state.foods.some(x=>x.id===it.id));
  if(!state.cart.length){ wrap.innerHTML='سبد خرید خالی است.'; checkout.classList.add('hidden'); updateCartCount(); return; }
  wrap.innerHTML = state.cart.map(item=>{
    const f = state.foods.find(x=>x.id===item.id);
    const extrasSum = (item.extras||[]).reduce((a,e)=>a+Number(e.price||0),0);
    const lineTotal = (Number(f.discounted_price)+extrasSum) * item.qty;
    return `<div class="cart-line">
      <div>
        <b>${escapeHtml(f.title)}</b>
        ${item.extras?.length?`<div class="muted">${item.extras.map(e=>escapeHtml(e.name)).join('، ')}</div>`:''}
        <div class="muted">${money(Number(f.discounted_price)+extrasSum)} × ${item.qty.toLocaleString('fa-IR')} = ${money(lineTotal)}</div>
      </div>
      <div class="row fixed">
        <button class="secondary fixed" data-dec="${item.key}">−</button>
        <button class="secondary fixed" data-inc="${item.key}">+</button>
        <button class="danger fixed" data-remove="${item.key}">حذف</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>setQty(b.dataset.dec,-1));
  wrap.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>setQty(b.dataset.inc,1));
  wrap.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{ state.cart=state.cart.filter(x=>x.key!==b.dataset.remove); updateCartCount(); renderCart(); });
  
  const t = cartTotals();
  const dSel=$('#delivery'), hint=$('#deliveryHint');
  if(!t.canCourier){ dSel.value='pickup'; Array.from(dSel.options).forEach(o=>{if(o.value==='courier')o.disabled=true;}); hint.textContent='این فروشنده پیک ندارد.'; }
  else { Array.from(dSel.options).forEach(o=>{if(o.value==='courier')o.disabled=false;}); hint.textContent = t.mode==='free'?'ارسال رایگان.':`هزینه پیک: ${money(t.seller?.courier_cost||0)}`; }
  
  $('#orderTotal').innerHTML = `جمع غذاها: <b>${money(t.items)}</b>` + (t.shipping?`<br>+ پیک: <b>${money(t.shipping)}</b>`:'') + `<br>⇒ قابل پرداخت: <b>${money(t.total)}</b>`;
  checkout.classList.remove('hidden');
}

function setQty(key, delta){
  const item = state.cart.find(x=>x.key===key); if(!item) return;
  const f = state.foods.find(x=>x.id===item.id); if(!f) return;
  item.qty += delta;
  if(item.qty<=0) state.cart = state.cart.filter(x=>x.key!==key);
  else if(item.qty > f.quantity){ item.qty=f.quantity; notice('تعداد از موجودی بیشتر است.',true); }
  updateCartCount(); renderCart();
}

// افزودن رویداد تغییر روش ارسال برای آپدیت لحظه‌ای جمع کل
$('#delivery')?.addEventListener('change', () => { if(!$('#view-cart').classList.contains('hidden')) renderCart(); });

$('#orderForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!state.cart.length) return notice('سبد خرید خالی است.',true);
  if(!$('#healthCheck')?.checked) return notice('لطفاً تیک تایید سلامت غذا را بزنید.',true);
  const btn=$('#submitOrder'); btn.disabled=true;
  try {
    const customer_name = $('#customerName').value.trim();
    const customer_phone = normPhone($('#customerPhone').value);
    const customer_address = $('#customerAddress').value.trim();
    if(customer_name.length<2 || customer_phone.length<5 || customer_address.length<3) throw new Error('نام، شماره تماس و نشانی را کامل کنید.');
    const items = state.cart.map(x=>({ listing_id:x.id, quantity:x.qty, extras:x.extras||[] }));
    const t = cartTotals();
    
    const { data, error } = await state.db.rpc('place_order', {
      p_customer_name: customer_name, p_customer_phone: customer_phone,
      p_customer_address: customer_address, p_delivery_method: $('#delivery').value,
      p_note: $('#orderNote').value.trim(), p_items: items, p_shipping: t.shipping
    });
    if(error) throw error;
    const orderId = data?.order_id, pin = data?.lookup_pin;
    if(!orderId || !pin) throw new Error('پاسخ سرور نامعتبر.');
    try {
      const saved = JSON.parse(localStorage.getItem('sofreh_orders')||'[]');
      saved.unshift({ orderId, pin, phone: customer_phone, at: Date.now() });
      localStorage.setItem('sofreh_orders', JSON.stringify(saved.slice(0,50)));
    } catch(_) {}
    state.cart=[]; updateCartCount(); e.target.reset(); await loadData();
    showView('orders'); $('#lookupPhone').value=customer_phone; $('#lookupPin').value=pin;
    await lookupOrders();
    notice(`✅ سفارش ثبت شد. شماره: ${String(orderId).slice(0,8)} — پین: ${pin}`);
  } catch(err){ console.error(err); notice('سفارش ثبت نشد: '+(err.message||'خطا'),true); }
  finally { btn.disabled=false; }
});

async function lookupOrders(){
  const phone = normPhone($('#lookupPhone').value);
  const pin = toAscii($('#lookupPin').value).replace(/\D/g,'');
  const wrap=$('#ordersList');
  if(phone.length<5){wrap.textContent='شماره معتبر نیست.';return;}
  if(!/^\d{6}$/.test(pin)){wrap.textContent='پین ۶ رقمی لازم است.';return;}
  wrap.textContent='در حال جستجو…';
  try {
    const { data, error } = await state.db.rpc('lookup_orders', { p_phone: phone, p_pin: pin });
    if(error) throw error;
    if(!data?.length){ wrap.innerHTML='<div class="card">سفارشی پیدا نشد.</div>'; return; }
    wrap.innerHTML = data.map(renderOrderCard).join('');
    wrap.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>openChat(b.dataset.chat,'customer'));
  } catch(err){ wrap.textContent='خطا: '+(err.message||''); }
}

function renderOrderCard(o){
  const items = o.items || [];
  const phones = Array.from(new Set(items.map(i=>i.seller_phone).filter(Boolean)));
  const isActive = o.status!=='completed' && o.status!=='cancelled';
  return `<article class="card">
    <b>سفارش ${escapeHtml(String(o.id).slice(0,8))}</b>
    <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')} · وضعیت: <b>${escapeHtml(statusNames[o.status]||o.status)}</b></p>
    <p class="price">${money(o.total_amount)}</p>
    ${items.map(i=>`<div class="muted">${escapeHtml(i.title)} × ${i.quantity} — ${money(i.unit_price)} · ${escapeHtml(i.seller_name||'')}</div>`).join('')}
    ${o.health_message?`<div class="health-box">🏥 ${escapeHtml(o.health_message)}</div>`:''}
    ${phones.length?`<p class="muted">تماس فروشنده: ${phones.map(p=>`<a href="tel:${encodeURIComponent(p)}">${escapeHtml(p)}</a>`).join('، ')}</p>`:''}
    ${isActive?`<div class="row" style="margin-top:8px"><button class="secondary fixed" data-chat="${o.id}">💬 چت با فروشنده</button></div>`:''}
  </article>`;
}

function renderLocalOrders(){
  const el=$('#localOrders'); if(!el) return;
  let saved=[]; try { saved=JSON.parse(localStorage.getItem('sofreh_orders')||'[]'); } catch(_) {}
  if(!saved.length){ el.innerHTML=''; return; }
  el.innerHTML = `<div class="card"><b>سفارش‌های این دستگاه</b>${saved.map(s=>`
    <div class="row" style="margin-top:8px;border-bottom:1px solid #eee;padding-bottom:8px">
      <span>${String(s.orderId).slice(0,8)} — پین ${escapeHtml(s.pin)}</span>
      <button class="secondary fixed" data-phone="${escapeHtml(s.phone)}" data-pin="${escapeHtml(s.pin)}">مشاهده</button>
    </div>`).join('')}</div>`;
  el.querySelectorAll('[data-phone]').forEach(b=>b.onclick=()=>{ $('#lookupPhone').value=b.dataset.phone; $('#lookupPin').value=b.dataset.pin; lookupOrders(); });
}

async function openChat(orderId, senderType){
  state.currentOrderForChat = orderId;
  const modal = document.createElement('div');
  modal.className='modal-bg';
  modal.innerHTML = `<div class="modal" style="max-height:80vh">
    <div class="row" style="justify-content:space-between">
      <h3 style="margin:0">💬 چت سفارش</h3>
      <button id="chatClose" class="secondary fixed">بستن</button>
    </div>
    <div id="chatBody" style="max-height:50vh;overflow-y:auto;margin:12px 0;border:1px solid #ddd;border-radius:10px;padding:8px;background:#f8f8f8"></div>
    <div class="row">
      <input id="chatInput" placeholder="پیام شما…" maxlength="500">
      ${senderType === 'seller' ? `<button id="chatSendLoc" class="secondary fixed" title="ارسال موقعیت GPS">📍</button>` : ''}
      <button id="chatSend" class="fixed">ارسال</button>
    </div>
  </div>`;
  
  document.body.appendChild(modal);
  modal.querySelector('#chatClose').onclick = () => modal.remove();
  const body = modal.querySelector('#chatBody');
  
  const load = async () => {
    const { data } = await state.db.rpc('get_chat_messages', { p_order_id: orderId });
    body.innerHTML = (data||[]).map(m => {
      let msgContent = '';
      if (m.message.startsWith('[LOCATION]')) {
        const coords = m.message.replace('[LOCATION]', '').split(',');
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
        msgContent = `<a href="${mapUrl}" target="_blank" class="btn secondary" style="display:inline-block;margin-top:6px;padding:6px 12px;font-size:13px;text-decoration:none">📍 مشاهده روی نقشه</a>`;
      } else {
        msgContent = escapeHtml(m.message);
      }
      return `<div style="margin:6px 0;padding:6px 10px;border-radius:8px;background:${m.sender_type==='customer'?'#e6f2e9':'#fff0d8'};max-width:75%;${m.sender_type==='customer'?'margin-right:auto':'margin-left:auto'}">
        <b>${m.sender_type==='customer'?'مشتری':'فروشنده'}:</b> <div>${msgContent}</div>
        <div class="muted" style="font-size:10px">${new Date(m.created_at).toLocaleTimeString('fa-IR')}</div>
      </div>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
  };
  
  await load();
  modal.querySelector('#chatSend').onclick = async () => {
    const msg = modal.querySelector('#chatInput').value.trim();
    if(!msg) return;
    await state.db.rpc('send_chat_message', { p_order_id: orderId, p_sender_type: senderType, p_sender_id: state.authUser?.id||null, p_message: msg });
    modal.querySelector('#chatInput').value='';
    await load();
  };
  modal.querySelector('#chatSendLoc')?.addEventListener('click', async () => {
    if (!state.mySeller || !state.mySeller.latitude || !state.mySeller.longitude) {
      alert('موقعیت فروشگاه شما ثبت نشده است. لطفاً از پنل فروشنده، موقعیت را ثبت کنید.');
      return;
    }
    const locMsg = `[LOCATION]${state.mySeller.latitude},${state.mySeller.longitude}`;
    await state.db.rpc('send_chat_message', { p_order_id: orderId, p_sender_type: 'seller', p_sender_id: state.authUser?.id||null, p_message: locMsg });
    await load();
  });
  const interval = setInterval(load, 4000);
  modal.addEventListener('DOMNodeRemoved', ()=>clearInterval(interval));
}

$('#gps')?.addEventListener('click', ()=>{
  if(!navigator.geolocation) return notice('GPS پشتیبانی نمی‌شود.',true);
  $('#locationStatus').textContent='در حال دریافت…';
  navigator.geolocation.getCurrentPosition(
    pos => { state.position={latitude:pos.coords.latitude,longitude:pos.coords.longitude}; $('#locationStatus').textContent='موقعیت دریافت شد.'; notice('موقعیت دریافت شد.'); renderFoods(); },
    err => { $('#locationStatus').textContent='ناموفق.'; },
    { enableHighAccuracy:true, timeout:12000, maximumAge:60000 }
  );
});

$('#search')?.addEventListener('input', renderFoods);
$('#category')?.addEventListener('change', renderFoods);
$$('[data-show]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.show)));
$('#lookupOrders')?.addEventListener('click', lookupOrders);

async function refreshAuth(){
  const { data:{ user } } = await state.db.auth.getUser();
  state.authUser = user||null; state.isAdmin=false; state.mySeller=null;
  if(!user) return;
  const { data:admin } = await state.db.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  state.isAdmin = !!admin;
  const { data:seller } = await state.db.from('sellers').select('*').eq('user_id',user.id).maybeSingle();
  state.mySeller = seller||null;
}

async function renderSellerView(){
  await refreshAuth();
  $('#seller-auth')?.classList.add('hidden'); $('#seller-register')?.classList.add('hidden'); $('#seller-dashboard')?.classList.add('hidden');
  if(!state.authUser){ $('#seller-auth')?.classList.remove('hidden'); return; }
  if(!state.mySeller){ $('#seller-register')?.classList.remove('hidden'); return; }
  $('#seller-dashboard')?.classList.remove('hidden');
  $('#subStatus').textContent = state.mySeller.subscription_until ? `اشتراک تا: ${new Date(state.mySeller.subscription_until).toLocaleDateString('fa-IR')}` : 'اشتراک فعال نیست';
  
  let shareBtnHtml = '';
  if (state.mySeller.latitude && state.mySeller.longitude) {
      shareBtnHtml = `<button id="shareMyLocation" class="secondary" style="margin-top:10px;width:100%">📍 اشتراک‌گذاری موقعیت فروشگاه (برای ارسال به مشتری)</button>`;
  }
  
  if (!$('#shareMyLocation') && shareBtnHtml) {
      $('#subStatus').insertAdjacentHTML('afterend', shareBtnHtml);
      $('#shareMyLocation').onclick = async () => {
          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${state.mySeller.latitude},${state.mySeller.longitude}`;
          const shopName = state.mySeller.name;
          if (navigator.share) {
              try { await navigator.share({ title: shopName, text: `موقعیت مکانی فروشگاه ${shopName} در سفره سبز:\n${mapUrl}` }); } catch (err) {}
          } else {
              navigator.clipboard.writeText(mapUrl);
              notice('لینک موقعیت کپی شد! می‌توانید آن را برای مشتری بفرستید.');
          }
      };
  }

  await loadSellerOrders(); await loadSellerListings();
}

async function renderAdminView(){
  await refreshAuth();
  $('#admin-auth')?.classList.add('hidden'); $('#admin-dashboard')?.classList.add('hidden');
  if(!state.authUser || !state.isAdmin){ $('#admin-auth')?.classList.remove('hidden'); return; }
  $('#admin-dashboard')?.classList.remove('hidden');
  await loadAdmin();
}

let authMode='signin';
$('#authToggle')?.addEventListener('click', ()=>{
  authMode = authMode==='signin'?'signup':'signin';
  $('#authSubmit').textContent = authMode==='signin'?'ورود':'ثبت‌نام';
  $('#authToggle').textContent = authMode==='signin'?'ثبت‌نام':'ورود';
});

$('#authForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn=$('#authSubmit'); btn.disabled=true;
  try {
    const email = $('#authEmail').value.trim(), password = $('#authPassword').value;
    if(authMode==='signup'){ const {error}=await state.db.auth.signUp({email,password}); if(error)throw error; notice('ثبت‌نام انجام شد.'); }
    else { const {error}=await state.db.auth.signInWithPassword({email,password}); if(error)throw error; notice('خوش آمدید.'); }
    await renderSellerView();
  } catch(err){ notice('خطا: '+(err.message||''),true); }
  finally { btn.disabled=false; }
});

$('#courierMode')?.addEventListener('change', e=>{ const c=$('#courierCost'); c.disabled = e.target.value!=='paid'; if(e.target.value!=='paid') c.value=0; });

$('#getSellerLocation')?.addEventListener('click', ()=>{
  if(!navigator.geolocation) return notice('GPS پشتیبانی نمی‌شود.',true);
  const btn=$('#getSellerLocation'); btn.disabled=true; btn.textContent='در حال دریافت…';
  navigator.geolocation.getCurrentPosition(
    pos => { $('#sellerLat').value=pos.coords.latitude.toFixed(6); $('#sellerLng').value=pos.coords.longitude.toFixed(6); notice('موقعیت ثبت شد.'); btn.disabled=false; btn.textContent='📍 دریافت مجدد'; },
    err => { notice('خطا در GPS.',true); btn.disabled=false; btn.textContent='📍 دریافت موقعیت'; },
    { enableHighAccuracy:true, timeout:10000 }
  );
});

$('#sellerForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form=e.currentTarget, btn=form.querySelector('button[type=submit]'); btn.disabled=true;
  try {
    if(!state.authUser) throw new Error('ابتدا وارد شوید.');
    const d = Object.fromEntries(new FormData(form));
    const payload = {
      user_id: state.authUser.id, name:d.name.trim(), phone:normPhone(d.phone),
      address:d.address.trim(), type:d.type, image_url:d.image_url?.trim()||null,
      courier_mode:d.courier_mode, courier_cost: d.courier_mode==='paid'?Number(d.courier_cost||0):0,
      latitude: d.latitude?Number(d.latitude):null, longitude: d.longitude?Number(d.longitude):null,
      national_code: d.national_code?.trim()||null,
    };
    const { error } = await state.db.from('sellers').insert(payload);
    if(error) throw error;
    const lic = form.querySelector('[name=license_file]')?.files?.[0];
    const guild = form.querySelector('[name=guild_file]')?.files?.[0];
    const sellerRow = await state.db.from('sellers').select('id').eq('user_id',state.authUser.id).maybeSingle();
    if(sellerRow.data && (lic||guild)){
      const updates = {};
      if(lic){ const path = `license-${sellerRow.data.id}.${lic.name.split('.').pop()}`; await state.db.storage.from('licenses').upload(path,lic,{upsert:true}); updates.license_url = path; }
      if(guild){ const path = `guild-${sellerRow.data.id}.${guild.name.split('.').pop()}`; await state.db.storage.from('licenses').upload(path,guild,{upsert:true}); updates.guild_license_url = path; }
      if(Object.keys(updates).length) await state.db.from('sellers').update(updates).eq('id', sellerRow.data.id);
    }
    form.reset(); notice('فروشگاه ثبت شد. مجوزها در انتظار تأیید مدیر.');
    await loadData(); await renderSellerView();
  } catch(err){ notice('خطا: '+(err.message||''),true); }
  finally { btn.disabled=false; }
});

$$('[data-sellertab]').forEach(b=>b.addEventListener('click', ()=>{
  $$('[data-sellertab]').forEach(x=>x.classList.toggle('active',x===b));
  ['orders','listings','new','subscription'].forEach(t=>$(`#seller-tab-${t}`)?.classList.toggle('hidden', t!==b.dataset.sellertab));
}));

async function loadSellerOrders(){
  const wrap=$('#sellerOrders'); if(!wrap) return;
  wrap.textContent='در حال بارگذاری…';
  try {
    const { data, error } = await state.db.rpc('seller_orders', { p_seller_id: state.mySeller.id });
    if(error) throw error;
    if(!data?.length){ wrap.innerHTML='<div class="card">سفارشی نیست.</div>'; return; }
    wrap.innerHTML = data.map(o=>`<article class="card">
      <b>${escapeHtml(String(o.id).slice(0,8))}</b>
      <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')}</p>
      <div class="kv"><span>مشتری:</span><span>${escapeHtml(o.customer_name)} — <a href="tel:${encodeURIComponent(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></span>
      <span>مبلغ:</span><span class="price">${money(o.total_amount)}</span></div>
      <div class="row" style="margin-top:8px">
        ${['accepted','preparing','ready','completed','cancelled'].map(s=>`<button class="secondary fixed" data-status="${s}" data-order="${o.id}" ${o.status===s?'disabled':''}>${escapeHtml(statusNames[s])}</button>`).join('')}
        <button class="secondary fixed" data-chat="${o.id}" data-chat-type="seller">💬 چت</button>
      </div>
    </article>`).join('');
    wrap.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>changeOrderStatus(b.dataset.order,b.dataset.status,loadSellerOrders));
    wrap.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>openChat(b.dataset.chat,'seller'));
  } catch(err){ wrap.textContent='خطا: '+(err.message||''); }
}

async function loadSellerListings(){
  const wrap=$('#sellerListings'); if(!wrap) return;
  wrap.textContent='در حال بارگذاری…';
  const { data, error } = await state.db.from('listings').select('*').eq('seller_id',state.mySeller.id).order('created_at',{ascending:false});
  if(error){ wrap.textContent='خطا: '+error.message; return; }
  if(!data?.length){ wrap.innerHTML='<div class="card">هنوز غذایی ندارید.</div>'; return; }
  wrap.innerHTML = data.map(f=>`<div class="card">
    <b>${escapeHtml(f.title)}</b>
    <p class="muted">${catNames[f.category]||f.category} · موجودی ${f.quantity} · ${f.is_active?'فعال':'غیرفعال'}</p>
    <p class="price">${money(f.discounted_price)}</p>
    <div class="row" style="margin-top:6px"><button class="secondary fixed" data-del="${f.id}">حذف</button></div>
  </div>`).join('');
  wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    if(!confirm('حذف؟')) return;
    const {error} = await state.db.from('listings').delete().eq('id',b.dataset.del);
    if(error) return notice('خطا: '+error.message,true);
    notice('حذف شد.'); await loadSellerListings(); await loadData();
  });
}

$('#foodForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form=e.currentTarget, btn=form.querySelector('button[type=submit]'); btn.disabled=true;
  try {
    if(!state.mySeller) throw new Error('فروشنده یافت نشد.');
    if(!CONFIG.TRIAL_MODE){
      const sub = state.mySeller.subscription_until ? new Date(state.mySeller.subscription_until) : null;
      if(!sub || sub < new Date()) throw new Error('اشتراک شما فعال نیست. لطفاً از تب «اشتراک» خریداری کنید.');
    }
    const d = Object.fromEntries(new FormData(form));
    const original = Number(toAscii(d.original_price));
    const price = Number(toAscii(d.discounted_price));
    const qty = Number(toAscii(d.quantity));
    if(!original || original<1) throw new Error('قیمت اصلی نامعتبر.');
    if(!price || price<1 || price>original) throw new Error('قیمت تخفیفی نامعتبر.');
    if(qty<0) throw new Error('موجودی نامعتبر.');
    
    const extras = [];
    form.querySelectorAll('[data-extra-row]').forEach(row=>{
      const name = row.querySelector('[data-ex-name]').value.trim();
      const p = Number(toAscii(row.querySelector('[data-ex-price]').value));
      if(name) extras.push({ name, price: p||0 });
    });
    
    const payload = {
      seller_id: state.mySeller.id, title:d.title.trim(),
      drinks:d.drinks?.trim()||null, description:d.description.trim(),
      category:d.category, original_price:original, discounted_price:price,
      quantity:qty, delivery_minutes: Math.max(0, Number(toAscii(d.delivery_minutes||30))),
      image_url:d.image_url?.trim()||null, extras: extras
    };
    
    const { error } = await state.db.from('listings').insert(payload);
    if(error) throw error;
    form.reset(); form.querySelector('#extrasList').innerHTML='';
    notice('غذا ثبت شد.');
    await loadData(); await loadSellerListings();
    $$('[data-sellertab]').forEach(x=>x.classList.toggle('active', x.dataset.sellertab==='listings'));
    ['orders','listings','new','subscription'].forEach(t=>$(`#seller-tab-${t}`)?.classList.toggle('hidden', t!=='listings'));
  } catch(err){ notice('خطا: '+(err.message||''),true); }
  finally { btn.disabled=false; }
});

$('#addExtraRow')?.addEventListener('click', ()=>{
  const list = $('#extrasList');
  const row = document.createElement('div');
  row.className='row'; row.dataset.extraRow='1';
  row.innerHTML = `<input data-ex-name placeholder="نام افزودنی (مثلاً نان باگت)" style="flex:2"><input data-ex-price type="number" min="0" placeholder="قیمت" style="flex:1"><button type="button" class="danger fixed" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(row);
});

async function buySubscription(plan){
  const plans = { monthly: { days:30, amount:100000, label:'ماهانه' }, yearly: { days:365, amount:1000000, label:'سالانه' } };
  const p = plans[plan]; if(!p) return;
  if(!CONFIG.ZARINPAL_MERCHANT){
    if(!confirm(`درگاه بانکی هنوز فعال نیست. تمدید آزمایشی ${p.label} (${money(p.amount)}) انجام شود؟`)) return;
    const newDate = new Date();
    newDate.setDate(newDate.getDate()+p.days);
    const { error: e2 } = await state.db.from('sellers').update({ subscription_until: newDate.toISOString(), subscription_plan: p.label }).eq('id', state.mySeller.id);
    if(e2) return notice('خطا: '+e2.message,true);
    notice('✅ اشتراک تمدید شد (حالت آزمایشی).');
    await renderSellerView();
    return;
  }
}
$('#buyMonthly')?.addEventListener('click', ()=>buySubscription('monthly'));
$('#buyYearly')?.addEventListener('click', ()=>buySubscription('yearly'));

$('#signOut')?.addEventListener('click', async()=>{ await state.db.auth.signOut(); await renderSellerView(); });
$('#adminSignOut')?.addEventListener('click', async()=>{ await state.db.auth.signOut(); await renderAdminView(); });

$('#adminAuthForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn=e.target.querySelector('button[type=submit]'); btn.disabled=true;
  try {
    const { error } = await state.db.auth.signInWithPassword({ email:$('#adminEmail').value.trim(), password:$('#adminPassword').value });
    if(error) throw error;
    await renderAdminView();
    if(!state.isAdmin) notice('این حساب دسترسی مدیریت ندارد.',true);
  } catch(err){ notice('ورود ناموفق: '+(err.message||''),true); }
  finally { btn.disabled=false; }
});

async function loadAdmin(){
  const wrap=$('#adminOrders'); if(wrap) wrap.textContent='در حال بارگذاری…';
  try {
    const { data, error } = await state.db.rpc('admin_list_orders', { p_limit: 200 });
    if(!error && data?.length){
      wrap.innerHTML = data.map(o=>`<article class="card">
        <b>${escapeHtml(String(o.id).slice(0,8))}</b> · ${escapeHtml(o.seller_name||'')}
        <p class="muted">${new Date(o.created_at).toLocaleString('fa-IR')} | ${escapeHtml(statusNames[o.status]||o.status)}</p>
        <div class="row" style="margin-top:6px">${['pending','accepted','preparing','ready','completed','cancelled'].map(s=>`<button class="secondary fixed" data-status="${s}" data-order="${o.id}" ${o.status===s?'disabled':''}>${escapeHtml(statusNames[s])}</button>`).join('')}</div>
      </article>`).join('');
      wrap.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>changeOrderStatus(b.dataset.order,b.dataset.status,loadAdmin));
    } else if(wrap){ wrap.innerHTML='<div class="card">سفارشی نیست.</div>'; }
  } catch(err){ if(wrap) wrap.textContent='خطا'; }

  const sWrap=$('#adminSellers');
  if(sWrap){
    const { data:sellers } = await state.db.from('sellers').select('*').order('created_at',{ascending:false});
    sWrap.innerHTML = '<h3>فروشندگان</h3>' + (sellers||[]).map(s=>`
      <div class="card" style="margin-bottom:8px">
        <b>${escapeHtml(s.name)}</b> - ${escapeHtml(catNames[s.type]||s.type)}<br>
        <span class="muted">📞 ${escapeHtml(s.phone)}</span><br>
        <span class="muted">اشتراک: ${s.subscription_until?new Date(s.subscription_until).toLocaleDateString('fa-IR'):'ندارد'}</span><br>
        <span class="muted">جواز بهداشت: ${s.license_approved?'✅ تأیید':'⏳ تأیید نشده'} | پروانه صنف: ${s.guild_approved?'✅ تأیید':'⏳ تأیید نشده'}</span>
        <div class="row" style="margin-top:6px">
          ${!s.license_approved?`<button class="secondary fixed" data-approve="license" data-id="${s.id}">تأیید جواز</button>`:''}
          ${!s.guild_approved?`<button class="secondary fixed" data-approve="guild" data-id="${s.id}">تأیید صنف</button>`:''}
          <button class="secondary fixed" data-renew="${s.id}">+۳۰ روز</button>
          <button class="danger fixed" data-delseller="${s.id}">حذف فروشنده</button>
        </div>
      </div>`).join('');
    sWrap.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{
      const { error } = await state.db.rpc('admin_approve_license', { p_seller_id:b.dataset.id, p_type:b.dataset.approve });
      if(error) return notice('خطا: '+error.message,true);
      notice('تأیید شد.'); await loadAdmin();
    });
    sWrap.querySelectorAll('[data-renew]').forEach(b=>b.onclick=async()=>{
      const { error } = await state.db.rpc('admin_set_subscription', { p_seller_id:b.dataset.renew, p_days:30 });
      if(error) return notice('خطا: '+error.message,true);
      notice('تمدید شد.'); await loadAdmin();
    });
    sWrap.querySelectorAll('[data-delseller]').forEach(b=>b.onclick=async()=>{
      if(!confirm('حذف فروشنده و همه غذاهایش؟')) return;
      const { error } = await state.db.rpc('admin_delete_seller', { p_seller_id:b.dataset.delseller });
      if(error) return notice('خطا: '+error.message,true);
      notice('حذف شد.'); await loadAdmin(); await loadData();
    });
  }

  const lWrap=$('#adminListings');
  if(lWrap){
    const { data:listings } = await state.db.from('listings').select('id,title,seller_id,discounted_price,is_active,created_at').eq('is_active', true).order('created_at',{ascending:false}).limit(200);
    lWrap.innerHTML = '<h3>غذاهای ثبت‌شده</h3>' + (listings||[]).map(l=>`
      <div class="card" style="margin-bottom:6px">
        <b>${escapeHtml(l.title)}</b> — ${money(l.discounted_price)}
        <button class="danger fixed" style="float:left" data-dellisting="${l.id}">حذف</button>
      </div>`).join('');
    lWrap.querySelectorAll('[data-dellisting]').forEach(b=>b.onclick=async()=>{
      if(!confirm('حذف این غذا؟')) return;
      const { error } = await state.db.rpc('admin_delete_listing', { p_listing_id:b.dataset.dellisting });
      if(error) return notice('خطا: '+error.message,true);
      notice('حذف شد.'); await loadAdmin(); await loadData();
    });
  }
}

async function changeOrderStatus(orderId, status, reloadFn){
  const { error } = await state.db.from('orders').update({ status }).eq('id', orderId);
  if(error) return notice('خطا: '+error.message,true);
  notice('به‌روزرسانی شد.');
  await reloadFn();
}

async function init(){
  if(!window.supabase?.createClient) return connection('کتابخانه Supabase بارگذاری نشد.',true);
  state.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{persistSession:true,autoRefreshToken:true} });
  try { state.cart = JSON.parse(localStorage.getItem('sofreh_cart')||'[]'); } catch(_){ state.cart=[]; }
  updateCartCount();
  state.db.auth.onAuthStateChange(()=>{ refreshAuth().then(()=>{ if(!$('#view-seller')?.classList.contains('hidden')) renderSellerView(); if(!$('#view-admin')?.classList.contains('hidden')) renderAdminView(); }); });
  await loadData();
  await refreshAuth();
  showView('restaurants'); 
}

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
init();
})();
