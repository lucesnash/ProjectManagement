/* ============================================================
   PAMILIHANG SILANGAN — Application JavaScript
   University of the East Philippines
============================================================ */


/* ============================================================
   DATA & STATE
============================================================ */

if (localStorage.getItem("ps_version") !== "v9") {
  localStorage.removeItem("products");
  localStorage.removeItem("notifications");
  localStorage.setItem("ps_version", "v9");
}

let products      = JSON.parse(localStorage.getItem("products"))        || [];

let migrated = false;
products.forEach(p => {
  if (p.category === "stationery") {
    p.category = "others";
    migrated = true;
  }
});
if (migrated) localStorage.setItem("products", JSON.stringify(products));

let users         = JSON.parse(localStorage.getItem("registeredUsers")) || {};
let notifications = JSON.parse(localStorage.getItem("notifications"))   || {};
let ratings       = JSON.parse(localStorage.getItem("sellerRatings"))    || {};
let currentUser   = null;
let currentCat    = "all";
let myItems       = false;
let uploadedImages = [];// Changed to array for multiple images
let editMode      = false;

/* Carousel State */
let lbImagesArray = [];
let lbCurrentIdx  = 0;
let isAdmin       = false;

/* Forgot password state */
let fpEmail       = "";
let fpCode        = "";
let fpCodeExpiry  = 0;
let fpResendTimer = null;
let fpExpireTimer = null;


/* ============================================================
   HELPERS
============================================================ */

const save      = () => localStorage.setItem("products",      JSON.stringify(products));
const saveNotif = () => localStorage.setItem("notifications", JSON.stringify(notifications));
const saveRatings = () => localStorage.setItem("sellerRatings", JSON.stringify(ratings));

const ICONS = {
  technology: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  books:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  uniform:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`,
  stationery: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="4"/><path d="M6 9l6-5 6 5"/><line x1="6" y1="20" x2="18" y2="20"/></svg>`,
  others:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

const icon     = c => ICONS[c] || ICONS.others;
const lbl      = c => ({ all: "All Items", mine: "My Items", technology: "Technology", books: "Books", uniform: "Uniform", others: "Others" }[c] || c);
const initials = n => n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U";
const isReal   = img => img && img.startsWith("data:image/") && !img.includes("svg+xml");

const timeAgo = ts => {
  const d = (Date.now() - ts) / 1000;
  if (d < 60)    return "just now";
  if (d < 3600)  return Math.floor(d / 60)    + "m ago";
  if (d < 86400) return Math.floor(d / 3600)  + "h ago";
  return Math.floor(d / 86400) + "d ago";
};

const $ = id => document.getElementById(id);

function togglePw(inputId, btn) {
  const input    = $(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.querySelector(".eye-show").style.display = isHidden ? "none" : "";
  btn.querySelector(".eye-hide").style.display = isHidden ? ""     : "none";
  btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
}

const CATS = ["technology", "books", "uniform", "others"];




/* ============================================================
   FORGOT PASSWORD FLOW
   Step 1: Enter email → generate 6-digit code (shown on screen)
   Step 2: Enter code → verify with 10-min expiry + resend timer
   Step 3: Enter new password → update in localStorage
============================================================ */

/* All auth view IDs */
const ALL_AUTH_VIEWS = [
  "loginView", "signupView", "adminLoginView",
  "forgotStep1", "forgotStep2", "forgotStep3", "forgotSuccess"
];

function showOnly(id) {
  ALL_AUTH_VIEWS.forEach(v => {
    const el = $(v);
    if (el) el.classList.add("hidden");
  });
  const target = $(id);
  if (target) target.classList.remove("hidden");
}

/* Generate a random 6-digit code */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* Format seconds to MM:SS */
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

/* Start the 10-minute expiry countdown shown in the code preview */
function startExpireCountdown() {
  clearInterval(fpExpireTimer);
  fpCodeExpiry = Date.now() + 10 * 60 * 1000;

  function tick() {
    const remaining = Math.max(0, Math.round((fpCodeExpiry - Date.now()) / 1000));
    const el = $("fpCodeExpires");
    if (el) el.textContent = remaining > 0 ? "Expires in " + fmtTime(remaining) : "Code expired";
    if (remaining === 0) {
      clearInterval(fpExpireTimer);
      const codeEl = $("fpCodeDisplay");
      if (codeEl) codeEl.textContent = "EXPIRED";
      fpCode = "";
    }
  }

  tick();
  fpExpireTimer = setInterval(tick, 1000);
}

/* Start the 60-second resend cooldown */
function startResendCooldown() {
  const resendBtn   = $("fpResendBtn");
  const resendTimer = $("fpResendTimer");
  if (!resendBtn) return;

  resendBtn.disabled = true;
  let sec = 60;

  function tick() {
    resendTimer.textContent = "(" + sec + "s)";
    sec--;
    if (sec < 0) {
      clearInterval(fpResendTimer);
      resendBtn.disabled      = false;
      resendTimer.textContent = "";
    }
  }

  clearInterval(fpResendTimer);
  tick();
  fpResendTimer = setInterval(tick, 1000);
}

/* Send (simulate) the code */
function sendCode(email) {
  fpCode = generateCode();
  const codeEl = $("fpCodeDisplay");
  if (codeEl) codeEl.textContent = fpCode;
  const emailEl = $("fpEmailDisplay");
  if (emailEl) emailEl.textContent = email;
  startExpireCountdown();
  startResendCooldown();
  /* Clear OTP inputs */
  document.querySelectorAll(".fp-otp-input").forEach(inp => {
    inp.value = "";
    inp.classList.remove("filled", "error");
  });
  $("fpStep2Error").textContent = "";
}

/* ── Forgot password link on login page ── */
$("toForgotPassword").addEventListener("click", () => {
  showOnly("forgotStep1");
  $("fpEmail").value = "";
  $("fpStep1Error").textContent = "";
  $("fpEmailHint").style.display = "none";
});

$("fpBackToLogin").addEventListener("click", () => {
  clearInterval(fpExpireTimer);
  clearInterval(fpResendTimer);
  showOnly("loginView");
});

/* ── Step 1: Submit email ── */
$("fpEmail").addEventListener("input", function() {
  const ok = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  $("fpEmailHint").style.display = ok ? "none" : "block";
  this.style.borderColor         = ok ? "" : "#dc3545";
});

$("forgotStep1Form").addEventListener("submit", function(e) {
  e.preventDefault();
  const email = $("fpEmail").value.trim();
  const errEl = $("fpStep1Error");

  if (!email.endsWith("@ue.edu.ph")) {
    errEl.textContent = "Only @ue.edu.ph email addresses are allowed.";
    return;
  }

  users = JSON.parse(localStorage.getItem("registeredUsers")) || {};

  if (!users[email]) {
    errEl.textContent = "No account found with this email address.";
    return;
  }

  fpEmail = email;
  errEl.textContent = "";
  sendCode(email);
  showOnly("forgotStep2");
});

/* ── Step 2: OTP inputs ── */
const otpInputs = document.querySelectorAll(".fp-otp-input");

otpInputs.forEach((inp, idx) => {
  inp.addEventListener("input", function() {
    /* Only allow digits */
    this.value = this.value.replace(/\D/g, "").slice(0, 1);
    if (this.value) {
      this.classList.add("filled");
      this.classList.remove("error");
      /* Move to next */
      if (idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    } else {
      this.classList.remove("filled");
    }
  });

  inp.addEventListener("keydown", function(e) {
    if (e.key === "Backspace" && !this.value && idx > 0) {
      otpInputs[idx - 1].focus();
      otpInputs[idx - 1].value = "";
      otpInputs[idx - 1].classList.remove("filled");
    }
    /* Allow paste */
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) return;
  });

  inp.addEventListener("paste", function(e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
    pasted.split("").forEach((ch, i) => {
      if (otpInputs[i]) {
        otpInputs[i].value = ch;
        otpInputs[i].classList.add("filled");
      }
    });
    const next = Math.min(pasted.length, otpInputs.length - 1);
    otpInputs[next].focus();
  });
});

/* Step 2: Verify */
$("forgotStep2Form").addEventListener("submit", function(e) {
  e.preventDefault();
  const entered = Array.from(otpInputs).map(i => i.value).join("");
  const errEl   = $("fpStep2Error");

  if (entered.length < 6) {
    errEl.textContent = "Please enter the complete 6-digit code.";
    otpInputs.forEach(i => i.classList.add("error"));
    return;
  }

  if (!fpCode) {
    errEl.textContent = "Your code has expired. Please request a new one.";
    return;
  }

  if (entered !== fpCode) {
    errEl.textContent = "Incorrect code. Please try again.";
    otpInputs.forEach(i => { i.classList.add("error"); i.classList.remove("filled"); i.value = ""; });
    otpInputs[0].focus();
    return;
  }

  /* Code matched — go to step 3 */
  errEl.textContent = "";
  clearInterval(fpExpireTimer);
  clearInterval(fpResendTimer);
  fpCode = ""; /* Invalidate after use */
  $("fpNewPassword").value     = "";
  $("fpConfirmPassword").value = "";
  $("fpStep3Error").textContent = "";
  $("fpStrengthFill").style.width      = "0%";
  $("fpStrengthFill").style.background = "";
  $("fpStrengthLabel").textContent     = "";
  showOnly("forgotStep3");
});

/* Resend button */
$("fpResendBtn").addEventListener("click", function() {
  sendCode(fpEmail);
  $("fpStep2Error").textContent = "";
});

/* Back from step 2 → step 1 */
$("fpBackToStep1").addEventListener("click", () => {
  clearInterval(fpExpireTimer);
  clearInterval(fpResendTimer);
  showOnly("forgotStep1");
});

/* ── Step 3: Password strength meter ── */
$("fpNewPassword").addEventListener("input", function() {
  const val = this.value;
  let score = 0;
  if (val.length >= 6)                         score++;
  if (val.length >= 10)                        score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/[0-9]/.test(val))                       score++;
  if (/[^A-Za-z0-9]/.test(val))               score++;

  const fill   = $("fpStrengthFill");
  const lbl    = $("fpStrengthLabel");
  const widths = ["0%", "20%", "40%", "65%", "85%", "100%"];
  const colors = ["", "#e84040", "#f07300", "#f0b800", "#22a55a", "#1a8f4a"];
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];

  fill.style.width      = widths[score];
  fill.style.background = colors[score];
  lbl.style.color       = colors[score];
  lbl.textContent       = labels[score];
});

