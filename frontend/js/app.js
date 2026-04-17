/**
 * app.js — Page-specific initialization logic.
 *
 * Reads `document.body.dataset.page` to decide which init function to run.
 * Each HTML page sets: <body data-page="pagename">
 *
 * Depends on: utils.js, ui.js, api.js, auth.js
 */

/* ─────────────────────────────────────────────────────────────
   ROUTER — runs on DOMContentLoaded
───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function () {
  const page = document.body.dataset.page;
  if (!page) return;

  const routes = {
    'home':             initHome,
    'search':           initSearch,
    'vehicle-detail':   initVehicleDetail,
    'booking':          initBooking,
    'booking-confirmation': initBookingConfirmation,
    'payment':          initPayment,
    'my-bookings':      initMyBookings,
    'profile':          initProfile,
    'admin-dashboard':  initAdminDashboard,
    'admin-bookings':   initAdminBookings,
    'admin-vehicles':   initAdminVehicles,
    'admin-reports':    initAdminReports,
  };

  const initFn = routes[page];
  if (initFn) {
    initFn();
  }
});

/* ─────────────────────────────────────────────────────────────
   SHARED: HAMBURGER MENU
───────────────────────────────────────────────────────────── */

function initHamburger() {
  const btn  = document.getElementById('hamburger-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', function () {
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
  });

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────── */

async function initHome() {
  initHamburger();

  // Populate location dropdowns
  await loadLocationOptions('search-location');

  // Set minimum dates on date inputs
  const today = todayString();
  const pickupInput = document.getElementById('search-pickup');
  const returnInput = document.getElementById('search-return');
  if (pickupInput) pickupInput.min = today;
  if (returnInput) returnInput.min = today;

  // Keep return date >= pickup date
  if (pickupInput && returnInput) {
    pickupInput.addEventListener('change', function () {
      if (returnInput.value && returnInput.value < this.value) {
        returnInput.value = this.value;
      }
      returnInput.min = this.value || today;
    });
  }

  // Hero search form
  const heroForm = document.getElementById('hero-search-form');
  if (heroForm) {
    heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const type       = document.getElementById('search-type').value;
      const locationId = document.getElementById('search-location').value;
      const pickup     = document.getElementById('search-pickup').value;
      const returnDate = document.getElementById('search-return').value;

      if (pickup && returnDate && returnDate < pickup) {
        showToast('Return date must be after pickup date.', 'warning');
        return;
      }

      const qs = buildQueryString({ type, location_id: locationId, pickup_date: pickup, return_date: returnDate });
      window.location.href = `/pages/search.html${qs}`;
    });
  }

  // Featured vehicles
  loadFeaturedVehicles();
}

async function loadFeaturedVehicles() {
  const container = document.getElementById('featured-vehicles');
  if (!container) return;

  showSpinner('featured-vehicles');

  try {
    const vehicles = await getVehicles({});
    const list = Array.isArray(vehicles) ? vehicles : (vehicles.items || vehicles.data || []);
    const featured = list.slice(0, 6);

    if (featured.length === 0) {
      container.innerHTML = renderEmptyState('No vehicles available', 'Check back soon!');
      return;
    }

    container.innerHTML = `<div class="grid-3">${featured.map(renderVehicleCard).join('')}</div>`;
  } catch (err) {
    container.innerHTML = renderEmptyState('Could not load vehicles', 'Please try refreshing the page.');
  }
}

/* ─────────────────────────────────────────────────────────────
   SEARCH PAGE
───────────────────────────────────────────────────────────── */

async function initSearch() {
  initHamburger();

  // Read filters from URL
  const filters = {
    type:          getQueryParam('type')         || '',
    location_id:   getQueryParam('location_id')  || '',
    pickup_date:   getQueryParam('pickup_date')   || '',
    return_date:   getQueryParam('return_date')   || '',
    min_price:     getQueryParam('min_price')     || '',
    max_price:     getQueryParam('max_price')     || '',
    transmission:  getQueryParam('transmission')  || '',
  };

  // Pre-fill filter sidebar inputs
  setInputValue('filter-type',         filters.type);
  setInputValue('filter-transmission', filters.transmission);
  setInputValue('filter-min-price',    filters.min_price);
  setInputValue('filter-max-price',    filters.max_price);

  // Load location options into sidebar filter
  await loadLocationOptions('filter-location');
  setInputValue('filter-location', filters.location_id);

  // Fetch and render results
  await fetchAndRenderVehicles(filters);

  // Sort change — re-render without re-fetching
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      const container = document.getElementById('vehicles-grid');
      if (!container || _lastFetchedVehicles.length === 0) return;
      const sorted = _sortVehicles(_lastFetchedVehicles, this.value);
      container.innerHTML = `<div class="grid-3">${sorted.map(renderVehicleCard).join('')}</div>`;
    });
  }

  // Filter form change handlers
  const filterForm = document.getElementById('filter-form');
  if (filterForm) {
    filterForm.addEventListener('change', debounce(applyFilters, 400));
    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      applyFilters();
    });

    // Reset filters button
    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        filterForm.reset();
        applyFilters();
      });
    }
  }
}

function applyFilters() {
  const filters = {
    type:         getInputValue('filter-type'),
    location_id:  getInputValue('filter-location'),
    pickup_date:  getQueryParam('pickup_date') || '',
    return_date:  getQueryParam('return_date') || '',
    min_price:    getInputValue('filter-min-price'),
    max_price:    getInputValue('filter-max-price'),
    transmission: getInputValue('filter-transmission'),
  };

  // Update URL without reload so the URL is shareable
  const qs = buildQueryString(filters);
  window.history.replaceState({}, '', `/pages/search.html${qs}`);

  fetchAndRenderVehicles(filters);
}

let _lastFetchedVehicles = [];

function _sortVehicles(vehicles, sortVal) {
  const statusOrder = { available: 0, maintenance: 1, rented: 2 };
  const v = vehicles.slice();
  if (sortVal === 'price_asc')  return v.sort((a, b) => a.daily_rate - b.daily_rate);
  if (sortVal === 'price_desc') return v.sort((a, b) => b.daily_rate - a.daily_rate);
  if (sortVal === 'availability') return v.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  return v;
}

