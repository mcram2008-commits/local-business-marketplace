/**
 * Local Business Marketplace - Merchant Dashboard Controller
 */
let currentUser = null;
let ownerBusinesses = [];
let currentBookingsTab = 'pending';
let activeChatBusinessId = null;
let activeChatCustomerId = null;
let chatPollInterval = null;
let lastMessageCount = 0;

let revenueChartInstance = null;
let bookingsChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Guard route
  Auth.requireRole('owner');

  currentUser = Auth.getCurrentUser();
  if (currentUser) {
    document.getElementById('owner-profile-name').textContent = currentUser.name;
    document.getElementById('owner-avatar-initials').textContent = App.getInitials(currentUser.name);
  }

  // Navbar
  App.renderNav();

  // Load list of businesses owned
  refreshOwnerBusinesses();

  // Sidebar link clicks
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const tabName = link.getAttribute('data-tab');
      const panels = document.querySelectorAll('.dash-tab');
      panels.forEach(p => {
        if (p.id === `tab-${tabName}`) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      // Clear chat polling if leaving chat tab
      if (chatPollInterval && tabName !== 'messages') {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
      }

      // Load tab details
      if (tabName === 'analytics') {
        loadAnalytics();
      } else if (tabName === 'my-business') {
        loadMyBusinesses();
      } else if (tabName === 'services') {
        loadManageServices();
      } else if (tabName === 'bookings') {
        loadOwnerBookings();
      } else if (tabName === 'messages') {
        renderOwnerInboxThreads();
      }
    });
  });

  // Services business dropdown listener
  const svcBizSelect = document.getElementById('services-business-select');
  if (svcBizSelect) {
    svcBizSelect.addEventListener('change', () => {
      loadServicesList(svcBizSelect.value);
    });
  }

  // Load default tab (Analytics)
  loadAnalytics();
});

function refreshOwnerBusinesses() {
  ownerBusinesses = Store.getBusinessesByOwner(currentUser.id);
}

/* ─── ANALYTICS TAB LOGIC ────────────────────────────────────────── */
function loadAnalytics() {
  refreshOwnerBusinesses();
  
  const totalBookingsEl = document.getElementById('stats-total-bookings');
  const activeBookingsEl = document.getElementById('stats-confirmed-bookings');
  const totalRevenueEl = document.getElementById('stats-total-revenue');
  const avgRatingEl = document.getElementById('stats-avg-rating');

  const bizIds = ownerBusinesses.map(b => b.id);
  const bookings = Store.getBookings().filter(b => bizIds.includes(b.businessId));

  const totalRevenue = bookings
    .filter(b => b.status === 'completed')
    .reduce((s, b) => s + b.totalAmount, 0);

  const activeCount = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length;

  const avgRating = ownerBusinesses.length > 0
    ? Math.round((ownerBusinesses.reduce((s, b) => s + b.rating, 0) / ownerBusinesses.length) * 10) / 10
    : 0.0;

  totalBookingsEl.textContent = bookings.length;
  activeBookingsEl.textContent = activeCount;
  totalRevenueEl.textContent = App.formatCurrency(totalRevenue);
  avgRatingEl.textContent = avgRating.toFixed(1);

  // Load Charts
  setTimeout(() => {
    renderCharts(bookings);
  }, 100);
}