/* Step 3: Submit new password */
$("forgotStep3Form").addEventListener("submit", function(e) {
  e.preventDefault();
  const newPw  = $("fpNewPassword").value;
  const confPw = $("fpConfirmPassword").value;
  const errEl  = $("fpStep3Error");

  if (newPw.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (newPw !== confPw) {
    errEl.textContent = "Passwords do not match.";
    return;
  }

  /* Update password in localStorage */
  users = JSON.parse(localStorage.getItem("registeredUsers")) || {};
  if (users[fpEmail]) {
    users[fpEmail].password = newPw;
    localStorage.setItem("registeredUsers", JSON.stringify(users));
  }

  errEl.textContent = "";
  fpEmail = "";
  showOnly("forgotSuccess");
});

/* Success → back to login */
$("fpGoToLogin").addEventListener("click", () => {
  showOnly("loginView");
});


/* ============================================================
   ADMIN CREDENTIALS
   Username: admin  |  Password: admin
============================================================ */

const ADMIN_CREDENTIALS = { username: "admin", password: "uemanila" };


/* ============================================================
   ADMIN AUTH
============================================================ */

/* Switch to admin login page */
$("toAdminLogin").addEventListener("click", () => {
  $("loginView").classList.add("hidden");
  $("adminLoginView").classList.remove("hidden");
});

$("backToUserLogin").addEventListener("click", () => {
  $("adminLoginView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("adminUsername").value = "";
  $("adminPassword").value = "";
});

$("adminLoginForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const uname = $("adminUsername").value.trim();
  const pw    = $("adminPassword").value;

  if (uname === ADMIN_CREDENTIALS.username && pw === ADMIN_CREDENTIALS.password) {
    isAdmin = true;
    localStorage.setItem("ps_admin_session", "1");
    $("adminLoginView").classList.add("hidden");
    showAdminDashboard();
  } else {
    alert("Invalid admin credentials. Try username: admin, password: admin");
  }
});

$("adminLogoutBtn").addEventListener("click", adminLogout);

function adminLogout() {
  isAdmin = false;
  localStorage.removeItem("ps_admin_session");
  $("adminDashboardView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("adminUsername").value = "";
  $("adminPassword").value = "";
}

/* ============================================================
   NEW ADMIN PORTAL ICON CLICK LOGIC
============================================================ */
const topAdminBtn = document.getElementById("adminPortalIconBtn");
if (topAdminBtn) {
  topAdminBtn.addEventListener("click", function(e) {
    e.preventDefault();
    
    // Hide the main login screen
    const loginView = document.getElementById("loginView");
    if (loginView) loginView.classList.add("hidden");
    
    // Show the admin login screen
    const adminLoginView = document.getElementById("adminLoginView");
    if (adminLoginView) adminLoginView.classList.remove("hidden");
  });
}

/* ============================================================
   ADMIN DASHBOARD — RENDER
============================================================ */

function showAdminDashboard() {
  $("loginView").classList.add("hidden");
  $("signupView").classList.add("hidden");
  $("dashboardView").classList.add("hidden");
  $("adminDashboardView").classList.remove("hidden");

  /* Reload fresh data */
  products = JSON.parse(localStorage.getItem("products")) || [];
  users    = JSON.parse(localStorage.getItem("registeredUsers")) || {};

  showAdminSkeleton();
}

/* ── Tab navigation ────────────────────────────────────────── */

document.querySelectorAll(".admin-nav-item[data-tab]").forEach(btn => {
  btn.addEventListener("click", function() {
    const tab = this.dataset.tab;

    /* Update desktop nav */
    document.querySelectorAll(".admin-nav-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");

    /* Update mobile nav too */
    document.querySelectorAll(".admin-mn-item[data-tab]").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    $("tab-" + tab).classList.add("active");
    $("adminPageTitle").textContent = {
      overview:   "Overview",
      listings:   "All Listings",
      sold:       "Sold Items",
      users:      "Registered Users",
      categories: "By Category",
    }[tab] || "Overview";
  });
});

/* Refresh button — with skeleton loading animation */
$("adminRefreshBtn").addEventListener("click", () => {
  showAdminSkeleton();
});
$("adminTopbarLogoutBtn").addEventListener("click", adminLogout);

function showAdminSkeleton() {
  const overlay = $("adminSkeletonOverlay");
  if (overlay) overlay.classList.remove("hidden");

  /* Spin the refresh icon */
  const btn = $("adminRefreshBtn");
  if (btn) btn.style.animation = "spin 0.8s linear infinite";

  setTimeout(() => {
    /* Reload data */
    products = JSON.parse(localStorage.getItem("products")) || [];
    users    = JSON.parse(localStorage.getItem("registeredUsers")) || {};

    renderAdminOverview();
    renderAdminListings();
    renderAdminSold();
    renderAdminUsers();
    renderAdminCategories();

    /* Hide skeleton */
    if (overlay) overlay.classList.add("hidden");
    if (btn) btn.style.animation = "";
  }, 1600);
}


/* ── Overview tab ──────────────────────────────────────────── */

function renderAdminOverview() {
  const total    = products.length;
  const active   = products.filter(p => !p.soldOut).length;
  const sold     = products.filter(p => p.soldOut).length;
  const userList = Object.values(users);

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("ov-totalListings",  total);
  set("ov-activeListings", active);
  set("ov-soldItems",      sold);
  set("ov-totalUsers",     userList.length);

  /* Category breakdown bars */
  const catDiv = $("adminCatBreakdown");
  catDiv.innerHTML = "";
  const maxCount = Math.max(...CATS.map(c => products.filter(p => p.category === c).length), 1);

  CATS.forEach(cat => {
    const count = products.filter(p => p.category === cat).length;
    const pct   = Math.round((count / maxCount) * 100);
    const row   = document.createElement("div");
    row.className = "admin-cat-row";
    row.innerHTML = `
      <div class="admin-cat-name">${lbl(cat)}</div>
      <div class="admin-cat-bar-wrap">
        <div class="admin-cat-bar" style="width: ${pct}%"></div>
      </div>
      <div class="admin-cat-count">${count}</div>`;
    catDiv.appendChild(row);
  });

  /* Recent activity */
  const actDiv  = $("adminRecentActivity");
  actDiv.innerHTML = "";
  const recent  = products.slice(0, 8);

  if (!recent.length) {
    actDiv.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px;">No listings yet.</div>';
    return;
  }

  recent.forEach(p => {
    const row = document.createElement("div");
    row.className = "admin-activity-row";
    row.innerHTML = `
      <div class="admin-act-dot ${p.soldOut ? "sold" : "available"}"></div>
      <div class="admin-act-info">
        <div class="admin-act-name">${p.name}</div>
        <div class="admin-act-meta">${lbl(p.category)} · ${p.seller}</div>
      </div>
      <div class="admin-act-price">₱${p.price.toLocaleString()}</div>`;
    actDiv.appendChild(row);
  });
}


/* ── All Listings tab ──────────────────────────────────────── */

function renderAdminListings(search) {
  search = (search || "").toLowerCase();
  const tbody = $("adminListingsTbody");
  tbody.innerHTML = "";

  const list = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search) ||
    p.seller.toLowerCase().includes(search) ||
    p.category.toLowerCase().includes(search)
  );

  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7" class="admin-empty-row">No listings found.</td></tr>`;
    return;
  }

  list.forEach(p => {
    const tr = document.createElement("tr");
    const loc = p.location.length > 30 ? p.location.slice(0, 30) + "…" : p.location;
    tr.innerHTML = `
      <td class="col-item" data-label="Item"><strong>${p.name}</strong></td>
      <td data-label="Category">${lbl(p.category)}</td>
      <td data-label="Price"><strong>₱${p.price.toLocaleString()}</strong></td>
      <td data-label="Seller">${p.seller}</td>
      <td class="col-location" data-label="Location" title="${p.location}">${loc}</td>
      <td data-label="Status"><span class="admin-status-pill ${p.soldOut ? "sold" : "available"}">${p.soldOut ? "Sold" : "Available"}</span></td>
      <td data-label="Posted" style="color:#888;font-size:12px;">${p.soldOutTime ? timeAgo(p.soldOutTime) : "Active"}</td>`;
    tbody.appendChild(tr);
  });
}

