const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');

let serviceAccount;
let useMock = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:", e.message);
    useMock = true;
  }
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    console.warn("WARNING: serviceAccountKey.json not found in root.");
    console.warn("Firestore will run in in-memory fallback mode until you place your Firebase serviceAccountKey.json key in the root directory.");
    useMock = true;
  }
}

let fdb;
if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    fdb = getFirestore();
    console.log("Successfully connected to live Firebase Cloud Firestore!");
  } catch (e) {
    console.error("Failed to initialize Firebase Admin SDK with credentials:", e.message);
    console.warn("Falling back to in-memory mode...");
    useMock = true;
  }
} else {
  useMock = true;
}

// In-Memory Fallback Database
const mockData = {
  users: [],
  businesses: [],
  services: [],
  bookings: [],
  reviews: [],
  chats: []
};

// Seeding helper for mock data
function seedMock() {
  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashCust = bcrypt.hashSync('customer123', 10);
  const hashOwner = bcrypt.hashSync('owner123', 10);

  mockData.users = [
    { id: 'u_admin', name: 'Admin User', email: 'admin@lbm.com', password: hashAdmin, role: 'admin', phone: '9000000000', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'u_cust1', name: 'Priya Sharma', email: 'customer@lbm.com', password: hashCust, role: 'customer', phone: '9876543210', createdAt: '2024-02-15T00:00:00Z' },
    { id: 'u_cust2', name: 'Rahul Verma', email: 'customer2@lbm.com', password: hashCust, role: 'customer', phone: '9876500000', createdAt: '2024-03-10T00:00:00Z' },
    { id: 'u_own1', name: 'Ram Kumar', email: 'owner@lbm.com', password: hashOwner, role: 'owner', phone: '9812345678', createdAt: '2024-01-20T00:00:00Z' },
    { id: 'u_own2', name: 'Sneha Patel', email: 'owner2@lbm.com', password: hashOwner, role: 'owner', phone: '9823456789', createdAt: '2024-02-05T00:00:00Z' }
  ];

  mockData.businesses = [];
  mockData.services = [];
  mockData.bookings = [];
  mockData.reviews = [];
  mockData.chats = [];
}

// Helper to convert Firestore snapshot to array
function toArray(snapshot) {
  const arr = [];
  snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
  return arr;
}

