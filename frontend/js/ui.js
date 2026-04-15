/**
 * ui.js — DOM manipulation and reusable UI components.
 * Depends on: utils.js (must be loaded before ui.js)
 */

/* ── Toast container (created once, appended to body) ─────── */
let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a toast notification that auto-dismisses after 3 seconds.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
function showToast(message, type = 'info') {
  const container = _getToastContainer();

  const icons = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Dismiss notification">×</button>
  `;

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

  container.appendChild(toast);

  // Auto-dismiss after 3 seconds
  const timer = setTimeout(() => dismissToast(toast), 3000);
  toast._dismissTimer = timer;
}

function dismissToast(toast) {
  if (!toast || toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-hiding');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

/* ── Spinner ─────────────────────────────────────────────── */

/**
 * Insert a loading spinner inside the element with the given ID.
 * Replaces existing content; saves it in a data attribute for restoration.
 * @param {string} containerId
 */
function showSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.dataset.prevContent = el.innerHTML;
  el.innerHTML = `
    <div class="spinner-overlay" role="status" aria-label="Loading">
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * Remove the spinner from the element and restore original content.
 * @param {string} containerId
 */
function hideSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (el.dataset.prevContent !== undefined) {
    el.innerHTML = el.dataset.prevContent;
    delete el.dataset.prevContent;
  }
}

/* ── Form field errors ───────────────────────────────────── */

/**
 * Show an inline error message below a form input.
 * Marks the input as invalid for styling.
 * @param {string} inputId
 * @param {string} message
 */
function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');

  // Find or create error element
  let errorEl = document.getElementById(`${inputId}-error`);
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.id = `${inputId}-error`;
    errorEl.className = 'field-error';
    errorEl.setAttribute('role', 'alert');
    // Insert after the input (or after its parent .form-group child)
    input.parentNode.insertBefore(errorEl, input.nextSibling);
  }

  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

/**
 * Clear an inline error message from a form input.
 * @param {string} inputId
 */
function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');

  const errorEl = document.getElementById(`${inputId}-error`);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }
}

/**
 * Clear all field errors within a form element.
 * @param {HTMLFormElement} formEl
 */
function clearAllFieldErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('.is-invalid').forEach(el => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
  });
  formEl.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
}

/* ── Vehicle Card ────────────────────────────────────────── */

/**
 * Render an HTML string for a vehicle card.
 * @param {Object} vehicle
 * @returns {string}  HTML string
 */
function renderVehicleCard(vehicle) {
  const imgHtml = vehicle.image_url
    ? `<img class="card-img" src="${escapeHtml(vehicle.image_url)}" alt="${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}" loading="lazy">`
    : `<div class="card-img-placeholder" aria-label="${escapeHtml(vehicle.type || 'Vehicle')}">${escapeHtml(vehicle.type || 'Vehicle')}</div>`;

  const rating = vehicle.avg_rating
    ? `<span title="${vehicle.avg_rating} stars">${buildStars(vehicle.avg_rating)}</span>`
    : '';

  const specs = [
    vehicle.transmission ? `<span class="spec-item">${escapeHtml(capitalize(vehicle.transmission))}</span>` : '',
    vehicle.fuel_type    ? `<span class="spec-item">${escapeHtml(capitalize(vehicle.fuel_type))}</span>` : '',
    vehicle.seats        ? `<span class="spec-item">${escapeHtml(String(vehicle.seats))} seats</span>` : '',
  ].filter(Boolean).join('');

  return `
    <article class="card" data-vehicle-id="${vehicle.id}">
      ${imgHtml}
      <div class="card-body">
        <div class="card-meta">
          <span class="badge badge-type">${escapeHtml(capitalize(vehicle.type || 'vehicle'))}</span>
          ${rating}
        </div>
        <h3 class="card-title">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}
          <span class="text-muted" style="font-weight:400;font-size:0.875rem;">${vehicle.year ? `(${vehicle.year})` : ''}</span>
        </h3>
        <div class="vehicle-specs">${specs}</div>
        <div class="card-price">
          ${formatCurrency(vehicle.daily_rate)} <span>/ day</span>
        </div>
      </div>
      <div class="card-footer">
        <a href="/pages/vehicle-detail.html?id=${vehicle.id}" class="btn btn-primary btn-sm" style="flex:1;">
          View Details
        </a>
      </div>
    </article>
  `;
}

/* ── Booking Table Row ───────────────────────────────────── */

/**
 * Render an HTML string for a booking table row (customer-facing).
 * @param {Object} booking
 * @returns {string}  HTML <tr> string
 */