function renderCharts(bookings) {
  // Destroy old charts to prevent duplicate canvas error
  if (revenueChartInstance) revenueChartInstance.destroy();
  if (bookingsChartInstance) bookingsChartInstance.destroy();

  // 1. REVENUE CHART (Line chart by month)
  const ctxRev = document.getElementById('revenueChart');
  if (ctxRev) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueByMonth = new Array(12).fill(0);

    bookings.forEach(b => {
      if (b.status === 'completed') {
        const d = new Date(b.bookingDate);
        if (!isNaN(d)) {
          const monthIndex = d.getMonth();
          revenueByMonth[monthIndex] += b.totalAmount;
        }
      }
    });

    // We only display the months up to the current month for a cleaner look
    const curMonth = new Date().getMonth();
    const labels = months.slice(0, curMonth + 1);
    const data = revenueByMonth.slice(0, curMonth + 1);

    revenueChartInstance = new Chart(ctxRev, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: data,
          borderColor: '#00d4aa',
          backgroundColor: 'rgba(0, 212, 170, 0.05)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0' } },
          x: { grid: { display: false }, ticks: { color: '#8892b0' } }
        }
      }
    });
  }

  // 2. BOOKINGS STATS (Bar chart of bookings status counts)
  const ctxBks = document.getElementById('bookingsChart');
  if (ctxBks) {
    const statusCounts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach(b => {
      if (statusCounts[b.status] !== undefined) {
        statusCounts[b.status]++;
      }
    });

    bookingsChartInstance = new Chart(ctxBks, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        datasets: [{
          data: [statusCounts.pending, statusCounts.confirmed, statusCounts.completed, statusCounts.cancelled],
          backgroundColor: ['#ffd700', '#3b82f6', '#22c55e', '#f43f5e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#8892b0', font: { size: 11 } }
          }
        }
      }
    });
  }
}

