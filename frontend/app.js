/* ═══════════════════════════════════════════════════════════════
   MemoStack — app.js  |  Frontend Logic
   ═══════════════════════════════════════════════════════════════ */

const API = "https://memostack-api.onrender.com";

/* ─── State ──────────────────────────────────────────────────── */
let notes        = [];
let editId       = null;   // null = create, string = editing
let deleteTarget = null;
let activeCategory = "all";
let selectedColor  = "#6C63FF";

/* ─── DOM Refs ───────────────────────────────────────────────── */
const notesGrid      = document.getElementById("notesGrid");
const emptyState     = document.getElementById("emptyState");
const loadingState   = document.getElementById("loadingState");
const searchInput    = document.getElementById("searchInput");
const modalOverlay   = document.getElementById("modalOverlay");
const confirmOverlay = document.getElementById("confirmOverlay");
const toast          = document.getElementById("toast");
const pageTitle      = document.getElementById("pageTitle");
const pageSubtitle   = document.getElementById("pageSubtitle");

// Form fields
const fieldTitle    = document.getElementById("fieldTitle");
const fieldCategory = document.getElementById("fieldCategory");
const fieldContent  = document.getElementById("fieldContent");
const fieldPinned   = document.getElementById("fieldPinned");
const colorDots     = document.querySelectorAll(".color-dot");

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function showToast(msg, type = "success") {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function setLoading(on) {
  loadingState.style.display = on ? "flex" : "none";
}

/* ─── Fetch Wrappers ─────────────────────────────────────────── */
async function fetchNotes(search = "") {
  setLoading(true);
  try {
    const params = new URLSearchParams({ category: activeCategory, search });
    const res  = await fetch(`${API}/notes?${params}`);
    const data = await res.json();
    notes = data.data || [];
    renderNotes();
    await fetchStats();
  } catch {
    showToast("Cannot reach API. Is the backend running?", "error");
  } finally {
    setLoading(false);
  }
}

async function fetchStats() {
  try {
    const res  = await fetch(`${API}/stats`);
    const data = await res.json();
    const s = data.data;

    document.getElementById("stat-total").textContent  = s.total;
    document.getElementById("stat-pinned").textContent = s.pinned;

    // Update badges
    document.getElementById("badge-all").textContent     = s.total;
    const cats = ["general","frontend","backend","ideas","tasks"];
    cats.forEach(c => {
      const el = document.getElementById(`badge-${c}`);
      if (el) el.textContent = s.categories[c] || 0;
    });
  } catch { /* silent */ }
}

async function createNote(payload) {
  const res  = await fetch(`${API}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function updateNote(id, payload) {
  const res = await fetch(`${API}/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function togglePin(id) {
  const res = await fetch(`${API}/notes/${id}/pin`, { method: "PATCH" });
  return res.json();
}

async function deleteNote(id) {
  await fetch(`${API}/notes/${id}`, { method: "DELETE" });
}

/* ─── Render ─────────────────────────────────────────────────── */
function renderNotes() {
  notesGrid.innerHTML = "";

  if (notes.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  notes.forEach((note, i) => {
    const card = document.createElement("div");
    card.className = "note-card";
    card.style.setProperty("--card-accent", note.color);
    card.style.setProperty("--card-glow",   hexToRgba(note.color, 0.07));
    card.style.animationDelay = `${i * 0.06}s`;

    card.innerHTML = `
      <div class="card-top">
        <h3 class="card-title">${escHtml(note.title)}</h3>
        ${note.pinned ? '<span class="card-pin" title="Pinned">📌</span>' : ""}
      </div>
      <p class="card-content">${escHtml(note.content)}</p>
      <div class="card-footer">
        <span class="card-category">${note.category}</span>
        <div class="card-actions">
          <button class="card-btn pin-btn" data-id="${note.id}" title="${note.pinned ? "Unpin" : "Pin"}">
            ${note.pinned ? "📌" : "📍"}
          </button>
          <button class="card-btn edit-btn" data-id="${note.id}">Edit</button>
          <button class="card-btn del"      data-id="${note.id}">Delete</button>
        </div>
        <span class="card-date">${formatDate(note.updatedAt)}</span>
      </div>
    `;

    // Click card body (not action buttons) → open edit modal
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".card-btn")) openEditModal(note);
    });

    // Action buttons
    card.querySelector(".pin-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      await togglePin(note.id);
      showToast(note.pinned ? "Note unpinned" : "Note pinned 📌");
      await fetchNotes(searchInput.value);
    });

    card.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(note);
    });

    card.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      openConfirm(note.id);
    });

    notesGrid.appendChild(card);
  });
}

