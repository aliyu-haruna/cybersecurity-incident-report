// localStorage keys and helpers
const KEYS = {
  users: 'cis_users',
  incidents: 'cis_incidents',
  investigations: 'cis_investigations',
  resolutions: 'cis_resolutions',
  notifications: 'cis_notifications',
  currentUser: 'cis_current_user',
};

function getItem(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : safeParse(v);
  } catch (e) {
    return null;
  }
}

// Writes a value, but only when the value is non-empty. An empty incidents or
// users array is almost always the result of a failed read rather than a real
// state, and persisting it would make the collection permanently unreadable.
function setItem(key, value) {
  try {
    if (Array.isArray(value) && value.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore in prototype
  }
}

function loadUsers() {
  return getItem(KEYS.users) || [];
}

function saveUsers(users) {
  setItem(KEYS.users, users);
}

function loadIncidents() {
  return getItem(KEYS.incidents) || [];
}

function saveIncidents(incidents) {
  setItem(KEYS.incidents, incidents);
}

function loadInvestigations() {
  return getItem(KEYS.investigations) || [];
}

function saveInvestigations(invs) {
  setItem(KEYS.investigations, invs);
}

function loadResolutions() {
  return getItem(KEYS.resolutions) || [];
}

function saveResolutions(res) {
  setItem(KEYS.resolutions, res);
}

function loadNotifications() {
  return getItem(KEYS.notifications) || [];
}

function saveNotifications(nots) {
  setItem(KEYS.notifications, nots);
}

function getCurrentUser() {
  const u = getItem(KEYS.currentUser);
  return u && u.email ? u : null;
}

function setCurrentUser(u) {
  if (u) setItem(KEYS.currentUser, u);
  else localStorage.removeItem(KEYS.currentUser);
}

window.KEYS = KEYS;
window.getItem = getItem;
window.setItem = setItem;
window.loadUsers = loadUsers;
window.saveUsers = saveUsers;
window.loadIncidents = loadIncidents;
window.saveIncidents = saveIncidents;
window.loadInvestigations = loadInvestigations;
window.saveInvestigations = saveInvestigations;
window.loadResolutions = loadResolutions;
window.saveResolutions = saveResolutions;
window.loadNotifications = loadNotifications;
window.saveNotifications = saveNotifications;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
