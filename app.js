/* ============================================================
   PAMILIHANG SILANGAN — Application JavaScript
   University of the East Philippines
============================================================ */


/* ============================================================
   DATA & STATE
============================================================ */

// Clear old demo data on first load (version check)
if (localStorage.getItem("ps_version") !== "v5") {
  localStorage.removeItem("products");
  localStorage.setItem("ps_version", "v5");
}

let products    = JSON.parse(localStorage.getItem("products")) || [];
let users       = JSON.parse(localStorage.getItem("registeredUsers")) || {};
let currentUser = null;
let currentCat  = "all";
let myItems     = false;
let uploadedImg = null;
let editMode    = false;


/* ============================================================
   HELPERS
============================================================ */

const save     = () => localStorage.setItem("products", JSON.stringify(products));
// SVG icon set — black/white stroke icons
const ICONS = {
  technology: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  books:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  uniform:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>',
  stationery: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="4"/><path d="M6 9l6-5 6 5"/><line x1="6" y1="20" x2="18" y2="20"/></svg>',
  others:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
};
const icon = c => ICONS[c] || ICONS.others;
const lbl      = c  => ({ all:"All Items", mine:"My Items", technology:"Technology", books:"Books", uniform:"Uniform", stationery:"Stationery", others:"Others" }[c] || c);
const initials = n  => n ? n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U";
const isReal   = img => img && img.startsWith("data:image/") && !img.includes("svg+xml");


/* ============================================================
   SOLD ITEM EXPIRY  (auto-remove after 24 hours)
============================================================ */

function expiry() {
  const now = Date.now();
  const before = products.length;
  products = products.filter(p =>
    !(p.soldOut && p.soldOutTime && (now - p.soldOutTime) / 3600000 >= 24)
  );
  if (products.length < before) { save(); renderAll(); }
}

setInterval(expiry, 60000);


/* ============================================================
   STATS CARDS
============================================================ */

function stats() {
  const v = products.filter(p => !p.soldOut);
  document.getElementById("sTotal").textContent   = v.length;
  document.getElementById("sTech").textContent    = v.filter(p => p.category === "technology").length;
  document.getElementById("sBooks").textContent   = v.filter(p => p.category === "books").length;
  document.getElementById("sUniform").textContent = v.filter(p => p.category === "uniform").length;
  document.getElementById("sOthers").textContent  = v.filter(p => p.category === "stationery" || p.category === "others").length;
}


/* ============================================================
   PRODUCT CARDS  (main grid)
============================================================ */

function renderProducts(cat, search) {
  search = (search || "").toLowerCase();
  const grid = document.getElementById("productsGrid");

  // Filter by category and search term
  let list = products.filter(p => {
    const matchCat    = myItems ? p.email === currentUser.email : (cat === "all" || p.category === cat);
    const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  document.getElementById("itemCount").textContent = list.length + " item" + (list.length !== 1 ? "s" : "");
  document.getElementById("catLabel").textContent  = myItems ? "My Items" : lbl(cat);

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

    // My Items action buttons (edit / mark sold / delete)
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
        ${hasImg ? '<div class="zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Tap to expand</div>' : ""}
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
      </div>`;

    grid.appendChild(card);
  });
}


/* ============================================================
   RECENT LISTINGS  (right panel)
============================================================ */

function renderRecent() {
  const el    = document.getElementById("recentList");
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
      </div>`;
    el.appendChild(d);
  });
}


/* ============================================================
   PROFILE DROPDOWN  (avatar menu)
============================================================ */

function renderPD() {
  const el   = document.getElementById("pdList");
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
      </div>`;
    el.appendChild(d);
  });
}


/* ============================================================
   RENDER ALL
============================================================ */

function renderAll() {
  stats();
  renderProducts(currentCat, document.getElementById("searchBar").value);
  renderRecent();
  const pd = document.getElementById("profileDropdown");
  if (pd.classList.contains("open")) renderPD();
}


/* ============================================================
   LIGHTBOX  (fullscreen image preview)
============================================================ */

function openLightbox(id) {
  const p = products.find(x => x.id === id);
  if (!p || !isReal(p.image)) return;
  document.getElementById("lightboxImg").src             = p.image;
  document.getElementById("lightboxCaption").textContent = p.name;
  document.getElementById("lightboxPrice").textContent   = "₱" + p.price.toLocaleString();
  document.getElementById("lightbox").classList.add("open");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  setTimeout(() => { document.getElementById("lightboxImg").src = ""; }, 300);
}

document.getElementById("lightboxClose").onclick = closeLightbox;
document.getElementById("lightbox").addEventListener("click", function(e) {
  if (e.target === this) closeLightbox();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });


/* ============================================================
   CONTACT SELLER MODAL
============================================================ */

function openContact(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.soldOut) return;

  document.getElementById("cName").textContent  = p.seller;
  document.getElementById("cEmail").textContent = p.email;
  document.getElementById("cLoc").textContent   = p.location;
  document.getElementById("cRole").innerHTML    = `<span class="role-b role-${p.role}">${p.role}</span>`;

  document.getElementById("emailBtn").onclick = () => {
    window.location.href = `mailto:${p.email}?subject=Interested in ${p.name}&body=Hi ${p.seller}, I'm interested in your ${p.name} for ₱${p.price.toLocaleString()}.`;
  };

  document.getElementById("contactModal").classList.add("open");
}