function escHtml(str) {
  return str
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/* ─── Modal Logic ────────────────────────────────────────────── */
function openCreateModal() {
  editId = null;
  document.getElementById("modalTitle").textContent = "New Note";
  fieldTitle.value    = "";
  fieldContent.value  = "";
  fieldCategory.value = "general";
  fieldPinned.checked = false;
  setColor("#6C63FF");
  modalOverlay.classList.add("open");
  fieldTitle.focus();
}

function openEditModal(note) {
  editId = note.id;
  document.getElementById("modalTitle").textContent = "Edit Note";
  fieldTitle.value    = note.title;
  fieldContent.value  = note.content;
  fieldCategory.value = note.category;
  fieldPinned.checked = note.pinned;
  setColor(note.color);
  modalOverlay.classList.add("open");
  fieldTitle.focus();
}

function closeModal() {
  modalOverlay.classList.remove("open");
}

function setColor(hex) {
  selectedColor = hex;
  colorDots.forEach(d => {
    d.classList.toggle("active", d.dataset.color === hex);
  });
}

/* ─── Save Handler ───────────────────────────────────────────── */
document.getElementById("btnSave").addEventListener("click", async () => {
  const title   = fieldTitle.value.trim();
  const content = fieldContent.value.trim();

  if (!title) { fieldTitle.focus(); showToast("Please enter a title", "error"); return; }
  if (!content) { fieldContent.focus(); showToast("Please add some content", "error"); return; }

  const payload = {
    title,
    content,
    category: fieldCategory.value,
    color:    selectedColor,
    pinned:   fieldPinned.checked,
  };

  try {
    if (editId) {
      await updateNote(editId, payload);
      showToast("Note updated ✓");
    } else {
      await createNote(payload);
      showToast("Note created ✓");
    }
    closeModal();
    await fetchNotes(searchInput.value);
  } catch {
    showToast("Something went wrong", "error");
  }
});

/* ─── Delete Confirm ─────────────────────────────────────────── */
function openConfirm(id) {
  deleteTarget = id;
  confirmOverlay.classList.add("open");
}

document.getElementById("confirmNo").addEventListener("click", () => {
  confirmOverlay.classList.remove("open");
  deleteTarget = null;
});

document.getElementById("confirmYes").addEventListener("click", async () => {
  if (!deleteTarget) return;
  await deleteNote(deleteTarget);
  confirmOverlay.classList.remove("open");
  deleteTarget = null;
  showToast("Note deleted");
  await fetchNotes(searchInput.value);
});

/* ─── UI Bindings ────────────────────────────────────────────── */
document.getElementById("btnNew").addEventListener("click", openCreateModal);
document.getElementById("btnCancel").addEventListener("click", closeModal);
document.getElementById("modalClose").addEventListener("click", closeModal);

// Close modal on backdrop click
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Color picker
colorDots.forEach(dot => {
  dot.addEventListener("click", () => setColor(dot.dataset.color));
});

// Search (debounced)
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => fetchNotes(searchInput.value), 350);
});

// Category nav
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    activeCategory = item.dataset.category;
    const label = item.textContent.trim().replace(/\d+/g,"").trim();
    pageTitle.textContent    = label.replace(/[◈◇◆◉▣]/g,"").trim();
    pageSubtitle.textContent = activeCategory === "all"
      ? "Your thoughts, organized"
      : `${label.replace(/[◈◇◆◉▣]/g,"").trim()} category`;
    fetchNotes(searchInput.value);
  });
});

// Hamburger
document.getElementById("hamburgerBtn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    openCreateModal();
  }
  if (e.key === "Escape") {
    closeModal();
    confirmOverlay.classList.remove("open");
    document.getElementById("sidebar").classList.remove("open");
  }
});

/* ─── Init ───────────────────────────────────────────────────── */
fetchNotes();