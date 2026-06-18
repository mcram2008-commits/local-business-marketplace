/**
 * Local Business Marketplace - Shared App Utilities
 */
window.App = (function () {

  // Restore theme immediately to avoid styling flash
  const savedTheme = localStorage.getItem('lbm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
  }

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function getDashboardUrl() {
    const user = Auth.getCurrentUser();
    if (!user) return 'login.html';
    if (user.role === 'admin') return 'dashboard-admin.html';
    if (user.role === 'owner') return 'dashboard-owner.html';
    return 'dashboard-customer.html';
  }

  function renderStars(rating) {
    const r = Math.round(rating * 2) / 2;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= r) html += '<span class="star filled">★</span>';
      else html += '<span class="star">☆</span>';
    }
    return html;
  }

  function getCategoryIcon(category) {
    const icons = {
      'Restaurants': '🍽️', 'Beauty & Spa': '💆', 'Home Services': '🔧',
      'Fitness': '💪', 'Education': '📚', 'Healthcare': '🏥',
      'Automotive': '🚗', 'Travel': '✈️', 'Other': '🏪'
    };
    return icons[category] || '🏪';
  }

  function getCategoryColor(category) {
    const colors = {
      'Restaurants': 'linear-gradient(135deg, #f093fb, #f5576c)',
      'Beauty & Spa': 'linear-gradient(135deg, #fa709a, #fee140)',
      'Home Services': 'linear-gradient(135deg, #4facfe, #00f2fe)',
      'Fitness': 'linear-gradient(135deg, #43e97b, #38f9d7)',
      'Education': 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
      'Healthcare': 'linear-gradient(135deg, #84fab0, #8fd3f4)',
      'Automotive': 'linear-gradient(135deg, #ffecd2, #fcb69f)',
      'Travel': 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
      'Other': 'linear-gradient(135deg, #00d4aa, #00a884)'
    };
    return colors[category] || colors['Other'];
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
    return formatDate(dateStr);
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  function renderNav() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    const user = Auth.getCurrentUser();
    const page = window.location.pathname.split('/').pop() || 'index.html';

    const isActive = (p) => page === p ? 'active' : '';

    nav.innerHTML = `
      <div class="nav-inner container">
        <a href="index.html" class="nav-logo">🏪 LocalBiz</a>
        <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-menu" id="nav-menu">
          <div class="nav-links">
            <a href="index.html" class="nav-link ${isActive('index.html')}">Home</a>
            <a href="businesses.html" class="nav-link ${isActive('businesses.html')}">Businesses</a>
          </div>
          <div class="nav-right" style="display: flex; align-items: center; gap: 12px;">
            <!-- Theme Toggle Button -->
            <button id="theme-toggle" class="btn-theme-toggle" aria-label="Toggle theme" style="font-size: 1.25rem; cursor: pointer; background: transparent; border: none; outline: none; padding: 4px; display: flex; align-items: center; justify-content: center; transition: var(--transition);">
              ☀️
            </button>
            ${user ? `
              <a href="${getDashboardUrl()}" class="nav-link ${isActive(getDashboardUrl())}">Dashboard</a>
              <div class="nav-avatar" title="${user.name}">${getInitials(user.name)}</div>
              <button class="btn btn-outline btn-sm" onclick="Auth.logout()">Logout</button>
            ` : `
              <a href="login.html" class="btn btn-outline btn-sm ${isActive('login.html')}">Login</a>
              <a href="register.html" class="btn btn-primary btn-sm">Register</a>
            `}
          </div>
        </div>
      </div>
    `;

    // Initialize Theme toggle state & click listener
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      const updateThemeIcon = (theme) => {
        themeBtn.innerHTML = theme === 'light' ? '🌙' : '☀️';
      };
      
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      updateThemeIcon(currentTheme);

      themeBtn.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('lbm_theme', newTheme);
        updateThemeIcon(newTheme);
      });
    }

    // Hamburger toggle
    document.getElementById('nav-toggle').addEventListener('click', () => {
      document.getElementById('nav-menu').classList.toggle('open');
    });
  }

  return {
    formatCurrency, formatDate, formatDateTime, getInitials, generateId,
    getParam, getDashboardUrl, renderStars, getCategoryIcon, getCategoryColor,
    timeAgo, showToast, renderNav
  };
})();
