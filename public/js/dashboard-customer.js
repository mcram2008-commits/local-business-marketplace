/**
 * Local Business Marketplace - Customer Dashboard Logic
 */
let currentUser = null;
let currentBookingSubTab = 'upcoming';
let chatPollInterval = null;
let activeChatBusinessId = null;
let activeChatOwnerId = null;
let lastMessageCount = 0;
let selectedRating = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Guard Route
  Auth.requireRole('customer');

  // Load User Info
  currentUser = Auth.getCurrentUser();
  if (currentUser) {
    document.getElementById('customer-profile-name').textContent = currentUser.name;
    document.getElementById('customer-avatar-initials').textContent = App.getInitials(currentUser.name);
  }

  // Navigation navbar
  App.renderNav();

  // Sidebar link clicks
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Toggle active link
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Toggle active panels
      const tabName = link.getAttribute('data-tab');
      const panels = document.querySelectorAll('.dash-tab');
      panels.forEach(p => {
        if (p.id === `tab-${tabName}`) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      // Clear interval if not messages tab
      if (chatPollInterval && tabName !== 'messages') {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
      }

      // Action on select
      if (tabName === 'bookings') {
        loadBookings();
      } else if (tabName === 'messages') {
        renderInboxThreads();
      }
    });
  });

  // Load default tab contents
  loadBookings();

  // Initialize review stars
  initReviewStars();

  // Initialize review submit
  initReviewForm();
});

/* ─── BOOKINGS TAB LOGIC ─────────────────────────────────────────── */
function switchBookingsSubTab(subTab) {
  currentBookingSubTab = subTab;
  
  const btnUpcoming = document.getElementById('btn-bookings-upcoming');
  const btnPast = document.getElementById('btn-bookings-past');

  if (subTab === 'upcoming') {
    btnUpcoming.classList.add('active');
    btnPast.classList.remove('active');
  } else {
    btnUpcoming.classList.remove('active');
    btnPast.classList.add('active');
  }

  loadBookings();
}

