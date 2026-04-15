/**
 * api.js — All HTTP communication with the backend API.
 *
 * Rules:
 *  - All requests go through apiFetch().
 *  - Token is read from localStorage on every call (stays fresh after login).
 *  - 401 responses clear auth and redirect to login.
 *  - Errors throw an Error with a human-readable message.
 *
 * Depends on: utils.js (buildQueryString)
 */

const API_BASE = 'http://localhost:8000/api/v1';

/**
 * Core fetch wrapper.
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} path   e.g. '/vehicles'
 * @param {Object|null} body  JSON body for POST/PUT
 * @returns {Promise<any>}  parsed JSON response
 */
async function apiFetch(method, path, body = null) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body !== null && method !== 'GET' && method !== 'DELETE') {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (networkErr) {
    // Network-level failure (no internet, server down, CORS preflight blocked, etc.)
    throw new Error('Unable to reach the server. Please check your connection and try again.');
  }

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/pages/login.html';
    throw new Error('Your session has expired. Please log in again.');
  }

  // Try to parse JSON body (may not exist on 204)
  let data = null;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  }

  if (!response.ok) {
    // Extract a human-friendly error message from the response
    const msg =
      (data && (data.detail || data.message || data.error)) ||
      `Request failed (HTTP ${response.status})`;
    throw new Error(String(msg));
  }

  return data;
}

/* ─────────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────────── */

async function loginUser(email, password) {
  return apiFetch('POST', '/auth/login', { email, password });
}

async function registerUser(full_name, email, phone, password) {
  return apiFetch('POST', '/auth/register', { full_name, email, phone, password });
}

async function getMe() {
  return apiFetch('GET', '/auth/me');
}

async function updateMe(data) {
  return apiFetch('PUT', '/auth/me', data);
}

async function changePassword(current_password, new_password) {
  return apiFetch('POST', '/auth/change-password', { current_password, new_password });
}

/* ─────────────────────────────────────────────────────────────
   VEHICLES
───────────────────────────────────────────────────────────── */

/**
 * @param {Object} filters  { type, location_id, pickup_date, return_date, min_price, max_price, transmission }
 */
async function getVehicles(filters = {}) {
  const qs = buildQueryString(filters);
  return apiFetch('GET', `/vehicles${qs}`);
}

async function getVehicle(id) {
  return apiFetch('GET', `/vehicles/${id}`);
}

async function createVehicle(data) {
  return apiFetch('POST', '/vehicles', data);
}

async function updateVehicle(id, data) {
  return apiFetch('PUT', `/vehicles/${id}`, data);
}

async function deleteVehicle(id) {
  return apiFetch('DELETE', `/vehicles/${id}`);
}

/* ─────────────────────────────────────────────────────────────
   LOCATIONS
───────────────────────────────────────────────────────────── */

async function getLocations() {
  return apiFetch('GET', '/locations');
}

/* ─────────────────────────────────────────────────────────────
   BOOKINGS
───────────────────────────────────────────────────────────── */

/**
 * Create a new booking.
 * @param {Object} data  { vehicle_id, pickup_location_id, return_location_id, pickup_date, return_date, addons }
 */
async function createBooking(data) {
  return apiFetch('POST', '/bookings', data);
}

/**
 * Get the current customer's bookings.
 * @param {Object} filters  { status }
 */
async function getMyBookings(filters = {}) {
  const qs = buildQueryString(filters);
  return apiFetch('GET', `/bookings/my${qs}`);
}

/**
 * Get all bookings (staff/manager).
 * @param {Object} filters  { status, page, limit }
 */
async function getAllBookings(filters = {}) {
  const qs = buildQueryString(filters);
  return apiFetch('GET', `/bookings${qs}`);
}

async function getBooking(id) {
  return apiFetch('GET', `/bookings/${id}`);
}

async function confirmBooking(id) {
  return apiFetch('PUT', `/bookings/${id}/confirm`);
}

async function cancelBooking(id) {
  return apiFetch('PUT', `/bookings/${id}/cancel`);
}

async function pickupBooking(id) {
  return apiFetch('PUT', `/bookings/${id}/pickup`);
}

async function returnBooking(id) {
  return apiFetch('PUT', `/bookings/${id}/return`);
}

/* ─────────────────────────────────────────────────────────────
   PAYMENTS
───────────────────────────────────────────────────────────── */

async function createPayment(booking_id, method) {
  return apiFetch('POST', '/payments', { booking_id, method });
}

async function getPayment(booking_id) {
  return apiFetch('GET', `/payments/${booking_id}`);
}

/* ─────────────────────────────────────────────────────────────
   REVIEWS
───────────────────────────────────────────────────────────── */

async function createReview(booking_id, rating, comment) {
  return apiFetch('POST', '/reviews', { booking_id, rating, comment });
}

async function getVehicleReviews(vehicle_id) {
  return apiFetch('GET', `/reviews/vehicle/${vehicle_id}`);
}

/* ─────────────────────────────────────────────────────────────
   REPORTS (manager only)
───────────────────────────────────────────────────────────── */

async function getRevenueReport(from_date, to_date) {
  const qs = buildQueryString({ from_date, to_date });
  return apiFetch('GET', `/reports/revenue${qs}`);
}

async function getVehiclesReport(from_date, to_date) {
  const qs = buildQueryString({ from_date, to_date });
  return apiFetch('GET', `/reports/vehicles${qs}`);
}

async function getCustomersReport(from_date, to_date) {
  const qs = buildQueryString({ from_date, to_date });
  return apiFetch('GET', `/reports/customers${qs}`);
}
