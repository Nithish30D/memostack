const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── In-Memory Store (replace with DB later) ─────────────────────────────────
let notes = [
  {
    id: uuidv4(),
    title: "Welcome to MemoStack 👋",
    content:
      "This is your first note! MemoStack helps you capture ideas, tasks, and thoughts — beautifully. Try creating a new note using the + button.",
    category: "general",
    color: "#6C63FF",
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    title: "Frontend Stack",
    content:
      "HTML5 · CSS3 · Vanilla JS\nAnimations with CSS keyframes\nFetch API for backend communication",
    category: "frontend",
    color: "#FF6584",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    title: "Backend Stack",
    content:
      "Node.js · Express.js\nIn-memory store (upgradeable to MongoDB)\nREST API with full CRUD operations",
    category: "backend",
    color: "#43D9AD",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
const findNote = (id) => notes.find((n) => n.id === id);

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET  /api/notes          → List all notes (optional ?search=&category=)
app.get("/api/notes", (req, res) => {
  const { search = "", category = "" } = req.query;
  let result = [...notes];

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }

  if (category && category !== "all") {
    result = result.filter((n) => n.category === category);
  }

  // Pinned notes first, then by updatedAt desc
  result.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  res.json({ success: true, count: result.length, data: result });
});

// GET  /api/notes/:id      → Get single note
app.get("/api/notes/:id", (req, res) => {
  const note = findNote(req.params.id);
  if (!note) return res.status(404).json({ success: false, message: "Note not found" });
  res.json({ success: true, data: note });
});

// POST /api/notes          → Create note
app.post("/api/notes", (req, res) => {
  const { title, content, category = "general", color = "#6C63FF", pinned = false } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: "Title and content are required" });
  }

  const note = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    category,
    color,
    pinned,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  notes.unshift(note);
  res.status(201).json({ success: true, data: note });
});

// PUT  /api/notes/:id      → Update note
app.put("/api/notes/:id", (req, res) => {
  const idx = notes.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Note not found" });

  const { title, content, category, color, pinned } = req.body;
  const existing = notes[idx];

  notes[idx] = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    content: content !== undefined ? content.trim() : existing.content,
    category: category !== undefined ? category : existing.category,
    color: color !== undefined ? color : existing.color,
    pinned: pinned !== undefined ? pinned : existing.pinned,
    updatedAt: new Date().toISOString(),
  };

  res.json({ success: true, data: notes[idx] });
});

// PATCH /api/notes/:id/pin → Toggle pin
app.patch("/api/notes/:id/pin", (req, res) => {
  const note = findNote(req.params.id);
  if (!note) return res.status(404).json({ success: false, message: "Note not found" });
  note.pinned = !note.pinned;
  note.updatedAt = new Date().toISOString();
  res.json({ success: true, data: note });
});

// DELETE /api/notes/:id   → Delete note
app.delete("/api/notes/:id", (req, res) => {
  const idx = notes.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Note not found" });
  const deleted = notes.splice(idx, 1)[0];
  res.json({ success: true, data: deleted });
});

// GET  /api/stats          → Dashboard stats
app.get("/api/stats", (req, res) => {
  const categories = {};
  notes.forEach((n) => {
    categories[n.category] = (categories[n.category] || 0) + 1;
  });
  res.json({
    success: true,
    data: {
      total: notes.length,
      pinned: notes.filter((n) => n.pinned).length,
      categories,
    },
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🟢  MemoStack API running at http://localhost:${PORT}`);
  console.log(`  📋  Endpoints:`);
  console.log(`      GET    /api/notes`);
  console.log(`      GET    /api/notes/:id`);
  console.log(`      POST   /api/notes`);
  console.log(`      PUT    /api/notes/:id`);
  console.log(`      PATCH  /api/notes/:id/pin`);
  console.log(`      DELETE /api/notes/:id`);
  console.log(`      GET    /api/stats\n`);
});