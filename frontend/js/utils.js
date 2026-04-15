/**
 * utils.js — Utility / helper functions
 * No DOM dependencies; safe to import anywhere.
 */

/**
 * Format a number as Philippine Peso currency string.
 * @param {number} amount
 * @returns {string}  e.g. "₱1,200.00"
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₱0.00';
  return '₱' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format an ISO date string (or Date object) into a human-readable date.
 * @param {string|Date} dateStr
 * @returns {string}  e.g. "April 20, 2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format an ISO date string to a short date for <input type="date"> value (YYYY-MM-DD).
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Format an ISO datetime string to a readable date+time.
 * @param {string} dateStr
 * @returns {string}  e.g. "April 20, 2026 at 2:30 PM"
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

/**
 * Calculate the number of days between two date strings.
 * Returns 0 if either date is missing or invalid.
 * @param {string} pickup   YYYY-MM-DD
 * @param {string} returnDate YYYY-MM-DD
 * @returns {number}
 */
function calculateDays(pickup, returnDate) {
  if (!pickup || !returnDate) return 0;
  const pickupMs = new Date(pickup).getTime();
  const returnMs = new Date(returnDate).getTime();
  if (isNaN(pickupMs) || isNaN(returnMs)) return 0;
  const diffMs = returnMs - pickupMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Read a single URL query parameter by name.
 * @param {string} name
 * @returns {string|null}
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Build a URL query string from an object, skipping null/undefined/empty-string values.
 * @param {Object} params
 * @returns {string}  e.g. "?type=car&location_id=1"
 */
function buildQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Get today's date as a YYYY-MM-DD string (for min date attributes).
 * @returns {string}
 */
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncate a string to maxLength characters, appending "..." if truncated.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength = 80) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trim() + '...';
}

/**
 * Escape HTML special characters to prevent XSS when inserting user content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build star HTML string for a numeric rating (0–5).
 * @param {number} rating
 * @returns {string}  e.g. "★★★★☆"
 */
function buildStars(rating) {
  const r = Math.round(rating || 0);
  const filled = '★'.repeat(Math.min(r, 5));
  const empty  = '☆'.repeat(Math.max(0, 5 - r));
  return `<span class="star-rating" title="${rating} out of 5">${filled}${empty}</span>`;
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay  ms
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