document.getElementById("closeContact").onclick  = () => document.getElementById("contactModal").classList.remove("open");
document.getElementById("closeContact2").onclick = () => document.getElementById("contactModal").classList.remove("open");
document.getElementById("contactModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});


/* ============================================================
   SELL / EDIT MODAL
============================================================ */

function openSell() {
  editMode = false;
  document.getElementById("sellTitle").textContent  = "New Listing";
  document.getElementById("sellSubmit").textContent = "List Item";
  document.getElementById("sellForm").reset();
  document.getElementById("editId").value           = "";
  uploadedImg = null;
  document.getElementById("imgPreview").style.display = "none";
  document.getElementById("fileLabel").className      = "file-lbl";
  document.getElementById("fileLabel").textContent    = "📷 Attach Photo";
  document.getElementById("sellModal").classList.add("open");
}

function openEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.email !== currentUser.email) return;

  editMode = true;
  document.getElementById("sellTitle").textContent  = "Edit Listing";
  document.getElementById("sellSubmit").textContent = "Update Item";
  document.getElementById("editId").value           = id;
  document.getElementById("iName").value            = p.name;
  document.getElementById("iPrice").value           = p.price;
  document.getElementById("iCat").value             = p.category;
  document.getElementById("iLoc").value             = p.location;
  document.getElementById("iDesc").value            = p.description;
  uploadedImg = p.image;
  document.getElementById("previewImg").src           = p.image;
  document.getElementById("imgPreview").style.display = "block";
  document.getElementById("fileLabel").className      = "file-lbl active";
  document.getElementById("fileLabel").textContent    = "✓ Current Photo";
  document.getElementById("profileDropdown").classList.remove("open");
  document.getElementById("sellModal").classList.add("open");
}

document.getElementById("sellBtn").onclick   = openSell;
document.getElementById("closeSell").onclick = () => document.getElementById("sellModal").classList.remove("open");
document.getElementById("sellModal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// Photo upload preview
document.getElementById("iImg").addEventListener("change", function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    uploadedImg = e.target.result;
    document.getElementById("previewImg").src           = uploadedImg;
    document.getElementById("imgPreview").style.display = "block";
    document.getElementById("fileLabel").className      = "file-lbl active";
    document.getElementById("fileLabel").textContent    = "✓ " + file.name;
  };
  reader.readAsDataURL(file);
});

// Submit listing
document.getElementById("sellForm").addEventListener("submit", function(e) {
  e.preventDefault();
  if (!uploadedImg) { alert("Please attach a photo."); return; }

  if (editMode) {
    // Update existing item
    const id = parseInt(document.getElementById("editId").value);
    const i  = products.findIndex(x => x.id === id);
    if (i !== -1 && products[i].email === currentUser.email) {
      products[i] = {
        ...products[i],
        name:        document.getElementById("iName").value,
        price:       parseFloat(document.getElementById("iPrice").value),
        category:    document.getElementById("iCat").value,
        location:    document.getElementById("iLoc").value,
        description: document.getElementById("iDesc").value,
        image:       uploadedImg
      };
    }
  } else {
    // Create new item
    products.unshift({
      id:          products.length ? Math.max(...products.map(p => p.id)) + 1 : 1,
      name:        document.getElementById("iName").value,
      price:       parseFloat(document.getElementById("iPrice").value),
      category:    document.getElementById("iCat").value,
      location:    document.getElementById("iLoc").value,
      image:       uploadedImg,
      seller:      currentUser.name,
      email:       currentUser.email,
      role:        currentUser.role,
      description: document.getElementById("iDesc").value,
      soldOut:     false,
      soldOutTime: null
    });
  }

  save();
  document.getElementById("sellModal").classList.remove("open");
  renderAll();
});


/* ============================================================
   MARK SOLD  &  DELETE
============================================================ */

