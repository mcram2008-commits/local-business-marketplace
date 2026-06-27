/**
 * Local Business Marketplace - Browse Businesses Logic
 */
let allBusinesses = [];
let categories = [];
let locations = [];

document.addEventListener('DOMContentLoaded', () => {
  // Render Navigation
  App.renderNav();

  // Load all businesses from Store
  allBusinesses = Store.getBusinesses();

  // Extract categories and cities
  categories = [...new Set(allBusinesses.map(b => b.category))].sort();
  locations = [...new Set(allBusinesses.map(b => b.city))].sort();

  // Build filter choices dynamically
  buildFilters();

  // Pre-fill fields from URL params
  readUrlParams();

  // Run initial search
  applyFilters();

  // Add event listeners for dynamic controls
  setupEventListeners();
});

function buildFilters() {
  // Populating category list
  const catList = document.getElementById('category-filter-list');
  if (catList) {
    catList.innerHTML = categories.map(cat => {
      return `
        <label class="filter-check">
          <input type="checkbox" class="category-checkbox" value="${cat}">
          <span>${cat}</span>
        </label>
      `;
    }).join('');
  }

  // Populating locations dropdown
  const locSelect = document.getElementById('filter-location');
  if (locSelect) {
    locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      locSelect.appendChild(opt);
    });
  }
}

function readUrlParams() {
  const query = App.getParam('search');
  const location = App.getParam('location');
  const category = App.getParam('category');

  if (query) {
    document.getElementById('filter-search').value = query;
  }
  if (location) {
    document.getElementById('filter-location').value = location;
  }
  if (category) {
    const checkboxes = document.querySelectorAll('.category-checkbox');
    checkboxes.forEach(chk => {
      if (chk.value.toLowerCase() === category.toLowerCase()) {
        chk.checked = true;
      }
    });
  }
}

function setupEventListeners() {
  // Input fields
  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.getElementById('filter-location').addEventListener('change', applyFilters);
  document.getElementById('filter-rating').addEventListener('change', applyFilters);
  document.getElementById('filter-verified').addEventListener('change', applyFilters);
  document.getElementById('sort-select').addEventListener('change', applyFilters);

  // Category checkbox event listeners
  const checkboxes = document.querySelectorAll('.category-checkbox');
  checkboxes.forEach(chk => chk.addEventListener('change', applyFilters));

  // Reset Filters Button
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-location').value = '';
    document.getElementById('filter-rating').value = '0';
    document.getElementById('filter-verified').checked = false;
    document.getElementById('sort-select').value = 'newest';
    
    document.querySelectorAll('.category-checkbox').forEach(chk => chk.checked = false);

    applyFilters();
    App.showToast('Filters cleared', 'info');
  });
}

function applyFilters() {
  const query = document.getElementById('filter-search').value.toLowerCase().trim();
  const city = document.getElementById('filter-location').value;
  const minRating = parseFloat(document.getElementById('filter-rating').value);
  const verifiedOnly = document.getElementById('filter-verified').checked;
  const sortBy = document.getElementById('sort-select').value;

  // Selected Categories
  const checkedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked'))
    .map(chk => chk.value);

  // Perform Filter
  let filtered = allBusinesses.filter(biz => {
    // Keyword match (Name, Description, Category, City, State)
    if (query) {
      const matchesQuery = 
        biz.name.toLowerCase().includes(query) ||
        biz.description.toLowerCase().includes(query) ||
        biz.category.toLowerCase().includes(query) ||
        biz.city.toLowerCase().includes(query) ||
        biz.state.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }

    // Category match
    if (checkedCategories.length > 0) {
      if (!checkedCategories.includes(biz.category)) return false;
    }

    // City match
    if (city && biz.city !== city) return false;

    // Rating match
    if (minRating > 0 && biz.rating < minRating) return false;

    // Verified match
    if (verifiedOnly && !biz.isVerified) return false;

    return true;
  });

  // Perform Sort
  filtered.sort((a, b) => {
    if (sortBy === 'rating') {
      return b.rating - a.rating;
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      // newest
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  // Update Count
  document.getElementById('results-count').textContent = filtered.length;

  // Render
  renderCards(filtered);
}

function renderCards(list) {
  const grid = document.getElementById('business-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🔍</div>
        <h3 style="font-family:Outfit; font-size:1.3rem; margin-bottom:8px">No Results Found</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem">Try adjusting your filters or search keywords.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(biz => {
    const verifiedBadge = biz.isVerified 
      ? `<div class="biz-card-verified">✓ Verified</div>` 
      : '';
    const ratingStars = App.renderStars(biz.rating);
    const coverGradient = App.getCategoryColor(biz.category);
    const categoryIcon = App.getCategorySvg(biz.category);
    const coverStyle = biz.logo 
      ? `background-image: url('${biz.logo}'); background-size: cover; background-position: center;`
      : `background: ${coverGradient}`;
    const coverContent = biz.logo ? '' : `<div class="card-cover-svg-wrapper">${categoryIcon}</div>`;

    return `
      <div class="biz-card" onclick="window.location.href='business-detail.html?id=${biz.id}'">
        <div class="biz-card-cover" style="${coverStyle}">
          ${coverContent}
          ${verifiedBadge}
        </div>
        <div class="biz-card-body">
          <div class="biz-card-category">${biz.category}</div>
          <h3 class="biz-card-name">${biz.name}</h3>
          <div class="biz-card-rating">
            <span class="stars">${ratingStars}</span>
            <strong style="color:var(--text-primary); margin-left: 4px;">${biz.rating}</strong>
            <span style="color:var(--text-secondary)">(${biz.reviewCount || 0})</span>
          </div>
          <div class="biz-card-location">📍 ${biz.city}, ${biz.state}</div>
        </div>
      </div>
    `;
  }).join('');
}