async function fetchAndRenderVehicles(filters) {
  const container   = document.getElementById('vehicles-grid');
  const countEl     = document.getElementById('results-count');
  if (!container) return;

  showSpinner('vehicles-grid');

  try {
    const result   = await getVehicles(filters);
    _lastFetchedVehicles = Array.isArray(result) ? result : (result.items || result.data || []);

    if (countEl) {
      countEl.textContent = `${_lastFetchedVehicles.length} vehicle${_lastFetchedVehicles.length !== 1 ? 's' : ''} found`;
    }

    if (_lastFetchedVehicles.length === 0) {
      container.innerHTML = renderEmptyState(
        'No vehicles found',
        'Try adjusting your filters or search dates.',
        '🚗'
      );
      return;
    }

    const sortVal = (document.getElementById('sort-select') || {}).value || 'default';
    const sorted  = _sortVehicles(_lastFetchedVehicles, sortVal);
    container.innerHTML = `<div class="grid-3">${sorted.map(renderVehicleCard).join('')}</div>`;
  } catch (err) {
    container.innerHTML = renderEmptyState('Could not load vehicles', err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   VEHICLE DETAIL PAGE
───────────────────────────────────────────────────────────── */

async function initVehicleDetail() {
  initHamburger();

  const vehicleId = getQueryParam('id');
  if (!vehicleId) {
    window.location.href = '/pages/search.html';
    return;
  }

  const container = document.getElementById('vehicle-detail-content');
  showSpinner('vehicle-detail-content');

  try {
    const vehicle = await getVehicle(vehicleId);
    renderVehicleDetail(vehicle);
  } catch (err) {
    if (container) {
      container.innerHTML = renderEmptyState('Vehicle not found', err.message, '🚫');
    }
    return;
  }

  // Load reviews
  loadVehicleReviews(vehicleId);

  // Check if logged-in customer can submit a review
  initReviewForm(vehicleId);
}

function renderVehicleDetail(vehicle) {
  const container = document.getElementById('vehicle-detail-content');
  if (!container) return;

  const imgHtml = vehicle.image_url
    ? `<img src="${escapeHtml(vehicle.image_url)}" alt="${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}">`
    : `<div class="vehicle-gallery-placeholder">${escapeHtml(vehicle.type || 'Vehicle')}</div>`;

  const ratingHtml = vehicle.avg_rating
    ? `<div class="rating-avg">
         <span class="rating-big">${Number(vehicle.avg_rating).toFixed(1)}</span>
         ${buildStars(vehicle.avg_rating)}
         <span class="text-muted" style="font-size:0.875rem;">avg rating</span>
       </div>`
    : '<p class="text-muted" style="font-size:0.875rem;">No reviews yet.</p>';

  // Spec grid items
  const specs = [
    vehicle.type         && { label: 'Type',         value: capitalize(vehicle.type) },
    vehicle.year         && { label: 'Year',          value: vehicle.year },
    vehicle.transmission && { label: 'Transmission',  value: capitalize(vehicle.transmission) },
    vehicle.fuel_type    && { label: 'Fuel Type',     value: capitalize(vehicle.fuel_type) },
    vehicle.seats        && { label: 'Seats',         value: vehicle.seats },
    vehicle.color        && { label: 'Color',         value: capitalize(vehicle.color) },
    vehicle.plate_number && { label: 'Plate',         value: vehicle.plate_number },
  ].filter(Boolean);

  const specGridHtml = `
    <div class="spec-grid">
      ${specs.map(s => `
        <div class="spec-box">
          <span class="spec-box-label">${escapeHtml(s.label)}</span>
          <span class="spec-box-value">${escapeHtml(String(s.value))}</span>
        </div>
      `).join('')}
    </div>
  `;

  // Best-for tags derived from vehicle type
  const bestForMap = {
    car:        ['City Driving', 'Family Trips', 'Road Trips'],
    motorcycle: ['Commuting', 'City Navigation', 'Fuel Efficiency'],
    suv:        ['Off-Road', 'Family Trips', 'Long Drives'],
    van:        ['Group Travel', 'Cargo', 'Road Trips'],
    truck:      ['Heavy Cargo', 'Commercial Use', 'Towing'],
  };
  const bestForTags = (bestForMap[vehicle.type] || ['Versatile Use']).map(
    tag => `<span class="best-for-tag">${escapeHtml(tag)}</span>`
  ).join('');

  // Reserve card (only when available)
  const reserveCardHtml = vehicle.status === 'available' ? `
    <div class="reserve-card" id="reserve-card">
      <h3>Quick Reserve</h3>
      <p class="text-muted" style="font-size:0.875rem;margin-bottom:var(--spacing-md);">Hold this vehicle for your dates. No payment needed now.</p>
      <div class="form-group">
        <label for="reserve-pickup">Pickup Date</label>
        <input type="date" id="reserve-pickup" />
      </div>
      <div class="form-group">
        <label for="reserve-return">Return Date</label>
        <input type="date" id="reserve-return" />
      </div>
      <button class="btn btn-primary btn-block" id="reserve-btn" type="button">Reserve Vehicle</button>
      <p class="text-muted" style="font-size:0.75rem;margin-top:var(--spacing-sm);text-align:center;">Complete payment later in My Bookings.</p>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="detail-layout">
      <!-- Left: gallery + info -->
      <div>
        <div class="vehicle-gallery">
          ${imgHtml}
        </div>
        <div class="vehicle-info-card mt-md">
          <div class="breadcrumb">
            <a href="/index.html">Home</a>
            <span class="sep">/</span>
            <a href="/pages/search.html">Vehicles</a>
            <span class="sep">/</span>
            <span>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</span>
          </div>
          <h1 style="font-size:1.75rem;">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h1>
          <p class="text-muted" style="margin-bottom:var(--spacing-sm);">${vehicle.year || ''} · ${escapeHtml(capitalize(vehicle.type || ''))}</p>

          ${ratingHtml}

          ${specGridHtml}

          ${vehicle.description
            ? `<div class="mt-md">
                 <h3 style="font-size:1rem;margin-bottom:var(--spacing-xs);">About this vehicle</h3>
                 <p style="color:var(--color-text-muted);">${escapeHtml(vehicle.description)}</p>
               </div>`
            : ''}

          <div class="mt-md">
            <h3 style="font-size:1rem;margin-bottom:var(--spacing-sm);">Best for</h3>
            <div class="best-for-tags">${bestForTags}</div>
          </div>

          ${vehicle.location
            ? `<p class="mt-md"><strong>Pickup location:</strong> ${escapeHtml(vehicle.location.name || vehicle.location)}</p>`
            : ''}
        </div>
      </div>

      <!-- Right: booking CTA -->
      <div>
        <div style="position:sticky;top:80px;">
          <div class="booking-summary-box">
            <h3>Book This Vehicle</h3>
            <div class="vehicle-price-box">
              <div>
                <div style="font-size:0.8rem;color:var(--color-text-muted);">Daily rate</div>
                <div class="vehicle-price-big">
                  ${formatCurrency(vehicle.daily_rate)}
                  <small>/ day</small>
                </div>
              </div>
              <span class="badge ${vehicle.status === 'available' ? 'status-available' : 'status-maintenance'}">
                ${escapeHtml(capitalize(vehicle.status || 'available'))}
              </span>
            </div>

            ${vehicle.status === 'available'
              ? `<a href="/pages/booking.html?vehicle_id=${vehicle.id}" class="btn btn-primary btn-block btn-lg">
                   Book Now
                 </a>`
              : `<button class="btn btn-secondary btn-block btn-lg" disabled>
                   Not Available
                 </button>`
            }

            <div class="mt-md" style="font-size:0.8125rem;color:var(--color-text-muted);text-align:center;">
              Free cancellation on pending bookings
            </div>
          </div>

          ${reserveCardHtml}
        </div>
      </div>
    </div>

    <!-- Reviews section rendered separately -->
    <div id="reviews-section" class="reviews-section"></div>
    <div id="review-form-section"></div>
  `;

  // Reserve button handler
  const reserveBtn = document.getElementById('reserve-btn');
  if (reserveBtn) {
    reserveBtn.addEventListener('click', async function () {
      if (!isLoggedIn()) {
        window.location.href = '/pages/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
      }
      const pickup = document.getElementById('reserve-pickup').value;
      const ret    = document.getElementById('reserve-return').value;
      if (!pickup || !ret) { showToast('Please select both dates.', 'warning'); return; }
      if (ret <= pickup)   { showToast('Return date must be after pickup date.', 'warning'); return; }

      reserveBtn.disabled = true;
      reserveBtn.textContent = 'Reserving…';
      try {
        await createBooking({
          vehicle_id:          vehicle.id,
          pickup_location_id:  vehicle.location_id,
          return_location_id:  vehicle.location_id,
          pickup_date:         pickup,
          return_date:         ret,
          addons:              [],
        });
        showToast('Vehicle reserved! View it in My Bookings.', 'success');
        reserveBtn.textContent = 'Reserved ✓';
      } catch (err) {
        showToast(err.message || 'Could not reserve vehicle.', 'error');
        reserveBtn.disabled = false;
        reserveBtn.textContent = 'Reserve Vehicle';
      }
    });
  }
}

async function loadVehicleReviews(vehicleId) {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  try {
    const result  = await getVehicleReviews(vehicleId);
    const reviews = Array.isArray(result) ? result : (result.items || result.data || []);

    if (reviews.length === 0) {
      container.innerHTML = '<h3>Reviews</h3><p class="text-muted">No reviews yet. Be the first!</p>';
      return;
    }

    const reviewsHtml = reviews.map(r => `
      <div class="review-card">
        <div class="review-header">
          <span class="review-author">${escapeHtml(r.user?.full_name || 'Anonymous')}</span>
          ${buildStars(r.rating)}
        </div>
        <p style="font-size:0.9rem;color:var(--color-text-muted);">${escapeHtml(r.comment || '')}</p>
        <small class="text-muted">${formatDate(r.created_at)}</small>
      </div>
    `).join('');

    container.innerHTML = `<h3>Reviews (${reviews.length})</h3>${reviewsHtml}`;
  } catch (_) {
    // Non-critical, don't show error
    container.innerHTML = '';
  }
}

async function initReviewForm(vehicleId) {
  const container = document.getElementById('review-form-section');
  if (!container || !isLoggedIn()) return;

  const user = getUser();
  if (!user || user.role !== 'customer') return;

  // Check if user has a completed booking for this vehicle without a review
  try {
    const result   = await getMyBookings({ status: 'completed' });
    const bookings = Array.isArray(result) ? result : (result.items || result.data || []);
    const eligible = bookings.find(
      b => String(b.vehicle_id) === String(vehicleId) && !b.has_review
    );
    if (!eligible) return;

    container.innerHTML = `
      <div class="profile-section mt-xl">
        <h3>Leave a Review</h3>
        <form id="review-form">
          <div class="form-group">
            <label for="review-rating">Rating <span class="required">*</span></label>
            <select id="review-rating" required>
              <option value="">Select rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Terrible</option>
            </select>
          </div>
          <div class="form-group">
            <label for="review-comment">Comment</label>
            <textarea id="review-comment" placeholder="Share your experience..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit Review</button>
        </form>
      </div>
    `;

    document.getElementById('review-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const rating  = parseInt(document.getElementById('review-rating').value, 10);
      const comment = document.getElementById('review-comment').value.trim();
      const btn     = this.querySelector('[type="submit"]');

      if (!rating) {
        showFieldError('review-rating', 'Please select a rating.');
        return;
      }

      setButtonLoading(btn, 'Submitting...');
      try {
        await createReview(eligible.id, rating, comment);
        showToast('Review submitted. Thank you!', 'success');
        container.innerHTML = '<div class="alert alert-success">Your review has been submitted.</div>';
        loadVehicleReviews(vehicleId);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setButtonReady(btn);
      }
    });
  } catch (_) {
    // Silently ignore
  }
}

/* ─────────────────────────────────────────────────────────────
   BOOKING PAGE
───────────────────────────────────────────────────────────── */

async function initBooking() {
  checkAuth();
  initHamburger();

  const vehicleId = getQueryParam('vehicle_id');
  if (!vehicleId) {
    window.location.href = '/pages/search.html';
    return;
  }

  // Load vehicle info
  let vehicle = null;
  try {
    vehicle = await getVehicle(vehicleId);
    renderBookingVehicleSummary(vehicle);
  } catch (err) {
    showToast('Could not load vehicle details: ' + err.message, 'error');
    return;
  }

  // Load locations
  await loadLocationOptions('pickup-location');
  await loadLocationOptions('return-location');

  // Set min dates
  const today = todayString();
  const pickupInput = document.getElementById('pickup-date');
  const returnInput = document.getElementById('return-date');
  if (pickupInput) pickupInput.min = today;
  if (returnInput) returnInput.min = today;

  // Live price calculation
  function recalcPrice() {
    const pickup   = pickupInput ? pickupInput.value : '';
    const returnD  = returnInput ? returnInput.value : '';
    const days     = calculateDays(pickup, returnD);
    const rate     = vehicle ? (vehicle.daily_rate || 0) : 0;
    let addonTotal = 0;

    document.querySelectorAll('.addon-checkbox:checked').forEach(cb => {
      addonTotal += parseFloat(cb.dataset.price || 0) * days;
    });

    const subtotal = days * rate;
    const total    = subtotal + addonTotal;

    setInnerText('price-days',    days ? `${days} day${days !== 1 ? 's' : ''}` : '—');
    setInnerText('price-rate',    formatCurrency(rate) + '/day');
    setInnerText('price-subtotal', formatCurrency(subtotal));
    setInnerText('price-addons',  formatCurrency(addonTotal));
    setInnerText('price-total',   formatCurrency(total));
  }

  // Attach change listeners for recalc
  if (pickupInput) {
    pickupInput.addEventListener('change', function () {
      if (returnInput && returnInput.value < this.value) returnInput.value = this.value;
      returnInput.min = this.value || today;
      recalcPrice();
    });
  }
  if (returnInput) {
    returnInput.addEventListener('change', recalcPrice);
  }
  document.querySelectorAll('.addon-checkbox').forEach(cb => {
    cb.addEventListener('change', function () {
      // Toggle selected class on parent
      const item = this.closest('.addon-item');
      if (item) item.classList.toggle('selected', this.checked);
      recalcPrice();
    });
  });

  recalcPrice(); // initial

  // Booking form submission
  const form = document.getElementById('booking-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllFieldErrors(form);

    const pickup_location_id = parseInt(getInputValue('pickup-location'), 10);
    const return_location_id = parseInt(getInputValue('return-location'), 10);
    const pickup_date        = getInputValue('pickup-date');
    const return_date        = getInputValue('return-date');
    const submitBtn          = form.querySelector('[type="submit"]');

    // Validation
    let valid = true;
    if (!pickup_location_id) { showFieldError('pickup-location', 'Select a pickup location.'); valid = false; }
    if (!return_location_id) { showFieldError('return-location', 'Select a return location.');  valid = false; }
    if (!pickup_date)        { showFieldError('pickup-date', 'Select a pickup date.');           valid = false; }
    if (!return_date)        { showFieldError('return-date', 'Select a return date.');           valid = false; }
    if (pickup_date && return_date && return_date <= pickup_date) {
      showFieldError('return-date', 'Return date must be after pickup date.');
      valid = false;
    }
    if (pickup_date && pickup_date < todayString()) {
      showFieldError('pickup-date', 'Pickup date cannot be in the past.');
      valid = false;
    }
    if (!valid) return;

    // Collect addons
    const addons = [];
    document.querySelectorAll('.addon-checkbox:checked').forEach(cb => {
      addons.push({ addon_type: cb.dataset.addon });
    });

    setButtonLoading(submitBtn, 'Creating booking...');

    try {
      const result = await createBooking({
        vehicle_id:         parseInt(vehicleId, 10),
        pickup_location_id,
        return_location_id,
        pickup_date,
        return_date,
        addons,
      });
      const bookingId = result.id || result.booking_id;
      showToast('Booking created successfully!', 'success');
      setTimeout(() => {
        window.location.href = `/pages/booking-confirmation.html?id=${bookingId}`;
      }, 600);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonReady(submitBtn);
    }
  });
}

function renderBookingVehicleSummary(vehicle) {
  const el = document.getElementById('booking-vehicle-summary');
  if (!el) return;

  const imgHtml = vehicle.image_url
    ? `<img src="${escapeHtml(vehicle.image_url)}" alt="${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius);">`
    : `<div style="height:80px;background:var(--color-bg);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);">${escapeHtml(vehicle.type || 'Vehicle')}</div>`;

  el.innerHTML = `
    ${imgHtml}
    <div class="mt-md">
      <h4>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} ${vehicle.year ? `(${vehicle.year})` : ''}</h4>
      <p class="text-muted" style="font-size:0.875rem;margin-bottom:var(--spacing-sm);">
        ${escapeHtml(capitalize(vehicle.type || ''))} • ${escapeHtml(capitalize(vehicle.transmission || ''))}
      </p>
      <div class="vehicle-price-big" style="font-size:1.5rem;">${formatCurrency(vehicle.daily_rate)} <small>/ day</small></div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   BOOKING CONFIRMATION PAGE
───────────────────────────────────────────────────────────── */

async function initBookingConfirmation() {
  initHamburger();

  const bookingId = getQueryParam('id');
  if (!bookingId) {
    window.location.href = '/pages/my-bookings.html';
    return;
  }

  const container = document.getElementById('confirmation-content');
  showSpinner('confirmation-content');

  try {
    const booking = await getBooking(bookingId);
    renderConfirmation(booking);
  } catch (err) {
    if (container) container.innerHTML = renderEmptyState('Booking not found', err.message, '🚫');
  }
}

function renderConfirmation(booking) {
  const container = document.getElementById('confirmation-content');
  if (!container) return;

  const vehicle     = booking.vehicle || {};
  const pickup_loc  = booking.pickup_location  || {};
  const return_loc  = booking.return_location  || {};
  const vehicleName = vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : 'Vehicle';

  container.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-icon" aria-hidden="true">✓</div>
      <h2>Booking Confirmed!</h2>
      <p class="text-muted" style="margin-top:var(--spacing-sm);">
        Your rental request has been submitted successfully.
      </p>
      <div class="confirmation-id">
        Booking ID: <strong>#${booking.id}</strong>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <label>Vehicle</label>
          <span>${escapeHtml(vehicleName)}</span>
        </div>
        <div class="detail-item">
          <label>Status</label>
          <span>${renderStatusBadge(booking.status)}</span>
        </div>
        <div class="detail-item">
          <label>Pickup Date</label>
          <span>${formatDate(booking.pickup_date)}</span>
        </div>
        <div class="detail-item">
          <label>Return Date</label>
          <span>${formatDate(booking.return_date)}</span>
        </div>
        <div class="detail-item">
          <label>Pickup Location</label>
          <span>${escapeHtml(pickup_loc.name || '—')}</span>
        </div>
        <div class="detail-item">
          <label>Return Location</label>
          <span>${escapeHtml(return_loc.name || '—')}</span>
        </div>
        <div class="detail-item">
          <label>Duration</label>
          <span>${calculateDays(booking.pickup_date, booking.return_date)} day(s)</span>
        </div>
        <div class="detail-item">
          <label>Total Amount</label>
          <span style="color:var(--color-primary);font-weight:800;">${formatCurrency(booking.total_amount)}</span>
        </div>
      </div>

      ${booking.status === 'pending'
        ? `<a href="/pages/payment.html?booking_id=${booking.id}" class="btn btn-primary btn-block btn-lg mb-md">
             Pay Now — ${formatCurrency(booking.total_amount)}
           </a>`
        : ''
      }

      <a href="/pages/my-bookings.html" class="btn btn-secondary btn-block">
        View My Bookings
      </a>

      <p class="text-muted mt-md" style="font-size:0.8125rem;">
        You will receive a confirmation once staff reviews your booking.
        Please check your bookings page for updates.
      </p>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   PAYMENT PAGE
───────────────────────────────────────────────────────────── */

async function initPayment() {
  checkAuth();
  initHamburger();

  const bookingId = getQueryParam('booking_id');
  if (!bookingId) {
    window.location.href = '/pages/my-bookings.html';
    return;
  }

  // Load booking details to show amount
  try {
    const booking = await getBooking(bookingId);
    const amountEl = document.getElementById('payment-amount');
    const vehicleEl = document.getElementById('payment-vehicle');
    if (amountEl) amountEl.textContent = formatCurrency(booking.total_amount);
    if (vehicleEl && booking.vehicle) {
      vehicleEl.textContent = `${booking.vehicle.brand} ${booking.vehicle.model}`;
    }
  } catch (err) {
    showToast('Could not load booking details.', 'error');
  }

  // Payment form
  const form = document.getElementById('payment-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const methodInput = form.querySelector('input[name="payment-method"]:checked');
    const submitBtn   = form.querySelector('[type="submit"]');

    if (!methodInput) {
      showToast('Please select a payment method.', 'warning');
      return;
    }

    setButtonLoading(submitBtn, 'Processing payment...');

    try {
      await createPayment(parseInt(bookingId, 10), methodInput.value);
      showToast('Payment submitted successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/pages/my-bookings.html';
      }, 1000);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonReady(submitBtn);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   MY BOOKINGS PAGE
───────────────────────────────────────────────────────────── */

async function initMyBookings() {
  checkAuth();
  requireRole(['customer']);
  initHamburger();

  let currentFilter = getQueryParam('status') || 'all';
  setActiveTab(currentFilter);

  await loadMyBookings(currentFilter);

  // Tab click handlers
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      currentFilter = this.dataset.status;
      setActiveTab(currentFilter);
      loadMyBookings(currentFilter);
    });
  });
}

async function loadMyBookings(statusFilter) {
  const container = document.getElementById('bookings-table-body');
  const wrapper   = document.getElementById('bookings-table-wrapper');
  if (!container) return;

  if (wrapper) wrapper.style.opacity = '0.5';

  try {
    const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
    const result  = await getMyBookings(filters);
    const bookings = Array.isArray(result) ? result : (result.items || result.data || []);

    if (wrapper) wrapper.style.opacity = '1';

    if (bookings.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:var(--spacing-xl);">
            ${renderEmptyState('No bookings found', 'You have no bookings in this category.', '📋')}
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = bookings.map(renderBookingRow).join('');
  } catch (err) {
    if (wrapper) wrapper.style.opacity = '1';
    showToast(err.message, 'error');
  }
}

function setActiveTab(status) {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.status === status);
  });
}

// Exposed to inline onclick handlers in rendered rows
async function handleCancelBooking(bookingId) {
  const confirmed = await confirmDialog('Are you sure you want to cancel this booking? This cannot be undone.');
  if (!confirmed) return;

  try {
    await cancelBooking(bookingId);
    showToast('Booking cancelled.', 'success');
    const tab = document.querySelector('.status-tab.active');
    loadMyBookings(tab ? tab.dataset.status : 'all');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────── */

async function initProfile() {
  checkAuth();
  initHamburger();

  // Load current user data
  try {
    const user = await getMe();
    setInputValue('profile-name',  user.full_name);
    setInputValue('profile-email', user.email);
    setInputValue('profile-phone', user.phone);

    // Also update localStorage with fresh data
    const localUser = getUser();
    if (localUser) {
      saveAuth(localStorage.getItem('token'), { ...localUser, ...user });
    }
  } catch (err) {
    showToast('Could not load profile: ' + err.message, 'error');
  }

  // Profile update form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearAllFieldErrors(profileForm);

      const full_name = getInputValue('profile-name');
      const phone     = getInputValue('profile-phone');
      const submitBtn = profileForm.querySelector('[type="submit"]');

      if (!full_name) { showFieldError('profile-name', 'Name is required.'); return; }
      if (!phone)     { showFieldError('profile-phone', 'Phone is required.'); return; }

      setButtonLoading(submitBtn, 'Saving...');
      try {
        const updated = await updateMe({ full_name, phone });
        // Update localStorage
        const localUser = getUser();
        if (localUser) {
          saveAuth(localStorage.getItem('token'), { ...localUser, full_name, phone });
        }
        showToast('Profile updated successfully!', 'success');
        updateNav();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setButtonReady(submitBtn);
      }
    });
  }

  // Password change form
  const pwForm = document.getElementById('password-form');
  if (pwForm) {
    pwForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearAllFieldErrors(pwForm);

      const current     = getInputValue('current-password');
      const newPw       = getInputValue('new-password');
      const confirmPw   = getInputValue('confirm-new-password');
      const submitBtn   = pwForm.querySelector('[type="submit"]');

      let valid = true;
      if (!current) { showFieldError('current-password', 'Current password is required.'); valid = false; }
      if (!newPw)   { showFieldError('new-password',     'New password is required.');     valid = false; }
      else if (newPw.length < 8) { showFieldError('new-password', 'Password must be at least 8 characters.'); valid = false; }
      if (newPw !== confirmPw) { showFieldError('confirm-new-password', 'Passwords do not match.'); valid = false; }
      if (!valid) return;

      setButtonLoading(submitBtn, 'Updating...');
      try {
        await changePassword(current, newPw);
        showToast('Password changed successfully!', 'success');
        pwForm.reset();
      } catch (err) {
        showToast(err.message, 'error');
        if (err.message.toLowerCase().includes('current') || err.message.toLowerCase().includes('incorrect')) {
          showFieldError('current-password', 'Current password is incorrect.');
        }
      } finally {
        setButtonReady(submitBtn);
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN: DASHBOARD
───────────────────────────────────────────────────────────── */

async function initAdminDashboard() {
  checkAuth();
  requireRole(['staff', 'manager']);
  initHamburger();

  const user = getUser();

  // Hide reports nav link for non-managers
  document.querySelectorAll('[data-manager-only]').forEach(el => {
    el.style.display = (user && user.role === 'manager') ? '' : 'none';
  });

  // Load stat summary
  await loadDashboardStats();

  // Load recent bookings
  await loadRecentBookings();
}

async function loadDashboardStats() {
  try {
    const result   = await getAllBookings({ limit: 100 });
    const bookings = Array.isArray(result) ? result : (result.items || result.data || []);

    const active    = bookings.filter(b => b.status === 'active').length;
    const pending   = bookings.filter(b => b.status === 'pending').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const today     = todayString();
    const todayPickups  = bookings.filter(b => b.pickup_date  === today && b.status === 'confirmed').length;
    const todayReturns  = bookings.filter(b => b.return_date  === today && b.status === 'active').length;

    setInnerText('stat-active',        String(active));
    setInnerText('stat-pending',       String(pending));
    setInnerText('stat-confirmed',     String(confirmed));
    setInnerText('stat-today-pickups', String(todayPickups));
    setInnerText('stat-today-returns', String(todayReturns));
  } catch (_) {
    // Stats are non-critical
  }
}

async function loadRecentBookings() {
  const container = document.getElementById('recent-bookings-body');
  if (!container) return;

  try {
    const result   = await getAllBookings({ limit: 10 });
    const bookings = Array.isArray(result) ? result : (result.items || result.data || []);

    if (bookings.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--spacing-lg);">No recent bookings.</td></tr>`;
      return;
    }

    container.innerHTML = bookings.slice(0, 10).map(renderAdminBookingRow).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="text-danger" style="padding:var(--spacing-md);">Could not load bookings.</td></tr>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN: BOOKINGS
───────────────────────────────────────────────────────────── */

async function initAdminBookings() {
  checkAuth();
  requireRole(['staff', 'manager']);
  initHamburger();

  let currentStatus = getQueryParam('status') || 'all';
  setActiveTab(currentStatus);

  await loadAdminBookings(currentStatus);

  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      currentStatus = this.dataset.status;
      setActiveTab(currentStatus);
      loadAdminBookings(currentStatus);
    });
  });
}