function markSold(id) {
  if (!confirm("Mark as sold? It will auto-remove after 24 hours.")) return;
  const i = products.findIndex(x => x.id === id);
  if (i !== -1 && products[i].email === currentUser.email) {
    products[i].soldOut     = true;
    products[i].soldOutTime = Date.now();
    save(); renderAll();
  }
}

function delItem(id) {
  if (!confirm("Delete this listing?")) return;
  const i = products.findIndex(x => x.id === id);
  if (i !== -1 && products[i].email === currentUser.email) {
    products.splice(i, 1);
    save(); renderAll();
  }
}


/* ============================================================
   SIDEBAR NAVIGATION
============================================================ */

document.querySelectorAll(".nav-item[data-cat]").forEach(btn => {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    this.classList.add("active");

    if (this.dataset.cat === "mine") {
      myItems = true;
    } else {
      myItems    = false;
      currentCat = this.dataset.cat;
    }

    renderProducts(currentCat, document.getElementById("searchBar").value);
  });
});


/* ============================================================
   SEARCH BAR
============================================================ */

document.getElementById("searchBar").addEventListener("input", function() {
  renderProducts(currentCat, this.value);
});


/* ============================================================
   PROFILE DROPDOWN  (avatar toggle)
============================================================ */

document.getElementById("profileToggle").addEventListener("click", function(e) {
  e.stopPropagation();
  const dd = document.getElementById("profileDropdown");
  dd.classList.toggle("open");
  if (dd.classList.contains("open")) renderPD();
});

document.addEventListener("click", e => {
  const dd = document.getElementById("profileDropdown");
  if (!document.getElementById("profileToggle").contains(e.target) && !dd.contains(e.target)) {
    dd.classList.remove("open");
  }
});


/* ============================================================
   AUTH  —  @ue.edu.ph ONLY
============================================================ */

// Live email validation hint
document.getElementById("loginEmail").addEventListener("input", function() {
  const valid = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  document.getElementById("loginHint").style.display = valid ? "none" : "block";
  this.style.borderColor = valid ? "" : "#dc3545";
});

document.getElementById("signupEmail").addEventListener("input", function() {
  const valid = this.value.trim() === "" || this.value.trim().endsWith("@ue.edu.ph");
  document.getElementById("signupHint").style.display = valid ? "none" : "block";
  this.style.borderColor = valid ? "" : "#dc3545";
});

// Toggle between login / signup views
document.getElementById("toSignup").onclick = () => {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("signupView").classList.remove("hidden");
};

document.getElementById("toLogin").onclick = () => {
  document.getElementById("signupView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
};

// Signup
document.getElementById("signupForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const name  = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const role  = document.getElementById("signupRole").value;
  const pw    = document.getElementById("signupPassword").value;
  const cpw   = document.getElementById("signupConfirm").value;

  if (!email.endsWith("@ue.edu.ph")) {
    alert("❌ Only @ue.edu.ph school email addresses are allowed to register.");
    return;
  }
  if (pw !== cpw) { alert("Passwords do not match."); return; }
  if (users[email]) { alert("This email is already registered."); return; }

  users[email] = { name, email, role, password: pw };
  localStorage.setItem("registeredUsers", JSON.stringify(users));

  document.getElementById("signupSuccess").style.display = "block";

  setTimeout(() => {
    document.getElementById("signupSuccess").style.display = "none";
    document.getElementById("signupForm").reset();
    document.getElementById("signupView").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
    document.getElementById("loginEmail").value = email;
  }, 1800);
});

// Login
document.getElementById("loginForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const pw    = document.getElementById("loginPassword").value;

  if (!email.endsWith("@ue.edu.ph")) {
    alert("❌ Only @ue.edu.ph school email addresses are allowed to sign in.");
    return;
  }

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
  document.getElementById("dashboardView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
  document.getElementById("loginEmail").value    = "";
  document.getElementById("loginPassword").value = "";
}

document.getElementById("logoutBtn").onclick = logout;


/* ============================================================
   SHOW DASHBOARD
============================================================ */

function showDashboard() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("signupView").classList.add("hidden");
  document.getElementById("dashboardView").classList.remove("hidden");

  document.getElementById("avInitials").textContent = initials(currentUser.name);
  document.getElementById("avName").textContent     = currentUser.name.split(" ")[0];
  document.getElementById("avRole").textContent     = currentUser.role;
  document.getElementById("pdName").textContent     = currentUser.name;
  document.getElementById("pdEmail").textContent    = currentUser.email;
  document.getElementById("pdRole").textContent     = currentUser.role;

  expiry();
  renderAll();
}


/* ============================================================
   INIT  —  auto-login if session exists
============================================================ */

const saved = localStorage.getItem("currentUser");
if (saved) {
  currentUser = JSON.parse(saved);
  showDashboard();
}