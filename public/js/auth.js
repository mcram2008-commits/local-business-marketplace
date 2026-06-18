/**
 * Local Business Marketplace - Auth Module (Server-Side Session Bridge)
 */
window.Auth = (function () {
  const USER_KEY = 'lbm_user';
  const TOKEN_KEY = 'lbm_token';

  function login(email, password) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/auth/login', false); // Synchronous auth request
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ email, password }));

      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        
        // Force store.js to resync users list and bookings
        if (window.Store && typeof window.Store.sync === 'function') {
          window.Store.sync();
        }
        
        return data.user;
      } else {
        let errMsg = 'Invalid credentials';
        try {
          const errObj = JSON.parse(xhr.responseText);
          errMsg = errObj.error || errMsg;
        } catch {}
        console.error('Login Failed:', errMsg);
        App.showToast(errMsg, 'error');
        return null;
      }
    } catch (err) {
      console.error('Connection failed during login:', err);
      App.showToast('Failed to connect to backend server', 'error');
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'login.html';
  }

  function getCurrentUser() {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
    }
  }

  function requireRole(role) {
    const user = getCurrentUser();
    if (!user) { 
      window.location.href = 'login.html'; 
      return; 
    }
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role)) {
      window.location.href = 'index.html';
    }
  }

  function requireGuest() {
    if (isLoggedIn()) {
      window.location.href = App.getDashboardUrl();
    }
  }

  return { login, logout, getCurrentUser, isLoggedIn, requireAuth, requireRole, requireGuest };
})();
