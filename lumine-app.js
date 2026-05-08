// ============================================================
//   LUMINE PARTNER SYSTEM
//   - Real persistent storage via localStorage
//   - Secure password hashing via Web Crypto API
//   - Session management via sessionStorage
//   - Full auth: signup, signin, signout, change password
// ============================================================

// ── STORAGE HELPERS ──────────────────────────────────────────
var LS = {
  get: function(k, fb) {
    try { var v = localStorage.getItem('lm_' + k); return v ? JSON.parse(v) : (fb !== undefined ? fb : null); }
    catch(e) { return fb !== undefined ? fb : null; }
  },
  set: function(k, v) {
    try { localStorage.setItem('lm_' + k, JSON.stringify(v)); } catch(e) {}
  },
  push: function(k, item) {
    var arr = this.get(k, []);
    item.id = 'id_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    arr.push(item);
    this.set(k, arr);
    return item;
  },
  update: function(k, id, patch) {
    var arr = this.get(k, []);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        Object.assign(arr[i], patch);
        this.set(k, arr);
        return arr[i];
      }
    }
    return null;
  },
  find: function(k, fn) {
    var arr = this.get(k, []);
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) return arr[i]; }
    return null;
  },
  filter: function(k, fn) {
    return (this.get(k, []) || []).filter(fn);
  }
};

// ── PASSWORD HASHING ─────────────────────────────────────────
async function hashPassword(pass) {
  var data = new TextEncoder().encode(pass + ':lumine_2025');
  var buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

// ── SESSION ──────────────────────────────────────────────────
var CU = null;

function getSession() {
  try {
    var s = sessionStorage.getItem('lm_session');
    return s ? JSON.parse(s) : null;
  } catch(e) { return null; }
}
function setSession(u) {
  sessionStorage.setItem('lm_session', JSON.stringify(u));
  CU = u;
}
function clearSession() {
  sessionStorage.removeItem('lm_session');
  CU = null;
}

// ── PACKS DATA ───────────────────────────────────────────────
var PACKS = [
  { id:'dp1', name:'DISCOVERY PACK 1', desc:'5 x 30ml Perfume Bottles', price:375, icon:'🌸', retail:'Retail R150–R180 per bottle' },
  { id:'dp2', name:'DISCOVERY PACK 2', desc:'5 x 50ml Perfume Bottles', price:550, icon:'✨', retail:'Retail R180–R220 per bottle' },
  { id:'cdp', name:'CAR DIFFUSER PACK', desc:'10 x 8ml Car Diffusers', price:300, icon:'🚗', retail:'Retail R30 per unit' },
  { id:'ifp', name:'INTERIOR FRAGRANCE PACK', desc:'4 x 150ml Interior Fragrance', price:640, icon:'🏡', retail:'Retail R230–R300 per unit' },
  { id:'sp',  name:'SAMPLE PACK', desc:'4 x 4ml Samples + 1 x 8ml Diffuser', price:100, icon:'💧', retail:'Non-commissionable' }
];

var INV_DEFAULTS = [
  { name:'30ml Perfume', sku:'LM-30ML', stock:200, min:50, price:'R150–R180', icon:'🌸' },
  { name:'50ml Perfume', sku:'LM-50ML', stock:150, min:50, price:'R180–R220', icon:'✨' },
  { name:'8ml Car Diffuser', sku:'LM-8CD', stock:100, min:60, price:'R30', icon:'🚗' },
  { name:'150ml Interior Fragrance', sku:'LM-150IF', stock:80, min:40, price:'R230–R300', icon:'🏡' },
  { name:'4ml Sample Perfume', sku:'LM-4ML', stock:300, min:100, price:'R25', icon:'💧' }
];

// ── SEED DATA ────────────────────────────────────────────────
async function seedData() {
  if (LS.get('seeded')) return;
  var inv = INV_DEFAULTS.map(function(item, idx) {
    return Object.assign({}, item, { id:'inv_' + idx });
  });
  LS.set('inventory', inv);
  var hash = await hashPassword('admin123');
  var users = LS.get('users', []);
  var adminExists = false;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === 'admin@lumine.co.za') { adminExists = true; break; }
  }
  if (!adminExists) {
    users.push({
      id: 'admin_default',
      fname: 'Lumine', lname: 'Admin',
      email: 'admin@lumine.co.za',
      phone: '', city: 'Johannesburg',
      role: 'admin', status: 'active',
      password: hash,
      createdAt: new Date().toISOString(),
      totalOrders: 0, address: '', notes: ''
    });
    LS.set('users', users);
  }
  LS.set('seeded', true);
}