/* Search listings */
$("adminSearchListings").addEventListener("input", function() {
  renderAdminListings(this.value);
});


/* ── Sold Items tab ────────────────────────────────────────── */

function renderAdminSold() {
  const tbody = $("adminSoldTbody");
  tbody.innerHTML = "";
  const sold = products.filter(p => p.soldOut);

  if (!sold.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5" class="admin-empty-row">No sold items yet.</td></tr>`;
    return;
  }

  sold.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-item" data-label="Item"><strong>${p.name}</strong></td>
      <td data-label="Category">${lbl(p.category)}</td>
      <td data-label="Price"><strong>₱${p.price.toLocaleString()}</strong></td>
      <td data-label="Seller">${p.seller}</td>
      <td data-label="Status"><span class="admin-status-pill sold">Sold</span></td>`;
    tbody.appendChild(tr);
  });
}


/* ── Registered Users tab ──────────────────────────────────── */

function renderAdminUsers(search) {
  search = (search || "").toLowerCase();
  const tbody    = $("adminUsersTbody");
  tbody.innerHTML = "";
  const userList = Object.values(users);

  const filtered = userList.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search) ||
    u.email.toLowerCase().includes(search) ||
    u.role.toLowerCase().includes(search)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5" class="admin-empty-row">No users registered yet.</td></tr>`;
    return;
  }

  filtered.forEach(u => {
    const listed = products.filter(p => p.email === u.email).length;
    const sold   = products.filter(p => p.email === u.email && p.soldOut).length;
    const tr     = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-item" data-label="Name"><strong>${u.name}</strong></td>
      <td data-label="Email" style="color:#888;font-size:12px;">${u.email}</td>
      <td data-label="Role"><span class="admin-role-pill ${u.role}">${u.role}</span></td>
      <td data-label="Listed"><strong>${listed}</strong></td>
      <td data-label="Sold"><strong>${sold}</strong></td>
      <td data-label="Action">
        <button class="btn-admin-delete" onclick="openDeleteUserModal('${u.email}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── Delete User (admin action) ────────────────────────────── */

let deleteTargetEmail = null;

function openDeleteUserModal(email) {
  const u      = users[email];
  if (!u) return;
  deleteTargetEmail = email;

  const listed = products.filter(p => p.email === email).length;
  const sold   = products.filter(p => p.email === email && p.soldOut).length;

  $("deleteUserInfo").innerHTML = `
    <strong>${u.name}</strong><br>
    <span style="color:#888;">${u.email}</span><br>
    Role: <strong>${u.role}</strong> &nbsp;·&nbsp;
    Listed: <strong>${listed}</strong> &nbsp;·&nbsp;
    Sold: <strong>${sold}</strong>`;

  $("deleteUserModal").classList.add("open");
}

$("closeDeleteUserModal").addEventListener("click", () => {
  $("deleteUserModal").classList.remove("open");
  deleteTargetEmail = null;
});

$("cancelDeleteUserBtn").addEventListener("click", () => {
  $("deleteUserModal").classList.remove("open");
  deleteTargetEmail = null;
});

$("deleteUserModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove("open");
    deleteTargetEmail = null;
  }
});

$("confirmDeleteUserBtn").addEventListener("click", () => {
  if (!deleteTargetEmail) return;

  const email  = deleteTargetEmail;
  const reason = $("deleteUserReason").value;

  /* Remove all listings by this user */
  products = products.filter(p => p.email !== email);
  save();

  /* Remove from registered users */
  users = JSON.parse(localStorage.getItem("registeredUsers")) || {};
  delete users[email];
  localStorage.setItem("registeredUsers", JSON.stringify(users));

  /* Remove any active session for this user */
  const session = localStorage.getItem("currentUser");
  if (session) {
    try {
      const sess = JSON.parse(session);
      if (sess.email === email) localStorage.removeItem("currentUser");
    } catch(e) {}
  }

  /* Remove notifications */
  const notifs = JSON.parse(localStorage.getItem("notifications")) || {};
  delete notifs[email];
  localStorage.setItem("notifications", JSON.stringify(notifs));

  $("deleteUserModal").classList.remove("open");
  deleteTargetEmail = null;

  /* Refresh admin views */
  showAdminSkeleton();
});


