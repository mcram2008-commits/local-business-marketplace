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

  function getCategorySvg(category) {
    const svgs = {
      'Restaurants': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M18 5v10a3 3 0 0 1-6 0V5M6 5v6a2 2 0 0 0 4 0V5"/></svg>`,
      'Beauty & Spa': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>`,
      'Home Services': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      'Fitness': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5h12M6 16.5h12M4 5v14M20 5v14M1 9v6M23 9v6"/></svg>`,
      'Education': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z"/></svg>`,
      'Healthcare': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
      'Automotive': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
      'Travel': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5c.8-.8.8-2 0-2.8s-2-.8-2.8 0L13 8.2l-8.2-1.8c-.5-.1-1 .1-1.3.5-.4.4-.4 1 0 1.4l5.8 4.2-3.5 3.5-2.1-.7c-.3-.1-.6 0-.8.2L1.8 17l2.8 1.4 1.4 2.8 1.3-1.3c.2-.2.3-.5.2-.8l-.7-2.1 3.5-3.5 4.2 5.8c.4.4 1 .4 1.4 0 .4-.3.6-.8.5-1.3z"/></svg>`,
      'Other': `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`
    };
    return svgs[category] || svgs['Other'];
  }

  function getCategoryColor(category) {
    const colors = {
      'Restaurants': 'linear-gradient(135deg, rgba(240, 147, 251, 0.25), rgba(245, 87, 108, 0.25))',
      'Beauty & Spa': 'linear-gradient(135deg, rgba(250, 112, 154, 0.25), rgba(254, 225, 64, 0.25))',
      'Home Services': 'linear-gradient(135deg, rgba(79, 172, 254, 0.25), rgba(0, 242, 254, 0.25))',
      'Fitness': 'linear-gradient(135deg, rgba(67, 233, 123, 0.25), rgba(56, 249, 215, 0.25))',
      'Education': 'linear-gradient(135deg, rgba(161, 140, 209, 0.25), rgba(251, 194, 235, 0.25))',
      'Healthcare': 'linear-gradient(135deg, rgba(132, 250, 176, 0.25), rgba(143, 211, 244, 0.25))',
      'Automotive': 'linear-gradient(135deg, rgba(255, 236, 210, 0.25), rgba(252, 182, 159, 0.25))',
      'Travel': 'linear-gradient(135deg, rgba(161, 196, 253, 0.25), rgba(194, 233, 251, 0.25))',
      'Other': 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(0, 198, 255, 0.25))'
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
    getParam, getDashboardUrl, renderStars, getCategoryIcon, getCategorySvg, getCategoryColor,
    timeAgo, showToast, renderNav
  };
})();
