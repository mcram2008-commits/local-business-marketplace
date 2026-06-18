/**
 * Local Business Marketplace - Admin Dashboard Controller
 */
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // Guard route
  Auth.requireRole('admin');

  currentUser = Auth.getCurrentUser();
  if (currentUser) {
    document.getElementById('admin-profile-name').textContent = currentUser.name;
  }

  // Render Navbar
  App.renderNav();

  // Sidebar link clicks
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const tabName = link.getAttribute('data-tab');
      switchAdminTab(tabName);
    });
  });

  // Load default tab (Overview)
  loadOverviewStats();
});

function switchAdminTab(tabName) {
  const panels = document.querySelectorAll('.dash-tab');
  panels.forEach(p => {
    if (p.id === `tab-${tabName}`) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Make sure sidebar link active state matches (e.g. when switched programmatically)
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    if (link.getAttribute('data-tab') === tabName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Load relevant tab data
  if (tabName === 'overview') {
    loadOverviewStats();
  } else if (tabName === 'verify') {
    loadVerifyQueue();
  } else if (tabName === 'users') {
    loadUsers();
  } else if (tabName === 'reviews') {
    loadReviews();
  }
}

/* ─── OVERVIEW TAB LOGIC ─────────────────────────────────────────── */
function loadOverviewStats() {
  const stats = Store.getStats();

  document.getElementById('admin-stats-users').textContent = stats.totalUsers;
  document.getElementById('admin-stats-businesses').textContent = stats.totalBusinesses;
  document.getElementById('admin-stats-bookings').textContent = stats.totalBookings;
  document.getElementById('admin-stats-pending').textContent = stats.pendingVerification;

  // Load recent verification requests (max 5 unverified businesses)
  const tbody = document.getElementById('admin-recent-verify-tbody');
  if (!tbody) return;

  const unverified = Store.getBusinesses().filter(b => !b.isVerified).slice(0, 5);

  if (unverified.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 20px; color:var(--text-secondary)">
          No pending verification requests. All caught up!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = unverified.map(biz => {
    return `
      <tr>
        <td style="font-weight:600">${biz.name}</td>
        <td><span class="tag" style="padding: 2px 8px; font-size: 0.72rem;">${biz.category}</span></td>
        <td>📍 ${biz.city}</td>
        <td>${biz.phone}</td>
        <td>
          <div style="display:inline-flex; gap:6px">
            <button class="btn btn-primary btn-sm" onclick="approveBusiness('${biz.id}', true)" style="padding: 2px 8px; font-size: 0.72rem;">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBusinessConfirm('${biz.id}', true)" style="padding: 2px 8px; font-size: 0.72rem;">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ─── VERIFY TAB LOGIC ───────────────────────────────────────────── */
function loadVerifyQueue() {
  const tbody = document.getElementById('admin-verify-queue-tbody');
  if (!tbody) return;

  const businesses = Store.getBusinesses();

  if (businesses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 30px; color:var(--text-secondary)">
          No businesses registered on the platform.
        </td>
      </tr>
    `;
    return;
  }

  // Sort: Unverified first, then newest
  businesses.sort((a, b) => {
    if (!a.isVerified && b.isVerified) return -1;
    if (a.isVerified && !b.isVerified) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  tbody.innerHTML = businesses.map(biz => {
    const owner = Store.getUserById(biz.ownerId);
    const ownerName = owner ? owner.name : 'Unknown Owner';

    const statusBadge = biz.isVerified 
      ? `<span class="badge badge-verified">VERIFIED</span>` 
      : `<span class="badge badge-pending">PENDING</span>`;

    let actionButton = '';
    if (!biz.isVerified) {
      actionButton = `<button class="btn btn-primary btn-sm" onclick="approveBusiness('${biz.id}')" style="padding: 4px 10px; font-size: 0.75rem;">Approve</button>`;
    } else {
      actionButton = `<span style="font-size:0.75rem; color:var(--text-secondary)">✓ Verified</span>`;
    }

    return `
      <tr>
        <td style="font-weight:600; cursor:pointer; color:var(--teal)" onclick="window.location.href='business-detail.html?id=${biz.id}'">${biz.name}</td>
        <td>${ownerName}</td>
        <td><span class="tag" style="padding:2px 8px; font-size:0.72rem;">${biz.category}</span></td>
        <td>${biz.city}</td>
        <td>${statusBadge}</td>
        <td style="text-align:right">
          <div style="display:inline-flex; gap:6px">
            ${actionButton}
            <button class="btn btn-danger btn-sm" onclick="deleteBusinessConfirm('${biz.id}')" style="padding: 4px 10px; font-size: 0.75rem;">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function approveBusiness(id, fromOverview = false) {
  Store.updateBusiness(id, { isVerified: true });
  App.showToast('Business verified successfully!', 'success');
  if (fromOverview) {
    loadOverviewStats();
  } else {
    loadVerifyQueue();
  }
}

function deleteBusinessConfirm(id, fromOverview = false) {
  if (confirm('Are you sure you want to remove this business registry from the platform? This cannot be undone.')) {
    Store.deleteBusiness(id);
    App.showToast('Business deleted successfully.', 'success');
    if (fromOverview) {
      loadOverviewStats();
    } else {
      loadVerifyQueue();
    }
  }
}

/* ─── MANAGE USERS TAB LOGIC ─────────────────────────────────────── */
function loadUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const users = Store.getUsers();

  tbody.innerHTML = users.map(user => {
    const initials = App.getInitials(user.name);
    const dateStr = App.formatDate(user.createdAt);

    let roleBadgeClass = 'badge-customer';
    if (user.role === 'owner') roleBadgeClass = 'badge-owner';
    if (user.role === 'admin') roleBadgeClass = 'badge-admin';

    // Prevent changing admin's role or deleting admin
    const isAdmin = user.role === 'admin';
    const isSelf = user.id === currentUser.id;

    let deleteButton = '';
    let roleToggleButton = '';

    if (!isAdmin) {
      deleteButton = `<button class="btn btn-danger btn-sm" onclick="deleteUserConfirm('${user.id}')" style="padding: 4px 10px; font-size:0.75rem;">Delete</button>`;
      
      const newRole = user.role === 'customer' ? 'owner' : 'customer';
      const toggleLabel = user.role === 'customer' ? 'Make Owner' : 'Make Cust';
      roleToggleButton = `<button class="btn btn-outline btn-sm" onclick="changeUserRole('${user.id}', '${newRole}')" style="padding: 4px 10px; font-size:0.75rem;">${toggleLabel}</button>`;
    } else {
      deleteButton = `<span style="font-size:0.75rem; color:var(--text-secondary)">Protected</span>`;
    }

    return `
      <tr>
        <td>
          <div class="user-info-cell">
            <div class="user-avatar-sm">${initials}</div>
            <div style="font-weight:600">${user.name} ${isSelf ? '<span style="color:var(--teal)">(You)</span>' : ''}</div>
          </div>
        </td>
        <td>${user.email}</td>
        <td>${user.phone || 'N/A'}</td>
        <td><span class="badge ${roleBadgeClass}">${user.role.toUpperCase()}</span></td>
        <td>${dateStr}</td>
        <td style="text-align:right">
          <div style="display:inline-flex; gap:6px">
            ${roleToggleButton}
            ${deleteButton}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function changeUserRole(id, newRole) {
  Store.updateUser(id, { role: newRole });
  App.showToast(`User role updated to ${newRole}`, 'success');
  loadUsers();
}

function deleteUserConfirm(id) {
  if (confirm('Are you sure you want to permanently delete this user account? All their data session will be cleared.')) {
    // Delete in Store
    const users = Store.getUsers().filter(u => u.id !== id);
    localStorage.setItem('lbm_users', JSON.stringify(users));
    App.showToast('User account deleted successfully.', 'success');
    loadUsers();
  }
}

/* ─── MODERATE REVIEWS TAB LOGIC ─────────────────────────────────── */
function loadReviews() {
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!tbody) return;

  const reviews = Store.getReviews();

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary)">
          No reviews available to moderate.
        </td>
      </tr>
    `;
    return;
  }

  // Sort by date desc
  reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  tbody.innerHTML = reviews.map(rev => {
    const user = Store.getUserById(rev.userId);
    const userName = user ? user.name : 'Unknown User';

    const biz = Store.getBusinessById(rev.businessId);
    const bizName = biz ? biz.name : 'Unknown Business';

    const ratingStars = App.renderStars(rev.rating);
    const dateStr = App.formatDate(rev.createdAt);

    return `
      <tr>
        <td style="font-weight:500">${userName}</td>
        <td>${bizName}</td>
        <td><span class="stars">${ratingStars}</span> (${rev.rating}★)</td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rev.comment}">${rev.comment}</td>
        <td>${dateStr}</td>
        <td style="text-align:right">
          <button class="btn btn-danger btn-sm" onclick="deleteReviewConfirm('${rev.id}')" style="padding: 4px 10px; font-size:0.75rem;">Delete Review</button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteReviewConfirm(id) {
  if (confirm('Are you sure you want to delete this review? The business rating score will be updated automatically.')) {
    Store.deleteReview(id);
    App.showToast('Review deleted successfully.', 'success');
    loadReviews();
  }
}