function renderBookingRow(booking) {
  const vehicle = booking.vehicle || {};
  const vehicleName = vehicle.brand
    ? `${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}`
    : `Booking #${booking.id}`;

  const statusBadge = renderStatusBadge(booking.status);
  const pickupDate  = formatDate(booking.pickup_date);
  const returnDate  = formatDate(booking.return_date);
  const total       = formatCurrency(booking.total_amount);

  // Action buttons based on status
  let actions = `
    <a href="/pages/booking-confirmation.html?id=${booking.id}" class="btn btn-secondary btn-sm">
      View
    </a>
  `;

  if (booking.status === 'pending') {
    actions += `
      <a href="/pages/payment.html?booking_id=${booking.id}" class="btn btn-primary btn-sm">
        Pay
      </a>
      <button class="btn btn-danger btn-sm" onclick="handleCancelBooking(${booking.id})">
        Cancel
      </button>
    `;
  } else if (booking.status === 'confirmed') {
    actions += `
      <button class="btn btn-danger btn-sm" onclick="handleCancelBooking(${booking.id})">
        Cancel
      </button>
    `;
  }

  return `
    <tr data-booking-id="${booking.id}">
      <td><strong>${vehicleName}</strong></td>
      <td>${pickupDate}</td>
      <td>${returnDate}</td>
      <td>${total}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="actions">${actions}</div>
      </td>
    </tr>
  `;
}

/**
 * Render an HTML string for an admin booking table row.
 * @param {Object} booking
 * @returns {string}
 */
function renderAdminBookingRow(booking) {
  const vehicle  = booking.vehicle  || {};
  const customer = booking.customer || {};

  const vehicleName  = vehicle.brand
    ? `${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}`
    : '—';
  const customerName = escapeHtml(customer.full_name || '—');
  const statusBadge  = renderStatusBadge(booking.status);
  const pickupDate   = formatDate(booking.pickup_date);
  const returnDate   = formatDate(booking.return_date);
  const total        = formatCurrency(booking.total_amount);

  // Action buttons based on status
  let actions = `
    <a href="/pages/booking-confirmation.html?id=${booking.id}" class="btn btn-secondary btn-sm" title="View">
      View
    </a>
  `;

  if (booking.status === 'pending') {
    actions += `
      <button class="btn btn-success btn-sm" onclick="handleAdminConfirm(${booking.id})" title="Confirm booking">
        Confirm
      </button>
    `;
  }
  if (booking.status === 'confirmed') {
    actions += `
      <button class="btn btn-primary btn-sm" onclick="handleAdminPickup(${booking.id})" title="Mark as picked up">
        Pickup
      </button>
    `;
  }
  if (booking.status === 'active') {
    actions += `
      <button class="btn btn-warning btn-sm" onclick="handleAdminReturn(${booking.id})" title="Mark as returned">
        Return
      </button>
    `;
  }
  if (['pending', 'confirmed'].includes(booking.status)) {
    actions += `
      <button class="btn btn-danger btn-sm" onclick="handleAdminCancel(${booking.id})" title="Cancel booking">
        Cancel
      </button>
    `;
  }

  return `
    <tr data-booking-id="${booking.id}">
      <td><code style="font-size:0.8rem">#${booking.id}</code></td>
      <td>${customerName}</td>
      <td>${vehicleName}</td>
      <td>${pickupDate} → ${returnDate}</td>
      <td>${total}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="actions">${actions}</div>
      </td>
    </tr>
  `;
}

/* ── Status Badge ────────────────────────────────────────── */

/**
 * Return an HTML badge span for a booking/vehicle status.
 * @param {string} status
 * @returns {string}
 */
function renderStatusBadge(status) {
  if (!status) return '<span class="badge">—</span>';
  return `<span class="badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(capitalize(status))}</span>`;
}

/* ── Confirm Dialog ──────────────────────────────────────── */

/**
 * Show a native confirm dialog (simple — can be replaced with a modal).
 * Returns a Promise<boolean>.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}

/* ── Modal helpers ───────────────────────────────────────── */

/**
 * Open a modal overlay by ID.
 * @param {string} modalId
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  // Trap focus (basic — focus first focusable)
  setTimeout(() => {
    const focusable = modal.querySelector('button, input, select, textarea, [tabindex]');
    if (focusable) focusable.focus();
  }, 50);
  document.addEventListener('keydown', _modalEscHandler);
}

/**
 * Close a modal overlay by ID.
 * @param {string} modalId
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  document.removeEventListener('keydown', _modalEscHandler);
}

function _modalEscHandler(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
      m.classList.add('hidden');
    });
    document.removeEventListener('keydown', _modalEscHandler);
  }
}

/* ── Set button loading state ────────────────────────────── */

/**
 * Disable a submit button and show a loading state.
 * @param {HTMLButtonElement} btn
 * @param {string} loadingText
 */
function setButtonLoading(btn, loadingText = 'Please wait...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML = `<span class="spinner spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:6px;"></span>${escapeHtml(loadingText)}`;
}

/**
 * Re-enable a button and restore its original text.
 * @param {HTMLButtonElement} btn
 */
function setButtonReady(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn.dataset.originalText !== undefined) {
    btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
}

/* ── Render empty state ──────────────────────────────────── */

/**
 * Returns an HTML string for an empty state (no results).
 * @param {string} title
 * @param {string} message
 * @param {string} icon  emoji or text icon
 * @returns {string}
 */
function renderEmptyState(title, message = '', icon = '📭') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    </div>
  `;
}
