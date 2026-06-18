/**
 * Local Business Marketplace - Home Page Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  // Render navbar
  App.renderNav();

  // Load featured businesses
  loadFeaturedBusinesses();

  // Initialize Search Form
  initSearch();

  // Initialize Animated Counters
  initCounters();
});

function loadFeaturedBusinesses() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  const businesses = Store.getBusinesses();
  
  // Sort by rating desc, verify status, then take top 6
  const featured = businesses
    .sort((a, b) => {
      if (a.isVerified && !b.isVerified) return -1;
      if (!a.isVerified && b.isVerified) return 1;
      return b.rating - a.rating;
    })
    .slice(0, 6);

  if (featured.length === 0) {
    grid.innerHTML = '<div class="empty-state">No businesses found.</div>';
    return;
  }

  grid.innerHTML = featured.map(biz => {
    const verifiedBadge = biz.isVerified 
      ? `<div class="biz-card-verified">✓ Verified</div>` 
      : '';
    const ratingHtml = App.renderStars(biz.rating);
    const coverGradient = App.getCategoryColor(biz.category);
    const categoryIcon = App.getCategoryIcon(biz.category);
    const coverStyle = biz.logo 
      ? `background-image: url('${biz.logo}'); background-size: cover; background-position: center;`
      : `background: ${coverGradient}`;
    const coverContent = biz.logo ? '' : categoryIcon;

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
            <span class="stars">${ratingHtml}</span>
            <strong style="color:var(--text-primary)">${biz.rating}</strong>
            <span style="color:var(--text-secondary)">(${biz.reviewCount || 0})</span>
          </div>
          <div class="biz-card-location">📍 ${biz.city}, ${biz.state}</div>
          <p class="biz-card-desc">${biz.description}</p>
          <div style="margin-top: 15px;">
            <button class="btn btn-outline btn-sm" style="width:100%">View Details</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initSearch() {
  const form = document.getElementById('hero-search-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const query = document.getElementById('search-query').value.trim();
    const city = document.getElementById('search-city').value;
    const category = document.getElementById('search-category').value;

    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (city) params.set('location', city);
    if (category) params.set('category', category);

    window.location.href = `businesses.html?${params.toString()}`;
  });
}

function initCounters() {
  const counters = document.querySelectorAll('.stat-counter');
  if (!counters.length) return;

  const animateCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    const duration = 2000; // 2 seconds
    const stepTime = Math.max(Math.floor(duration / target), 15);
    let current = 0;
    
    // For large numbers (e.g. 10000), increment by larger steps
    const stepSize = Math.max(Math.floor(target / (duration / stepTime)), 1);

    const timer = setInterval(() => {
      current += stepSize;
      if (current >= target) {
        counter.textContent = target.toLocaleString('en-IN') + '+';
        clearInterval(timer);
      } else {
        counter.textContent = current.toLocaleString('en-IN') + '+';
      }
    }, stepTime);
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}
