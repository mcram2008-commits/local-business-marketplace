/**
 * Local Business Marketplace - Express & Firebase Full-Stack Backend Server
 */
const express = require('express');
const cors = require('cors');
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

const db = require('./firestore-db');

// Trigger initial seeding check
db.seed().catch(err => {
  console.error("Firebase database operation failed:", err.message);
  console.warn("Please ensure you have enabled 'Firestore Database' in your Firebase console for project 'local-area-service'!");
});

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
    const existingUser = await db.users.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = 'u_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    await db.users.create({
      id: userId,
      name,
      email,
      password: hashedPassword,
      role,
      phone: phone || '',
      createdAt
    });

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
    const user = await db.users.getByEmail(email);
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
    const user = await db.users.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    delete user.password;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server profile retrieval error' });
  }
});

// GET /api/users (Retrieve user list profiles, excluding passwords)
app.get('/api/users', async (req, res) => {
  try {
    const list = await db.users.getAll();
    const sanitised = list.map(u => {
      delete u.password;
      return u;
    });
    res.json(sanitised);
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
  try {
    const list = await db.businesses.getAll({
      search,
      category,
      city,
      isVerified: verified !== undefined ? (verified === 'true') : undefined,
      ownerId
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve businesses' });
  }
});

// GET /api/businesses/:id
app.get('/api/businesses/:id', async (req, res) => {
  try {
    const biz = await db.businesses.getById(req.params.id);
    if (!biz) {
      return res.status(404).json({ error: 'Business details not found' });
    }
    res.json(biz);
  } catch (err) {
    res.status(500).json({ error: 'Database fetch error' });
  }
});

// POST /api/businesses (Protected, Owner only)
app.post('/api/businesses', authenticateToken, requireRole('owner'), async (req, res) => {
  const { name, category, address, city, state, phone, email, description, openTime, closeTime, latitude, longitude, logo } = req.body;

  if (!name || !category || !address || !city || !state || !phone || !email || !description) {
    return res.status(400).json({ error: 'Required business fields missing' });
  }

  try {
    const bizId = 'b_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    const created = await db.businesses.create({
      id: bizId,
      ownerId: req.user.id,
      name,
      category,
      address,
      city,
      state,
      phone,
      email,
      description,
      openTime: openTime || '09:00',
      closeTime: closeTime || '18:00',
      logo: logo || '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      isVerified: 0,
      rating: 0.0,
      reviewCount: 0,
      createdAt
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create business listing' });
  }
});

// PUT /api/businesses/:id (Protected, Owner / Admin update)
app.put('/api/businesses/:id', authenticateToken, async (req, res) => {
  try {
    const biz = await db.businesses.getById(req.params.id);
    if (!biz) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Auth Check: must be owner or admin
    if (req.user.role !== 'admin' && biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden update access' });
    }

    const { name, category, address, city, state, phone, email, description, openTime, closeTime, isVerified, latitude, longitude, logo } = req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (category !== undefined) dataToUpdate.category = category;
    if (address !== undefined) dataToUpdate.address = address;
    if (city !== undefined) dataToUpdate.city = city;
    if (state !== undefined) dataToUpdate.state = state;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (email !== undefined) dataToUpdate.email = email;
    if (description !== undefined) dataToUpdate.description = description;
    if (openTime !== undefined) dataToUpdate.openTime = openTime;
    if (closeTime !== undefined) dataToUpdate.closeTime = closeTime;
    if (isVerified !== undefined) dataToUpdate.isVerified = isVerified ? 1 : 0;
    if (latitude !== undefined) dataToUpdate.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) dataToUpdate.longitude = longitude ? parseFloat(longitude) : null;
    if (logo !== undefined) dataToUpdate.logo = logo;

    const updated = await db.businesses.update(req.params.id, dataToUpdate);
    res.json({ ...biz, ...updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update business details' });
  }
});

// DELETE /api/businesses/:id (Protected, Owner / Admin)
app.delete('/api/businesses/:id', authenticateToken, async (req, res) => {
  try {
    const biz = await db.businesses.getById(req.params.id);
    if (!biz) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (req.user.role !== 'admin' && biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this business' });
    }

    await db.businesses.delete(req.params.id);
    res.json({ success: true, message: 'Business successfully deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database delete error' });
  }
});

/* ─── SERVICES API ENDPOINTS ─────────────────────────────────────── */

// GET /api/services (Filter by businessId)
app.get('/api/services', async (req, res) => {
  const { businessId } = req.query;
  try {
    const list = await db.services.getAll(businessId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/:id
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await db.services.getById(req.params.id);
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
    const biz = await db.businesses.getById(businessId);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this business profile' });
    }

    const svcId = 's_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    const created = await db.services.create({
      id: svcId,
      businessId,
      name,
      description: description || '',
      price: Number(price),
      duration,
      image: '',
      createdAt
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create service option' });
  }
});

// PUT /api/services/:id (Protected, Owner only)
app.put('/api/services/:id', authenticateToken, requireRole('owner'), async (req, res) => {
  try {
    const service = await db.services.getById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const biz = await db.businesses.getById(service.businessId);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this service' });
    }

    const { name, description, price, duration } = req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (price !== undefined) dataToUpdate.price = Number(price);
    if (duration !== undefined) dataToUpdate.duration = duration;

    const updated = await db.services.update(req.params.id, dataToUpdate);
    res.json({ ...service, ...updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update service details' });
  }
});

// DELETE /api/services/:id (Protected, Owner only)
app.delete('/api/services/:id', authenticateToken, requireRole('owner'), async (req, res) => {
  try {
    const service = await db.services.getById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service option not found' });
    }

    const biz = await db.businesses.getById(service.businessId);
    if (!biz || biz.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    await db.services.delete(req.params.id);
    res.json({ success: true, message: 'Service option successfully deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database delete error' });
  }
});

/* ─── BOOKINGS API ENDPOINTS ─────────────────────────────────────── */

// GET /api/bookings (Protected, returns bookings relevant to user role)
app.get('/api/bookings', authenticateToken, async (req, res) => {
  const { businessId, status } = req.query;
  try {
    const filters = {};
    if (req.user.role === 'owner') {
      filters.ownerId = req.user.id;
    } else if (req.user.role === 'customer') {
      filters.userId = req.user.id;
    }
    if (businessId) filters.businessId = businessId;
    if (status) filters.status = status;

    const list = await db.bookings.getAll(filters);
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

    const created = await db.bookings.create({
      id: bookingId,
      userId: req.user.id,
      businessId,
      serviceId,
      bookingDate,
      time,
      status: 'pending',
      totalAmount: Number(totalAmount),
      createdAt
    });

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
    const booking = await db.bookings.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking appointment not found' });
    }

    const biz = await db.businesses.getById(booking.businessId);
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

    const updated = await db.bookings.updateStatus(req.params.id, status);
    res.json({ ...booking, ...updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

/* ─── REVIEWS API ENDPOINTS ──────────────────────────────────────── */

// GET /api/reviews (Optional filter by businessId)
app.get('/api/reviews', async (req, res) => {
  const { businessId } = req.query;
  try {
    const list = await db.reviews.getAll(businessId);
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
    const reviews = await db.reviews.getAll(businessId);
    const existing = reviews.find(r => r.userId === req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this business' });
    }

    const reviewId = 'r_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date().toISOString();

    const created = await db.reviews.create({
      id: reviewId,
      userId: req.user.id,
      businessId,
      rating: Number(rating),
      comment,
      createdAt
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// DELETE /api/reviews/:id (Protected, Admin only)
app.delete('/api/reviews/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.reviews.delete(req.params.id);
    res.json({ success: true, message: 'Review successfully moderated and removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

/* ─── CHAT API ENDPOINTS ─────────────────────────────────────────── */

// GET /api/chats (Protected, returns chats history between two users)
app.get('/api/chats', authenticateToken, async (req, res) => {
  const { businessId, userId } = req.query;

  if (!businessId) {
    return res.status(400).json({ error: 'businessId required' });
  }

  try {
    const biz = await db.businesses.getById(businessId);
    if (!biz) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    const otherPartyId = userId || biz.ownerId;

    const chatsList = await db.chats.getAll();
    const filtered = chatsList.filter(c => 
      c.businessId === businessId &&
      ((c.senderId === req.user.id && c.receiverId === otherPartyId) ||
       (c.senderId === otherPartyId && c.receiverId === req.user.id))
    );

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// GET /api/chats/all (Protected, helper for loading inbox threads list)
app.get('/api/chats/all', authenticateToken, async (req, res) => {
  try {
    const list = await db.chats.getAll();
    if (req.user.role === 'admin') {
      res.json(list);
    } else {
      const filtered = list.filter(c => c.senderId === req.user.id || c.receiverId === req.user.id);
      res.json(filtered);
    }
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

    const created = await db.chats.create({
      id: chatId,
      senderId: req.user.id,
      receiverId,
      businessId,
      message,
      time,
      createdAt: time
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/* ─── PLATFORM SYSTEM STATS (Admin Only) ─────────────────────────── */

// GET /api/stats (Protected, Admin only)
app.get('/api/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.users.getAll();
    const businesses = await db.businesses.getAll();
    const bookings = await db.bookings.getAll();

    const nonAdminUsersCount = users.filter(u => u.role !== 'admin').length;
    const pendingBusinessesCount = businesses.filter(b => Number(b.isVerified) === 0).length;
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const totalRevenue = completedBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    res.json({
      totalUsers: nonAdminUsersCount,
      totalBusinesses: businesses.length,
      totalBookings: bookings.length,
      totalRevenue,
      pendingVerification: pendingBusinessesCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load system metrics' });
  }
});

/* ─── START SERVER ───────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
