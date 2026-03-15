const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bookswipe-secret-change-in-production';

// ── DB SETUP (sql.js - pure JS, no native build needed) ─────────────
const DB_PATH = '/tmp/bookswipe.db';

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      rank TEXT NOT NULL DEFAULT 'mid',
      condition INTEGER NOT NULL,
      description TEXT DEFAULT '',
      photos TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS swipes (
      id TEXT PRIMARY KEY,
      swiper_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      book1_id TEXT NOT NULL,
      book2_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDB();
}

function saveDB() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch(e) {}
}

// Wrapper helpers to match better-sqlite3 API style
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function dbAll(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ── UPLOADS ─────────────────────────────────────────────────────────
const UPLOADS_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp/uploads'
  : path.join(__dirname, '../public/uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── MIDDLEWARE ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '../public')));

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ── AUTH ROUTES ──────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password, name, city } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(400).json({ error: 'Este email ya está registrado' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuidv4();
    dbRun('INSERT INTO users (id, email, password, name, city) VALUES (?,?,?,?,?)',
      [id, email.toLowerCase(), hashed, name, city || '']);

    const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email, name, city } });
  } catch (e) {
    res.status(500).json({ error: 'Error al registrar: ' + e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Faltan campos requeridos' });

  const user = dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, city: user.city } });
});

app.get('/api/me', auth, (req, res) => {
  const user = dbGet('SELECT id, email, name, city FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// ── BOOKS ROUTES ─────────────────────────────────────────────────────
app.get('/api/books', auth, (req, res) => {
  const { genre, rank } = req.query;
  let q = `
    SELECT b.*, u.name as owner_name, u.city as owner_city
    FROM books b JOIN users u ON b.user_id = u.id
    WHERE b.user_id != ? AND b.id NOT IN (SELECT book_id FROM swipes WHERE swiper_id = ?)
  `;
  const params = [req.user.id, req.user.id];
  if (genre && genre !== 'all') { q += ' AND b.genre = ?'; params.push(genre); }
  if (rank && rank !== 'all')   { q += ' AND b.rank = ?';  params.push(rank); }
  q += ' ORDER BY b.created_at DESC';

  const books = dbAll(q, params).map(b => ({ ...b, photos: JSON.parse(b.photos || '[]') }));
  res.json(books);
});

app.get('/api/books/explore', (req, res) => {
  const { genre, rank } = req.query;
  let q = `SELECT b.*, u.name as owner_name, u.city as owner_city FROM books b JOIN users u ON b.user_id = u.id WHERE 1=1`;
  const params = [];
  if (genre && genre !== 'all') { q += ' AND b.genre = ?'; params.push(genre); }
  if (rank && rank !== 'all')   { q += ' AND b.rank = ?';  params.push(rank); }
  q += ' ORDER BY b.condition DESC, b.created_at DESC';

  const books = dbAll(q, params).map(b => ({ ...b, photos: JSON.parse(b.photos || '[]') }));
  res.json(books);
});

app.get('/api/books/mine', auth, (req, res) => {
  const books = dbAll('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC', [req.user.id])
    .map(b => ({ ...b, photos: JSON.parse(b.photos || '[]') }));
  res.json(books);
});

app.post('/api/books', auth, upload.array('photos', 4), (req, res) => {
  const { title, author, genre, rank, condition, description } = req.body;
  if (!title || !author || !genre || !condition)
    return res.status(400).json({ error: 'Faltan campos requeridos' });

  const photos = (req.files || []).map(f => `/uploads/${f.filename}`);
  const id = uuidv4();

  dbRun(`INSERT INTO books (id, user_id, title, author, genre, rank, condition, description, photos) VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, req.user.id, title, author, genre, rank || 'mid', parseInt(condition), description || '', JSON.stringify(photos)]);

  const book = dbGet('SELECT b.*, u.name as owner_name, u.city as owner_city FROM books b JOIN users u ON b.user_id = u.id WHERE b.id = ?', [id]);
  res.json({ ...book, photos: JSON.parse(book.photos) });
});

app.delete('/api/books/:id', auth, (req, res) => {
  const book = dbGet('SELECT * FROM books WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });

  JSON.parse(book.photos || '[]').forEach(p => {
    const fp = path.join(UPLOADS_DIR, path.basename(p));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  dbRun('DELETE FROM books WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ── SWIPE ROUTES ─────────────────────────────────────────────────────
app.post('/api/swipe', auth, (req, res) => {
  const { book_id, direction } = req.body;
  if (!book_id || !direction) return res.status(400).json({ error: 'Datos incompletos' });

  const existing = dbGet('SELECT id FROM swipes WHERE swiper_id = ? AND book_id = ?', [req.user.id, book_id]);
  if (!existing) {
    dbRun('INSERT INTO swipes (id, swiper_id, book_id, direction) VALUES (?,?,?,?)',
      [uuidv4(), req.user.id, book_id, direction]);
  }

  let match = null;
  if (direction === 'right') {
    const targetBook = dbGet('SELECT * FROM books WHERE id = ?', [book_id]);
    if (targetBook) {
      const theyLikedMe = dbGet(`
        SELECT s.* FROM swipes s
        JOIN books b ON s.book_id = b.id
        WHERE s.swiper_id = ? AND b.user_id = ? AND s.direction = 'right'
      `, [targetBook.user_id, req.user.id]);

      if (theyLikedMe) {
        const myBook = dbGet('SELECT * FROM books WHERE user_id = ? ORDER BY RANDOM() LIMIT 1', [req.user.id]);
        if (myBook) {
          const matchId = uuidv4();
          dbRun('INSERT INTO matches (id, user1_id, user2_id, book1_id, book2_id) VALUES (?,?,?,?,?)',
            [matchId, req.user.id, targetBook.user_id, myBook.id, book_id]);
          match = dbGet('SELECT * FROM matches WHERE id = ?', [matchId]);
        }
      }
    }
  }
  res.json({ ok: true, match });
});

app.get('/api/matches', auth, (req, res) => {
  const matches = dbAll(`
    SELECT m.*,
      b1.title as book1_title, b1.photos as book1_photos, b1.author as book1_author,
      b2.title as book2_title, b2.photos as book2_photos, b2.author as book2_author,
      u1.name as user1_name, u2.name as user2_name
    FROM matches m
    JOIN books b1 ON m.book1_id = b1.id
    JOIN books b2 ON m.book2_id = b2.id
    JOIN users u1 ON m.user1_id = u1.id
    JOIN users u2 ON m.user2_id = u2.id
    WHERE m.user1_id = ? OR m.user2_id = ?
    ORDER BY m.created_at DESC
  `, [req.user.id, req.user.id]).map(m => ({
    ...m,
    book1_photos: JSON.parse(m.book1_photos || '[]'),
    book2_photos: JSON.parse(m.book2_photos || '[]'),
  }));
  res.json(matches);
});

// ── FALLBACK ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── START ─────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`BookSwipe API running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

module.exports = app;