function loadBookings() {
  const listEl = document.getElementById('bookings-list');
  if (!listEl) return;

  const bookings = Store.getBookings({ userId: currentUser.id });

  // Filter based on subtab
  let filtered = [];
  if (currentBookingSubTab === 'upcoming') {
    filtered = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  } else {
    filtered = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
        <div class="empty-icon">📅</div>
        <h3 style="font-family:Outfit; font-size:1.15rem; margin-bottom:6px">No Bookings Found</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem">You don't have any bookings in this section.</p>
      </div>
    `;
    return;
  }

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

  listEl.innerHTML = filtered.map(bk => {
    const biz = Store.getBusinessById(bk.businessId);
    const svc = Store.getServiceById(bk.serviceId);
    const bizName = biz ? biz.name : 'Unknown Business';
    const svcName = svc ? svc.name : 'Unknown Service';
    const duration = svc ? svc.duration : '';

    let statusClass = 'badge-pending';
    if (bk.status === 'confirmed') statusClass = 'badge-confirmed';
    if (bk.status === 'completed') statusClass = 'badge-completed';
    if (bk.status === 'cancelled') statusClass = 'badge-cancelled';

    // Check if user already reviewed
    let reviewBtnHtml = '';
    if (bk.status === 'completed' && biz) {
      const reviews = Store.getReviews(biz.id);
      const alreadyReviewed = reviews.some(r => r.userId === currentUser.id);
      
      if (!alreadyReviewed) {
        reviewBtnHtml = `<button class="btn btn-outline btn-sm" style="width:100%; margin-top:10px" onclick="openReviewModal('${biz.id}')">⭐ Rate Service</button>`;
      } else {
        reviewBtnHtml = `<div style="text-align:center; font-size:0.75rem; color:var(--teal); margin-top:12px; font-weight:500;">✓ Reviewed</div>`;
      }
    }

    let cancelBtnHtml = '';
    if (bk.status === 'pending') {
      cancelBtnHtml = `<button class="btn btn-danger btn-sm" style="width:100%; margin-top:10px" onclick="cancelBooking('${bk.id}')">Cancel Booking</button>`;
    }

    return `
      <div class="card service-card" style="flex-direction: column;">
        <div class="service-content" style="padding: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
            <div class="tag" style="padding: 2px 8px; font-size: 0.72rem;">${biz ? biz.category : 'Service'}</div>
            <span class="badge ${statusClass}">${bk.status.toUpperCase()}</span>
          </div>
          <h3 class="service-name" style="font-size:1.1rem; margin-bottom: 4px;">${svcName}</h3>
          <h4 style="font-size:0.85rem; color:var(--teal); font-weight:600; margin-bottom: 12px; cursor:pointer;" onclick="window.location.href='business-detail.html?id=${bk.businessId}'">${bizName}</h4>
          
          <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; margin-bottom: 12px;">
            <div>📅 Date: <strong>${App.formatDate(bk.bookingDate)}</strong></div>
            <div>⏱️ Time Slot: <strong>${bk.time}</strong> (${duration})</div>
            <div>💰 Price: <strong>${App.formatCurrency(bk.totalAmount)}</strong></div>
          </div>
          
          ${cancelBtnHtml}
          ${reviewBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

function cancelBooking(bookingId) {
  if (confirm('Are you sure you want to cancel this booking appointment?')) {
    Store.updateBooking(bookingId, { status: 'cancelled' });
    App.showToast('Booking cancelled successfully', 'success');
    loadBookings();
  }
}

/* ─── MESSAGES TAB LOGIC ─────────────────────────────────────────── */
function renderInboxThreads() {
  const threadsListEl = document.getElementById('inbox-threads-list');
  if (!threadsListEl) return;

  const chats = Store.getChats({ userId: currentUser.id });

  // Group chats by businessId
  const threadMap = {};
  chats.forEach(chat => {
    if (!threadMap[chat.businessId]) {
      threadMap[chat.businessId] = [];
    }
    threadMap[chat.businessId].push(chat);
  });

  const threads = Object.keys(threadMap).map(bizId => {
    const bizChats = threadMap[bizId];
    // Last message
    const lastChat = bizChats[bizChats.length - 1];
    
    // Business info
    const biz = Store.getBusinessById(bizId);
    const bizName = biz ? biz.name : 'Unknown Business';

    // The other party is the business owner
    const ownerId = biz ? biz.ownerId : null;
    const owner = ownerId ? Store.getUserById(ownerId) : null;
    const ownerName = owner ? owner.name : 'Merchant';
    const initials = App.getInitials(ownerName);

    return {
      businessId: bizId,
      businessName: bizName,
      ownerId: ownerId,
      ownerName: ownerName,
      initials: initials,
      lastMessage: lastChat.message,
      time: lastChat.time
    };
  });

  if (threads.length === 0) {
    threadsListEl.innerHTML = `
      <div style="padding:20px; text-align:center; color:var(--text-secondary); font-size:0.85rem">
        No messages yet.
      </div>
    `;
    return;
  }

  // Sort threads by last message time desc
  threads.sort((a, b) => new Date(b.time) - new Date(a.time));

  threadsListEl.innerHTML = threads.map(t => {
    const isActive = activeChatBusinessId === t.businessId ? 'active' : '';
    return `
      <div class="inbox-item ${isActive}" onclick="openConversation('${t.businessId}', '${t.ownerId}')">
        <div class="inbox-avatar">${t.initials}</div>
        <div class="inbox-item-info">
          <div class="inbox-item-name">${t.ownerName} <span style="font-size:0.75rem; color:var(--teal)">(${t.businessName})</span></div>
          <div class="inbox-item-preview">${t.lastMessage}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openConversation(businessId, ownerId) {
  activeChatBusinessId = businessId;
  activeChatOwnerId = ownerId;
  lastMessageCount = 0;

  // Highlights link in list
  renderInboxThreads();

  const chatArea = document.getElementById('inbox-chat-area');
  if (!chatArea) return;

  const ownerUser = Store.getUserById(ownerId);
  const ownerName = ownerUser ? ownerUser.name : 'Merchant';
  const biz = Store.getBusinessById(businessId);
  const bizName = biz ? biz.name : 'Merchant Shop';

  chatArea.innerHTML = `
    <div class="inbox-chat-panel">
      <div class="chat-header">
        <div class="chat-header-info">
          <span class="chat-status-indicator"></span>
          <span class="chat-header-name">${ownerName} — <span style="color:var(--teal)">${bizName}</span></span>
        </div>
      </div>
      
      <div id="inbox-messages-container" class="chat-messages" style="flex:1;">
        <!-- Dynamically loaded messages -->
      </div>

      <div class="chat-input-bar">
        <input type="text" id="inbox-chat-input" class="form-control" placeholder="Type a message..." aria-label="Type message">
        <button class="btn btn-primary" onclick="sendInboxMessage()">Send</button>
      </div>
    </div>
  `;

  // Press Enter key handler
  const inp = document.getElementById('inbox-chat-input');
  if (inp) {
    inp.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendInboxMessage();
    });
  }

  // Clear polling if running
  if (chatPollInterval) clearInterval(chatPollInterval);

  // Load chat messages
  loadInboxMessages(true);

  // Poll
  chatPollInterval = setInterval(() => {
    loadInboxMessages(false);
  }, 3000);
}

function loadInboxMessages(shouldScroll = false) {
  const container = document.getElementById('inbox-messages-container');
  if (!container || !activeChatBusinessId) return;

  const chats = Store.getChats({
    businessId: activeChatBusinessId,
    userId: currentUser.id
  });

  if (chats.length !== lastMessageCount) {
    container.innerHTML = Chat.renderMessages(chats, currentUser.id);
    lastMessageCount = chats.length;
    Chat.scrollToBottom('inbox-messages-container');
  } else if (shouldScroll) {
    Chat.scrollToBottom('inbox-messages-container');
  }
}

function sendInboxMessage() {
  const inputEl = document.getElementById('inbox-chat-input');
  if (!inputEl) return;

  const msgText = inputEl.value.trim();
  if (!msgText) return;

  Chat.send(currentUser.id, activeChatOwnerId, activeChatBusinessId, msgText);

  inputEl.value = '';
  loadInboxMessages(true);

  // Re-run threads list to show correct previews
  renderInboxThreads();
}

/* ─── REVIEW MODAL LOGIC ─────────────────────────────────────────── */
function openReviewModal(businessId) {
  selectedRating = 0;
  resetReviewStars();
  document.getElementById('review-comment').value = '';
  document.getElementById('review-rating-input').value = '';
  document.getElementById('review-business-id').value = businessId;
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

    const bizId = document.getElementById('review-business-id').value;
    const rating = parseInt(document.getElementById('review-rating-input').value, 10);
    const comment = document.getElementById('review-comment').value.trim();

    if (!rating) {
      App.showToast('Please select a star rating.', 'error');
      return;
    }

    // Submit Review
    Store.createReview({
      userId: currentUser.id,
      businessId: bizId,
      rating: rating,
      comment: comment
    });

    App.showToast('Review submitted successfully!', 'success');
    closeReviewModal();
    
    // Refresh list
    loadBookings();
  });
}
