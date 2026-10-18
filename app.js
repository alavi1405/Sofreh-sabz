// ═══════════════════════════════════════════════════════════════
//   سفره سبز (Sofreh Sabz) - app.js
//   نسخه نهایی، حرفه‌ای و متصل به دیتابیس Supabase
// ═══════════════════════════════════════════════════════════════

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
function calcDiscount(oldP, newP) { if (!oldP || oldP <= newP) return 0; return Math.round((1 - newP / oldP) * 100); }
function renderStars(rating) { const r = Number(rating) || 0; const full = Math.floor(r); let s = ''; for (let i = 0; i < 5; i++) { s += i < full ? '★' : '☆'; } return s; }

let searchQuery = '';
let currentFoodId = null;

// ═══════════════════════════════════════════════════════════════
//   ۱. نمایش غذاها (از دیتابیس آنلاین)
// ═══════════════════════════════════════════════════════════════
async function renderFoods() {
  const wrap = $('#foodsList');
  if (!wrap) return;
  wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280">در حال دریافت...</div>';
  
  // دریافت غذاها از Supabase
  const { data: listings, error } = await db.from('listings').select('*').order('created_at', { ascending: false });
  
  if (error) { 
    wrap.innerHTML = '<div style="text-align:center;color:red">خطا در اتصال به دیتابیس</div>'; 
    return; 
  }

  let filtered = listings || [];
  if (searchQuery) {
    filtered = filtered.filter(l => (l.title || '').toLowerCase().includes(searchQuery));
  }

  if (!filtered.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280">غذایی یافت نشد</div>';
    return;
  }

  wrap.innerHTML = filtered.map(l => {
    const disc = calcDiscount(l.original_price, l.discounted_price);
    return `
      <div class="food-card" onclick="openFoodDetail('${l.id}')" style="background:#fff;border-radius:16px;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;position:relative">
        ${disc ? `<div style="position:absolute;top:10px;left:10px;background:#ef4444;color:#fff;font-size:11px;padding:2px 8px;border-radius:20px">${disc}%</div>` : ''}
        <div style="flex:1;padding-left:10px">
          <div style="font-weight:800;font-size:15px;color:#111827;margin-bottom:6px">${l.title}</div>
          <div style="display:flex;gap:8px;align-items:center;font-size:13px">
            ${disc ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:11px">${toman(l.original_price)}</span>` : ''}
            <span style="color:#6d28d9;font-weight:800">${toman(l.discounted_price)} تومان</span>
          </div>
        </div>
        <div style="width:80px;height:80px;border-radius:12px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${l.image ? `<img src="${l.image}" style="width:100%;height:100%;object-fit:cover">` : '🍲'}
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
//   ۲. ثبت غذای جدید (پنل فروشنده)
// ═══════════════════════════════════════════════════════════════
const listingForm = $('#listingForm');
if (listingForm) {
  listingForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    
    // تبدیل عکس به فرمت قابل ذخیره در دیتابیس (Base64)
    let imageBase64 = '';
    const fileInput = e.target.querySelector('input[type="file"]');
    if (fileInput && fileInput.files[0]) {
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(fileInput.files[0]);
      });
    }

    // محاسبه قیمت با تخفیف
    const originalPrice = Number(data.originalPrice || data.price || 0);
    const discountPercent = Number(data.discount || 0);
    const discountedPrice = originalPrice - (originalPrice * discountPercent / 100);

    // ارسال به دیتابیس Supabase
    const { error } = await db.from('listings').insert([{
      id: Date.now().toString(),
      title: data.title || data.name,
      original_price: originalPrice,
      discounted_price: discountedPrice,
      quantity: Number(data.quantity || 10),
      image: imageBase64,
      created_at: Date.now()
    }]);

    if (error) {
      alert('خطای دیتابیس (ثبت غذا): ' + error.message);
      toast('❌ خطا در ثبت غذا', true);
      return;
    }

    e.target.reset();
    toast('✅ غذا با موفقیت ثبت شد');
    renderFoods();
  });
}

// ═══════════════════════════════════════════════════════════════
//   ۳. ثبت فروشنده جدید
// ═══════════════════════════════════════════════════════════════
const sellerForm = $('#sellerForm');
if (sellerForm) {
  sellerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    
    const { error } = await db.from('sellers').insert([{
      id: Date.now().toString(),
      name: data.name,
      phone: data.phone || '',
      address: data.address || '',
      created_at: Date.now()
    }]);

    if (error) {
      alert('خطای دیتابیس (ثبت فروشنده): ' + error.message);
      toast('❌ خطا در ثبت فروشنده', true);
      return;
    }

    e.target.reset();
    toast('✅ فروشنده با موفقیت ثبت شد');
  });
}

// ═══════════════════════════════════════════════════════════════
//   ۴. جزئیات غذا و ثبت سفارش (پنل خریدار)
// ═══════════════════════════════════════════════════════════════
window.openFoodDetail = async function(id) {
  currentFoodId = id;
  const { data: l } = await db.from('listings').select('*').eq('id', id).single();
  if (!l) return;

  $('#foodDetailContent').innerHTML = `
    <h3 style="color:#6d28d9;font-size:18px;margin-bottom:10px">${l.title}</h3>
    <div style="width:100%;height:150px;background:#f3f4f6;border-radius:12px;margin-bottom:15px;display:flex;align-items:center;justify-content:center">
      ${l.image ? `<img src="${l.image}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : '🍲'}
    </div>
    <div style="font-size:16px;font-weight:800;color:#6d28d9;margin-bottom:15px">${toman(l.discounted_price)} تومان</div>
    <button class="btn" style="background:#6d28d9" onclick="openOrderForm('${l.id}', '${l.title}', ${l.discounted_price})">🛒 ثبت سفارش</button>
    <button class="btn" style="background:#9ca3af;margin-top:10px" onclick="closeModal('foodDetailModal')">بستن</button>
  `;
  $('#foodDetailModal').classList.add('show');
};

window.openOrderForm = function(id, title, price) {
  closeModal('foodDetailModal');
  const orderForm = $('#orderForm');
  if (orderForm) {
    orderForm.dataset.listingId = id;
    orderForm.dataset.listingTitle = title;
    orderForm.dataset.listingPrice = price;
  }
  $('#orderModal').classList.add('show');
};

const orderForm = $('#orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const listingId = e.target.dataset.listingId;
    const listingTitle = e.target.dataset.listingTitle;
    const price = Number(e.target.dataset.listingPrice);

    const { error } = await db.from('orders').insert([{
      id: Date.now().toString(),
      listing_id: listingId,
      listing_title: listingTitle,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_address: data.customerAddress,
      total_price: price,
      status: 'pending',
      created_at: Date.now()
    }]);

    if (error) {
      alert('خطای دیتابیس (ثبت سفارش): ' + error.message);
      toast('❌ خطا در ثبت سفارش', true);
      return;
    }

    e.target.reset();
    closeModal('orderModal');
    if ($('#healthModal')) {
      $('#healthModal').classList.add('show');
    } else {
      toast('✅ سفارش ثبت شد');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//   ۵. ابزارهای کمکی (جستجو، بستن مودال)
// ═══════════════════════════════════════════════════════════════
window.closeModal = function(id) { $('#' + id).classList.remove('show'); };

const searchInp = $('#searchInput');
if (searchInp) {
  searchInp.addEventListener('input', e => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderFoods();
  });
}

// شروع اپلیکیشن
renderFoods();
