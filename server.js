/**
 * Local Business Marketplace - Express & SQLite Full-Stack Backend Server
 */
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'local_biz_marketplace_super_secret_jwt_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure upload directory exists and mount static serving
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Database Connection
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Helper DB Promise wrappers
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

// Initialize Tables & Seed Data
async function initializeDatabase() {
  try {
    // 1. Users Table
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      createdAt TEXT NOT NULL
    )`);

    // 2. Businesses Table
    await dbRun(`CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      description TEXT NOT NULL,
      openTime TEXT NOT NULL,
      closeTime TEXT NOT NULL,
      logo TEXT,
      isVerified INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      reviewCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(ownerId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 3. Services Table
    await dbRun(`CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      businessId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      duration TEXT NOT NULL,
      image TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(businessId) REFERENCES businesses(id) ON DELETE CASCADE
    )`);

    // 4. Bookings Table
    await dbRun(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      businessId TEXT NOT NULL,
      serviceId TEXT NOT NULL,
      bookingDate TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      totalAmount REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(businessId) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE
    )`);

    // 5. Reviews Table
    await dbRun(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      businessId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(businessId) REFERENCES businesses(id) ON DELETE CASCADE
    )`);

    // 6. Chats Table
    await dbRun(`CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      businessId TEXT NOT NULL,
      message TEXT NOT NULL,
      time TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(senderId) REFERENCES users(id),
      FOREIGN KEY(receiverId) REFERENCES users(id),
      FOREIGN KEY(businessId) REFERENCES businesses(id) ON DELETE CASCADE
    )`);

    // Seed data if users table is empty
    const usersCount = await dbGet(`SELECT count(*) as count FROM users`);
    if (usersCount.count === 0) {
      console.log('Seeding SQLite Database with initial marketplace records...');
      await seedDatabase();
    }

  } catch (error) {
    console.error('Database initialization failed:', error.message);
  }
}

