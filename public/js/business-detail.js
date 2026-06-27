/**
 * Local Business Marketplace - Business Detail Page Logic
 */
let businessId = null;
let business = null;
let currentUser = null;
let selectedRating = 0;
let chatPollInterval = null;
let lastMessageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Render Navigation
  App.renderNav();

  // Get Business ID
  businessId = App.getParam('id');
  if (!businessId) {
    window.location.href = 'businesses.html';
    return;
  }

  // Get Business Data
  business = Store.getBusinessById(businessId);
  if (!business) {
    window.location.href = 'businesses.html';
    return;
  }

  currentUser = Auth.getCurrentUser();

  // Render Hero
  renderHero();

  // Setup Tabs
  initTabs();

  // Render Default Tab (Overview)
  switchTab('overview');

  // Setup Review Star Selector
  initReviewStars();

  // Setup Booking Form Events
  initBookingEvents();

  // Setup Review Form Submit
  initReviewForm();
});

/* ─── HERO RENDER ────────────────────────────────────────────────── */
function renderHero() {
  const heroEl = document.getElementById('detail-hero');
  if (!heroEl) return;

  const bgGradient = App.getCategoryColor(business.category);
  const ratingStars = App.renderStars(business.rating);
  const verifiedBadge = business.isVerified 
    ? `<span class="badge badge-verified">✓ Verified</span>` 
    : '';

  const ownerUser = Store.getUserById(business.ownerId);
  const ownerName = ownerUser ? ownerUser.name : 'Unknown';

  if (business.logo) {
    heroEl.style.background = `linear-gradient(rgba(5, 6, 15, 0.5), rgba(5, 6, 15, 0.92)), url('${business.logo}')`;
    heroEl.style.backgroundSize = 'cover';
    heroEl.style.backgroundPosition = 'center';
  } else {
    heroEl.style.background = bgGradient;
  }

  heroEl.innerHTML = `
    <div class="container detail-hero-inner">
      <div class="detail-hero-left">
        <div class="detail-hero-title-row">
          <h1 class="detail-hero-title">${business.name}</h1>
          ${verifiedBadge}
        </div>
        <div class="detail-hero-meta">
          <span class="tag"><span class="tag-svg-wrapper">${App.getCategorySvg(business.category)}</span> ${business.category}</span>
          <span><span class="stars">${ratingStars}</span> <strong>${business.rating}</strong> (${business.reviewCount || 0} reviews)</span>
          <span>📍 ${business.address}, ${business.city}</span>
          <span>📞 ${business.phone}</span>
        </div>
      </div>
      <div class="detail-hero-right">
        <div class="detail-hero-owner">Merchant: <strong>${ownerName}</strong></div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="openBookingModal()">📅 Book Service</button>
          <button class="btn btn-secondary" onclick="switchTab('chat')">💬 Chat Now</button>
          <a href="businesses.html" class="btn btn-ghost">← Back</a>
        </div>
      </div>
    </div>
  `;
}

