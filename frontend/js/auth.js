/**
 * auth.js — Authentication state management and form handlers.
 *
 * Handles:
 *  - Saving/clearing auth state in localStorage
 *  - Route protection (checkAuth, requireRole)
 *  - Login and register form submissions
 *  - Updating the navbar on every page to reflect login state
 *
 * Depends on: utils.js, ui.js, api.js
 */

/* ─────────────────────────────────────────────────────────────
   AUTH STATE HELPERS
───────────────────────────────────────────────────────────── */

/**
 * Persist auth token and user object to localStorage.
 * @param {string} token
 * @param {Object} user
 */
function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Return the parsed user object from localStorage, or null.
 * @returns {Object|null}
 */
function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Remove token and user from localStorage (logout).
 */
function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Returns true if a token exists in localStorage.
 * @returns {boolean}
 */
function isLoggedIn() {
  return Boolean(localStorage.getItem('token'));
}

/**
 * If the user is not logged in, redirect to the login page.
 * Call this at the top of protected page init functions.
 */
function checkAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/pages/login.html';
  }
}

/**
 * If the user's role is not in the allowed roles array, redirect to home.
 * @param {string[]} roles  e.g. ['staff', 'manager']
 */
function requireRole(roles) {
  const user = getUser();
  if (!user || !roles.includes(user.role)) {
    window.location.href = '/index.html';
  }
}

/**
 * Redirect to the appropriate page after login, based on role.
 * @param {string} role
 */
function redirectByRole(role) {
  if (role === 'customer') {
    window.location.href = '/pages/my-bookings.html';
  } else if (role === 'staff' || role === 'manager') {
    window.location.href = '/pages/admin/dashboard.html';
  } else {
    window.location.href = '/index.html';
  }
}

/* ─────────────────────────────────────────────────────────────
   NAVBAR — update on every page load
───────────────────────────────────────────────────────────── */

/**
 * Build initials from a full name string.
 * "Alice Customer" → "AC", "Bob" → "B"
 * @param {string} fullName
 * @returns {string}
 */
function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Build the dropdown menu items based on the user's role.
 * @param {Object} user
 * @returns {string} HTML string for dropdown items
 */
function buildDropdownItems(user) {
  const role = user.role || 'customer';
  let items = '';

  if (role === 'customer') {
    items += `<a href="/pages/my-bookings.html">My Bookings</a>`;
    items += `<a href="/pages/profile.html">Profile</a>`;
  } else if (role === 'staff') {
    items += `<a href="/pages/admin/bookings.html">Manage Bookings</a>`;
    items += `<a href="/pages/admin/vehicles.html">Vehicles</a>`;
    items += `<a href="/pages/profile.html">Profile</a>`;
  } else if (role === 'manager') {
    items += `<a href="/pages/admin/dashboard.html">Dashboard</a>`;
    items += `<a href="/pages/admin/bookings.html">Manage Bookings</a>`;
    items += `<a href="/pages/admin/vehicles.html">Vehicles</a>`;
    items += `<a href="/pages/admin/reports.html">Reports</a>`;
    items += `<a href="/pages/profile.html">Profile</a>`;
  }

  items += `<button class="nav-dropdown-item nav-dropdown-logout" data-action="logout">Log Out</button>`;
  return items;
}

/**
 * Render the avatar + dropdown into every .nav-user[data-auth="loggedIn"] container.
 * @param {Object} user
 */
function renderAvatarDropdown(user) {
  const containers = document.querySelectorAll('.nav-user[data-auth="loggedIn"]');
  if (!containers.length) return;

  const initials = getInitials(user.full_name);
  const dropdownItems = buildDropdownItems(user);

  containers.forEach(container => {
    container.innerHTML = `
      <button class="nav-avatar-trigger" aria-haspopup="true" aria-expanded="false" aria-label="User menu">
        <span class="nav-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
        <span class="nav-avatar-name">${escapeHtml(user.full_name)}</span>
        <span class="nav-avatar-arrow" aria-hidden="true">&#9660;</span>
        <div class="nav-dropdown" role="menu">
          <div class="nav-dropdown-header">
            <span class="nav-dropdown-name">${escapeHtml(user.full_name)}</span>
            <span class="nav-dropdown-role">${escapeHtml(user.role || 'customer')}</span>
          </div>
          ${dropdownItems}
        </div>
      </button>
    `;
  });
}

/**
 * Update the navigation bar to reflect the current auth state.
 * Looks for elements with data-auth attributes in the nav.
 * Called automatically when auth.js is loaded.
 */