async function seedDatabase() {
  try {
    // 1. Hash Seed Passwords
    const hashAdmin = bcrypt.hashSync('admin123', 10);
    const hashCust = bcrypt.hashSync('customer123', 10);
    const hashOwner = bcrypt.hashSync('owner123', 10);

    const users = [
      ['u_admin', 'Admin User', 'admin@lbm.com', hashAdmin, 'admin', '9000000000', '2024-01-01T00:00:00Z'],
      ['u_cust1', 'Priya Sharma', 'customer@lbm.com', hashCust, 'customer', '9876543210', '2024-02-15T00:00:00Z'],
      ['u_cust2', 'Rahul Verma', 'customer2@lbm.com', hashCust, 'customer', '9876500000', '2024-03-10T00:00:00Z'],
      ['u_own1', 'Ram Kumar', 'owner@lbm.com', hashOwner, 'owner', '9812345678', '2024-01-20T00:00:00Z'],
      ['u_own2', 'Sneha Patel', 'owner2@lbm.com', hashOwner, 'owner', '9823456789', '2024-02-05T00:00:00Z']
    ];

    const businesses = [
      ['b001', 'u_own1', 'Ram Fitness Gym', 'Fitness', '12 Anna Salai, Chennai', 'Chennai', 'Tamil Nadu', '9812345678', 'owner@lbm.com', 'Best gym in town with modern equipment and certified trainers. We offer personal training, group classes, and nutrition counseling.', '06:00', '22:00', '', 1, 4.7, 48, '2024-01-20T00:00:00Z'],
      ['b002', 'u_own2', 'Glow Beauty Spa', 'Beauty & Spa', '45 Linking Road, Bandra', 'Mumbai', 'Maharashtra', '9823456789', 'owner2@lbm.com', 'Premium beauty salon and spa offering facials, hair treatments, massages, and bridal packages. Relax and rejuvenate in our luxury setting.', '09:00', '20:00', '', 1, 4.5, 32, '2024-02-05T00:00:00Z'],
      ['b003', 'u_own1', 'QuickFix Home Services', 'Home Services', '7 Connaught Place', 'Delhi', 'Delhi NCR', '9845678901', 'owner@lbm.com', 'Professional home repair and maintenance services. Plumbing, electrical, carpentry, painting, and more. Quick response, quality work guaranteed.', '08:00', '19:00', '', 0, 4.2, 21, '2024-03-01T00:00:00Z']
    ];

    const services = [
      ['s001', 'b001', 'Personal Training', '1-on-1 training session with certified trainer tailored to your fitness goals.', 2000, '1 hour', '', '2024-01-21T00:00:00Z'],
      ['s002', 'b001', 'Monthly Membership', 'Unlimited gym access for a full month. All equipment included.', 1500, 'Monthly', '', '2024-01-21T00:00:00Z'],
      ['s003', 'b001', 'Diet Consultation', 'Personalized diet plan from our certified nutritionist.', 800, '45 min', '', '2024-01-22T00:00:00Z'],
      ['s004', 'b002', 'Full Body Massage', 'Relaxing full body Swedish massage to relieve stress and tension.', 1800, '1 hour', '', '2024-02-06T00:00:00Z'],
      ['s005', 'b002', 'Bridal Package', 'Complete bridal beauty package including makeup, hair, and skincare.', 12000, 'Half day', '', '2024-02-06T00:00:00Z'],
      ['s006', 'b002', 'Facial Treatment', 'Deep cleansing facial with premium organic products.', 1200, '1 hour', '', '2024-02-07T00:00:00Z'],
      ['s007', 'b003', 'Plumbing Repair', 'Fix leaks, blocked drains, pipe repairs and installation.', 500, '1-2 hours', '', '2024-03-02T00:00:00Z'],
      ['s008', 'b003', 'Electrical Work', 'Wiring, switches, fan installation, and all electrical repairs.', 700, '1-3 hours', '', '2024-03-02T00:00:00Z']
    ];

    const bookings = [
      ['bk001', 'u_cust1', 'b001', 's001', '2026-07-01', '10:00 AM', 'confirmed', 2000, '2024-06-25T00:00:00Z'],
      ['bk002', 'u_cust1', 'b001', 's002', '2026-07-01', '06:00 AM', 'pending', 1500, '2024-06-26T00:00:00Z'],
      ['bk003', 'u_cust2', 'b002', 's004', '2026-06-20', '02:00 PM', 'completed', 1800, '2024-06-15T00:00:00Z'],
      ['bk004', 'u_cust1', 'b002', 's006', '2026-06-15', '11:00 AM', 'completed', 1200, '2024-06-10T00:00:00Z'],
      ['bk005', 'u_cust2', 'b003', 's007', '2026-07-05', '09:00 AM', 'pending', 500, '2024-06-28T00:00:00Z']
    ];

    const reviews = [
      ['r001', 'u_cust1', 'b001', 5, 'Amazing gym! The trainers are very professional and the equipment is top-notch. Highly recommend!', '2024-06-20T00:00:00Z'],
      ['r002', 'u_cust2', 'b002', 4, 'Lovely spa experience. Very relaxing and professional staff. Will definitely come back!', '2024-06-21T00:00:00Z'],
      ['r003', 'u_cust1', 'b002', 5, 'Best facial I have ever had. My skin feels amazing!', '2024-06-17T00:00:00Z']
    ];

    const chats = [
      ['c001', 'u_cust1', 'u_own1', 'b001', 'Hi, I want to know about personal training sessions.', '2024-06-25T10:30:00Z', '2024-06-25T10:30:00Z'],
      ['c002', 'u_own1', 'u_cust1', 'b001', 'Sure! Please let me know your fitness goals and preferred time slots.', '2024-06-25T10:32:00Z', '2024-06-25T10:32:00Z'],
      ['c003', 'u_cust1', 'u_own1', 'b001', 'I want to lose weight and build muscle. Morning slots preferred.', '2024-06-25T10:35:00Z', '2024-06-25T10:35:00Z'],
      ['c004', 'u_own1', 'u_cust1', 'b001', 'Great! We have 6 AM and 7 AM slots available. Book online or visit us directly.', '2024-06-25T10:37:00Z', '2024-06-25T10:37:00Z']
    ];

    // Bulk Seed inserts
    for (const u of users) {
      await dbRun(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)`, u);
    }
    for (const b of businesses) {
      await dbRun(`INSERT INTO businesses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, b);
    }
    for (const s of services) {
      await dbRun(`INSERT INTO services VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, s);
    }
    for (const bk of bookings) {
      await dbRun(`INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, bk);
    }
    for (const r of reviews) {
      await dbRun(`INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?)`, r);
    }
    for (const c of chats) {
      await dbRun(`INSERT INTO chats VALUES (?, ?, ?, ?, ?, ?, ?)`, c);
    }

    console.log('Database seeding successfully finished.');
  } catch (err) {
    console.error('Error seeding data:', err.message);
  }
}

