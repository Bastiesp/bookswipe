const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bookswipe-secret-change-in-production';

// ── IN-MEMORY DB ─────────────────────────────────────────────────────
// Pure JS objects — no SQLite, no WASM, no native compilation needed.
// Works on Vercel serverless. Data resets on cold start (demo-ready).
const DB = { users: [], books: [], swipes: [], matches: [] };

const dbFind  = (t, f, v)  => DB[t].find(r => r[f] === v);
const dbFilter = (t, fn)   => DB[t].filter(fn);
const dbInsert = (t, row)  => { DB[t].push(row); return row; };
const dbRemove = (t, fn)   => { DB[t] = DB[t].filter(r => !fn(r)); };

// ── UPLOADS ──────────────────────────────────────────────────────────
const UPLOADS_DIR = '/tmp/uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename:    (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype))
});

// ── MIDDLEWARE ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '../public')));

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}

// ── AUTH ─────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password, name, city } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (dbFind('users', 'email', email.toLowerCase()))
    return res.status(400).json({ error: 'Este email ya está registrado' });
  try {
    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    dbInsert('users', { id, email: email.toLowerCase(), password: hashed, name, city: city||'', created_at: new Date().toISOString() });
    const token = jwt.sign({ id, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email: email.toLowerCase(), name, city: city||'' } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos requeridos' });
  const user = dbFind('users', 'email', email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, city: user.city } });
});

app.get('/api/me', auth, (req, res) => {
  const user = dbFind('users', 'id', req.user.id);
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  const { password, ...safe } = user;
  res.json(safe);
});

// ── BOOKS ────────────────────────────────────────────────────────────
function enrich(book) {
  const owner = dbFind('users', 'id', book.user_id);
  return { ...book, owner_name: owner?.name||'Usuario', owner_city: owner?.city||'' };
}

app.get('/api/books', auth, (req, res) => {
  const { genre, rank } = req.query;
  const swiped = new Set(dbFilter('swipes', s => s.swiper_id === req.user.id).map(s => s.book_id));
  let books = dbFilter('books', b => b.user_id !== req.user.id && !swiped.has(b.id));
  if (genre && genre !== 'all') books = books.filter(b => b.genre === genre);
  if (rank  && rank  !== 'all') books = books.filter(b => b.rank  === rank);
  res.json(books.sort((a,b) => b.created_at > a.created_at ? 1:-1).map(enrich));
});

app.get('/api/books/explore', (req, res) => {
  const { genre, rank } = req.query;
  let books = [...DB.books];
  if (genre && genre !== 'all') books = books.filter(b => b.genre === genre);
  if (rank  && rank  !== 'all') books = books.filter(b => b.rank  === rank);
  books.sort((a,b) => b.condition - a.condition);
  res.json(books.map(enrich));
});

app.get('/api/books/mine', auth, (req, res) => {
  res.json(dbFilter('books', b => b.user_id === req.user.id)
    .sort((a,b) => b.created_at > a.created_at ? 1:-1).map(enrich));
});

app.post('/api/books', auth, upload.array('photos', 4), (req, res) => {
  const { title, author, genre, rank, condition, description } = req.body;
  if (!title || !author || !genre || !condition)
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  const photos = (req.files||[]).map(f => `/uploads/${f.filename}`);
  const book = dbInsert('books', {
    id: uuidv4(), user_id: req.user.id,
    title, author, genre, rank: rank||'mid',
    condition: parseInt(condition),
    description: description||'',
    photos, created_at: new Date().toISOString()
  });
  res.json(enrich(book));
});

app.delete('/api/books/:id', auth, (req, res) => {
  const book = DB.books.find(b => b.id === req.params.id && b.user_id === req.user.id);
  if (!book) return res.status(404).json({ error: 'No encontrado' });
  (book.photos||[]).forEach(p => { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(p))); } catch {} });
  dbRemove('books', b => b.id === req.params.id);
  res.json({ ok: true });
});

// ── SWIPE ────────────────────────────────────────────────────────────
app.post('/api/swipe', auth, (req, res) => {
  const { book_id, direction } = req.body;
  if (!book_id || !direction) return res.status(400).json({ error: 'Datos incompletos' });

  if (!DB.swipes.find(s => s.swiper_id === req.user.id && s.book_id === book_id))
    dbInsert('swipes', { id: uuidv4(), swiper_id: req.user.id, book_id, direction, created_at: new Date().toISOString() });

  let match = null;
  if (direction === 'right') {
    const targetBook = dbFind('books', 'id', book_id);
    if (targetBook) {
      const myBookIds = new Set(dbFilter('books', b => b.user_id === req.user.id).map(b => b.id));
      const theyLikedMe = DB.swipes.find(s =>
        s.swiper_id === targetBook.user_id && myBookIds.has(s.book_id) && s.direction === 'right'
      );
      if (theyLikedMe) {
        const myBook = dbFind('books', 'id', theyLikedMe.book_id);
        if (myBook) {
          match = dbInsert('matches', {
            id: uuidv4(), user1_id: req.user.id, user2_id: targetBook.user_id,
            book1_id: myBook.id, book2_id: book_id, created_at: new Date().toISOString()
          });
        }
      }
    }
  }
  res.json({ ok: true, match });
});

// ── MATCHES ──────────────────────────────────────────────────────────
app.get('/api/matches', auth, (req, res) => {
  const list = dbFilter('matches', m => m.user1_id === req.user.id || m.user2_id === req.user.id)
    .sort((a,b) => b.created_at > a.created_at ? 1:-1)
    .map(m => {
      const b1 = dbFind('books','id',m.book1_id)||{};
      const b2 = dbFind('books','id',m.book2_id)||{};
      const u1 = dbFind('users','id',m.user1_id)||{};
      const u2 = dbFind('users','id',m.user2_id)||{};
      return { ...m,
        book1_title:b1.title, book1_photos:b1.photos||[], book1_author:b1.author,
        book2_title:b2.title, book2_photos:b2.photos||[], book2_author:b2.author,
        user1_name:u1.name, user2_name:u2.name };
    });
  res.json(list);
});

// ── FALLBACK ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => console.log(`BookSwipe running on port ${PORT}`));
module.exports = app;