/* ── Admin Mobile Bottom Navigation ────────────────────────── */

document.querySelectorAll(".admin-mn-item[data-tab]").forEach(btn => {
  btn.addEventListener("click", function() {
    const tab = this.dataset.tab;

    /* Update mobile nav active */
    document.querySelectorAll(".admin-mn-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");

    /* Update desktop nav active too */
    document.querySelectorAll(".admin-nav-item[data-tab]").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    /* Switch tabs */
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    $("tab-" + tab).classList.add("active");

    $("adminPageTitle").textContent = {
      overview:   "Overview",
      listings:   "All Listings",
      sold:       "Sold Items",
      users:      "Registered Users",
      categories: "By Category",
    }[tab] || "Overview";

    /* Scroll to top */
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* Sync desktop nav to also update mobile nav */


/* Search users */
$("adminSearchUsers").addEventListener("input", function() {
  renderAdminUsers(this.value);
});


/* ── By Category tab ───────────────────────────────────────── */

function renderAdminCategories() {
  const grid = $("adminCatsGrid");
  grid.innerHTML = "";

  CATS.forEach(cat => {
    const total  = products.filter(p => p.category === cat).length;
    const active = products.filter(p => p.category === cat && !p.soldOut).length;
    const sold   = products.filter(p => p.category === cat && p.soldOut).length;

    const card = document.createElement("div");
    card.className = "admin-cat-card";
    card.innerHTML = `
      <div class="admin-cat-card-icon">${icon(cat)}</div>
      <div class="admin-cat-card-name">${lbl(cat)}</div>
      <div class="admin-cat-card-count">${total}</div>
      <div class="admin-cat-card-sub">Total listings in this category</div>
      <div class="admin-cat-card-sold">
        <div>Available <span>${active}</span></div>
        <div>Sold <span>${sold}</span></div>
      </div>`;
    grid.appendChild(card);
  });
}


/* ============================================================
   USER NOTIFICATIONS
============================================================ */

function getMyNotifs() {
  if (!currentUser) return [];
  return (notifications[currentUser.email] || []).slice().reverse();
}

function addNotification(toEmail, notif) {
  if (!notifications[toEmail]) notifications[toEmail] = [];
  notifications[toEmail].push({ id: Date.now() + Math.random(), ...notif, time: Date.now(), unread: true });
  saveNotif();
  if (currentUser && toEmail === currentUser.email) updateNotifBadge();
}

function countUnread() {
  if (!currentUser) return 0;
  return (notifications[currentUser.email] || []).filter(n => n.unread).length;
}

function updateNotifBadge() {
  const count  = countUnread();
  const badge  = $("notifBadge");
  const mpCnt  = $("mppNotifCount");
  const mnDot  = $("mnNotifDot");
  const mppDot = $("mppNotifDot");
  if (count > 0) {
    if (badge)  { badge.textContent = count > 9 ? "9+" : count; badge.style.display = "flex"; }
    if (mpCnt)  { mpCnt.textContent = count; mpCnt.style.display = "inline-block"; }
    if (mnDot)  mnDot.style.display = "block";
    if (mppDot) mppDot.style.display = "block";
  } else {
    if (badge)  badge.style.display = "none";
    if (mpCnt)  mpCnt.style.display = "none";
    if (mnDot)  mnDot.style.display = "none";
    if (mppDot) mppDot.style.display = "none";
  }
}

function markAllRead() {
  if (!currentUser) return;
  (notifications[currentUser.email] || []).forEach(n => (n.unread = false));
  saveNotif();
  updateNotifBadge();
}

function likeNotif(notifId) {
  if (!currentUser) return;
  const list = notifications[currentUser.email] || [];
  const n    = list.find(x => x.id === notifId);
  if (!n || n.liked) return;
  n.liked = true;
  saveNotif();
  if (n.from) {
    addNotification(n.from, {
      title:    currentUser.name + " acknowledged your message",
      message:  "Your inquiry about \"" + (n.itemName || "the item") + "\" has been seen. The seller liked your message! 👍",
      from:     currentUser.email,
      fromName: currentUser.name,
      isAck:    true,
    });
  }
  renderNotifList();
}

function renderNotifList() {
  const list   = $("notifList");
  const notifs = getMyNotifs();
  if (!notifs.length) { list.innerHTML = '<div class="pd-empty">No notifications yet.</div>'; return; }
  list.innerHTML = "";
  notifs.forEach(n => {
    const div      = document.createElement("div");
    div.className  = "notif-item" + (n.unread ? " unread" : "");
    const showLike = n.from && !n.isAck;
    const liked    = !!n.liked;
    const likeBtn  = showLike
      ? `<button class="btn-notif-like${liked ? " liked" : ""}" onclick="likeNotif(${n.id})" ${liked ? "disabled" : ""}>
           <svg width="13" height="13" viewBox="0 0 24 24" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
           ${liked ? "Acknowledged" : "Acknowledge"}
         </button>`
      : "";
    const rateBtn = n.isRatingRequest && !n.rated
      ? '<button class="btn-notif-rate" onclick="openRatingModal(\'' + (n.ratedSellerEmail || '').replace(/'/g, "\\'") + '\',\'' + (n.ratedSellerName || '').replace(/'/g, "\\'") + '\',' + n.id + ')">⭐ Rate Seller</button>'
      : n.isRatingRequest && n.rated
      ? '<span class="rated-label">✅ Rated</span>'
      : "";
    const notifIcon = n.isRatingReceived
      ? "⭐"
      : n.isRatingRequest
      ? "⭐"
      : n.isAck
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : "✉️";
    div.innerHTML =
      `<div class="notif-item-icon">${notifIcon}</div>` +
      `<div class="notif-item-body">` +
        `<div class="notif-item-title">${n.title || "New Message"}</div>` +
        `<div class="notif-item-msg">${n.message}</div>` +
        `<div class="notif-item-footer"><span class="notif-item-time">${timeAgo(n.time)}</span>${likeBtn}${rateBtn}</div>` +
      `</div>` +
      (n.unread ? `<div class="notif-dot"></div>` : "");
    list.appendChild(div);
  });
}

function openNotifModal() {
  renderNotifList();
  $("notifModal").classList.add("open");
  markAllRead();
}

$("notifBtn").addEventListener("click", openNotifModal);
$("closeNotif").addEventListener("click", () => $("notifModal").classList.remove("open"));
$("notifModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });
$("clearNotifBtn").addEventListener("click", () => {
  if (!currentUser) return;
  notifications[currentUser.email] = [];
  saveNotif(); updateNotifBadge(); renderNotifList();
});


/* ============================================================
   SOLD ITEM EXPIRY
============================================================ */

function expiry() {
  const now    = Date.now();
  const before = products.length;
  products = products.filter(p => !(p.soldOut && p.soldOutTime && (now - p.soldOutTime) / 3600000 >= 24));
  if (products.length < before) { save(); renderAll(); }
}

setInterval(expiry, 60000);


/* ============================================================
   STATS (user dashboard)
============================================================ */

function stats() {
  const v   = products.filter(p => !p.soldOut);
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("sTotal",       v.length);
  set("sTech",        v.filter(p => p.category === "technology").length);
  set("sBooks",       v.filter(p => p.category === "books").length);
  set("sUniform",     v.filter(p => p.category === "uniform").length);
  set("sOthers",      v.filter(p => p.category === "others").length);
  set("scAll",        v.length);
  set("scTech",       v.filter(p => p.category === "technology").length);
  set("scBooks",      v.filter(p => p.category === "books").length);
  set("scUniform",    v.filter(p => p.category === "uniform").length);
  set("scOthers",     v.filter(p => p.category === "others").length);
}


/* ============================================================
   PRODUCT CARDS
============================================================ */

function renderProducts(cat, search) {
  search     = (search || "").toLowerCase();
  const grid = $("productsGrid");
  const list = products.filter(p => {
    const matchCat    = myItems ? p.email === currentUser.email : (cat === "all" || p.category === cat);
    const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  $("itemCount").textContent = list.length + " item" + (list.length !== 1 ? "s" : "");
  $("catLabel").textContent  = myItems ? "My Items" : lbl(cat);

  if (!list.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">📦</div><h3>No items found</h3><p>Try a different category or search term.</p></div>`;
    return;
  }

  grid.innerHTML = "";
  list.forEach(p => {
    const card   = document.createElement("div");
    card.className = "p-card" + (p.soldOut ? " sold" : "");
    
    // Handle old single images and new arrays
    const imgArray = Array.isArray(p.image) ? p.image : (p.image ? [p.image] : []);
    const mainImg = imgArray.length > 0 ? imgArray[0] : null;
    const hasImg = mainImg && mainImg.startsWith("data:image/");
    const myBtns = (myItems && p.email === currentUser.email)
      ? `<div class="p-my-btns">
           ${!p.soldOut
             ? `<button class="xs xs-edit" onclick="openEdit(${p.id});event.stopPropagation()">Edit</button>
                <button class="xs xs-sold" onclick="markSold(${p.id});event.stopPropagation()">Mark Sold</button>`
             : ""}
           <button class="xs xs-del" onclick="delItem(${p.id});event.stopPropagation()">Delete</button>
         </div>`
      : "";

    card.innerHTML = `
      <div class="p-banner${hasImg ? " clickable" : ""}" ${hasImg ? `onclick="openLightbox(${p.id});event.stopPropagation();"` : ""}>
        ${hasImg ? `<img src="${mainImg}" alt="${p.name}">` : `<div class="p-banner-icon">${icon(p.category)}</div>`}
        ${p.soldOut ? `<div class="p-sold-badge">SOLD</div>` : ""}
        <div class="p-banner-label">${p.name}</div>
        ${hasImg ? `<div class="zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Tap to expand</div>` : ""}
      </div>
      <div class="p-body">
        <div class="p-name">${p.name}</div>
        <div class="p-tag">${lbl(p.category)}</div>
        <div class="p-price">₱${p.price.toLocaleString()}</div>
        <div class="p-loc">${p.location}</div>
        ${myBtns}
        ${p.email !== currentUser.email
          ? `<button class="btn-contact" onclick="openContact(${p.id})" ${p.soldOut ? "disabled" : ""}>${p.soldOut ? "Sold Out" : "Contact Seller"}</button>`
          : p.soldOut ? `<button class="btn-contact" disabled>Sold Out</button>` : ""}
      </div>`;
    grid.appendChild(card);
  });
}



/* ============================================================
   RECENT LISTINGS
============================================================ */

function renderRecent() {
  const el  = $("recentList");
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Filter items that are not sold AND were created within the last 24 hours
  const avail = products.filter(p => !p.soldOut && (now - p.id) <= ONE_DAY_MS).slice(0, 6);
  
  if (!avail.length) { 
    el.innerHTML = '<div class="pd-empty">No recent listings in the last 24 hours.</div>'; 
    return; 
  }
  
  el.innerHTML = "";
  avail.forEach(p => {
    const d     = document.createElement("div");
    d.className = "r-row";
    d.onclick   = () => openContact(p.id);
    d.innerHTML = `
      <div class="r-icon">${icon(p.category)}</div>
      <div style="min-width:0;flex:1;">
        <div class="r-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
        <div class="r-sub">${lbl(p.category)}</div>
      </div>
      <div class="r-right">
        <div class="r-price">₱${p.price.toLocaleString()}</div>
        <div class="r-seller">${p.seller}</div>
      </div>`;
    el.appendChild(d);
  });
}


/* ============================================================
   DESKTOP PROFILE DROPDOWN
============================================================ */

function renderPD() {
  const el   = $("pdList");
  const mine = products.filter(p => p.email === currentUser.email);
  if (!mine.length) { el.innerHTML = '<div class="pd-empty">You have no listed items yet.</div>'; return; }
  el.innerHTML = "";
  mine.forEach(p => {
    const d     = document.createElement("div");
    d.className = "pd-item";
    d.innerHTML = `
      <div class="pd-ico">${icon(p.category)}</div>
      <div style="flex:1;min-width:0;">
        <div class="pd-n" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
        <div class="pd-p">₱${p.price.toLocaleString()} ·
          <span style="color:${p.soldOut ? "#721c24" : "#22a55a"};font-size:11px;">${p.soldOut ? "Sold" : "Available"}</span>
        </div>
      </div>
      <div class="pd-acts">
        ${!p.soldOut
          ? `<button class="xs xs-edit" onclick="openEdit(${p.id});event.stopPropagation()">Edit</button>
             <button class="xs xs-sold" onclick="markSold(${p.id});event.stopPropagation()">Sold</button>`
          : ""}
        <button class="xs xs-del" onclick="delItem(${p.id});event.stopPropagation()">Del</button>
      </div>`;
    el.appendChild(d);
  });
}


/* ============================================================
   MOBILE PROFILE PAGE
============================================================ */

let mobileProfileOpen = false;

function openMobileProfilePage() {
  if (!currentUser) return;
  mobileProfileOpen = true;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("mppAvatar", initials(currentUser.name));
  set("mppName",   currentUser.name);
  set("mppEmail",  currentUser.email);
  set("mppRole",   currentUser.role);
  const mine = products.filter(p => p.email === currentUser.email);
  set("mppListedCount", mine.length);
  set("mppSoldCount",   mine.filter(p => p.soldOut).length);
  set("mppAvailCount",  mine.filter(p => !p.soldOut).length);
  renderMobileProfileItems();
  if (typeof renderRatingBadge === "function") renderRatingBadge(currentUser.email, "mppRating");
  $("mobileProfilePage").classList.remove("hidden");
  $("pageBody").style.display = "none";
  setMobileNavActive("mnProfile");
  updateNotifBadge();
}

function closeMobileProfilePage() {
  mobileProfileOpen = false;
  $("mobileProfilePage").classList.add("hidden");
  $("pageBody").style.display = "";
}

function renderMobileProfileItems() {
  const list = $("mppItemsList");
  if (!list) return;
  const mine = products.filter(p => p.email === currentUser.email);
  if (!mine.length) {
    list.innerHTML = '<div class="pd-empty" style="text-align:center;padding:24px;color:#888;">No items listed yet.</div>';
    return;
  }
  list.innerHTML = "";
  mine.forEach(p => {
    const d     = document.createElement("div");
    d.className = "mpp-item-row";
    d.innerHTML = `
      <div class="pd-ico">${icon(p.category)}</div>
      <div class="mpp-item-info">
        <div class="mpp-item-name">${p.name}</div>
        <div class="mpp-item-price">₱${p.price.toLocaleString()} ·
          <span style="color:${p.soldOut ? "#721c24" : "#22a55a"}">${p.soldOut ? "Sold" : "Available"}</span>
        </div>
      </div>
      <div class="mpp-item-acts">
        ${!p.soldOut
          ? `<button class="xs xs-edit" onclick="openEdit(${p.id});event.stopPropagation();">Edit</button>
             <button class="xs xs-sold" onclick="markSold(${p.id});event.stopPropagation();">Sold</button>`
          : ""}
        <button class="xs xs-del" onclick="delItem(${p.id});event.stopPropagation();">Del</button>
      </div>`;
    list.appendChild(d);
  });
}


/* ============================================================
   RENDER ALL (user dashboard)
============================================================ */

function renderAll() {
  stats();
  renderProducts(currentCat, getSearchValue());
  renderRecent();
  if ($("profileDropdown").classList.contains("open")) renderPD();
  if (mobileProfileOpen) {
    renderMobileProfileItems();
    if (typeof renderRatingBadge === "function") renderRatingBadge(currentUser.email, "mppRating");
  }
  updateNotifBadge();
  if (typeof renderRatingBadge === "function" && currentUser) {
    renderRatingBadge(currentUser.email, "pdRating");
    renderRatingBadge(currentUser.email, "avRating");
  }
}

function getSearchValue() {
  const overlay = $("mobileSearchOverlay");
  const mobile  = $("searchBarMobile");
  const desk    = $("searchBar");
  if (overlay && overlay.classList.contains("open") && mobile) return mobile.value;
  return desk ? desk.value : "";
}


/* ============================================================
   LIGHTBOX
============================================================ */

/* ============================================================
   LIGHTBOX & CAROUSEL
============================================================ */

function openLightbox(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  
  lbImagesArray = Array.isArray(p.image) ? p.image : (p.image ? [p.image] : []);
  if (lbImagesArray.length === 0) return;

  lbCurrentIdx = 0;
  $("lightboxCaption").textContent = p.name;
  $("lightboxPrice").textContent   = "₱" + p.price.toLocaleString();
  
  updateLightboxView();
  $("lightbox").classList.add("open");
}

function updateLightboxView() {
  $("lightboxImg").src = lbImagesArray[lbCurrentIdx];
  
  // Show/Hide Arrows
  $("lbPrev").style.display = lbImagesArray.length > 1 ? "block" : "none";
  $("lbNext").style.display = lbImagesArray.length > 1 ? "block" : "none";

  // Build Dots
  const dotsContainer = $("lbDots");
  dotsContainer.innerHTML = "";
  if (lbImagesArray.length > 1) {
    lbImagesArray.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "lb-dot" + (i === lbCurrentIdx ? " active" : "");
      dot.onclick = (e) => { e.stopPropagation(); lbCurrentIdx = i; updateLightboxView(); };
      dotsContainer.appendChild(dot);
    });
  }
}

function lbChange(dir) {
  lbCurrentIdx += dir;
  if (lbCurrentIdx < 0) lbCurrentIdx = lbImagesArray.length - 1;
  if (lbCurrentIdx >= lbImagesArray.length) lbCurrentIdx = 0;
  updateLightboxView();
}

function closeLightbox() {
  $("lightbox").classList.remove("open");
  setTimeout(() => { $("lightboxImg").src = ""; }, 300);
}

$("lightboxClose").onclick = closeLightbox;
$("lightbox").addEventListener("click", function(e) { if (e.target === this) closeLightbox(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeLightbox(); closeMobileSheets(); closeMobileSearch(); }
});

/* ============================================================
   CONTACT SELLER MODAL
============================================================ */

let contactProductId = null;

function openContact(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.soldOut) return;
  contactProductId = id;
  $("cName").textContent  = p.seller;
  $("cEmail").textContent = p.email;
  $("cLoc").textContent   = p.location;
  $("cRole").innerHTML    = `<span class="role-b role-${p.role}">${p.role}</span>`;
  if (typeof renderRatingBadge === "function") renderRatingBadge(p.email, "cRating");
  $("contactMessage").value = `Hi ${p.seller}! I'm interested in your "${p.name}" for ₱${p.price.toLocaleString()}. Is it still available?`;
  $("emailBtn").onclick = () => {
    const p2  = products.find(x => x.id === contactProductId);
    if (!p2) return;
    const msg = $("contactMessage").value.trim();
    window.location.href = `mailto:${p2.email}?subject=Interested in ${encodeURIComponent(p2.name)}&body=${encodeURIComponent(msg)}`;
    if (p2.email !== currentUser.email) {
      addNotification(p2.email, {
        title:    `${currentUser.name} emailed you about "${p2.name}"`,
        message:  msg || `${currentUser.name} is interested in your item.`,
        from:     currentUser.email,
        fromName: currentUser.name,
        itemId:   p2.id,
        itemName: p2.name,
      });
    }
    $("contactModal").classList.remove("open");
  };
  $("contactModal").classList.add("open");
}

$("closeContact").onclick  = () => $("contactModal").classList.remove("open");
$("closeContact2").onclick = () => $("contactModal").classList.remove("open");
$("contactModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });


/* ============================================================
   MULTI-PHOTO GALLERY LOGIC
============================================================ */

// This function draws the images on the screen
function renderUploadPreviews() {
  const container = document.getElementById("imgPreviewContainer");
  if (!container) return;
  
  // 1. Clear only the photo thumbnails (not the + button)
  const existingThumbs = container.querySelectorAll('.thumb-wrap');
  existingThumbs.forEach(t => t.remove());

  // 2. Add the new photos from the array
  uploadedImages.forEach((imgSrc, i) => {
    const wrap = document.createElement("div");
    wrap.className = "thumb-wrap";
    wrap.innerHTML = `
      <img src="${imgSrc}">
      <button type="button" class="thumb-remove" onclick="removeImage(${i})">✕</button>
    `;
    // We use prepend so they appear BEFORE the + button 
    // OR we use append if the + button has 'order: 99' in CSS
    container.appendChild(wrap);
  });
}

// Handler for the file input
document.getElementById("iImg").addEventListener("change", function(e) {
  const files = Array.from(this.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadedImages.push(ev.target.result);
      renderUploadPreviews();
    };
    reader.readAsDataURL(file);
  });
  this.value = ""; // Reset input
});

window.removeImage = function(index) {
  uploadedImages.splice(index, 1);
  renderUploadPreviews();
};

// This function handles the file selection
$("iImg").addEventListener("change", function(e) {
  const files = Array.from(this.files);
  
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadedImages.push(ev.target.result); // Save to array
      renderUploadPreviews();               // Show on screen
    };
    reader.readAsDataURL(file);
  });
  this.value = ""; // Reset so you can pick the same file again
});

// This function removes a photo when you click the red 'X'
window.removeImage = function(index) {
  uploadedImages.splice(index, 1); // Remove from array
  renderUploadPreviews();         // Refresh UI
};

function openSell() {
  editMode = false;
  $("sellTitle").textContent  = "New Listing";
  $("sellSubmit").textContent = "List Item";
  $("sellForm").reset();
  
  uploadedImages = []; // CRITICAL: Reset the array
  renderUploadPreviews(); // Clear the previews
  
  $("sellModal").classList.add("open");
}

function openEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.email !== currentUser.email) return;
  editMode = true;
  $("sellTitle").textContent  = "Edit Listing";
  $("sellSubmit").textContent = "Update Item";
  $("editId").value  = id;
  $("iName").value   = p.name;
  $("iPrice").value  = p.price;
  $("iCat").value    = p.category;
  $("iLoc").value    = p.location;
  $("iDesc").value   = p.description;
  
  // Load existing array or single image
  uploadedImages = Array.isArray(p.image) ? [...p.image] : (p.image ? [p.image] : []);
  renderUploadPreviews();
  
  $("profileDropdown").classList.remove("open");
  $("sellModal").classList.add("open");
}

$("sellBtn").onclick   = openSell;
$("closeSell").onclick = () => $("sellModal").classList.remove("open");
$("sellModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });

$("mppSellBtn").addEventListener("click", openSell);
$("mppNotifBtn").addEventListener("click", openNotifModal);

// Multiple File Upload Handler
$("iImg").addEventListener("change", function(e) {
  const files = Array.from(this.files);
  if (!files.length) return;
  
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      uploadedImages.push(ev.target.result);
      renderUploadPreviews();
    };
    reader.readAsDataURL(file);
  });
  this.value = ""; // reset input
});

$("sellForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const productData = {
    id: editMode ? parseInt($("editId").value) : Date.now(),
    name: $("iName").value,
    price: parseFloat($("iPrice").value),
    category: $("iCat").value,
    location: $("iLoc").value, // <--- ENSURE THIS IS "location"
    description: $("iDesc").value,
    image: uploadedImages,    // <--- SAVING THE ARRAY
    seller: currentUser.name,
    email: currentUser.email,
    soldOut: false
  };

  if (editMode) {
    const idx = products.findIndex(x => x.id === productData.id);
    if (idx !== -1) products[idx] = productData;
  } else {
    products.unshift(productData);
  }

  save(); // Save to localStorage
  $("sellModal").classList.remove("open");
  renderAll(); // Refresh the dashboard
});