/* ─── AUTHENTICATION MIDDLEWARE ──────────────────────────────────── */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    req.user = decoded;
    next();
  });
}

// Optional Auth role restrictions middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    const authorizedRoles = Array.isArray(roles) ? roles : [roles];
    if (!req.user || !authorizedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden: unauthorized role' });
    }
    next();
  };
};

/* ─── AUTH API ENDPOINTS ─────────────────────────────────────────── */

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await dbGet(`SELECT * FROM users WHERE email = ?`, [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = 'u_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await dbRun(`INSERT INTO users (id, name, email, password, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, email, hashedPassword, role, phone, createdAt]);

    // Return created details without password
    res.status(201).json({
      id: userId,
      name,
      email,
      role,
      phone
    });
  } catch (err) {
    res.status(500).json({ error: 'Server registration error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await dbGet(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid email or password credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server login error' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(`SELECT id, name, email, role, phone, createdAt FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server profile retrieval error' });
  }
});

// GET /api/users (Retrieve user list profiles, excluding passwords)
app.get('/api/users', async (req, res) => {
  try {
    const list = await dbAll(`SELECT id, name, email, role, phone, createdAt FROM users`);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profiles list' });
  }
});

// Multer storage configuration for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// POST /api/upload (Protected, returns relative path of uploaded file)
app.post('/api/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});


/* ─── BUSINESS API ENDPOINTS ─────────────────────────────────────── */

// GET /api/businesses (With search & filter queries)
app.get('/api/businesses', async (req, res) => {
  const { search, category, city, verified, ownerId } = req.query;
  let sql = `SELECT * FROM businesses WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ` AND (name LIKE ? OR description LIKE ? OR category LIKE ? OR city LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }
  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  if (city) {
    sql += ` AND city = ?`;
    params.push(city);
  }
  if (verified !== undefined) {
    sql += ` AND isVerified = ?`;
    params.push(verified === 'true' ? 1 : 0);
  }
  if (ownerId) {
    sql += ` AND ownerId = ?`;
    params.push(ownerId);
  }

  try {
    const list = await dbAll(sql, params);
    // Convert isVerified back to boolean
    const result = list.map(b => ({ ...b, isVerified: !!b.isVerified }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve businesses' });
  }
});

// GET /api/businesses/:id
app.get('/api/businesses/:id', async (req, res) => {
  try {
    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [req.params.id]);
    if (!biz) {
      return res.status(404).json({ error: 'Business details not found' });
    }
    res.json({ ...biz, isVerified: !!biz.isVerified });
  } catch (err) {
    res.status(500).json({ error: 'Database fetch error' });
  }
});

// POST /api/businesses (Protected, Owner only)
app.post('/api/businesses', authenticateToken, requireRole('owner'), async (req, res) => {
  const { name, category, address, city, state, phone, email, description, openTime, closeTime } = req.body;

  if (!name || !category || !address || !city || !state || !phone || !email || !description) {
    return res.status(400).json({ error: 'Required business fields missing' });
  }

  try {
    const bizId = 'b_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await dbRun(`INSERT INTO businesses (id, ownerId, name, category, address, city, state, phone, email, description, openTime, closeTime, logo, isVerified, rating, reviewCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bizId, req.user.id, name, category, address, city, state, phone, email, description, openTime || '09:00', closeTime || '18:00', '', 0, 0.0, 0, createdAt]);

    const created = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [bizId]);
    res.status(201).json({ ...created, isVerified: !!created.isVerified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create business listing' });
  }
});

// PUT /api/businesses/:id (Protected, Owner / Admin update)
app.put('/api/businesses/:id', authenticateToken, async (req, res) => {
  try {
    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [req.params.id]);
    if (!biz) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Auth Check: must be owner or admin
    if (req.user.role !== 'admin' && biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden update access' });
    }

    const { name, category, address, city, state, phone, email, description, openTime, closeTime, isVerified } = req.body;

    const sql = `UPDATE businesses SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      description = COALESCE(?, description),
      openTime = COALESCE(?, openTime),
      closeTime = COALESCE(?, closeTime),
      isVerified = COALESCE(?, isVerified)
      WHERE id = ?`;

    const isVerifiedInt = isVerified !== undefined ? (isVerified ? 1 : 0) : null;

    await dbRun(sql, [name, category, address, city, state, phone, email, description, openTime, closeTime, isVerifiedInt, req.params.id]);

    const updated = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [req.params.id]);
    res.json({ ...updated, isVerified: !!updated.isVerified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update business details' });
  }
});

// DELETE /api/businesses/:id (Protected, Owner / Admin)
app.delete('/api/businesses/:id', authenticateToken, async (req, res) => {
  try {
    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [req.params.id]);
    if (!biz) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (req.user.role !== 'admin' && biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this business' });
    }

    await dbRun(`DELETE FROM businesses WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Business successfully deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database delete error' });
  }
});

/* ─── SERVICES API ENDPOINTS ─────────────────────────────────────── */

// GET /api/services (Filter by businessId)
app.get('/api/services', async (req, res) => {
  const { businessId } = req.query;
  let sql = `SELECT * FROM services`;
  const params = [];

  if (businessId) {
    sql += ` WHERE businessId = ?`;
    params.push(businessId);
  }

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/:id
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await dbGet(`SELECT * FROM services WHERE id = ?`, [req.params.id]);
    if (!service) {
      return res.status(404).json({ error: 'Service option not found' });
    }
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get service' });
  }
});

// POST /api/services (Protected, Owner only)
app.post('/api/services', authenticateToken, requireRole('owner'), async (req, res) => {
  const { businessId, name, description, price, duration } = req.body;

  if (!businessId || !name || !price || !duration) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    // Check if business belongs to owner
    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [businessId]);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this business profile' });
    }

    const svcId = 's_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await dbRun(`INSERT INTO services (id, businessId, name, description, price, duration, image, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [svcId, businessId, name, description || '', price, duration, '', createdAt]);

    const created = await dbGet(`SELECT * FROM services WHERE id = ?`, [svcId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create service option' });
  }
});

// PUT /api/services/:id (Protected, Owner only)
app.put('/api/services/:id', authenticateToken, requireRole('owner'), async (req, res) => {
  try {
    const service = await dbGet(`SELECT * FROM services WHERE id = ?`, [req.params.id]);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [service.businessId]);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this service' });
    }

    const { name, description, price, duration } = req.body;

    await dbRun(`UPDATE services SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      duration = COALESCE(?, duration)
      WHERE id = ?`, [name, description, price, duration, req.params.id]);

    const updated = await dbGet(`SELECT * FROM services WHERE id = ?`, [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update service details' });
  }
});

// DELETE /api/services/:id (Protected, Owner only)
app.delete('/api/services/:id', authenticateToken, requireRole('owner'), async (req, res) => {
  try {
    const service = await dbGet(`SELECT * FROM services WHERE id = ?`, [req.params.id]);
    if (!service) {
      return res.status(404).json({ error: 'Service option not found' });
    }

    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [service.businessId]);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    await dbRun(`DELETE FROM services WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Service option successfully deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database delete error' });
  }
});

/* ─── BOOKINGS API ENDPOINTS ─────────────────────────────────────── */

// GET /api/bookings (Protected, returns bookings relevant to user role)
app.get('/api/bookings', authenticateToken, async (req, res) => {
  const { businessId, status } = req.query;
  let sql = '';
  const params = [];

  if (req.user.role === 'admin') {
    sql = `SELECT * FROM bookings WHERE 1=1`;
  } else if (req.user.role === 'owner') {
    sql = `SELECT bks.* FROM bookings bks
           JOIN businesses biz ON bks.businessId = biz.id
           WHERE biz.ownerId = ?`;
    params.push(req.user.id);
  } else {
    // customer
    sql = `SELECT * FROM bookings WHERE userId = ?`;
    params.push(req.user.id);
  }

  if (businessId) {
    sql += ` AND businessId = ?`;
    params.push(businessId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings list' });
  }
});

// POST /api/bookings (Protected, Customer only)
app.post('/api/bookings', authenticateToken, requireRole('customer'), async (req, res) => {
  const { businessId, serviceId, bookingDate, time, totalAmount } = req.body;

  if (!businessId || !serviceId || !bookingDate || !time || !totalAmount) {
    return res.status(400).json({ error: 'Missing appointment details' });
  }

  try {
    const bookingId = 'bk_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await dbRun(`INSERT INTO bookings (id, userId, businessId, serviceId, bookingDate, time, status, totalAmount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [bookingId, req.user.id, businessId, serviceId, bookingDate, time, totalAmount, createdAt]);

    const created = await dbGet(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit appointment booking' });
  }
});

// PUT /api/bookings/:id (Protected, Confirm/Cancel update status)
app.put('/api/bookings/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status update parameter missing' });
  }

  try {
    const booking = await dbGet(`SELECT * FROM bookings WHERE id = ?`, [req.params.id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking appointment not found' });
    }

    const biz = await dbGet(`SELECT * FROM businesses WHERE id = ?`, [booking.businessId]);
    const isOwner = biz && biz.ownerId === req.user.id;
    const isCustomer = booking.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Authorization checks
    if (!isAdmin && !isOwner && !isCustomer) {
      return res.status(403).json({ error: 'Unauthorized to update this booking' });
    }

    // Customers can only cancel
    if (isCustomer && !isOwner && !isAdmin && status !== 'cancelled') {
      return res.status(403).json({ error: 'Customers can only cancel appointments' });
    }

    await dbRun(`UPDATE bookings SET status = ? WHERE id = ?`, [status, req.params.id]);
    const updated = await dbGet(`SELECT * FROM bookings WHERE id = ?`, [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

/* ─── REVIEWS API ENDPOINTS ──────────────────────────────────────── */

// GET /api/reviews (Optional filter by businessId)
app.get('/api/reviews', async (req, res) => {
  const { businessId } = req.query;
  let sql = `SELECT * FROM reviews`;
  const params = [];

  if (businessId) {
    sql += ` WHERE businessId = ?`;
    params.push(businessId);
  }

  try {
    const list = await dbAll(sql, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews (Protected, Customer only)
app.post('/api/reviews', authenticateToken, requireRole('customer'), async (req, res) => {
  const { businessId, rating, comment } = req.body;

  if (!businessId || !rating || !comment) {
    return res.status(400).json({ error: 'Missing review feedback parameters' });
  }

  try {
    // Check if user already reviewed
    const existing = await dbGet(`SELECT * FROM reviews WHERE userId = ? AND businessId = ?`, [req.user.id, businessId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this business' });
    }

    const reviewId = 'r_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await dbRun(`INSERT INTO reviews (id, userId, businessId, rating, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [reviewId, req.user.id, businessId, rating, comment, createdAt]);

    // Recalculate Business Average Rating
    await updateBusinessRatingScore(businessId);

    const created = await dbGet(`SELECT * FROM reviews WHERE id = ?`, [reviewId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// DELETE /api/reviews/:id (Protected, Admin only)
app.delete('/api/reviews/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const review = await dbGet(`SELECT * FROM reviews WHERE id = ?`, [req.params.id]);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await dbRun(`DELETE FROM reviews WHERE id = ?`, [req.params.id]);

    // Recalculate Business Rating
    await updateBusinessRatingScore(review.businessId);

    res.json({ success: true, message: 'Review successfully moderated and removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Helper: Recalculate Business rating
async function updateBusinessRatingScore(businessId) {
  const list = await dbAll(`SELECT rating FROM reviews WHERE businessId = ?`, [businessId]);
  const count = list.length;
  const avg = count > 0 ? list.reduce((s, r) => s + r.rating, 0) / count : 0.0;
  const ratingRounded = Math.round(avg * 10) / 10;

  await dbRun(`UPDATE businesses SET rating = ?, reviewCount = ? WHERE id = ?`, [ratingRounded, count, businessId]);
}

/* ─── CHAT API ENDPOINTS ─────────────────────────────────────────── */

// GET /api/chats (Protected, returns chats history between two users)
app.get('/api/chats', authenticateToken, async (req, res) => {
  const { businessId, userId } = req.query;

  if (!businessId) {
    return res.status(400).json({ error: 'businessId required' });
  }

  // Determine interlocutors: req.user.id and (userId || business.ownerId)
  try {
    const biz = await dbGet(`SELECT ownerId FROM businesses WHERE id = ?`, [businessId]);
    if (!biz) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    const otherPartyId = userId || biz.ownerId;

    // Retrieve chats between req.user.id and otherPartyId for this business
    const chatsList = await dbAll(`
      SELECT * FROM chats 
      WHERE businessId = ? 
      AND (
        (senderId = ? AND receiverId = ?) 
        OR (senderId = ? AND receiverId = ?)
      )
      ORDER BY createdAt ASC
    `, [businessId, req.user.id, otherPartyId, otherPartyId, req.user.id]);

    res.json(chatsList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// GET /api/chats/all (Protected, helper for loading inbox threads list)
app.get('/api/chats/all', authenticateToken, async (req, res) => {
  try {
    // If admin, return all chats. Else, return chats involving req.user.id (either sender or receiver)
    let list;
    if (req.user.role === 'admin') {
      list = await dbAll(`SELECT * FROM chats ORDER BY createdAt ASC`);
    } else {
      list = await dbAll(`
        SELECT * FROM chats 
        WHERE senderId = ? OR receiverId = ?
        ORDER BY createdAt ASC
      `, [req.user.id, req.user.id]);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve message threads' });
  }
});

// POST /api/chats (Protected, send a message)
app.post('/api/chats', authenticateToken, async (req, res) => {
  const { receiverId, businessId, message } = req.body;

  if (!receiverId || !businessId || !message) {
    return res.status(400).json({ error: 'Message components missing' });
  }

  try {
    const chatId = 'c_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const time = new Date().toISOString();

    await dbRun(`INSERT INTO chats (id, senderId, receiverId, businessId, message, time, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chatId, req.user.id, receiverId, businessId, message, time, time]);

    const created = await dbGet(`SELECT * FROM chats WHERE id = ?`, [chatId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/* ─── PLATFORM SYSTEM STATS (Admin Only) ─────────────────────────── */

// GET /api/stats (Protected, Admin only)
app.get('/api/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await dbGet(`SELECT count(*) as count FROM users WHERE role != 'admin'`);
    const businesses = await dbGet(`SELECT count(*) as count FROM businesses`);
    const bookings = await dbGet(`SELECT count(*) as count FROM bookings`);
    const pending = await dbGet(`SELECT count(*) as count FROM businesses WHERE isVerified = 0`);
    
    // Revenue calculations
    const revRow = await dbGet(`SELECT sum(totalAmount) as total FROM bookings WHERE status = 'completed'`);
    const totalRevenue = revRow.total || 0;

    res.json({
      totalUsers: users.count,
      totalBusinesses: businesses.count,
      totalBookings: bookings.count,
      totalRevenue,
      pendingVerification: pending.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load system metrics' });
  }
});

/* ─── START SERVER ───────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