// ═══════════════════════════════════════════════════════════
//   AUTH
// ═══════════════════════════════════════════════════════════
function switchTab(tab) {
  var tabs = document.querySelectorAll('.auth-tab');
  tabs[0].classList.toggle('active', tab === 'signin');
  tabs[1].classList.toggle('active', tab === 'signup');
  document.getElementById('panel-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('panel-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('si-err').textContent = '';
  document.getElementById('su-err').textContent = '';
}

async function signIn() {
  var email = gv('si-email').toLowerCase().trim();
  var pass = gv('si-pass');
  var errEl = document.getElementById('si-err');
  if (!email || !pass) { errEl.textContent = 'Please enter your email and password.'; return; }
  setLoading('btn-signin', true, 'SIGNING IN...');
  var hash = await hashPassword(pass);
  var user = LS.find('users', function(u) { return u.email === email && u.password === hash; });
  if (!user) {
    errEl.textContent = 'Incorrect email or password.';
    setLoading('btn-signin', false, 'SIGN IN');
    return;
  }
  setSession(user);
  initApp();
}

async function signUp() {
  var fname = gv('su-fname').trim();
  var lname = gv('su-lname').trim();
  var email = gv('su-email').toLowerCase().trim();
  var phone = gv('su-phone').trim();
  var city = gv('su-city').trim();
  var role = gv('su-role');
  var pass = gv('su-pass');
  var pass2 = gv('su-pass2');
  var errEl = document.getElementById('su-err');

  if (!fname || !lname || !email || !pass) { errEl.textContent = 'Please fill in all required fields.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (pass !== pass2) { errEl.textContent = 'Passwords do not match.'; return; }
  var existing = LS.find('users', function(u) { return u.email === email; });
  if (existing) { errEl.textContent = 'An account with this email already exists.'; return; }

  setLoading('btn-signup', true, 'CREATING ACCOUNT...');
  var hash = await hashPassword(pass);
  var newUser = LS.push('users', {
    fname: fname, lname: lname, email: email, phone: phone,
    city: city, role: role, password: hash,
    status: role === 'admin' ? 'active' : 'pending',
    createdAt: new Date().toISOString(),
    totalOrders: 0, address: '', notes: ''
  });
  addNotif('New ' + role + ' registration: ' + fname + ' ' + lname + ' (' + email + ')', 'admin');
  showToast('Account created! ' + (role === 'partner' ? 'Awaiting admin approval.' : 'Welcome to Lumine!'));
  setSession(newUser);
  setTimeout(function() { initApp(); }, 800);
}

function logout() {
  clearSession();
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  sv('si-email', '');
  sv('si-pass', '');
}

// ═══════════════════════════════════════════════════════════
//   APP INIT
// ═══════════════════════════════════════════════════════════
function initApp() {
  if (!CU) { logout(); return; }
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  var name = CU.fname + ' ' + CU.lname;
  document.getElementById('top-name').textContent = name;
  document.getElementById('top-role').textContent = CU.role === 'admin' ? 'ADMINISTRATOR' : 'PARTNER';
  document.getElementById('top-av').textContent = CU.fname.charAt(0).toUpperCase();
  document.getElementById('sb-name').textContent = name;

  var isAdmin = CU.role === 'admin';
  document.getElementById('admin-nav').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('partner-nav').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('admin-recent-partners-wrap').style.display = isAdmin ? 'block' : 'none';

  document.getElementById('btn-view-all-orders').onclick = function() {
    gotoPage(isAdmin ? 'orders' : 'my-orders');
  };

  var thead = document.getElementById('dash-order-thead');
  if (isAdmin) {
    thead.innerHTML = '<th>ORDER #</th><th>PARTNER</th><th>PACK</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th>';
  } else {
    thead.innerHTML = '<th>ORDER #</th><th>PACK</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th>';
  }

  if (isAdmin) updatePendingPill();

  if (CU.role !== 'admin' && CU.status === 'pending') {
    gotoPage('pending');
    return;
  }

  renderNotifPanel();
  renderPacks();
  calcProfit();
  gotoPage('dashboard');
}

// ═══════════════════════════════════════════════════════════
//   NAVIGATION
// ═══════════════════════════════════════════════════════════
function gotoPage(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nitem').forEach(function(n) { n.classList.remove('active'); });
  var pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  var nav = document.getElementById('nav-' + page);
  if (nav) nav.classList.add('active');
  closeSidebarMobile();

  if (page === 'dashboard') renderDashboard();
  else if (page === 'partners') renderPartnersTable();
  else if (page === 'orders') { populatePartnerDropdown(); renderOrdersTable(); }
  else if (page === 'inventory') renderInventory();
  else if (page === 'reports') renderReports();
  else if (page === 'my-orders') renderMyOrders();
  else if (page === 'place-order') renderPacks();
  else if (page === 'profile') loadProfile();
  else if (page === 'calculator') calcProfit();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebarMobile() {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ═══════════════════════════════════════════════════════════
//   DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderDashboard() {
  var h = new Date().getHours();
  var greeting;
  if (h < 12) { greeting = 'Good morning, '; }
  else if (h < 17) { greeting = 'Good afternoon, '; }
  else { greeting = 'Good evening, '; }
  document.getElementById('dash-greeting').textContent = greeting + CU.fname;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-ZA', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  var orders = LS.get('orders', []);
  var myOrders = orders.filter(function(o) { return o.userId === CU.id; });
  var users = LS.get('users', []).filter(function(u) { return u.role !== 'admin'; });
  var inv = LS.get('inventory', []);
  var lowStock = inv.filter(function(i) { return i.stock < i.min; }).length;

  var stats = [];
  if (CU.role === 'admin') {
    var rev = orders.reduce(function(s, o) { return s + (o.amount || 0); }, 0);
    stats = [
      { lbl:'TOTAL PARTNERS', val:users.length, sub:users.filter(function(u){return u.status==='active';}).length + ' active', icon:'👥' },
      { lbl:'TOTAL ORDERS', val:orders.length, sub:'All time', icon:'📦' },
      { lbl:'TOTAL REVENUE', val:'R' + rev.toLocaleString(), sub:'All time', icon:'💰' },
      { lbl:'LOW STOCK ITEMS', val:lowStock, sub:lowStock > 0 ? 'Needs attention' : 'All good', icon:'📊' }
    ];
  } else {
    var myRev = myOrders.reduce(function(s, o) { return s + (o.amount || 0); }, 0);
    var inProgress = myOrders.filter(function(o) { return o.status === 'Processing' || o.status === 'Shipped'; }).length;
    stats = [
      { lbl:'MY ORDERS', val:myOrders.length, sub:'Total placed', icon:'📦' },
      { lbl:'DELIVERED', val:myOrders.filter(function(o){return o.status==='Delivered';}).length, sub:'Completed', icon:'✅' },
      { lbl:'TOTAL SPENT', val:'R' + myRev.toLocaleString(), sub:'Lifetime', icon:'💳' },
      { lbl:'IN PROGRESS', val:inProgress, sub:'Active orders', icon:'🚀' }
    ];
  }

  document.getElementById('dash-stats').innerHTML = stats.map(function(s) {
    return '<div class="scard"><div class="scard-lbl">' + s.lbl + '</div><div class="scard-val">' + s.val + '</div><div class="scard-sub">' + s.sub + '</div><div class="scard-icon">' + s.icon + '</div></div>';
  }).join('');

  var displayOrders = (CU.role === 'admin' ? orders : myOrders)
    .slice().sort(function(a,b){ return b.createdAt.localeCompare(a.createdAt); }).slice(0, 6);

  var tbody = document.getElementById('dash-order-tbody');
  if (displayOrders.length === 0) {
    var colspan = CU.role === 'admin' ? 6 : 5;
    tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="etd">No orders yet</td></tr>';
  } else {
    tbody.innerHTML = displayOrders.map(function(o) {
      var partnerCell = CU.role === 'admin' ? '<td>' + (o.partnerName || '—') + '</td>' : '';
      return '<tr><td><strong>' + o.orderId + '</strong></td>' + partnerCell +
        '<td>' + o.packName + '</td><td><strong>R' + o.amount.toLocaleString() + '</strong></td>' +
        '<td><span class="badge badge-' + o.status.toLowerCase() + '">' + o.status + '</span></td>' +
        '<td>' + fmtDate(o.createdAt) + '</td></tr>';
    }).join('');
  }

  if (CU.role === 'admin') {
    var recent = users.slice().sort(function(a,b){ return b.createdAt.localeCompare(a.createdAt); }).slice(0,5);
    var ptbody = document.getElementById('dash-partners-tbody');
    if (recent.length === 0) {
      ptbody.innerHTML = '<tr><td colspan="5" class="etd">No partners yet</td></tr>';
    } else {
      ptbody.innerHTML = recent.map(function(u) {
        return '<tr><td><strong>' + u.fname + ' ' + u.lname + '</strong></td><td>' + u.email + '</td><td>' + (u.city || '—') + '</td><td><span class="badge badge-' + u.status + '">' + u.status + '</span></td><td>' + fmtDate(u.createdAt) + '</td></tr>';
      }).join('');
    }
  }
}

// ═══════════════════════════════════════════════════════════
//   PARTNERS
// ═══════════════════════════════════════════════════════════
function renderPartnersTable() {
  var q = (gv('partner-search') || '').toLowerCase();
  var users = LS.get('users', []).filter(function(u) { return u.role !== 'admin'; });
  if (q) {
    users = users.filter(function(u) {
      return (u.fname + ' ' + u.lname + u.email + (u.city || '')).toLowerCase().indexOf(q) > -1;
    });
  }
  updatePendingPill();
  var tbody = document.getElementById('partners-tbody');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="etd">No partners found</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(function(u) {
    var approveBtn = u.status === 'active'
      ? '<button class="btn btn-xs btn-red" onclick="togglePartner(\'' + u.id + '\')">SUSPEND</button>'
      : '<button class="btn btn-xs btn-gold" onclick="togglePartner(\'' + u.id + '\')">APPROVE</button>';
    return '<tr><td><strong>' + u.fname + ' ' + u.lname + '</strong></td><td>' + u.email + '</td><td>' + (u.phone || '—') + '</td><td>' + (u.city || '—') + '</td><td>' + (u.totalOrders || 0) + '</td><td>' + fmtDate(u.createdAt) + '</td><td><span class="badge badge-' + u.status + '">' + u.status + '</span></td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-xs btn-outline" onclick="editPartner(\'' + u.id + '\')">EDIT</button>' + approveBtn + '</td></tr>';
  }).join('');
}

function updatePendingPill() {
  var pending = LS.filter('users', function(u) { return u.role !== 'admin' && u.status === 'pending'; }).length;
  var pill = document.getElementById('pending-pill');
  if (pill) { pill.textContent = pending; pill.style.display = pending > 0 ? 'inline-block' : 'none'; }
}

var editingPartnerId = null;

function openPartnerModal() {
  editingPartnerId = null;
  document.getElementById('modal-partner-title').textContent = 'Add Partner';
  ['mp-fname','mp-lname','mp-email','mp-phone','mp-city','mp-notes'].forEach(function(id) { sv(id, ''); });
  document.getElementById('mp-status').value = 'active';
  openModal('modal-partner');
}

function editPartner(id) {
  var u = LS.find('users', function(x) { return x.id === id; });
  if (!u) return;
  editingPartnerId = id;
  document.getElementById('modal-partner-title').textContent = 'Edit Partner';
  sv('mp-fname', u.fname || '');
  sv('mp-lname', u.lname || '');
  sv('mp-email', u.email || '');
  sv('mp-phone', u.phone || '');
  sv('mp-city', u.city || '');
  document.getElementById('mp-status').value = u.status || 'active';
  sv('mp-notes', u.notes || '');
  openModal('modal-partner');
}

function savePartner() {
  var fname = gv('mp-fname').trim();
  var lname = gv('mp-lname').trim();
  var email = gv('mp-email').trim().toLowerCase();
  if (!fname || !lname || !email) { showToast('First name, last name and email are required', 'err'); return; }
  var patch = {
    fname: fname, lname: lname, email: email,
    phone: gv('mp-phone').trim(), city: gv('mp-city').trim(),
    status: gv('mp-status'), notes: gv('mp-notes').trim()
  };
  if (editingPartnerId) {
    LS.update('users', editingPartnerId, patch);
    showToast('Partner updated successfully');
  } else {
    var exists = LS.find('users', function(u) { return u.email === email; });
    if (exists) { showToast('A user with this email already exists', 'err'); return; }
    patch.role = 'partner';
    patch.totalOrders = 0;
    patch.createdAt = new Date().toISOString();
    patch.password = '';
    patch.address = '';
    LS.push('users', patch);
    showToast('Partner added successfully');
    addNotif('New partner record added: ' + fname + ' ' + lname, 'admin');
  }
  editingPartnerId = null;
  closeModal('modal-partner');
  renderPartnersTable();
}

function togglePartner(id) {
  var u = LS.find('users', function(x) { return x.id === id; });
  if (!u) return;
  var newStatus = u.status === 'active' ? 'suspended' : 'active';
  LS.update('users', id, { status: newStatus });
  if (newStatus === 'active') addNotif('Partner ' + u.fname + ' ' + u.lname + ' has been approved', 'admin');
  showToast('Partner ' + (newStatus === 'active' ? 'approved' : 'suspended'));
  renderPartnersTable();
}

// ═══════════════════════════════════════════════════════════
//   ORDERS (admin)
// ═══════════════════════════════════════════════════════════
function renderOrdersTable() {
  var statusFilter = gv('order-status-filter');
  var orders = LS.get('orders', []).slice().sort(function(a,b) { return b.createdAt.localeCompare(a.createdAt); });
  if (statusFilter) {
    orders = orders.filter(function(o) { return o.status === statusFilter; });
  }
  var tbody = document.getElementById('orders-tbody');
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="etd">No orders found</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(function(o) {
    var opts = ['Processing','Shipped','Delivered','Cancelled'].map(function(s) {
      return '<option' + (o.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    return '<tr><td><strong>' + o.orderId + '</strong></td><td>' + (o.partnerName || '—') + '</td><td>' + o.packName + '</td><td>' + o.qty + '</td><td><strong>R' + o.amount.toLocaleString() + '</strong></td><td><span class="badge badge-' + o.status.toLowerCase() + '">' + o.status + '</span></td><td>' + fmtDate(o.createdAt) + '</td><td><select class="status-sel" onchange="updateOrderStatus(\'' + o.id + '\',this.value)">' + opts + '</select></td></tr>';
  }).join('');
}

function updateOrderStatus(id, status) {
  var o = LS.update('orders', id, { status: status });
  if (o) addNotif('Order ' + o.orderId + ' updated to ' + status, 'admin');
  showToast('Order updated to ' + status);
  renderOrdersTable();
}

function openAdminOrderModal() {
  populatePartnerDropdown();
  calcModalTotal();
  openModal('modal-order');
}

function populatePartnerDropdown() {
  var users = LS.filter('users', function(u) { return u.role !== 'admin' && u.status === 'active'; });
  var sel = document.getElementById('mo-partner');
  sel.innerHTML = '<option value="">Select partner...</option>' + users.map(function(u) {
    return '<option value="' + u.id + '">' + u.fname + ' ' + u.lname + '</option>';
  }).join('');
  calcModalTotal();
}

function calcModalTotal() {
  var price = parseInt(gv('mo-pack')) || 0;
  var qty = parseInt(gv('mo-qty')) || 1;
  sv('mo-total', 'R' + (price * qty).toLocaleString());
}

function adminCreateOrder() {
  var partnerId = gv('mo-partner');
  if (!partnerId) { showToast('Please select a partner', 'err'); return; }
  var partner = LS.find('users', function(u) { return u.id === partnerId; });
  if (!partner) { showToast('Partner not found', 'err'); return; }
  var packSel = document.getElementById('mo-pack');
  var price = parseInt(packSel.value) || 0;
  var packName = packSel.options[packSel.selectedIndex].text.split(' — ')[0];
  var qty = parseInt(gv('mo-qty')) || 1;
  var orderId = 'LM-' + Date.now().toString().slice(-6);
  LS.push('orders', {
    orderId: orderId,
    userId: partnerId,
    partnerName: partner.fname + ' ' + partner.lname,
    partnerEmail: partner.email,
    packName: packName,
    qty: qty,
    amount: price * qty,
    address: gv('mo-address') || '—',
    status: gv('mo-status'),
    createdAt: new Date().toISOString()
  });
  LS.update('users', partnerId, { totalOrders: (partner.totalOrders || 0) + 1 });
  addNotif('New order ' + orderId + ' created for ' + partner.fname + ' ' + partner.lname, 'admin');
  showToast('Order ' + orderId + ' created successfully');
  closeModal('modal-order');
  renderOrdersTable();
  renderDashboard();
}

// ═══════════════════════════════════════════════════════════
//   MY ORDERS (partner)
// ═══════════════════════════════════════════════════════════
function renderMyOrders() {
  var myOrders = LS.filter('orders', function(o) { return o.userId === CU.id; })
    .slice().sort(function(a,b) { return b.createdAt.localeCompare(a.createdAt); });
  var rev = myOrders.reduce(function(s, o) { return s + (o.amount || 0); }, 0);
  var inProgress = myOrders.filter(function(o) { return o.status === 'Processing' || o.status === 'Shipped'; }).length;
  document.getElementById('my-order-stats').innerHTML = [
    { lbl:'TOTAL ORDERS', val:myOrders.length, icon:'📦' },
    { lbl:'DELIVERED', val:myOrders.filter(function(o){return o.status==='Delivered';}).length, icon:'✅' },
    { lbl:'TOTAL SPENT', val:'R' + rev.toLocaleString(), icon:'💳' },
    { lbl:'IN PROGRESS', val:inProgress, icon:'🚀' }
  ].map(function(s) {
    return '<div class="scard"><div class="scard-lbl">' + s.lbl + '</div><div class="scard-val">' + s.val + '</div><div class="scard-icon">' + s.icon + '</div></div>';
  }).join('');

  var tbody = document.getElementById('my-orders-tbody');
  if (myOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="etd">No orders yet — place your first order!</td></tr>';
    return;
  }
  tbody.innerHTML = myOrders.map(function(o) {
    return '<tr><td><strong>' + o.orderId + '</strong></td><td>' + o.packName + '</td><td>' + o.qty + '</td><td><strong>R' + o.amount.toLocaleString() + '</strong></td><td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (o.address || '—') + '</td><td><span class="badge badge-' + o.status.toLowerCase() + '">' + o.status + '</span></td><td>' + fmtDate(o.createdAt) + '</td></tr>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
//   PLACE ORDER (partner)
// ═══════════════════════════════════════════════════════════
var selectedPack = null;

function renderPacks() {
  document.getElementById('pack-grid').innerHTML = PACKS.map(function(p, i) {
    var sel = selectedPack && selectedPack.id === p.id ? 'selected' : '';
    return '<div class="pcard ' + sel + '" onclick="selectPack(' + i + ')"><div class="pcard-icon">' + p.icon + '</div><div class="pcard-name">' + p.name + '</div><div class="pcard-desc">' + p.desc + '</div><div class="pcard-price">R' + p.price + '</div><div class="pcard-retail">' + p.retail + '</div></div>';
  }).join('');
}

function selectPack(i) {
  selectedPack = PACKS[i];
  renderPacks();
  sv('of-pack', selectedPack.name + ' — ' + selectedPack.desc);
  sv('of-price', 'R' + selectedPack.price);
  sv('of-qty', '1');
  calcOrderTotal();
  document.getElementById('order-form-wrap').style.display = 'block';
  document.getElementById('order-form-wrap').scrollIntoView({ behavior:'smooth' });
}

function calcOrderTotal() {
  if (!selectedPack) return;
  var qty = parseInt(gv('of-qty')) || 1;
  sv('of-total', 'R' + (selectedPack.price * qty).toLocaleString());
}

function cancelOrderForm() {
  selectedPack = null;
  renderPacks();
  document.getElementById('order-form-wrap').style.display = 'none';
}

function placeOrder() {
  if (!selectedPack) { showToast('Please select a pack first', 'err'); return; }
  var address = gv('of-address').trim();
  var notes = gv('of-notes').trim();
  var qty = parseInt(gv('of-qty')) || 1;
  if (!address) { showToast('Please enter a delivery address', 'err'); return; }
  setLoading('btn-place-order', true, 'PLACING ORDER...');
  var orderId = 'LM-' + Date.now().toString().slice(-6);
  LS.push('orders', {
    orderId: orderId,
    userId: CU.id,
    partnerName: CU.fname + ' ' + CU.lname,
    partnerEmail: CU.email,
    packName: selectedPack.name + ' — ' + selectedPack.desc,
    qty: qty,
    amount: selectedPack.price * qty,
    address: address,
    notes: notes,
    status: 'Processing',
    createdAt: new Date().toISOString()
  });
  var current = LS.find('users', function(u) { return u.id === CU.id; });
  var newTotal = (current ? (current.totalOrders || 0) : 0) + 1;
  LS.update('users', CU.id, { totalOrders: newTotal });
  CU.totalOrders = newTotal;
  setSession(CU);
  addNotif('New order ' + orderId + ' from ' + CU.fname + ' ' + CU.lname + ' — ' + selectedPack.name, 'admin');
  showToast('Order placed! Reference: ' + orderId);
  cancelOrderForm();
  setLoading('btn-place-order', false, 'SUBMIT ORDER');
  setTimeout(function() { gotoPage('my-orders'); }, 600);
}

// ═══════════════════════════════════════════════════════════
//   INVENTORY (admin)
// ═══════════════════════════════════════════════════════════
function renderInventory() {
  var inv = LS.get('inventory', []);
  document.getElementById('inv-grid').innerHTML = inv.map(function(p) {
    var countClass = p.stock < p.min ? 'low' : 'ok';
    var lowTag = p.stock < p.min ? '<div class="icard-lowtag">LOW STOCK</div>' : '';
    return '<div class="icard"><div class="icard-img">' + p.icon + '</div><div class="icard-body"><div class="icard-name">' + p.name + '</div><div class="icard-sku">' + p.sku + '</div><div class="icard-stock"><div><div class="icard-count ' + countClass + '">' + p.stock + '</div><div class="icard-lbl">in stock</div></div><div><div class="icard-min">MIN: ' + p.min + '</div>' + lowTag + '</div></div><div class="icard-price">' + p.price + '</div><button class="icard-btn" onclick="quickRestock(\'' + p.id + '\')">+ RESTOCK</button></div></div>';
  }).join('');
}

function quickRestock(id) {
  var inv = LS.get('inventory', []);
  var idx = -1;
  for (var i = 0; i < inv.length; i++) {
    if (inv[i].id === id) { idx = i; break; }
  }
  if (idx > -1) {
    document.getElementById('rs-product').value = idx;
    openModal('modal-restock');
  }
}

function doRestock() {
  var idx = parseInt(gv('rs-product')) || 0;
  var qty = parseInt(gv('rs-qty')) || 0;
  var note = gv('rs-note');
  var inv = LS.get('inventory', []);
  if (inv[idx]) {
    inv[idx].stock += qty;
    LS.set('inventory', inv);
    addNotif('Restocked ' + inv[idx].name + ': +' + qty + ' units' + (note ? ' (' + note + ')' : ''), 'admin');
    showToast('Restocked ' + inv[idx].name + ' with ' + qty + ' units');
    closeModal('modal-restock');
    renderInventory();
  }
}

// ═══════════════════════════════════════════════════════════
//   REPORTS (admin)
// ═══════════════════════════════════════════════════════════
function renderReports() {
  var orders = LS.get('orders', []);
  var users = LS.filter('users', function(u) { return u.role !== 'admin'; });
  var inv = LS.get('inventory', []);
  var rev = orders.reduce(function(s, o) { return s + (o.amount || 0); }, 0);
  var lowStock = inv.filter(function(i) { return i.stock < i.min; }).length;

  document.getElementById('report-stats').innerHTML = [
    { lbl:'TOTAL REVENUE', val:'R' + rev.toLocaleString(), sub:'All orders combined', icon:'💰' },
    { lbl:'TOTAL ORDERS', val:orders.length, sub:'All time', icon:'📦' },
    { lbl:'ACTIVE PARTNERS', val:users.filter(function(u){return u.status==='active';}).length, sub:'of ' + users.length + ' total', icon:'👥' },
    { lbl:'LOW STOCK', val:lowStock, sub:'Items below minimum', icon:'⚠️' }
  ].map(function(s) {
    return '<div class="scard"><div class="scard-lbl">' + s.lbl + '</div><div class="scard-val">' + s.val + '</div><div class="scard-sub">' + s.sub + '</div><div class="scard-icon">' + s.icon + '</div></div>';
  }).join('');

  // Bar chart
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var now = new Date();
  var bars = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var cnt = orders.filter(function(o) { return o.createdAt && o.createdAt.slice(0, 7) === ym; }).length;
    bars.push({ name:monthNames[d.getMonth()], val:cnt });
  }
  var maxVal = Math.max.apply(null, bars.map(function(b) { return b.val; }).concat([1]));
  document.getElementById('bar-chart').innerHTML = bars.map(function(b) {
    var h = Math.max(4, Math.round((b.val / maxVal) * 100));
    return '<div class="bar-col"><div class="bar-num">' + b.val + '</div><div class="bar-fill" style="height:' + h + 'px"></div><div class="bar-name">' + b.name + '</div></div>';
  }).join('');

  // Top partners
  var sorted = users.filter(function(u) { return (u.totalOrders || 0) > 0; })
    .slice().sort(function(a,b) { return (b.totalOrders || 0) - (a.totalOrders || 0); }).slice(0,8);
  var tpbody = document.getElementById('top-partners-tbody');
  if (sorted.length === 0) {
    tpbody.innerHTML = '<tr><td colspan="5" class="etd">No order data yet</td></tr>';
  } else {
    tpbody.innerHTML = sorted.map(function(u, idx) {
      return '<tr><td><strong>#' + (idx+1) + '</strong></td><td>' + u.fname + ' ' + u.lname + '</td><td>' + (u.city || '—') + '</td><td>' + (u.totalOrders || 0) + '</td><td>R' + ((u.totalOrders || 0) * 420).toLocaleString() + '</td></tr>';
    }).join('');
  }
}

// ═══════════════════════════════════════════════════════════
//   PROFIT CALCULATOR (partner)
// ═══════════════════════════════════════════════════════════
function calcProfit() {
  var wholesale = parseInt(gv('calc-pack')) || 375;
  var qty = parseInt(gv('calc-qty')) || 1;
  var sellPrice = parseInt(gv('calc-sell')) || wholesale;
  var sellQty = parseInt(gv('calc-sell-qty')) || 1;
  var totalCost = wholesale * qty;
  var totalRevenue = sellPrice * sellQty;
  var profit = totalRevenue - totalCost;
  var margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
  var statsEl = document.getElementById('calc-stats');
  if (!statsEl) return;
  statsEl.innerHTML = [
    { lbl:'TOTAL INVESTMENT', val:'R' + totalCost.toLocaleString(), icon:'💳' },
    { lbl:'EXPECTED REVENUE', val:'R' + totalRevenue.toLocaleString(), icon:'💵' },
    { lbl:'PROFIT', val:'R' + (profit >= 0 ? '+' : '') + profit.toLocaleString(), icon: profit >= 0 ? '✅' : '❌' },
    { lbl:'PROFIT MARGIN', val:margin + '%', icon:'📊' }
  ].map(function(s) {
    return '<div class="scard" style="cursor:default"><div class="scard-lbl">' + s.lbl + '</div><div class="scard-val" style="font-size:26px">' + s.val + '</div><div class="scard-icon">' + s.icon + '</div></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
//   PROFILE
// ═══════════════════════════════════════════════════════════
function loadProfile() {
  var u = LS.find('users', function(x) { return x.id === CU.id; }) || CU;
  sv('pr-fname', u.fname || '');
  sv('pr-lname', u.lname || '');
  sv('pr-email', u.email || '');
  sv('pr-phone', u.phone || '');
  sv('pr-city', u.city || '');
  sv('pr-addr', u.address || '');
  if (CU.role !== 'admin') {
    document.getElementById('profile-stats-card').style.display = 'block';
    var myOrders = LS.filter('orders', function(o) { return o.userId === CU.id; });
    var rev = myOrders.reduce(function(s, o) { return s + (o.amount || 0); }, 0);
    document.getElementById('profile-stats').innerHTML = [
      { lbl:'TOTAL ORDERS', val:myOrders.length },
      { lbl:'TOTAL SPENT', val:'R' + rev.toLocaleString() },
      { lbl:'ACCOUNT TYPE', val:'Partner' }
    ].map(function(s) {
      return '<div class="scard"><div class="scard-lbl">' + s.lbl + '</div><div class="scard-val" style="font-size:' + (String(s.val).length > 6 ? '22px' : '36px') + '">' + s.val + '</div></div>';
    }).join('');
  }
}

function saveProfile() {
  var fname = gv('pr-fname').trim();
  var lname = gv('pr-lname').trim();
  if (!fname || !lname) { showToast('Name fields are required', 'err'); return; }
  var updates = {
    fname: fname, lname: lname,
    phone: gv('pr-phone').trim(),
    city: gv('pr-city').trim(),
    address: gv('pr-addr').trim()
  };
  setLoading('btn-save-profile', true, 'SAVING...');
  LS.update('users', CU.id, updates);
  Object.assign(CU, updates);
  setSession(CU);
  var name = CU.fname + ' ' + CU.lname;
  document.getElementById('top-name').textContent = name;
  document.getElementById('sb-name').textContent = name;
  document.getElementById('top-av').textContent = CU.fname.charAt(0).toUpperCase();
  showToast('Profile updated successfully');
  setLoading('btn-save-profile', false, 'SAVE CHANGES');
}

async function changePassword() {
  var oldPass = gv('pr-oldpass');
  var newPass = gv('pr-newpass');
  if (!oldPass || !newPass) { showToast('Both fields are required', 'err'); return; }
  if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'err'); return; }
  var oldHash = await hashPassword(oldPass);
  var user = LS.find('users', function(u) { return u.id === CU.id; });
  if (!user || user.password !== oldHash) { showToast('Current password is incorrect', 'err'); return; }
  var newHash = await hashPassword(newPass);
  LS.update('users', CU.id, { password: newHash });
  sv('pr-oldpass', '');
  sv('pr-newpass', '');
  showToast('Password updated successfully');
}

// ═══════════════════════════════════════════════════════════
//   NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
function addNotif(msg, target) {
  LS.push('notifications', { message:msg, target:target, read:false, createdAt:new Date().toISOString() });
  renderNotifPanel();
}

function renderNotifPanel() {
  var all = LS.get('notifications', []);
  var notifs = all.filter(function(n) {
    return n.target === 'all' || n.target === CU.role || n.target === CU.id;
  }).slice().sort(function(a,b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 20);
  var unread = notifs.filter(function(n) { return !n.read; }).length;
  var badge = document.getElementById('notif-count');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  var list = document.getElementById('notif-list');
  if (!list) return;
  if (notifs.length === 0) {
    list.innerHTML = '<div class="np-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = notifs.map(function(n) {
    return '<div class="nitem-wrap ' + (n.read ? '' : 'unread') + '"><div class="nitem-text">' + n.message + '</div><div class="nitem-time">' + fmtDate(n.createdAt) + '</div></div>';
  }).join('');
}

function toggleNotifPanel() {
  var panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifPanel();
}

function markAllRead() {
  var notifs = LS.get('notifications', []).map(function(n) { return Object.assign({}, n, { read:true }); });
  LS.set('notifications', notifs);
  renderNotifPanel();
}

// ═══════════════════════════════════════════════════════════
//   MODALS
// ═══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ═══════════════════════════════════════════════════════════
//   TOAST
// ═══════════════════════════════════════════════════════════
var toastTimer;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.className = ''; }, 3500);
}

// ═══════════════════════════════════════════════════════════
//   UTILITIES
// ═══════════════════════════════════════════════════════════
function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return iso; }
}

function setLoading(id, loading, label) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (label) btn.textContent = label;
}

// Close modals clicking overlay
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.modal-overlay').forEach(function(m) {
    m.addEventListener('click', function(e) {
      if (e.target === m) m.classList.remove('open');
    });
  });
  // Close notif panel on outside click
  document.addEventListener('click', function(e) {
    var panel = document.getElementById('notif-panel');
    var toggle = document.getElementById('notif-toggle');
    if (panel && toggle && !panel.contains(e.target) && !toggle.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
});

// ═══════════════════════════════════════════════════════════
//   STARTUP
// ═══════════════════════════════════════════════════════════
window.addEventListener('load', function() {
  seedData().then(function() {
    setTimeout(function() {
      var splash = document.getElementById('splash');
      splash.classList.add('hide');
      setTimeout(function() { splash.style.display = 'none'; }, 600);
      var session = getSession();
      if (session) { CU = session; initApp(); }
      else {
        document.getElementById('auth-screen').style.display = 'flex';
      }
    }, 1500);
  });
});