/* ============================================================
   MARK SOLD & DELETE
============================================================ */

function markSold(id) {
  if (!confirm("Mark as sold? It will auto-remove after 24 hours.")) return;
  const i = products.findIndex(x => x.id === id);
  if (i !== -1 && products[i].email === currentUser.email) {
    products[i].soldOut     = true;
    products[i].soldOutTime = Date.now();
    save();

    /* Send rating notification to all buyers who contacted about this item */
    const sellerEmail = products[i].email;
    const sellerName  = products[i].seller;
    const itemName    = products[i].name;
    const itemId      = products[i].id;

    const sellerNotifs = notifications[sellerEmail] || [];
    const buyerEmails  = [];
    sellerNotifs.forEach(n => {
      if (n.itemId === itemId && n.from && n.from !== sellerEmail && !buyerEmails.includes(n.from)) {
        buyerEmails.push(n.from);
      }
    });

    buyerEmails.forEach(buyerEmail => {
      addNotification(buyerEmail, {
        title:    "Rate your experience with " + sellerName,
        message:  '"' + itemName + '" has been marked as sold! If you purchased this item, please rate the seller to help other buyers. ⭐',
        from:     sellerEmail,
        fromName: sellerName,
        itemId:   itemId,
        itemName: itemName,
        isRatingRequest: true,
        ratedSellerEmail: sellerEmail,
        ratedSellerName:  sellerName,
      });
    });

    renderAll();
  }
}