const db = {
  users: {
    async getAll() {
      if (useMock) return [...mockData.users];
      const snap = await fdb.collection('users').get();
      return toArray(snap);
    },
    async getById(id) {
      if (!id) return null;
      if (useMock) return mockData.users.find(u => u.id === id) || null;
      const doc = await fdb.collection('users').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async getByEmail(email) {
      if (!email) return null;
      if (useMock) return mockData.users.find(u => u.email === email) || null;
      const snap = await fdb.collection('users').where('email', '==', email).limit(1).get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    },
    async create(data) {
      if (useMock) {
        mockData.users.push(data);
        return data;
      }
      await fdb.collection('users').doc(data.id).set(data);
      return data;
    }
  },
  businesses: {
    async getAll(filters = {}) {
      if (useMock) {
        let list = [...mockData.businesses];
        if (filters.category) {
          list = list.filter(b => b.category === filters.category);
        }
        if (filters.city) {
          list = list.filter(b => b.city === filters.city);
        }
        if (filters.isVerified !== undefined) {
          list = list.filter(b => Number(b.isVerified) === Number(filters.isVerified));
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          list = list.filter(b => 
            b.name.toLowerCase().includes(q) || 
            b.description.toLowerCase().includes(q)
          );
        }
        // Sort
        if (filters.sort === 'rating') {
          list.sort((a, b) => b.rating - a.rating);
        } else if (filters.sort === 'name') {
          list.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return list;
      }
      
      let query = fdb.collection('businesses');
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      if (filters.city) {
        query = query.where('city', '==', filters.city);
      }
      if (filters.isVerified !== undefined) {
        query = query.where('isVerified', '==', Number(filters.isVerified));
      }
      const snap = await query.get();
      let list = toArray(snap);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(b => 
          b.name.toLowerCase().includes(q) || 
          b.description.toLowerCase().includes(q)
        );
      }
      // Sort
      if (filters.sort === 'rating') {
        list.sort((a, b) => b.rating - a.rating);
      } else if (filters.sort === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return list;
    },
    async getById(id) {
      if (!id) return null;
      if (useMock) return mockData.businesses.find(b => b.id === id) || null;
      const doc = await fdb.collection('businesses').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async create(data) {
      if (useMock) {
        mockData.businesses.push(data);
        return data;
      }
      await fdb.collection('businesses').doc(data.id).set(data);
      return data;
    },
    async update(id, data) {
      if (useMock) {
        const idx = mockData.businesses.findIndex(b => b.id === id);
        if (idx !== -1) {
          mockData.businesses[idx] = { ...mockData.businesses[idx], ...data };
        }
        return { id, ...data };
      }
      await fdb.collection('businesses').doc(id).update(data);
      return { id, ...data };
    },
    async delete(id) {
      if (useMock) {
        mockData.businesses = mockData.businesses.filter(b => b.id !== id);
        return { id };
      }
      await fdb.collection('businesses').doc(id).delete();
      return { id };
    }
  },
  services: {
    async getAll(businessId = null) {
      if (useMock) {
        return businessId 
          ? mockData.services.filter(s => s.businessId === businessId)
          : [...mockData.services];
      }
      let query = fdb.collection('services');
      if (businessId) {
        query = query.where('businessId', '==', businessId);
      }
      const snap = await query.get();
      return toArray(snap);
    },
    async getById(id) {
      if (!id) return null;
      if (useMock) return mockData.services.find(s => s.id === id) || null;
      const doc = await fdb.collection('services').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async create(data) {
      if (useMock) {
        mockData.services.push(data);
        return data;
      }
      await fdb.collection('services').doc(data.id).set(data);
      return data;
    },
    async update(id, data) {
      if (useMock) {
        const idx = mockData.services.findIndex(s => s.id === id);
        if (idx !== -1) {
          mockData.services[idx] = { ...mockData.services[idx], ...data };
        }
        return { id, ...data };
      }
      await fdb.collection('services').doc(id).update(data);
      return { id, ...data };
    },
    async delete(id) {
      if (useMock) {
        mockData.services = mockData.services.filter(s => s.id !== id);
        return { id };
      }
      await fdb.collection('services').doc(id).delete();
      return { id };
    }
  },
  bookings: {
    async getAll(filters = {}) {
      if (useMock) {
        let list = [...mockData.bookings];
        if (filters.userId) {
          list = list.filter(b => b.userId === filters.userId);
        }
        if (filters.businessId) {
          list = list.filter(b => b.businessId === filters.businessId);
        }
        if (filters.status) {
          list = list.filter(b => b.status === filters.status);
        }
        if (filters.ownerId) {
          const ownerBizIds = mockData.businesses.filter(b => b.ownerId === filters.ownerId).map(b => b.id);
          list = list.filter(b => ownerBizIds.includes(b.businessId));
        }
        return list;
      }

      let query = fdb.collection('bookings');
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.businessId) {
        query = query.where('businessId', '==', filters.businessId);
      }
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      const snap = await query.get();
      let list = toArray(snap);
      if (filters.ownerId) {
        const ownerBizs = await db.businesses.getAll();
        const ownerBizIds = ownerBizs.filter(b => b.ownerId === filters.ownerId).map(b => b.id);
        list = list.filter(b => ownerBizIds.includes(b.businessId));
      }
      return list;
    },
    async getById(id) {
      if (!id) return null;
      if (useMock) return mockData.bookings.find(b => b.id === id) || null;
      const doc = await fdb.collection('bookings').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async create(data) {
      if (useMock) {
        mockData.bookings.push(data);
        return data;
      }
      await fdb.collection('bookings').doc(data.id).set(data);
      return data;
    },
    async updateStatus(id, status) {
      if (useMock) {
        const idx = mockData.bookings.findIndex(b => b.id === id);
        if (idx !== -1) {
          mockData.bookings[idx].status = status;
        }
        return { id, status };
      }
      await fdb.collection('bookings').doc(id).update({ status });
      return { id, status };
    }
  },
  reviews: {
    async getAll(businessId = null) {
      if (useMock) {
        return businessId 
          ? mockData.reviews.filter(r => r.businessId === businessId)
          : [...mockData.reviews];
      }
      let query = fdb.collection('reviews');
      if (businessId) {
        query = query.where('businessId', '==', businessId);
      }
      const snap = await query.get();
      return toArray(snap);
    },
    async create(data) {
      if (useMock) {
        mockData.reviews.push(data);
        await db.businesses.recalculateRating(data.businessId);
        return data;
      }
      await fdb.collection('reviews').doc(data.id).set(data);
      await db.businesses.recalculateRating(data.businessId);
      return data;
    },
    async delete(id) {
      if (useMock) {
        const review = mockData.reviews.find(r => r.id === id);
        if (review) {
          mockData.reviews = mockData.reviews.filter(r => r.id !== id);
          await db.businesses.recalculateRating(review.businessId);
        }
        return { id };
      }
      const doc = await fdb.collection('reviews').doc(id).get();
      if (doc.exists) {
        const review = doc.data();
        await fdb.collection('reviews').doc(id).delete();
        await db.businesses.recalculateRating(review.businessId);
      }
      return { id };
    }
  },
  chats: {
    async getAll() {
      if (useMock) {
        return [...mockData.chats].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      const snap = await fdb.collection('chats').orderBy('createdAt', 'asc').get();
      return toArray(snap);
    },
    async create(data) {
      if (useMock) {
        mockData.chats.push(data);
        return data;
      }
      await fdb.collection('chats').doc(data.id).set(data);
      return data;
    }
  }
};

// Add rating recalculation helper to businesses
db.businesses.recalculateRating = async function(businessId) {
  const reviews = await db.reviews.getAll(businessId);
  const count = reviews.length;
  const rating = count > 0 
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
    : 0;
  
  if (useMock) {
    const idx = mockData.businesses.findIndex(b => b.id === businessId);
    if (idx !== -1) {
      mockData.businesses[idx].rating = rating;
      mockData.businesses[idx].reviewCount = count;
    }
    return;
  }
  await fdb.collection('businesses').doc(businessId).update({ rating, reviewCount: count });
};

// Seed function
db.seed = async function() {
  if (useMock) {
    seedMock();
    console.log('In-memory database initialized and seeded successfully.');
    return;
  }

  const usersSnap = await fdb.collection('users').limit(1).get();
  if (!usersSnap.empty) {
    console.log('Firestore collections are already populated. Skipping seeding.');
    return;
  }

  console.log('Seeding Cloud Firestore with default records...');
  
  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashCust = bcrypt.hashSync('customer123', 10);
  const hashOwner = bcrypt.hashSync('owner123', 10);

  const users = [
    { id: 'u_admin', name: 'Admin User', email: 'admin@lbm.com', password: hashAdmin, role: 'admin', phone: '9000000000', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'u_cust1', name: 'Priya Sharma', email: 'customer@lbm.com', password: hashCust, role: 'customer', phone: '9876543210', createdAt: '2024-02-15T00:00:00Z' },
    { id: 'u_cust2', name: 'Rahul Verma', email: 'customer2@lbm.com', password: hashCust, role: 'customer', phone: '9876500000', createdAt: '2024-03-10T00:00:00Z' },
    { id: 'u_own1', name: 'Ram Kumar', email: 'owner@lbm.com', password: hashOwner, role: 'owner', phone: '9812345678', createdAt: '2024-01-20T00:00:00Z' },
    { id: 'u_own2', name: 'Sneha Patel', email: 'owner2@lbm.com', password: hashOwner, role: 'owner', phone: '9823456789', createdAt: '2024-02-05T00:00:00Z' }
  ];

  const businesses = [];
  const services = [];
  const bookings = [];
  const reviews = [];
  const chats = [];

  // Load into Firestore
  for (const u of users) {
    await fdb.collection('users').doc(u.id).set(u);
  }
  for (const b of businesses) {
    await fdb.collection('businesses').doc(b.id).set(b);
  }
  for (const s of services) {
    await fdb.collection('services').doc(s.id).set(s);
  }
  for (const bk of bookings) {
    await fdb.collection('bookings').doc(bk.id).set(bk);
  }
  for (const r of reviews) {
    await fdb.collection('reviews').doc(r.id).set(r);
  }
  for (const c of chats) {
    await fdb.collection('chats').doc(c.id).set(c);
  }

  console.log('Firestore database seeding successfully finished.');
};

module.exports = db;