/* ─── TABS CONTROLLER ────────────────────────────────────────────── */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update panels
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => {
    if (panel.id === `tab-${tabName}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  // Clear polling if not in chat tab
  if (chatPollInterval && tabName !== 'chat') {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }

  // Load appropriate contents
  if (tabName === 'overview') {
    renderOverview();
  } else if (tabName === 'services') {
    renderServices();
  } else if (tabName === 'reviews') {
    renderReviews();
  } else if (tabName === 'photos') {
    renderPhotos();
  } else if (tabName === 'chat') {
    renderChat();
  }
}

/* ─── OVERVIEW PANEL ─────────────────────────────────────────────── */
function renderOverview() {
  const panel = document.getElementById('tab-overview');
  if (!panel) return;

  const ownerUser = Store.getUserById(business.ownerId);
  const ownerName = ownerUser ? ownerUser.name : 'Unknown';
  const ownerInitials = App.getInitials(ownerName);

  panel.innerHTML = `
    <div class="overview-grid">
      <div class="card overview-card">
        <h3 class="overview-title">About the Business</h3>
        <p style="font-size: 0.95rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 24px;">
          ${business.description}
        </p>
        
        <h3 class="overview-title" style="margin-top: 30px;">Contact &amp; Hours</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Phone Number</span>
            <span class="info-value">${business.phone}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Email Address</span>
            <span class="info-value">${business.email || 'info@localbiz.com'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Operating Hours</span>
            <span class="info-value">🕒 ${business.openTime} - ${business.closeTime}</span>
          </div>
          <div class="info-item">
            <span class="info-label">City &amp; State</span>
            <span class="info-value">📍 ${business.city}, ${business.state}</span>
          </div>
        </div>
      </div>

      <div class="browse-sidebar">
        <div class="card owner-card">
          <div class="owner-avatar">${ownerInitials}</div>
          <div>
            <div class="owner-name">${ownerName}</div>
            <div class="owner-label">Verified Owner</div>
            <button class="btn btn-outline btn-sm" style="margin-top: 10px; width: 100%; padding: 4px 8px; font-size: 0.75rem;" onclick="switchTab('chat')">Send Message</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ─── SERVICES PANEL ─────────────────────────────────────────────── */
function renderServices() {
  const panel = document.getElementById('tab-services');
  if (!panel) return;

  const services = Store.getServices(business.id);

  if (services.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛎️</div>
        <h3 style="font-family:Outfit; font-size:1.3rem; margin-bottom:8px">No Services Offered</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem">This business has not added any services yet.</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="service-grid">
      ${services.map(svc => {
        const coverColor = App.getCategoryColor(business.category);
        const coverIcon = App.getCategorySvg(business.category);
        const coverStyle = svc.image 
          ? `background-image: url('${svc.image}'); background-size: cover; background-position: center;`
          : `background: ${coverColor}`;
        const coverContent = svc.image ? '' : `<div class="card-cover-svg-wrapper">${coverIcon}</div>`;

        return `
          <div class="service-card">
            <div class="service-image-placeholder" style="${coverStyle}">
              ${coverContent}
            </div>
            <div class="service-content">
              <h3 class="service-name">${svc.name}</h3>
              <div class="service-duration">⏱️ ${svc.duration}</div>
              <p class="service-desc">${svc.description}</p>
              <div class="service-price-row">
                <span class="service-price">${App.formatCurrency(svc.price)}</span>
                <button class="btn btn-primary btn-sm" onclick="openBookingModal('${svc.id}')">Book Now</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ─── REVIEWS PANEL ──────────────────────────────────────────────── */
function renderReviews() {
  const panel = document.getElementById('tab-reviews');
  if (!panel) return;

  const reviews = Store.getReviews(business.id);

  // Math breakdown
  const totalReviews = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  reviews.forEach(rev => {
    if (distribution[rev.rating] !== undefined) {
      distribution[rev.rating]++;
    }
  });

  const getPercentage = (rating) => {
    if (totalReviews === 0) return 0;
    return Math.round((distribution[rating] / totalReviews) * 100);
  };

  const ratingBigVal = business.rating || '0.0';
  const ratingStars = App.renderStars(business.rating || 0);

  // Check if current user can write review
  let writeReviewBtnHtml = '';
  if (currentUser && currentUser.role === 'customer') {
    const hasReviewed = reviews.some(r => r.userId === currentUser.id);
    if (!hasReviewed) {
      writeReviewBtnHtml = `<button class="btn btn-primary" onclick="openReviewModal()">✍️ Write a Review</button>`;
    }
  } else if (!currentUser) {
    writeReviewBtnHtml = `<a href="login.html" class="btn btn-outline">Login to Write Review</a>`;
  }

  panel.innerHTML = `
    <div class="rating-summary-card card">
      <div class="rating-big-box">
        <div class="rating-big-num">${ratingBigVal}</div>
        <div class="stars" style="margin: 8px 0;">${ratingStars}</div>
        <div style="font-size:0.85rem; color:var(--text-secondary)">${totalReviews} ratings</div>
      </div>
      <div class="rating-breakdown">
        ${[5, 4, 3, 2, 1].map(starsNum => {
          const pct = getPercentage(starsNum);
          return `
            <div class="breakdown-row">
              <span style="width:25px">${starsNum} ★</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill" style="width: ${pct}%"></div>
              </div>
              <span style="width:35px; text-align:right">${pct}%</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="text-align: center; padding-left: 20px;">
        ${writeReviewBtnHtml}
      </div>
    </div>

    <div class="review-list">
      ${totalReviews === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <h3 style="font-family:Outfit; font-size:1.3rem; margin-bottom:8px">No Reviews Yet</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem">Be the first to share your experience with this business!</p>
        </div>
      ` : reviews.map(rev => {
        const revUser = Store.getUserById(rev.userId);
        const name = revUser ? revUser.name : 'Anonymous User';
        const initials = App.getInitials(name);
        const stars = App.renderStars(rev.rating);

        return `
          <div class="card review-card">
            <div class="review-header">
              <div class="review-user">
                <div class="review-avatar">${initials}</div>
                <div>
                  <h4 class="review-name">${name}</h4>
                  <div class="stars">${stars}</div>
                </div>
              </div>
              <div class="review-meta">
                <span class="review-date">${App.timeAgo(rev.createdAt)}</span>
              </div>
            </div>
            <p class="review-comment">${rev.comment}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ─── PHOTOS PANEL ───────────────────────────────────────────────── */
function renderPhotos() {
  const panel = document.getElementById('tab-photos');
  if (!panel) return;

  const bgGrad = App.getCategoryColor(business.category);
  const icon = App.getCategorySvg(business.category);

  panel.innerHTML = `
    <div class="photos-grid">
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="card-cover-svg-wrapper">${icon}</span>
        <div class="photo-label">Main Entrance</div>
      </div>
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="photo-placeholder-icon">🏪</span>
        <div class="photo-label">Reception Desk</div>
      </div>
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="photo-placeholder-icon">💆</span>
        <div class="photo-label">Service Lounge</div>
      </div>
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="photo-placeholder-icon">🔧</span>
        <div class="photo-label">Equipment Area</div>
      </div>
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="photo-placeholder-icon">💼</span>
        <div class="photo-label">Staff Workspace</div>
      </div>
      <div class="photo-placeholder" style="background: ${bgGrad}1a">
        <span class="photo-placeholder-icon">✨</span>
        <div class="photo-label">Premium Zone</div>
      </div>
    </div>
  `;
}

/* ─── CHAT PANEL ─────────────────────────────────────────────────── */
function renderChat() {
  const panel = document.getElementById('tab-chat');
  if (!panel) return;

  if (!currentUser) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3 style="font-family:Outfit; font-size:1.3rem; margin-bottom:8px">Login Required</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:20px">Please login to chat directly with the business owner.</p>
        <a href="login.html" class="btn btn-primary">Login Now</a>
      </div>
    `;
    return;
  }

  // Owner user
  const ownerUser = Store.getUserById(business.ownerId);
  const ownerName = ownerUser ? ownerUser.name : 'Merchant';

  panel.innerHTML = `
    <div class="chat-tab-container">
      <div class="chat-box">
        <div class="chat-header">
          <div class="chat-header-info">
            <span class="chat-status-indicator"></span>
            <span class="chat-header-name">Chatting with: ${ownerName}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--text-secondary)">Online Support</span>
        </div>
        
        <div id="chat-messages-container" class="chat-messages">
          <!-- Dynamically loaded messages -->
        </div>

        <div class="chat-input-bar">
          <input type="text" id="chat-input-field" class="form-control" placeholder="Type a message..." aria-label="Chat message text">
          <button id="btn-send-chat" class="btn btn-primary" onclick="sendChatMessage()">Send</button>
        </div>
      </div>
    </div>
  `;

  // Focus input
  const inp = document.getElementById('chat-input-field');
  if (inp) {
    inp.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  // Load initial chats
  loadChatMessages(true);

  // Start chat polling (every 3 seconds)
  chatPollInterval = setInterval(() => {
    loadChatMessages(false);
  }, 3000);
}

function loadChatMessages(shouldScroll = false) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  // Filter messages between currentUser and owner for this business
  const chatMessages = Store.getChats({
    businessId: business.id,
    userId: currentUser.id
  });

  if (chatMessages.length !== lastMessageCount) {
    container.innerHTML = Chat.renderMessages(chatMessages, currentUser.id);
    lastMessageCount = chatMessages.length;
    Chat.scrollToBottom('chat-messages-container');
  } else if (shouldScroll) {
    Chat.scrollToBottom('chat-messages-container');
  }
}

function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-field');
  if (!inputEl) return;

  const msgText = inputEl.value.trim();
  if (!msgText) return;

  const ownerId = business.ownerId;
  
  // Call Chat utility
  Chat.send(currentUser.id, ownerId, business.id, msgText);

  inputEl.value = '';
  loadChatMessages(true);
}

/* ─── BOOKING MODAL LOGIC ────────────────────────────────────────── */
function openBookingModal(serviceId = null) {
  if (!currentUser) {
    App.showToast('Please login to book a service', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    return;
  }

  if (currentUser.role !== 'customer') {
    App.showToast('Only customers can book appointments.', 'warning');
    return;
  }

  // Show overlay
  const modal = document.getElementById('booking-modal');
  modal.classList.remove('hidden');

  // Populate Services dropdown
  const svcSelect = document.getElementById('booking-service-select');
  const services = Store.getServices(business.id);
  
  svcSelect.innerHTML = services.map(svc => {
    return `<option value="${svc.id}" data-price="${svc.price}">${svc.name} (${App.formatCurrency(svc.price)})</option>`;
  }).join('');

  if (serviceId) {
    svcSelect.value = serviceId;
  }

  // Set min date = today
  const dateInput = document.getElementById('booking-date');
  dateInput.value = Booking.getTodayStr();
  dateInput.min = Booking.getTodayStr();

  // Populate timeslots
  recalculateBookingSlots();
  recalculatePrice();
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

function initBookingEvents() {
  const svcSelect = document.getElementById('booking-service-select');
  const dateInput = document.getElementById('booking-date');
  
  if (svcSelect) svcSelect.addEventListener('change', () => {
    recalculatePrice();
  });

  if (dateInput) dateInput.addEventListener('change', () => {
    recalculateBookingSlots();
  });

  const form = document.getElementById('booking-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const serviceId = document.getElementById('booking-service-select').value;
      const date = document.getElementById('booking-date').value;
      const time = document.getElementById('booking-time-select').value;
      const service = Store.getServiceById(serviceId);

      if (!time) {
        App.showToast('Please select a valid time slot.', 'error');
        return;
      }

      // Create Booking
      Store.createBooking({
        userId: currentUser.id,
        businessId: business.id,
        serviceId: serviceId,
        bookingDate: date,
        time: time,
        totalAmount: service ? service.price : 0,
        status: 'pending'
      });

      App.showToast('Booking submitted successfully! Pending confirmation.', 'success');
      closeBookingModal();
      
      // Redirect to customer dashboard
      setTimeout(() => {
        window.location.href = 'dashboard-customer.html';
      }, 1500);
    });
  }
}

function recalculatePrice() {
  const svcSelect = document.getElementById('booking-service-select');
  if (!svcSelect) return;

  const opt = svcSelect.options[svcSelect.selectedIndex];
  if (!opt) return;

  const price = opt.getAttribute('data-price');
  const priceFormatted = App.formatCurrency(price);

  document.getElementById('booking-price-val').textContent = priceFormatted;
  document.getElementById('booking-total-val').textContent = priceFormatted;
}

function recalculateBookingSlots() {
  const dateVal = document.getElementById('booking-date').value;
  const timeSelect = document.getElementById('booking-time-select');
  if (!timeSelect || !dateVal) return;

  const slots = Booking.generateTimeSlots();
  const availableSlots = slots.filter(slot => {
    return Booking.isSlotAvailable(business.id, dateVal, slot);
  });

  if (availableSlots.length === 0) {
    timeSelect.innerHTML = `<option value="">No slots available (Fully Booked)</option>`;
  } else {
    timeSelect.innerHTML = availableSlots.map(slot => {
      return `<option value="${slot}">${slot}</option>`;
    }).join('');
  }
}

/* ─── REVIEW MODAL LOGIC ─────────────────────────────────────────── */
function openReviewModal() {
  selectedRating = 0;
  resetReviewStars();
  document.getElementById('review-comment').value = '';
  document.getElementById('review-rating-input').value = '';
  document.getElementById('review-modal').classList.remove('hidden');
}

function closeReviewModal() {
  document.getElementById('review-modal').classList.add('hidden');
}

function initReviewStars() {
  const stars = document.querySelectorAll('#review-star-selector span');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      selectedRating = val;
      document.getElementById('review-rating-input').value = val;
      highlightStars(val);
    });

    star.addEventListener('mouseover', () => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      highlightStars(val);
    });

    star.addEventListener('mouseout', () => {
      highlightStars(selectedRating);
    });
  });
}

function highlightStars(count) {
  const stars = document.querySelectorAll('#review-star-selector span');
  stars.forEach(star => {
    const val = parseInt(star.getAttribute('data-value'), 10);
    if (val <= count) {
      star.classList.add('selected');
    } else {
      star.classList.remove('selected');
    }
  });
}

function resetReviewStars() {
  const stars = document.querySelectorAll('#review-star-selector span');
  stars.forEach(star => star.classList.remove('selected'));
}

function initReviewForm() {
  const form = document.getElementById('review-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!currentUser) return;
    
    const rating = parseInt(document.getElementById('review-rating-input').value, 10);
    const comment = document.getElementById('review-comment').value.trim();

    if (!rating) {
      App.showToast('Please select a star rating.', 'error');
      return;
    }

    // Double check duplicate
    const reviews = Store.getReviews(business.id);
    const alreadyReviewed = reviews.some(r => r.userId === currentUser.id);

    if (alreadyReviewed) {
      App.showToast('You have already reviewed this business.', 'error');
      closeReviewModal();
      return;
    }

    // Submit Review
    Store.createReview({
      userId: currentUser.id,
      businessId: business.id,
      rating: rating,
      comment: comment
    });

    App.showToast('Review submitted. Thank you!', 'success');
    closeReviewModal();

    // Re-render hero and review tab panel
    business = Store.getBusinessById(businessId);
    renderHero();
    renderReviews();
  });
}