function delItem(id) {
  if (!confirm("Delete this listing?")) return;
  const i = products.findIndex(x => x.id === id);
  if (i !== -1 && products[i].email === currentUser.email) {
    products.splice(i, 1);
    save();
    renderAll();
  }
}


/* ============================================================
   DESKTOP SIDEBAR NAV
============================================================ */

document.querySelectorAll(".nav-item[data-cat]").forEach(btn => {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    myItems    = this.dataset.cat === "mine";
    currentCat = myItems ? currentCat : this.dataset.cat;
    renderProducts(currentCat, getSearchValue());
  });
});

document.querySelectorAll(".stat-card[data-cat-stat]").forEach(card => {
  card.addEventListener("click", function() {
    currentCat = this.dataset.catStat;
    myItems    = false;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const match = document.querySelector(`.nav-item[data-cat="${currentCat}"]`);
    if (match) match.classList.add("active");
    renderProducts(currentCat, getSearchValue());
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

$("sbLogoutBtn").addEventListener("click", logout);


/* ============================================================
   SEARCH
============================================================ */

$("searchBar").addEventListener("input", function() { renderProducts(currentCat, this.value); });

function openMobileSearch() {
  $("mobileSearchOverlay").classList.add("open");
  $("searchBarMobile").value = "";
  setTimeout(() => $("searchBarMobile").focus(), 80);
  document.querySelector(".mobile-search-bar-wrap").addEventListener("click", e => e.stopPropagation(), { once: false });
}

function closeMobileSearch(applySearch) {
  const overlay = $("mobileSearchOverlay");
  if (!overlay.classList.contains("open")) return;
  overlay.classList.remove("open");
  const query = $("searchBarMobile").value.trim();
  if (applySearch && query) {
    myItems    = false;
    currentCat = "all";
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const allNav = document.querySelector('.nav-item[data-cat="all"]');
    if (allNav) allNav.classList.add("active");
    if (mobileProfileOpen) closeMobileProfilePage();
    setMobileNavActive("mnHome");
    renderProducts(currentCat, query);
  } else {
    $("searchBarMobile").value = "";
    renderProducts(currentCat, "");
  }
}

$("mobileSearchBtn").addEventListener("click", openMobileSearch);
$("mobileSearchSubmit").addEventListener("click", () => closeMobileSearch(true));
$("searchBarMobile").addEventListener("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); closeMobileSearch(true); } });
$("mobileSearchOverlay").addEventListener("pointerdown", function(e) {
  const wrap = document.querySelector(".mobile-search-bar-wrap");
  if (wrap && !wrap.contains(e.target)) closeMobileSearch(false);
});


/* ============================================================
   DESKTOP PROFILE DROPDOWN
============================================================ */

$("profileToggle").addEventListener("click", function(e) {
  e.stopPropagation();
  const dd = $("profileDropdown");
  dd.classList.toggle("open");
  if (dd.classList.contains("open")) renderPD();
});

document.addEventListener("click", e => {
  const dd = $("profileDropdown");
  if (!$("profileToggle").contains(e.target) && !dd.contains(e.target)) {
    dd.classList.remove("open");
  }
});


/* ============================================================
   MOBILE BOTTOM NAV
============================================================ */

function closeMobileSheets() {
  $("mobileCatSheet").classList.remove("open");
  $("sheetOverlay").classList.remove("open");
}

function openMobileSheet(id) {
  closeMobileSheets();
  $(id).classList.add("open");
  $("sheetOverlay").classList.add("open");
}

$("sheetOverlay").addEventListener("click", closeMobileSheets);

function setMobileNavActive(id) {
  document.querySelectorAll(".mn-item").forEach(b => b.classList.remove("active"));
  $(id).classList.add("active");
}

$("mnHome").addEventListener("click", function() {
  if (mobileProfileOpen) closeMobileProfilePage();
  setMobileNavActive("mnHome");
  myItems    = false;
  currentCat = "all";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const nav = document.querySelector('.nav-item[data-cat="all"]');
  if (nav) nav.classList.add("active");
  renderProducts(currentCat, getSearchValue());
  closeMobileSheets();
});

$("mnCategories").addEventListener("click", function() {
  if (mobileProfileOpen) closeMobileProfilePage();
  setMobileNavActive("mnCategories");
  openMobileSheet("mobileCatSheet");
});

$("mnProfile").addEventListener("click", function() {
  if (!mobileProfileOpen) openMobileProfilePage();
  const dot = $("mnNotifDot");
  if (dot) dot.style.display = "none";
});

document.querySelectorAll(".sheet-cat-item").forEach(btn => {
  btn.addEventListener("click", function() {
    currentCat = this.dataset.cat;
    myItems    = false;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const match = document.querySelector(`.nav-item[data-cat="${currentCat}"]`);
    if (match) match.classList.add("active");
    document.querySelectorAll(".sheet-cat-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    renderProducts(currentCat, getSearchValue());
    closeMobileSheets();
    setMobileNavActive("mnHome");
  });
});

$("mobileLogoutBtn").addEventListener("click", logout);


/* ============================================================
   USER AUTH
============================================================ */

$("loginEmail").addEventListener("input", function() {
  const ok = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  $("loginHint").style.display = ok ? "none" : "block";
  this.style.borderColor       = ok ? "" : "#dc3545";
});

$("signupEmail").addEventListener("input", function() {
  const ok = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  $("signupHint").style.display = ok ? "none" : "block";
  this.style.borderColor        = ok ? "" : "#dc3545";
});

$("toSignup").onclick = () => { $("loginView").classList.add("hidden"); $("signupView").classList.remove("hidden"); };
$("toLogin").onclick  = () => { $("signupView").classList.add("hidden"); $("loginView").classList.remove("hidden"); };

$("signupForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const name  = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const role  = $("signupRole").value;
  const pw    = $("signupPassword").value;
  const cpw   = $("signupConfirm").value;
  if (!email.endsWith("@ue.edu.ph")) { alert("Only @ue.edu.ph school email addresses are allowed."); return; }
  if (pw !== cpw)   { alert("Passwords do not match."); return; }
  if (users[email]) { alert("This email is already registered."); return; }
  users[email] = { name, email, role, password: pw };
  localStorage.setItem("registeredUsers", JSON.stringify(users));
  $("signupSuccess").style.display = "block";
  setTimeout(() => {
    $("signupSuccess").style.display = "none";
    $("signupForm").reset();
    $("signupView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
    $("loginEmail").value = email;
  }, 1800);
});

$("loginForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const pw    = $("loginPassword").value;
  if (!email.endsWith("@ue.edu.ph")) { alert("Only @ue.edu.ph school email addresses are allowed."); return; }
  if (users[email] && users[email].password === pw) {
    currentUser = users[email];
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    showDashboard();
  } else {
    alert("Invalid email or password.");
  }
});


/* ============================================================
   USER LOGOUT
============================================================ */

function logout() {
  currentUser       = null;
  mobileProfileOpen = false;
  localStorage.removeItem("currentUser");
  closeMobileSheets();
  $("dashboardView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginEmail").value    = "";
  $("loginPassword").value = "";
}

$("logoutBtn").onclick = logout;


/* ============================================================
   SHOW USER DASHBOARD
============================================================ */

function showDashboard() {
  $("loginView").classList.add("hidden");
  $("signupView").classList.add("hidden");
  $("adminDashboardView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("avInitials", initials(currentUser.name));
  set("avName",     currentUser.name.split(" ")[0]);
  set("avRole",     currentUser.role);
  set("pdName",     currentUser.name);
  set("pdEmail",    currentUser.email);
  set("pdRole",     currentUser.role);

  expiry();
  renderAll();
  if (typeof renderRatingBadge === "function") {
    renderRatingBadge(currentUser.email, "pdRating");
    renderRatingBadge(currentUser.email, "avRating");
  }
}




/* ============================================================
   SELLER RATINGS SYSTEM
============================================================ */

let ratingValue     = 0;
let ratingTargetEmail = "";
let ratingTargetName  = "";
let ratingNotifId     = 0;

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function getSellerRating(email) {
  const r = ratings[email];
  if (!r || !r.length) return null;
  const avg = r.reduce((sum, x) => sum + x.score, 0) / r.length;
  return { avg: Math.round(avg * 10) / 10, count: r.length };
}

function getTrustLabel(avg) {
  if (avg >= 4.5) return { label: "Highly Trusted", cls: "trust-high" };
  if (avg >= 3.5) return { label: "Trusted", cls: "trust-mid" };
  if (avg >= 2.5) return { label: "Moderate", cls: "trust-mod" };
  return { label: "Low Trust", cls: "trust-low" };
}

function renderStarsHtml(avg, size) {
  size = size || 14;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    const fill = i <= Math.round(avg) ? "#f5a623" : "#ddd";
    html += '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + fill + '" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  }
  return html;
}

function renderRatingBadge(email, targetId) {
  const el = $(targetId);
  if (!el) return;
  const r = getSellerRating(email);
  if (!r) {
    el.innerHTML = '<span class="no-rating">No ratings yet</span>';
    return;
  }
  const trust = getTrustLabel(r.avg);
  el.innerHTML =
    '<div class="rating-badge ' + trust.cls + '">' +
      '<span class="rating-stars-small">' + renderStarsHtml(r.avg, 13) + '</span>' +
      '<span class="rating-avg">' + r.avg + '</span>' +
      '<span class="rating-count">(' + r.count + ')</span>' +
      '<span class="trust-pill ' + trust.cls + '">' + trust.label + '</span>' +
    '</div>';
}

function openRatingModal(sellerEmail, sellerName, notifId) {
  ratingTargetEmail = sellerEmail;
  ratingTargetName  = sellerName;
  ratingNotifId     = notifId;
  ratingValue       = 0;

  const existing = (ratings[sellerEmail] || []).find(r => r.rater === currentUser.email && r.notifId === notifId);
  if (existing) {
    alert("You have already rated this seller for this transaction.");
    return;
  }

  $("ratingSellerInfo").innerHTML =
    '<div class="rating-seller-name">' + sellerName + '</div>' +
    '<div class="rating-seller-email">' + sellerEmail + '</div>';
  $("ratingText").textContent = "";
  $("ratingComment").value = "";
  $("submitRatingBtn").disabled = true;

  document.querySelectorAll("#ratingStars .star").forEach(s => s.classList.remove("active"));
  $("ratingModal").classList.add("open");
}

document.querySelectorAll("#ratingStars .star").forEach(star => {
  star.addEventListener("click", function() {
    ratingValue = parseInt(this.dataset.val);
    document.querySelectorAll("#ratingStars .star").forEach((s, i) => {
      s.classList.toggle("active", i < ratingValue);
    });
    $("ratingText").textContent = RATING_LABELS[ratingValue];
    $("submitRatingBtn").disabled = false;
  });

  star.addEventListener("mouseenter", function() {
    const val = parseInt(this.dataset.val);
    document.querySelectorAll("#ratingStars .star").forEach((s, i) => {
      s.classList.toggle("hover", i < val);
    });
  });

  star.addEventListener("mouseleave", function() {
    document.querySelectorAll("#ratingStars .star").forEach(s => s.classList.remove("hover"));
  });
});

$("submitRatingBtn").addEventListener("click", function() {
  if (!ratingValue || !ratingTargetEmail) return;

  if (!ratings[ratingTargetEmail]) ratings[ratingTargetEmail] = [];
  ratings[ratingTargetEmail].push({
    rater:    currentUser.email,
    raterName: currentUser.name,
    score:    ratingValue,
    comment:  $("ratingComment").value.trim(),
    time:     Date.now(),
    notifId:  ratingNotifId,
  });
  saveRatings();

  const myNotifs = notifications[currentUser.email] || [];
  const n = myNotifs.find(x => x.id === ratingNotifId);
  if (n) {
    n.rated = true;
    saveNotif();
  }

  const r = getSellerRating(ratingTargetEmail);
  const trust = getTrustLabel(r.avg);
  addNotification(ratingTargetEmail, {
    title:    currentUser.name + " rated you " + ratingValue + "/5 ⭐",
    message:  "You received a " + RATING_LABELS[ratingValue].toLowerCase() + " rating! Your overall rating is now " + r.avg + "/5 (" + r.count + " reviews). You are \"" + trust.label + "\".",
    from:     currentUser.email,
    fromName: currentUser.name,
    isRatingReceived: true,
  });

  $("ratingModal").classList.remove("open");
  renderAll();
  alert("Thank you for your rating!");
});

$("closeRating").addEventListener("click", () => $("ratingModal").classList.remove("open"));
$("ratingModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });

window.openRatingModal = openRatingModal;


/* ============================================================
   INIT — auto-login if session saved
============================================================ */



/* Check admin session first */
if (localStorage.getItem("ps_admin_session") === "1") {
  isAdmin = true;
  showAdminDashboard();
} else {
  /* Check regular user session */
  const saved = localStorage.getItem("currentUser");
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
}