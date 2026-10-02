// Authentication and authorization (prototype only)
// NOTE: This is a simulated client-side login for an academic prototype.
// Production would require server-side authentication, password hashing,
// secure session tokens, and server-side authorization.
const ROLE_HOME = {
  REPORTER: 'reporter-dashboard.html',
  INVESTIGATOR: 'investigator-dashboard.html',
  ADMINISTRATOR: 'admin-dashboard.html',
  MANAGEMENT: 'management-dashboard.html',
};

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
  };
}

function findUserByEmail(email) {
  const users = loadUsers();
  const norm = String(email || '').trim().toLowerCase();
  return users.find((u) => String(u.email).toLowerCase() === norm) || null;
}

function login(email, password) {
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, message: 'No account found with that email address.' };
  }
  if (user.password !== password) {
    return { ok: false, message: 'Incorrect password. Please try again.' };
  }
  if (user.isActive === false) {
    return { ok: false, message: 'This account has been deactivated. Contact an administrator.' };
  }
  setCurrentUser(sanitizeUser(user));
  return { ok: true, user: sanitizeUser(user), redirect: ROLE_HOME[user.role] || 'index.html' };
}

function logout() {
  setCurrentUser(null);
  window.location.href = 'index.html';
}

// Guards a page: allowedRoles is an array of role strings.
function requireAuth(allowedRoles) {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(user.role)) {
    const home = ROLE_HOME[user.role] || 'index.html';
    document.body.innerHTML = `
      <main class="container">
        <div class="card" role="alert">
          <h1>Access denied</h1>
          <p class="stat-label">You are signed in as ${escapeHtml(user.email)} (${escapeHtml(user.role)}).
          Your role does not have permission to view this page.</p>
          <p class="stat-label">Redirecting you to your dashboard&hellip;</p>
          <p><a class="btn" href="${home}">Go to my dashboard now</a></p>
        </div>
      </main>`;
    setTimeout(() => {
      window.location.replace(home);
    }, 1500);
    return null;
  }
  return user;
}

// Renders the shared header and sidebar for logged-in pages.
// activeNavId is optional: when omitted it is derived from the current page,
// so a page only has to pass the id when it renders several sections.
function navIdForPage(role, href) {
  const page = String(href || window.location.href).split('/').pop().split('?')[0].split('#')[0];
  const item = (NAV_BY_ROLE[role] || []).find((n) => n.href === page);
  return item ? item.id : null;
}

// Re-reads the unread count and refreshes just the header badge, so pages that
// mark notifications as read do not leave a stale count on screen.
function updateUnreadBadge() {
  const user = getCurrentUser();
  const header = document.getElementById('app-header');
  if (!user || !header) return;
  const holder = header.querySelector('.user-info > span');
  if (!holder) return;
  const unread = typeof countUnread === 'function' ? countUnread(user.id) : 0;
  holder.innerHTML =
    escapeHtml(user.fullName) +
    ' &middot; ' +
    escapeHtml(user.role) +
    (unread ? ` &middot; <span class="notif-count" title="Unread notifications">${unread}</span>` : '');
}

function renderLayout(activeNavId) {
  const user = getCurrentUser();
  if (!user) return;
  const active = activeNavId || navIdForPage(user.role);
  const unread = typeof countUnread === 'function' ? countUnread(user.id) : 0;
  const header = document.getElementById('app-header');
  if (header) {
    header.innerHTML = `
      <span class="brand">Cybersecurity Incident Reporting System</span>
      <span class="user-info">
        <span>${escapeHtml(user.fullName)} &middot; ${escapeHtml(user.role)}${
          unread ? ` &middot; <span class="notif-count" title="Unread notifications">${unread}</span>` : ''
        }</span>
        <button class="btn btn-secondary" id="logout-btn" type="button">Logout</button>
      </span>`;
    const btn = document.getElementById('logout-btn');
    if (btn) btn.addEventListener('click', logout);
  }
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    const nav = NAV_BY_ROLE[user.role] || [];
    sidebar.innerHTML = nav
      .map(
        (item) =>
          `<a href="${item.href}" ${item.id === active ? 'class="active" aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`
      )
      .join('');
  }
}

// Navigation is defined per role so a signed-in user only ever sees links
// that belong to their own role.
const NAV_BY_ROLE = {
  REPORTER: [
    { id: 'dashboard', label: 'Dashboard', href: 'reporter-dashboard.html' },
    { id: 'report', label: 'Report Incident', href: 'report-incident.html' },
    { id: 'my', label: 'My Incidents', href: 'my-incidents.html' },
    { id: 'details', label: 'Incident Details', href: 'incident-details.html' },
  ],
  INVESTIGATOR: [
    { id: 'dashboard', label: 'Dashboard', href: 'investigator-dashboard.html' },
    { id: 'assigned', label: 'Assigned Incidents', href: 'assigned-incidents.html' },
    { id: 'investigate', label: 'Investigation', href: 'investigation.html' },
    { id: 'details', label: 'Incident Details', href: 'incident-details.html' },
  ],
  ADMINISTRATOR: [
    { id: 'dashboard', label: 'Dashboard', href: 'admin-dashboard.html' },
    { id: 'manage', label: 'Incident Management', href: 'incident-management.html' },
    { id: 'resolution', label: 'Resolution', href: 'resolution.html' },
    { id: 'users', label: 'User Management', href: 'user-management.html' },
    { id: 'reports', label: 'Reports', href: 'admin-reports.html' },
  ],
  MANAGEMENT: [
    { id: 'dashboard', label: 'Dashboard', href: 'management-dashboard.html' },
    { id: 'reports', label: 'Reports', href: 'management-reports.html' },
  ],
};

window.ROLE_HOME = ROLE_HOME;
window.NAV_BY_ROLE = NAV_BY_ROLE;
window.navIdForPage = navIdForPage;
window.login = login;
window.logout = logout;
window.requireAuth = requireAuth;
window.renderLayout = renderLayout;
window.updateUnreadBadge = updateUnreadBadge;
window.sanitizeUser = sanitizeUser;