/* ─── MY BUSINESSES TAB LOGIC ────────────────────────────────────── */
function loadMyBusinesses() {
  refreshOwnerBusinesses();
  const listEl = document.getElementById('businesses-list');
  if (!listEl) return;

  if (ownerBusinesses.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
        <div class="empty-icon">🏪</div>
        <h3 style="font-family:Outfit; font-size:1.15rem; margin-bottom:6px">No Businesses Registered</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:20px">You haven't listed any businesses on our platform yet.</p>
        <a href="add-business.html" class="btn btn-primary">➕ Register Business</a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = ownerBusinesses.map(biz => {
    const verifiedBadge = biz.isVerified 
      ? `<span class="badge badge-verified">✓ Verified</span>` 
      : `<span class="badge badge-pending">⏳ Verification Pending</span>`;
    const coverGradient = App.getCategoryColor(biz.category);
    const categoryIcon = App.getCategoryIcon(biz.category);
    const coverStyle = biz.logo 
      ? `background-image: url('${biz.logo}'); background-size: cover; background-position: center;`
      : `background: ${coverGradient}`;
    const coverContent = biz.logo ? '' : categoryIcon;

    return `
      <div class="biz-card">
        <div class="biz-card-cover" style="${coverStyle}">
          ${coverContent}
        </div>
        <div class="biz-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
            <span class="biz-card-category">${biz.category}</span>
            ${verifiedBadge}
          </div>
          <h3 class="biz-card-name" style="cursor:pointer;" onclick="window.location.href='business-detail.html?id=${biz.id}'">${biz.name}</h3>
          <div class="biz-card-rating" style="font-size:0.8rem">
            ${App.renderStars(biz.rating)} <strong>${biz.rating}</strong> (${biz.reviewCount} reviews)
          </div>
          <div class="biz-card-location">📍 ${biz.address}, ${biz.city}</div>
          <p class="biz-card-desc">${biz.description}</p>
          <div style="margin-top: auto; display: flex; gap: 8px; padding-top: 15px; border-top: 1px solid var(--border)">
            <a href="add-business.html?id=${biz.id}" class="btn btn-ghost btn-sm" style="flex:1">✏️ Edit</a>
            <button class="btn btn-danger btn-sm" style="flex:1" onclick="deleteBusinessConfirm('${biz.id}')">✕ Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function deleteBusinessConfirm(id) {
  if (confirm('WARNING: Are you sure you want to delete this business? All associated services and bookings will remain in history.')) {
    Store.deleteBusiness(id);
    App.showToast('Business deleted successfully', 'success');
    loadMyBusinesses();
  }
}

/* ─── MANAGE SERVICES TAB LOGIC ──────────────────────────────────── */
function loadManageServices() {
  refreshOwnerBusinesses();
  const select = document.getElementById('services-business-select');
  if (!select) return;

  if (ownerBusinesses.length === 0) {
    select.innerHTML = `<option value="">No businesses</option>`;
    document.getElementById('services-list').innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3 style="font-family:Outfit; font-size:1.15rem; margin-bottom:6px">Business Registration Required</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem">Please register a business first before creating services.</p>
      </div>
    `;
    document.getElementById('btn-add-service-shortcut').disabled = true;
    return;
  }

  document.getElementById('btn-add-service-shortcut').disabled = false;
  
  // Populate dropdown
  select.innerHTML = ownerBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  // Initial load
  loadServicesList(select.value);
}

function loadServicesList(businessId) {
  const listEl = document.getElementById('services-list');
  if (!listEl || !businessId) return;

  const services = Store.getServices(businessId);
  const biz = Store.getBusinessById(businessId);

  if (services.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
        <div class="empty-icon">🛎️</div>
        <h3 style="font-family:Outfit; font-size:1.15rem; margin-bottom:6px">No Services Created</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom: 20px;">Add the services you offer to allow customers to book online.</p>
        <button class="btn btn-primary btn-sm" onclick="navigateToAddService()">➕ Create First Service</button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = services.map(svc => {
    const coverGradient = App.getCategoryColor(biz.category);
    const coverIcon = App.getCategoryIcon(biz.category);
    const coverStyle = svc.image 
      ? `background-image: url('${svc.image}'); background-size: cover; background-position: center;`
      : `background: ${coverGradient}`;
    const coverContent = svc.image ? '' : coverIcon;

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
            <div style="display:flex; gap:6px">
              <a href="add-service.html?id=${svc.id}&bizId=${businessId}" class="btn btn-ghost btn-sm" style="padding: 4px 8px;">✏️ Edit</a>
              <button class="btn btn-danger btn-sm" style="padding: 4px 8px;" onclick="deleteServiceConfirm('${svc.id}')">✕</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function deleteServiceConfirm(id) {
  if (confirm('Are you sure you want to remove this service option?')) {
    Store.deleteService(id);
    App.showToast('Service deleted successfully', 'success');
    const select = document.getElementById('services-business-select');
    loadServicesList(select.value);
  }
}

function navigateToAddService() {
  const select = document.getElementById('services-business-select');
  if (select && select.value) {
    window.location.href = `add-service.html?bizId=${select.value}`;
  } else {
    App.showToast('Please select/register a business first', 'warning');
  }
}

/* ─── APPOINTMENTS BOOKINGS TAB LOGIC ────────────────────────────── */
function switchOwnerBookingsTab(tabName) {
  currentBookingsTab = tabName;

  document.getElementById('btn-owner-bk-pending').classList.remove('active');
  document.getElementById('btn-owner-bk-confirmed').classList.remove('active');
  document.getElementById('btn-owner-bk-history').classList.remove('active');

  if (tabName === 'pending') {
    document.getElementById('btn-owner-bk-pending').classList.add('active');
  } else if (tabName === 'confirmed') {
    document.getElementById('btn-owner-bk-confirmed').classList.add('active');
  } else {
    document.getElementById('btn-owner-bk-history').classList.add('active');
  }

  loadOwnerBookings();
}

function loadOwnerBookings() {
  const tbody = document.getElementById('owner-bookings-tbody');
  if (!tbody) return;

  refreshOwnerBusinesses();
  const bizIds = ownerBusinesses.map(b => b.id);
  const bookings = Store.getBookings().filter(b => bizIds.includes(b.businessId));

  // Filter
  let filtered = [];
  if (currentBookingsTab === 'pending') {
    filtered = bookings.filter(b => b.status === 'pending');
  } else if (currentBookingsTab === 'confirmed') {
    filtered = bookings.filter(b => b.status === 'confirmed');
  } else {
    // History
    filtered = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px; color:var(--text-secondary)">
          No bookings found in this category.
        </td>
      </tr>
    `;
    return;
  }

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

  tbody.innerHTML = filtered.map(bk => {
    const customer = Store.getUserById(bk.userId);
    const customerName = customer ? customer.name : 'Guest User';
    const initials = App.getInitials(customerName);
    
    const svc = Store.getServiceById(bk.serviceId);
    const svcName = svc ? svc.name : 'Unknown Service';

    const dateStr = App.formatDate(bk.bookingDate);
    const priceStr = App.formatCurrency(bk.totalAmount);

    let badgeClass = 'badge-pending';
    if (bk.status === 'confirmed') badgeClass = 'badge-confirmed';
    if (bk.status === 'completed') badgeClass = 'badge-completed';
    if (bk.status === 'cancelled') badgeClass = 'badge-cancelled';

    let actionButtons = '';
    if (bk.status === 'pending') {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="updateBookingStatus('${bk.id}', 'confirmed')" style="padding: 4px 10px; font-size:0.75rem;">Accept</button>
        <button class="btn btn-danger btn-sm" onclick="updateBookingStatus('${bk.id}', 'cancelled')" style="padding: 4px 10px; font-size:0.75rem;">Decline</button>
      `;
    } else if (bk.status === 'confirmed') {
      actionButtons = `
        <button class="btn btn-outline btn-sm" onclick="updateBookingStatus('${bk.id}', 'completed')" style="padding: 4px 10px; font-size:0.75rem; border-color:#22c55e; color:#22c55e;">Complete</button>
        <button class="btn btn-danger btn-sm" onclick="updateBookingStatus('${bk.id}', 'cancelled')" style="padding: 4px 10px; font-size:0.75rem;">Cancel</button>
      `;
    }

    return `
      <tr>
        <td>
          <div class="user-info-cell">
            <div class="user-avatar-sm">${initials}</div>
            <div>
              <div style="font-weight:600">${customerName}</div>
              <div style="font-size:0.7rem; color:var(--text-secondary)">${customer ? customer.phone : ''}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:500">${svcName}</div>
        </td>
        <td>
          <div>${dateStr}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary)">🕒 ${bk.time}</div>
        </td>
        <td><strong>${priceStr}</strong></td>
        <td><span class="badge ${badgeClass}">${bk.status.toUpperCase()}</span></td>
        <td style="text-align:right">
          <div style="display:inline-flex; gap:6px">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateBookingStatus(id, newStatus) {
  Store.updateBooking(id, { status: newStatus });
  App.showToast(`Appointment status updated to ${newStatus}`, 'success');
  loadOwnerBookings();
}

/* ─── MESSAGES TAB LOGIC ────────────────────────────────────────── */
function renderOwnerInboxThreads() {
  const threadsListEl = document.getElementById('owner-threads-list');
  if (!threadsListEl) return;

  refreshOwnerBusinesses();
  const bizIds = ownerBusinesses.map(b => b.id);

  // Retrieve all chats for owner's businesses
  const chats = Store.getChats().filter(c => bizIds.includes(c.businessId));

  // Group chats by unique key: customerId + businessId
  const threadMap = {};
  chats.forEach(chat => {
    // The customer is either the sender or receiver
    const otherUserId = chat.senderId === currentUser.id ? chat.receiverId : chat.senderId;
    const key = `${otherUserId}_${chat.businessId}`;
    if (!threadMap[key]) {
      threadMap[key] = [];
    }
    threadMap[key].push(chat);
  });

  const threads = Object.keys(threadMap).map(key => {
    const [customerId, businessId] = key.split('_');
    const threadChats = threadMap[key];
    const lastChat = threadChats[threadChats.length - 1];

    const customer = Store.getUserById(customerId);
    const customerName = customer ? customer.name : 'Customer User';
    const initials = App.getInitials(customerName);

    const biz = Store.getBusinessById(businessId);
    const bizName = biz ? biz.name : 'My Business';

    return {
      key: key,
      customerId: customerId,
      businessId: businessId,
      customerName: customerName,
      initials: initials,
      businessName: bizName,
      lastMessage: lastChat.message,
      time: lastChat.time
    };
  });

  if (threads.length === 0) {
    threadsListEl.innerHTML = `
      <div style="padding:20px; text-align:center; color:var(--text-secondary); font-size:0.85rem">
        No customer messages yet.
      </div>
    `;
    return;
  }

  // Sort by last message time desc
  threads.sort((a, b) => new Date(b.time) - new Date(a.time));

  threadsListEl.innerHTML = threads.map(t => {
    const isActive = activeChatBusinessId === t.businessId && activeChatCustomerId === t.customerId ? 'active' : '';
    return `
      <div class="inbox-item ${isActive}" onclick="openOwnerConversation('${t.businessId}', '${t.customerId}')">
        <div class="inbox-avatar">${t.initials}</div>
        <div class="inbox-item-info">
          <div class="inbox-item-name">${t.customerName} <span style="font-size:0.75rem; color:var(--teal)">(${t.businessName})</span></div>
          <div class="inbox-item-preview">${t.lastMessage}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openOwnerConversation(businessId, customerId) {
  activeChatBusinessId = businessId;
  activeChatCustomerId = customerId;
  lastMessageCount = 0;

  renderOwnerInboxThreads();

  const chatArea = document.getElementById('owner-chat-area');
  if (!chatArea) return;

  const customerUser = Store.getUserById(customerId);
  const customerName = customerUser ? customerUser.name : 'Customer';
  const biz = Store.getBusinessById(businessId);
  const bizName = biz ? biz.name : 'My Shop';

  chatArea.innerHTML = `
    <div class="inbox-chat-panel">
      <div class="chat-header">
        <div class="chat-header-info">
          <span class="chat-status-indicator"></span>
          <span class="chat-header-name">${customerName} — <span style="color:var(--teal)">${bizName}</span></span>
        </div>
      </div>
      
      <div id="owner-messages-container" class="chat-messages" style="flex:1;">
        <!-- Dynamically loaded messages -->
      </div>

      <div class="chat-input-bar">
        <input type="text" id="owner-chat-input" class="form-control" placeholder="Type a message..." aria-label="Type message">
        <button class="btn btn-primary" onclick="sendOwnerInboxMessage()">Send</button>
      </div>
    </div>
  `;

  // Press Enter key handler
  const inp = document.getElementById('owner-chat-input');
  if (inp) {
    inp.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendOwnerInboxMessage();
    });
  }

  // Clear polling if running
  if (chatPollInterval) clearInterval(chatPollInterval);

  // Load chat messages
  loadOwnerMessages(true);

  // Poll
  chatPollInterval = setInterval(() => {
    loadOwnerMessages(false);
  }, 3000);
}

function loadOwnerMessages(shouldScroll = false) {
  const container = document.getElementById('owner-messages-container');
  if (!container || !activeChatBusinessId || !activeChatCustomerId) return;

  // Chats matching this business and involving this customer
  const chats = Store.getChats({
    businessId: activeChatBusinessId,
    userId: activeChatCustomerId
  });

  if (chats.length !== lastMessageCount) {
    container.innerHTML = Chat.renderMessages(chats, currentUser.id);
    lastMessageCount = chats.length;
    Chat.scrollToBottom('owner-messages-container');
  } else if (shouldScroll) {
    Chat.scrollToBottom('owner-messages-container');
  }
}

function sendOwnerInboxMessage() {
  const inputEl = document.getElementById('owner-chat-input');
  if (!inputEl) return;

  const msgText = inputEl.value.trim();
  if (!msgText) return;

  Chat.send(currentUser.id, activeChatCustomerId, activeChatBusinessId, msgText);

  inputEl.value = '';
  loadOwnerMessages(true);

  renderOwnerInboxThreads();
}
