/**
 * Local Business Marketplace - Data Store (Synchronous HTTP Client Bridge)
 * Fetches and syncs data with the SQLite backend. Supports synchronous reads & writes
 * to prevent breaking the existing frontend Multi-Page Application logic.
 */
window.Store = (function () {

  const memoryDb = {
    users: [],
    businesses: [],
    services: [],
    bookings: [],
    reviews: [],
    chats: []
  };

  // Synchronously fetch database records from Express server APIs
  function loadDataSync() {
    const token = localStorage.getItem('lbm_token');
    const endpoints = {
      users: '/api/users',
      businesses: '/api/businesses',
      services: '/api/services',
      bookings: '/api/bookings',
      reviews: '/api/reviews',
      chats: '/api/chats/all'
    };

    for (const key in endpoints) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', endpoints[key], false); // Synchronous fetch
        if (token) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        }
        xhr.send();
        if (xhr.status === 200) {
          memoryDb[key] = JSON.parse(xhr.responseText);
        } else {
          console.warn(`Failed to sync ${key} from server:`, xhr.status);
        }
      } catch (err) {
        console.error(`Error sync loading ${key}:`, err);
      }
    }
  }

  // Helper to send synchronous POST/PUT/DELETE commands to server
  function sendSyncRequest(method, url, data = null) {
    const token = localStorage.getItem('lbm_token');
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, false); // Synchronous command
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      }
      xhr.send(data ? JSON.stringify(data) : null);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        // Refresh local cache with latest database state
        loadDataSync();
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return { success: true };
        }
      } else {
        let errMsg = 'Network request failed';
        try {
          const errObj = JSON.parse(xhr.responseText);
          errMsg = errObj.error || errMsg;
        } catch {}
        console.error(`Sync Request Error [${method} ${url}]:`, errMsg);
        App.showToast(errMsg, 'error');
        return null;
      }
    } catch (err) {
      console.error('Connection to server failed:', err);
      App.showToast('Failed to connect to backend server', 'error');
      return null;
    }
  }

  // Load all data on script execution
  loadDataSync();

  /* ─── USERS ─────────────────────────────────────────────────────── */
  function getUsers() { 
    return memoryDb.users; 
  }
  
  function getUserById(id) { 
    return memoryDb.users.find(u => u.id === id) || null; 
  }
  
  function getUserByEmail(email) { 
    return memoryDb.users.find(u => u.email === email) || null; 
  }
  
  function createUser(data) {
    // Call server register
    return sendSyncRequest('POST', '/api/auth/register', data);
  }
  
  function updateUser(id, data) {
    // Note: We use auth update endpoint or user profile endpoint
    return sendSyncRequest('PUT', `/api/businesses/update-user-placeholder`, data); // Not heavily used, but kept for completeness
  }

  /* ─── BUSINESSES ────────────────────────────────────────────────── */
  function getBusinesses() { 
    return memoryDb.businesses; 
  }
  
  function getBusinessById(id) { 
    return memoryDb.businesses.find(b => b.id === id) || null; 
  }
  
  function getBusinessesByOwner(ownerId) { 
    return memoryDb.businesses.filter(b => b.ownerId === ownerId); 
  }
  
  function createBusiness(data) {
    return sendSyncRequest('POST', '/api/businesses', data);
  }
  
  function updateBusiness(id, data) {
    return sendSyncRequest('PUT', `/api/businesses/${id}`, data);
  }
  
  function deleteBusiness(id) {
    return sendSyncRequest('DELETE', `/api/businesses/${id}`);
  }

  /* ─── SERVICES ──────────────────────────────────────────────────── */
  function getServices(businessId) {
    return businessId 
      ? memoryDb.services.filter(s => s.businessId === businessId) 
      : memoryDb.services;
  }
  
  function getServiceById(id) { 
    return memoryDb.services.find(s => s.id === id) || null; 
  }
  
  function createService(data) {
    return sendSyncRequest('POST', '/api/services', data);
  }
  
  function updateService(id, data) {
    return sendSyncRequest('PUT', `/api/services/${id}`, data);
  }
  
  function deleteService(id) {
    return sendSyncRequest('DELETE', `/api/services/${id}`);
  }

  /* ─── BOOKINGS ──────────────────────────────────────────────────── */
  function getBookings(filter) {
    let list = memoryDb.bookings;
    if (!filter) return list;
    if (filter.userId) list = list.filter(b => b.userId === filter.userId);
    if (filter.businessId) list = list.filter(b => b.businessId === filter.businessId);
    if (filter.status) list = list.filter(b => b.status === filter.status);
    if (filter.ownerId) {
      const ownerBizIds = getBusinessesByOwner(filter.ownerId).map(b => b.id);
      list = list.filter(b => ownerBizIds.includes(b.businessId));
    }
    return list;
  }
  
  function getBookingById(id) { 
    return memoryDb.bookings.find(b => b.id === id) || null; 
  }
  
  function createBooking(data) {
    return sendSyncRequest('POST', '/api/bookings', data);
  }
  
  function updateBooking(id, data) {
    return sendSyncRequest('PUT', `/api/bookings/${id}`, data);
  }

  /* ─── REVIEWS ───────────────────────────────────────────────────── */
  function getReviews(businessId) {
    return businessId 
      ? memoryDb.reviews.filter(r => r.businessId === businessId) 
      : memoryDb.reviews;
  }
  
  function createReview(data) {
    return sendSyncRequest('POST', '/api/reviews', data);
  }
  
  function deleteReview(id) {
    return sendSyncRequest('DELETE', `/api/reviews/${id}`);
  }

  /* ─── CHATS ─────────────────────────────────────────────────────── */
  function getChats(filter) {
    let list = memoryDb.chats;
    if (!filter) return list;
    if (filter.businessId) list = list.filter(c => c.businessId === filter.businessId);
    if (filter.userId) {
      list = list.filter(c => c.senderId === filter.userId || c.receiverId === filter.userId);
    }
    return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  
  function createChat(data) {
    return sendSyncRequest('POST', '/api/chats', data);
  }

  /* ─── STATS ─────────────────────────────────────────────────────── */
  function getStats() {
    // Requests dynamic metrics directly from server stats endpoint
    const stats = sendSyncRequest('GET', '/api/stats');
    if (stats) return stats;

    // Fallback locally computed stats
    const bookings = memoryDb.bookings;
    const totalRevenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    return {
      totalUsers: memoryDb.users.filter(u => u.role !== 'admin').length,
      totalBusinesses: memoryDb.businesses.length,
      totalBookings: bookings.length,
      totalRevenue,
      pendingVerification: memoryDb.businesses.filter(b => !b.isVerified).length
    };
  }

  return {
    sync: loadDataSync,
    getUsers, getUserById, getUserByEmail, createUser, updateUser,
    getBusinesses, getBusinessById, getBusinessesByOwner, createBusiness, updateBusiness, deleteBusiness,
    getServices, getServiceById, createService, updateService, deleteService,
    getBookings, getBookingById, createBooking, updateBooking,
    getReviews, createReview, deleteReview,
    getChats, createChat,
    getStats
  };
})();
