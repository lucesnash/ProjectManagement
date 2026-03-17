/* ============================================================
   PAMILIHANG SILANGAN — Application JavaScript
   University of the East Philippines
============================================================ */


/* ============================================================
   DATA & STATE
============================================================ */

if (localStorage.getItem("ps_version") !== "v8") {
  localStorage.removeItem("products");
  localStorage.removeItem("notifications");
  localStorage.setItem("ps_version", "v8");
}

let products      = JSON.parse(localStorage.getItem("products"))        || [];
let users         = JSON.parse(localStorage.getItem("registeredUsers")) || {};
let notifications = JSON.parse(localStorage.getItem("notifications"))   || {};
let currentUser   = null;
let currentCat    = "all";
let myItems       = false;
let uploadedImg   = null;
let editMode      = false;


/* ============================================================
   HELPERS
============================================================ */

const save      = () => localStorage.setItem("products",      JSON.stringify(products));
const saveNotif = () => localStorage.setItem("notifications", JSON.stringify(notifications));

const ICONS = {
  technology: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`,
  books: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>`,
  uniform: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
  </svg>`,
  stationery: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="20" x2="12" y2="4"/>
    <path d="M6 9l6-5 6 5"/>
    <line x1="6" y1="20" x2="18" y2="20"/>
  </svg>`,
  others: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/>
    <rect x="1" y="3" width="22" height="5"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </svg>`,
};

const icon     = c => ICONS[c] || ICONS.others;
const lbl      = c => ({ all: "All Items", mine: "My Items", technology: "Technology", books: "Books", uniform: "Uniform", stationery: "Stationery", others: "Others" }[c] || c);
const initials = n => n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U";
const isReal   = img => img && img.startsWith("data:image/") && !img.includes("svg+xml");

const timeAgo = ts => {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
};

const $ = id => document.getElementById(id);


/* ============================================================
   NOTIFICATIONS SYSTEM
============================================================ */

function getMyNotifs() {
  if (!currentUser) return [];
  return (notifications[currentUser.email] || []).slice().reverse();
}

function addNotification(toEmail, notif) {
  if (!notifications[toEmail]) notifications[toEmail] = [];
  notifications[toEmail].push({
    id:     Date.now() + Math.random(),
    ...notif,
    time:   Date.now(),
    unread: true,
  });
  saveNotif();
  if (currentUser && toEmail === currentUser.email) updateNotifBadge();
}

function countUnread() {
  if (!currentUser) return 0;
  return (notifications[currentUser.email] || []).filter(n => n.unread).length;
}

function updateNotifBadge() {
  const count   = countUnread();
  const badge   = $("notifBadge");
  const mpCount = $("mpNotifCount");
  const mnDot   = $("mnNotifDot");

  if (count > 0) {
    if (badge)   { badge.textContent = count > 9 ? "9+" : count; badge.style.display = "flex"; }
    if (mpCount) { mpCount.textContent = count; mpCount.style.display = "inline-block"; }
    if (mnDot)   mnDot.style.display = "block";
  } else {
    if (badge)   badge.style.display = "none";
    if (mpCount) mpCount.style.display = "none";
    if (mnDot)   mnDot.style.display = "none";
  }
}

function markAllRead() {
  if (!currentUser) return;
  (notifications[currentUser.email] || []).forEach(n => (n.unread = false));
  saveNotif();
  updateNotifBadge();
}

function renderNotifList() {
  const list   = $("notifList");
  const notifs = getMyNotifs();

  if (!notifs.length) {
    list.innerHTML = '<div class="pd-empty">No notifications yet.</div>';
    return;
  }

  list.innerHTML = "";
  notifs.forEach(n => {
    const div = document.createElement("div");
    div.className = "notif-item" + (n.unread ? " unread" : "");
    div.innerHTML = `
      <div class="notif-item-icon">💬</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${n.title || "New Message"}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
      ${n.unread ? '<div class="notif-dot"></div>' : ""}
    `;
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
  saveNotif();
  updateNotifBadge();
  renderNotifList();
});


/* ============================================================
   SOLD ITEM EXPIRY (auto-remove after 24 h)
============================================================ */

function expiry() {
  const now    = Date.now();
  const before = products.length;
  products = products.filter(p => !(p.soldOut && p.soldOutTime && (now - p.soldOutTime) / 3600000 >= 24));
  if (products.length < before) { save(); renderAll(); }
}

setInterval(expiry, 60000);


/* ============================================================
   STATS
============================================================ */

function stats() {
  const v         = products.filter(p => !p.soldOut);
  const total     = v.length;
  const techCount = v.filter(p => p.category === "technology").length;
  const bookCount = v.filter(p => p.category === "books").length;
  const unifCount = v.filter(p => p.category === "uniform").length;
  const statCount = v.filter(p => p.category === "stationery").length;
  const othCount  = v.filter(p => p.category === "others").length;

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  // Desktop stat cards
  set("sTotal",    total);
  set("sTech",     techCount);
  set("sBooks",    bookCount);
  set("sUniform",  unifCount);
  set("sOthers",   statCount + othCount);

  // Mobile category sheet
  set("scAll",        total);
  set("scTech",       techCount);
  set("scBooks",      bookCount);
  set("scUniform",    unifCount);
  set("scStationery", statCount);
  set("scOthers",     othCount);

  // Mobile listings sheet
  set("lsTotal",      total);
  set("lsTech",       techCount);
  set("lsBooks",      bookCount);
  set("lsUniform",    unifCount);
  set("lsStationery", statCount);
  set("lsOthers",     othCount);
}


/* ============================================================
   PRODUCT CARDS
============================================================ */

function renderProducts(cat, search) {
  search = (search || "").toLowerCase();
  const grid = $("productsGrid");

  const list = products.filter(p => {
    const matchCat    = myItems ? p.email === currentUser.email : (cat === "all" || p.category === cat);
    const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  $("itemCount").textContent = list.length + " item" + (list.length !== 1 ? "s" : "");
  $("catLabel").textContent  = myItems ? "My Items" : lbl(cat);

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📦</div>
        <h3>No items found</h3>
        <p>Try a different category or search term.</p>
      </div>`;
    return;
  }

  grid.innerHTML = "";

  list.forEach(p => {
    const card   = document.createElement("div");
    card.className = "p-card" + (p.soldOut ? " sold" : "");
    const hasImg = isReal(p.image);

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
      <div class="p-banner${hasImg ? " clickable" : ""}"
        ${hasImg ? `onclick="openLightbox(${p.id});event.stopPropagation();"` : ""}>
        ${hasImg
          ? `<img src="${p.image}" alt="${p.name}">`
          : `<div class="p-banner-icon">${icon(p.category)}</div>`}
        ${p.soldOut ? '<div class="p-sold-badge">SOLD</div>' : ""}
        <div class="p-banner-label">${p.name}</div>
        ${hasImg
          ? `<div class="zoom-hint">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                 <circle cx="11" cy="11" r="8"/>
                 <line x1="21" y1="21" x2="16.65" y2="16.65"/>
               </svg>
               Tap to expand
             </div>`
          : ""}
      </div>
      <div class="p-body">
        <div class="p-name">${p.name}</div>
        <div class="p-tag">${lbl(p.category)}</div>
        <div class="p-price">₱${p.price.toLocaleString()}</div>
        <div class="p-loc">${p.location}</div>
        ${myBtns}
        <button class="btn-contact" onclick="openContact(${p.id})" ${p.soldOut ? "disabled" : ""}>
          ${p.soldOut ? "Sold Out" : "Contact Seller"}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}


/* ============================================================
   RECENT LISTINGS (right panel)
============================================================ */

function renderRecent() {
  const el    = $("recentList");
  const avail = products.filter(p => !p.soldOut).slice(0, 6);

  if (!avail.length) {
    el.innerHTML = '<div class="pd-empty">No listings yet.</div>';
    return;
  }

  el.innerHTML = "";
  avail.forEach(p => {
    const d = document.createElement("div");
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
      </div>
    `;
    el.appendChild(d);
  });
}


/* ============================================================
   DESKTOP PROFILE DROPDOWN
============================================================ */

function renderPD() {
  const el   = $("pdList");
  const mine = products.filter(p => p.email === currentUser.email);

  if (!mine.length) {
    el.innerHTML = '<div class="pd-empty">You have no listed items yet.</div>';
    return;
  }

  el.innerHTML = "";
  mine.forEach(p => {
    const d = document.createElement("div");
    d.className = "pd-item";
    d.innerHTML = `
      <div class="pd-ico">${icon(p.category)}</div>
      <div style="flex:1;min-width:0;">
        <div class="pd-n" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
        <div class="pd-p">₱${p.price.toLocaleString()} ·
          <span style="color:${p.soldOut ? "#721c24" : "#22a55a"};font-size:11px;">
            ${p.soldOut ? "Sold" : "Available"}
          </span>
        </div>
      </div>
      <div class="pd-acts">
        ${!p.soldOut
          ? `<button class="xs xs-edit" onclick="openEdit(${p.id});event.stopPropagation()">Edit</button>
             <button class="xs xs-sold" onclick="markSold(${p.id});event.stopPropagation()">Sold</button>`
          : ""}
        <button class="xs xs-del" onclick="delItem(${p.id});event.stopPropagation()">Del</button>
      </div>
    `;
    el.appendChild(d);
  });
}


/* ============================================================
   MOBILE PROFILE SHEET
============================================================ */

function renderMobileProfile() {
  if (!currentUser) return;

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set("mpAvatar", initials(currentUser.name));
  set("mpName",   currentUser.name);
  set("mpEmail",  currentUser.email);
  set("mpRole",   currentUser.role);

  const list = $("mpItemsList");
  if (!list) return;

  const mine = products.filter(p => p.email === currentUser.email);

  if (!mine.length) {
    list.innerHTML = '<div class="pd-empty">No items listed yet.</div>';
    return;
  }

  list.innerHTML = "";
  mine.forEach(p => {
    const d = document.createElement("div");
    d.className = "mp-item-row";
    d.innerHTML = `
      <div class="pd-ico">${icon(p.category)}</div>
      <div class="mp-item-info">
        <div class="mp-item-name">${p.name}</div>
        <div class="mp-item-price">₱${p.price.toLocaleString()} ·
          <span style="color:${p.soldOut ? "#721c24" : "#22a55a"}">
            ${p.soldOut ? "Sold" : "Available"}
          </span>
        </div>
      </div>
      <div class="mp-item-acts">
        ${!p.soldOut
          ? `<button class="xs xs-edit" onclick="openEdit(${p.id});event.stopPropagation();closeMobileSheets();">Edit</button>
             <button class="xs xs-sold" onclick="markSold(${p.id});event.stopPropagation();">Sold</button>`
          : ""}
        <button class="xs xs-del" onclick="delItem(${p.id});event.stopPropagation();">Del</button>
      </div>
    `;
    list.appendChild(d);
  });
}


/* ============================================================
   RENDER ALL
============================================================ */

function renderAll() {
  stats();
  renderProducts(currentCat, getSearchValue());
  renderRecent();
  if ($("profileDropdown").classList.contains("open")) renderPD();
  if ($("mobileProfileSheet").classList.contains("open")) renderMobileProfile();
  updateNotifBadge();
}

// Returns current search value from whichever bar is active
function getSearchValue() {
  const mobile = $("searchBarMobile");
  const desk   = $("searchBar");
  if (mobile && $("mobileSearchBar").classList.contains("open")) return mobile.value;
  return desk ? desk.value : "";
}


/* ============================================================
   LIGHTBOX
============================================================ */

function openLightbox(id) {
  const p = products.find(x => x.id === id);
  if (!p || !isReal(p.image)) return;
  $("lightboxImg").src             = p.image;
  $("lightboxCaption").textContent = p.name;
  $("lightboxPrice").textContent   = "₱" + p.price.toLocaleString();
  $("lightbox").classList.add("open");
}

function closeLightbox() {
  $("lightbox").classList.remove("open");
  setTimeout(() => { $("lightboxImg").src = ""; }, 300);
}

$("lightboxClose").onclick = closeLightbox;
$("lightbox").addEventListener("click", function (e) { if (e.target === this) closeLightbox(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeLightbox(); closeMobileSheets(); } });


/* ============================================================
   CONTACT SELLER MODAL — in-app notification
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
  $("contactMessage").value = `Hi ${p.seller}! I'm interested in your "${p.name}" for ₱${p.price.toLocaleString()}. Is it still available?`;

  $("emailBtn").onclick = () => {
    const msg = $("contactMessage").value;
    window.location.href = `mailto:${p.email}?subject=Interested in ${encodeURIComponent(p.name)}&body=${encodeURIComponent(msg)}`;
  };

  $("contactModal").classList.add("open");
}

$("sendNotifBtn").addEventListener("click", function () {
  const p = products.find(x => x.id === contactProductId);
  if (!p) return;

  if (p.email === currentUser.email) { alert("That's your own listing!"); return; }

  const msg = $("contactMessage").value.trim();
  if (!msg) { alert("Please write a message first."); return; }

  addNotification(p.email, {
    title:    `${currentUser.name} is interested in "${p.name}"`,
    message:  msg,
    from:     currentUser.email,
    fromName: currentUser.name,
    itemId:   p.id,
    itemName: p.name,
  });

  const btn  = $("sendNotifBtn");
  const orig = btn.innerHTML;
  btn.innerHTML         = "✓ Notification Sent!";
  btn.style.background  = "#22a55a";
  setTimeout(() => {
    btn.innerHTML        = orig;
    btn.style.background = "";
    $("contactModal").classList.remove("open");
  }, 1800);
});

$("closeContact").onclick  = () => $("contactModal").classList.remove("open");
$("closeContact2").onclick = () => $("contactModal").classList.remove("open");
$("contactModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });


/* ============================================================
   SELL / EDIT MODAL
============================================================ */

function openSell() {
  editMode = false;
  $("sellTitle").textContent  = "New Listing";
  $("sellSubmit").textContent = "List Item";
  $("sellForm").reset();
  $("editId").value = "";
  uploadedImg = null;
  $("imgPreview").style.display = "none";
  $("fileLabel").className      = "file-lbl";
  $("fileLabel").textContent    = "📷 Attach Photo";
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
  uploadedImg = p.image;
  $("previewImg").src             = p.image;
  $("imgPreview").style.display   = "block";
  $("fileLabel").className        = "file-lbl active";
  $("fileLabel").textContent      = "✓ Current Photo";
  $("profileDropdown").classList.remove("open");
  $("sellModal").classList.add("open");
}

$("sellBtn").onclick   = openSell;
$("closeSell").onclick = () => $("sellModal").classList.remove("open");
$("sellModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });

$("mpSellBtn").addEventListener("click", () => { closeMobileSheets(); openSell(); });
$("mpNotifBtn").addEventListener("click", () => { closeMobileSheets(); openNotifModal(); });

$("iImg").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    uploadedImg = e.target.result;
    $("previewImg").src           = uploadedImg;
    $("imgPreview").style.display = "block";
    $("fileLabel").className      = "file-lbl active";
    $("fileLabel").textContent    = "✓ " + file.name;
  };
  reader.readAsDataURL(file);
});

$("sellForm").addEventListener("submit", function (e) {
  e.preventDefault();
  if (!uploadedImg) { alert("Please attach a photo."); return; }

  if (editMode) {
    const id = parseInt($("editId").value);
    const i  = products.findIndex(x => x.id === id);
    if (i !== -1 && products[i].email === currentUser.email) {
      products[i] = {
        ...products[i],
        name:        $("iName").value,
        price:       parseFloat($("iPrice").value),
        category:    $("iCat").value,
        location:    $("iLoc").value,
        description: $("iDesc").value,
        image:       uploadedImg,
      };
    }
  } else {
    products.unshift({
      id:          products.length ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name:        $("iName").value,
      price:       parseFloat($("iPrice").value),
      category:    $("iCat").value,
      location:    $("iLoc").value,
      image:       uploadedImg,
      seller:      currentUser.name,
      email:       currentUser.email,
      role:        currentUser.role,
      description: $("iDesc").value,
      soldOut:     false,
      soldOutTime: null,
    });
  }

  save();
  $("sellModal").classList.remove("open");
  renderAll();
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
   DESKTOP SIDEBAR NAVIGATION
============================================================ */

document.querySelectorAll(".nav-item[data-cat]").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    myItems    = this.dataset.cat === "mine";
    currentCat = myItems ? currentCat : this.dataset.cat;
    renderProducts(currentCat, getSearchValue());
  });
});