function updateNav() {
  const user = getUser();

  // Elements that should only show when logged in
  document.querySelectorAll('[data-auth="loggedIn"]').forEach(el => {
    el.style.display = user ? '' : 'none';
  });

  // Elements that should only show when logged out
  document.querySelectorAll('[data-auth="loggedOut"]').forEach(el => {
    el.style.display = user ? 'none' : '';
  });

  // Elements that show only for specific roles
  document.querySelectorAll('[data-auth-role]').forEach(el => {
    const allowedRoles = el.dataset.authRole.split(',').map(r => r.trim());
    el.style.display = (user && allowedRoles.includes(user.role)) ? '' : 'none';
  });

  // Populate username display (legacy plain-text spans)
  document.querySelectorAll('[data-auth="userName"]').forEach(el => {
    el.textContent = user ? user.full_name : '';
  });

  // Render avatar + dropdown for logged-in users
  if (user) {
    renderAvatarDropdown(user);
  }

  // Hamburger / mobile menu: sync same logic
  document.querySelectorAll('[data-mobile-auth="loggedIn"]').forEach(el => {
    el.style.display = user ? '' : 'none';
  });
  document.querySelectorAll('[data-mobile-auth="loggedOut"]').forEach(el => {
    el.style.display = user ? 'none' : '';
  });
  document.querySelectorAll('[data-mobile-auth-role]').forEach(el => {
    const allowedRoles = el.dataset.mobileAuthRole.split(',').map(r => r.trim());
    el.style.display = (user && allowedRoles.includes(user.role)) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────────────────────────
   AVATAR DROPDOWN TOGGLE
───────────────────────────────────────────────────────────── */

/**
 * Attach click-to-toggle and click-outside-to-close logic for all
 * .nav-avatar-trigger elements. Called after updateNav() renders them.
 */
function attachDropdownHandlers() {
  // Use event delegation on the document so it works after dynamic render
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('.nav-avatar-trigger');

    if (trigger) {
      // Don't close if a dropdown link/button was clicked — let it navigate
      const clickedItem = e.target.closest('.nav-dropdown a, .nav-dropdown button');
      if (!clickedItem) {
        // Toggle this trigger
        const isOpen = trigger.classList.contains('dropdown-open');
        // Close all open dropdowns first
        document.querySelectorAll('.nav-avatar-trigger.dropdown-open').forEach(t => {
          t.classList.remove('dropdown-open');
          t.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          trigger.classList.add('dropdown-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }
    }

    // Clicked outside any trigger — close all
    document.querySelectorAll('.nav-avatar-trigger.dropdown-open').forEach(t => {
      t.classList.remove('dropdown-open');
      t.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────────────────────── */

/**
 * Attach a click handler to all elements with data-action="logout".
 */
function attachLogoutHandlers() {
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      clearAuth();
      window.location.href = '/pages/login.html';
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   LOGIN FORM
───────────────────────────────────────────────────────────── */

/**
 * Initialize the login form on pages/login.html.
 * Reads #login-form, submits credentials, saves auth, redirects.
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllFieldErrors(form);

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('[type="submit"]');

    // Basic validation
    let valid = true;
    if (!email) {
      showFieldError('email', 'Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email', 'Please enter a valid email address.');
      valid = false;
    }
    if (!password) {
      showFieldError('password', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(submitBtn, 'Signing in...');

    try {
      const data = await loginUser(email, password);
      saveAuth(data.token, data.user);
      showToast('Welcome back, ' + data.user.full_name + '!', 'success');
      // Short delay so the user sees the toast before redirect
      setTimeout(() => redirectByRole(data.user.role), 600);
    } catch (err) {
      showToast(err.message, 'error');
      // Common: wrong credentials
      if (err.message.toLowerCase().includes('password') ||
          err.message.toLowerCase().includes('credential') ||
          err.message.toLowerCase().includes('invalid')) {
        showFieldError('password', 'Incorrect email or password.');
      }
    } finally {
      setButtonReady(submitBtn);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   REGISTER FORM
───────────────────────────────────────────────────────────── */

/**
 * Initialize the registration form on pages/register.html.
 */
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllFieldErrors(form);

    const full_name        = document.getElementById('full_name').value.trim();
    const email            = document.getElementById('email').value.trim();
    const phone            = document.getElementById('phone').value.trim();
    const password         = document.getElementById('password').value;
    const confirm_password = document.getElementById('confirm_password').value;
    const submitBtn        = form.querySelector('[type="submit"]');

    // Validation
    let valid = true;

    if (!full_name) {
      showFieldError('full_name', 'Full name is required.');
      valid = false;
    }
    if (!email) {
      showFieldError('email', 'Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email', 'Please enter a valid email address.');
      valid = false;
    }
    if (!phone) {
      showFieldError('phone', 'Phone number is required.');
      valid = false;
    }
    if (!password) {
      showFieldError('password', 'Password is required.');
      valid = false;
    } else if (password.length < 8) {
      showFieldError('password', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (password !== confirm_password) {
      showFieldError('confirm_password', 'Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(submitBtn, 'Creating account...');

    try {
      const data = await registerUser(full_name, email, phone, password);
      // Auto-login after successful registration
      saveAuth(data.token, data.user || { full_name, email, role: 'customer' });
      showToast('Account created! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/pages/my-bookings.html';
      }, 800);
    } catch (err) {
      showToast(err.message, 'error');
      if (err.message.toLowerCase().includes('email')) {
        showFieldError('email', 'This email address is already registered.');
      }
    } finally {
      setButtonReady(submitBtn);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   AUTO-INIT on every page load
───────────────────────────────────────────────────────────── */

// Run as soon as the DOM is ready (auth.js is included in <head> with defer,
// or just before </body>). Either way, we attach when DOM is interactive.
document.addEventListener('DOMContentLoaded', function () {
  updateNav();
  attachLogoutHandlers();
  attachDropdownHandlers();
  initLoginForm();
  initRegisterForm();
});