async function loadAdminBookings(statusFilter) {
  const container = document.getElementById('admin-bookings-body');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="7"><div class="spinner-overlay"><div class="spinner"></div></div></td></tr>`;

  try {
    const filters  = statusFilter !== 'all' ? { status: statusFilter } : {};
    const result   = await getAllBookings(filters);
    const bookings = Array.isArray(result) ? result : (result.items || result.data || []);

    if (bookings.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--spacing-xl);">No bookings found.</td></tr>`;
      return;
    }

    container.innerHTML = bookings.map(renderAdminBookingRow).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--spacing-md);color:var(--color-danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

// Admin booking action handlers (called from inline onclick in renderAdminBookingRow)
async function handleAdminConfirm(id) {
  if (!await confirmDialog('Confirm this booking?')) return;
  try {
    await confirmBooking(id);
    showToast('Booking confirmed.', 'success');
    refreshAdminBookingRow(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleAdminPickup(id) {
  if (!await confirmDialog('Mark this booking as picked up?')) return;
  try {
    await pickupBooking(id);
    showToast('Marked as active (picked up).', 'success');
    refreshAdminBookingRow(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleAdminReturn(id) {
  if (!await confirmDialog('Mark this booking as returned?')) return;
  try {
    await returnBooking(id);
    showToast('Booking completed (returned).', 'success');
    refreshAdminBookingRow(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleAdminCancel(id) {
  if (!await confirmDialog('Cancel this booking? This cannot be undone.')) return;
  try {
    await cancelBooking(id);
    showToast('Booking cancelled.', 'success');
    refreshAdminBookingRow(id);
  } catch (err) { showToast(err.message, 'error'); }
}

async function refreshAdminBookingRow(id) {
  try {
    const booking = await getBooking(id);
    const row     = document.querySelector(`tr[data-booking-id="${id}"]`);
    if (row) {
      const newRow = document.createElement('tbody');
      newRow.innerHTML = renderAdminBookingRow(booking);
      row.parentNode.replaceChild(newRow.firstElementChild, row);
    }
  } catch (_) {
    // Fallback: reload all
    const tab = document.querySelector('.status-tab.active');
    loadAdminBookings(tab ? tab.dataset.status : 'all');
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN: VEHICLES
───────────────────────────────────────────────────────────── */

let _editingVehicleId = null;

async function initAdminVehicles() {
  checkAuth();
  requireRole(['staff', 'manager']);
  initHamburger();

  const user = getUser();

  // Load vehicles list
  await loadAdminVehicles();

  // Load locations for vehicle form
  await loadLocationOptions('vehicle-location');

  // Add vehicle button → open modal
  const addBtn = document.getElementById('add-vehicle-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      _editingVehicleId = null;
      document.getElementById('vehicle-modal-title').textContent = 'Add New Vehicle';
      document.getElementById('vehicle-form').reset();
      openModal('vehicle-modal');
    });
  }

  // Vehicle form submit
  const vehicleForm = document.getElementById('vehicle-form');
  if (vehicleForm) {
    vehicleForm.addEventListener('submit', handleVehicleFormSubmit);
  }

  // Modal close
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', function () {
      closeModal(this.dataset.closeModal);
    });
  });

  // Manager-only: show delete buttons
  document.querySelectorAll('[data-manager-only]').forEach(el => {
    el.style.display = (user && user.role === 'manager') ? '' : 'none';
  });
}

async function loadAdminVehicles() {
  const container = document.getElementById('vehicles-table-body');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="7"><div class="spinner-overlay"><div class="spinner"></div></div></td></tr>`;

  try {
    const result   = await getVehicles({});
    const vehicles = Array.isArray(result) ? result : (result.items || result.data || []);
    const user     = getUser();

    if (vehicles.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--spacing-xl);">No vehicles found.</td></tr>`;
      return;
    }

    container.innerHTML = vehicles.map(v => {
      const deleteBtn = (user && user.role === 'manager')
        ? `<button class="btn btn-danger btn-sm" onclick="handleDeleteVehicle(${v.id})">Delete</button>`
        : '';
      return `
        <tr data-vehicle-id="${v.id}">
          <td><code style="font-size:0.8rem">${escapeHtml(v.plate_number || '—')}</code></td>
          <td><strong>${escapeHtml(v.brand)} ${escapeHtml(v.model)}</strong><br><small class="text-muted">${v.year || ''}</small></td>
          <td><span class="badge badge-type">${escapeHtml(capitalize(v.type || ''))}</span></td>
          <td>${escapeHtml(v.location?.name || '—')}</td>
          <td>${formatCurrency(v.daily_rate)}</td>
          <td>${renderStatusBadge(v.status || 'available')}</td>
          <td>
            <div class="actions">
              <button class="btn btn-secondary btn-sm" onclick="handleEditVehicle(${v.id})">Edit</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="color:var(--color-danger);padding:var(--spacing-md);">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function handleVehicleFormSubmit(e) {
  e.preventDefault();
  clearAllFieldErrors(this);

  const data = {
    plate_number:  getInputValue('vehicle-plate'),
    brand:         getInputValue('vehicle-brand'),
    model:         getInputValue('vehicle-model'),
    year:          parseInt(getInputValue('vehicle-year'), 10) || undefined,
    type:          getInputValue('vehicle-type'),
    transmission:  getInputValue('vehicle-transmission'),
    fuel_type:     getInputValue('vehicle-fuel'),
    seats:         parseInt(getInputValue('vehicle-seats'), 10) || undefined,
    daily_rate:    parseFloat(getInputValue('vehicle-rate')) || undefined,
    location_id:   parseInt(getInputValue('vehicle-location'), 10) || undefined,
    status:        getInputValue('vehicle-status'),
    description:   getInputValue('vehicle-description'),
    image_url:     getInputValue('vehicle-image') || undefined,
  };

  const submitBtn = this.querySelector('[type="submit"]');
  let valid = true;

  if (!data.plate_number) { showFieldError('vehicle-plate',  'Plate number is required.'); valid = false; }
  if (!data.brand)        { showFieldError('vehicle-brand',  'Brand is required.');         valid = false; }
  if (!data.model)        { showFieldError('vehicle-model',  'Model is required.');          valid = false; }
  if (!data.type)         { showFieldError('vehicle-type',   'Vehicle type is required.');   valid = false; }
  if (!data.daily_rate)   { showFieldError('vehicle-rate',   'Daily rate is required.');     valid = false; }
  if (!data.location_id)  { showFieldError('vehicle-location','Location is required.');      valid = false; }
  if (!valid) return;

  setButtonLoading(submitBtn, 'Saving...');

  try {
    if (_editingVehicleId) {
      await updateVehicle(_editingVehicleId, data);
      showToast('Vehicle updated.', 'success');
    } else {
      await createVehicle(data);
      showToast('Vehicle added.', 'success');
    }
    closeModal('vehicle-modal');
    loadAdminVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonReady(submitBtn);
  }
}

async function handleEditVehicle(id) {
  _editingVehicleId = id;
  try {
    const vehicle = await getVehicle(id);
    setInputValue('vehicle-plate',       vehicle.plate_number   || '');
    setInputValue('vehicle-brand',       vehicle.brand          || '');
    setInputValue('vehicle-model',       vehicle.model          || '');
    setInputValue('vehicle-year',        vehicle.year           || '');
    setInputValue('vehicle-type',        vehicle.type           || '');
    setInputValue('vehicle-transmission',vehicle.transmission   || '');
    setInputValue('vehicle-fuel',        vehicle.fuel_type      || '');
    setInputValue('vehicle-seats',       vehicle.seats          || '');
    setInputValue('vehicle-rate',        vehicle.daily_rate     || '');
    setInputValue('vehicle-location',    vehicle.location_id    || vehicle.location?.id || '');
    setInputValue('vehicle-status',      vehicle.status         || 'available');
    setInputValue('vehicle-description', vehicle.description    || '');
    setInputValue('vehicle-image',       vehicle.image_url      || '');

    document.getElementById('vehicle-modal-title').textContent = 'Edit Vehicle';
    openModal('vehicle-modal');
  } catch (err) {
    showToast('Could not load vehicle: ' + err.message, 'error');
  }
}

async function handleDeleteVehicle(id) {
  if (!await confirmDialog('Permanently delete this vehicle? This cannot be undone.')) return;
  try {
    await deleteVehicle(id);
    showToast('Vehicle deleted.', 'success');
    loadAdminVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMIN: REPORTS
───────────────────────────────────────────────────────────── */

async function initAdminReports() {
  checkAuth();
  requireRole(['manager']);
  initHamburger();

  // Set default date range (last 30 days)
  const toDate   = todayString();
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  setInputValue('report-from', fromDate);
  setInputValue('report-to',   toDate);

  // Generate on load
  await generateReports(fromDate, toDate);

  // Form submit
  const form = document.getElementById('report-form');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const from = getInputValue('report-from');
      const to   = getInputValue('report-to');
      if (!from || !to) { showToast('Please select both dates.', 'warning'); return; }
      if (to < from)    { showToast('End date must be after start date.', 'warning'); return; }
      const submitBtn = this.querySelector('[type="submit"]');
      setButtonLoading(submitBtn, 'Generating...');
      await generateReports(from, to);
      setButtonReady(submitBtn);
    });
  }
}

async function generateReports(from, to) {
  // Revenue
  try {
    const rev = await getRevenueReport(from, to);
    renderRevenueReport(rev);
  } catch (err) {
    const el = document.getElementById('revenue-report');
    if (el) el.innerHTML = `<p class="text-danger">Could not load revenue data: ${escapeHtml(err.message)}</p>`;
  }

  // Vehicles utilization
  try {
    const veh = await getVehiclesReport(from, to);
    renderVehiclesReport(veh);
  } catch (err) {
    const el = document.getElementById('vehicles-report');
    if (el) el.innerHTML = `<p class="text-danger">Could not load vehicle data: ${escapeHtml(err.message)}</p>`;
  }

  // Top customers
  try {
    const cust = await getCustomersReport(from, to);
    renderCustomersReport(cust);
  } catch (err) {
    const el = document.getElementById('customers-report');
    if (el) el.innerHTML = `<p class="text-danger">Could not load customer data: ${escapeHtml(err.message)}</p>`;
  }
}

function renderRevenueReport(data) {
  const el = document.getElementById('revenue-report');
  if (!el) return;
  if (!data) { el.innerHTML = '<p class="text-muted">No revenue data.</p>'; return; }

  const totalRevenue  = data.total_revenue  || 0;
  const totalBookings = data.booking_count  || 0;
  const byType        = Array.isArray(data.by_vehicle_type) ? data.by_vehicle_type : [];

  const byTypeRows = byType.map(row => `
    <tr>
      <td>${escapeHtml(capitalize(row.vehicle_type || ''))}</td>
      <td>${row.booking_count || 0}</td>
      <td>${formatCurrency(row.total_revenue || 0)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="text-muted">No breakdown available.</td></tr>';

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
      <div class="stat-card" style="--stat-color:var(--color-success)">
        <span class="stat-label">Total Revenue</span>
        <span class="stat-value">${formatCurrency(totalRevenue)}</span>
      </div>
      <div class="stat-card" style="--stat-color:var(--color-primary)">
        <span class="stat-label">Total Bookings</span>
        <span class="stat-value">${totalBookings}</span>
      </div>
    </div>
    <h4 class="mt-lg mb-md">Revenue by Vehicle Type</h4>
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Type</th><th>Bookings</th><th>Revenue</th></tr></thead>
        <tbody>${byTypeRows}</tbody>
      </table>
    </div>
  `;
}

function renderVehiclesReport(data) {
  const el = document.getElementById('vehicles-report');
  if (!el) return;

  const vehicles = Array.isArray(data) ? data : (data?.items || data?.data || []);
  if (vehicles.length === 0) {
    el.innerHTML = '<p class="text-muted">No vehicle utilization data.</p>';
    return;
  }

  const rows = vehicles.map(v => `
    <tr>
      <td><strong>${escapeHtml(v.brand || '')} ${escapeHtml(v.model || '')}</strong><br>
        <small class="text-muted">${escapeHtml(v.plate_number || '')}</small></td>
      <td>${v.total_bookings || 0}</td>
      <td>${v.total_days_rented || 0}</td>
      <td>${formatCurrency(v.total_revenue || 0)}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Bookings</th>
            <th>Days Rented</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCustomersReport(data) {
  const el = document.getElementById('customers-report');
  if (!el) return;

  const customers = Array.isArray(data) ? data : (data?.items || data?.data || []);
  if (customers.length === 0) {
    el.innerHTML = '<p class="text-muted">No customer data.</p>';
    return;
  }

  const rows = customers.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.full_name || c.name || '—')}</strong></td>
      <td>${escapeHtml(c.email || '—')}</td>
      <td>${c.bookings_count || 0}</td>
      <td>${formatCurrency(c.total_spent || 0)}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Bookings</th>
            <th>Total Spent</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   SHARED HELPERS (DOM shortcuts)
───────────────────────────────────────────────────────────── */

/**
 * Safely set the value of a form input by ID.
 */
function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value !== null && value !== undefined ? value : '';
}

/**
 * Get the value of a form input by ID (trimmed).
 */
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/**
 * Set the text content of an element by ID.
 */
function setInnerText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Populate a <select> element with location options from the API.
 * @param {string} selectId
 */
async function loadLocationOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const locations = await getLocations();
    const list      = Array.isArray(locations) ? locations : (locations.items || locations.data || []);
    const current   = select.value; // preserve if already set

    // Keep placeholder option
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML  = '';
    if (placeholder) select.appendChild(placeholder);
    else {
      const opt   = document.createElement('option');
      opt.value   = '';
      opt.textContent = 'Select location';
      select.appendChild(opt);
    }

    list.forEach(loc => {
      const opt    = document.createElement('option');
      opt.value    = loc.id;
      opt.textContent = loc.name + (loc.city ? ` — ${loc.city}` : '');
      select.appendChild(opt);
    });

    if (current) select.value = current; // restore
  } catch (_) {
    // Non-critical — location dropdown stays empty
  }
}