// Stat cards clickable to filter
document.querySelectorAll(".stat-card[data-cat-stat]").forEach(card => {
  card.addEventListener("click", function () {
    currentCat = this.dataset.catStat;
    myItems    = false;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const match = document.querySelector(`.nav-item[data-cat="${currentCat}"]`);
    if (match) match.classList.add("active");
    renderProducts(currentCat, getSearchValue());
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});


/* ============================================================
   SEARCH — DESKTOP + MOBILE
============================================================ */

// Desktop search bar
$("searchBar").addEventListener("input", function () {
  renderProducts(currentCat, this.value);
});

// Mobile search icon → show overlay search bar
$("mobileSearchBtn").addEventListener("click", function () {
  $("mobileSearchBar").classList.add("open");
  const input = $("searchBarMobile");
  input.value = "";
  setTimeout(() => input.focus(), 50);
});

// Mobile close button → hide overlay search bar
$("searchCloseBtn").addEventListener("click", function () {
  $("mobileSearchBar").classList.remove("open");
  $("searchBarMobile").value = "";
  renderProducts(currentCat, "");
});

// Mobile search input live filter
$("searchBarMobile").addEventListener("input", function () {
  renderProducts(currentCat, this.value);
});


/* ============================================================
   DESKTOP PROFILE DROPDOWN TOGGLE
============================================================ */

$("profileToggle").addEventListener("click", function (e) {
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
   MOBILE BOTTOM NAVIGATION
============================================================ */

function closeMobileSheets() {
  $("mobileCatSheet").classList.remove("open");
  $("mobileListSheet").classList.remove("open");
  $("mobileProfileSheet").classList.remove("open");
  $("sheetOverlay").classList.remove("open");
}

function openMobileSheet(sheetId) {
  closeMobileSheets();
  $(sheetId).classList.add("open");
  $("sheetOverlay").classList.add("open");
}

$("sheetOverlay").addEventListener("click", closeMobileSheets);

function setMobileNavActive(id) {
  document.querySelectorAll(".mn-item").forEach(b => b.classList.remove("active"));
  $(id).classList.add("active");
}

// Home
$("mnHome").addEventListener("click", function () {
  setMobileNavActive("mnHome");
  myItems    = false;
  currentCat = "all";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const nav = document.querySelector('.nav-item[data-cat="all"]');
  if (nav) nav.classList.add("active");
  renderProducts(currentCat, getSearchValue());
  closeMobileSheets();
});

// Categories
$("mnCategories").addEventListener("click", function () {
  setMobileNavActive("mnCategories");
  openMobileSheet("mobileCatSheet");
});

// Listings counts
$("mnListings").addEventListener("click", function () {
  setMobileNavActive("mnListings");
  openMobileSheet("mobileListSheet");
});

// Profile — hide red dot when opened
$("mnProfile").addEventListener("click", function () {
  setMobileNavActive("mnProfile");
  renderMobileProfile();
  openMobileSheet("mobileProfileSheet");
  const dot = $("mnNotifDot");
  if (dot) dot.style.display = "none";
});

// Category sheet items
document.querySelectorAll(".sheet-cat-item").forEach(btn => {
  btn.addEventListener("click", function () {
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

// Mobile logout
$("mobileLogoutBtn").addEventListener("click", logout);


/* ============================================================
   AUTH — @ue.edu.ph ONLY
============================================================ */

$("loginEmail").addEventListener("input", function () {
  const ok = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  $("loginHint").style.display = ok ? "none" : "block";
  this.style.borderColor       = ok ? "" : "#dc3545";
});

$("signupEmail").addEventListener("input", function () {
  const ok = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  $("signupHint").style.display = ok ? "none" : "block";
  this.style.borderColor        = ok ? "" : "#dc3545";
});

$("toSignup").onclick = () => {
  $("loginView").classList.add("hidden");
  $("signupView").classList.remove("hidden");
};

$("toLogin").onclick = () => {
  $("signupView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
};

$("signupForm").addEventListener("submit", function (e) {
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

$("loginForm").addEventListener("submit", function (e) {
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
   LOGOUT
============================================================ */

function logout() {
  currentUser = null;
  localStorage.removeItem("currentUser");
  closeMobileSheets();
  $("dashboardView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginEmail").value    = "";
  $("loginPassword").value = "";
}

$("logoutBtn").onclick = logout;


/* ============================================================
   SHOW DASHBOARD
============================================================ */

function showDashboard() {
  $("loginView").classList.add("hidden");
  $("signupView").classList.add("hidden");
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
}


/* ============================================================
   INIT — auto-login if session exists
============================================================ */

const saved = localStorage.getItem("currentUser");
if (saved) {
  currentUser = JSON.parse(saved);
  showDashboard();
}