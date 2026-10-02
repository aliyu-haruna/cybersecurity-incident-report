// Incident workflow and data operations
const STATUS_FLOW = ['SUBMITTED', 'UNDER_REVIEW', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'];

function statusIndex(s) {
  return STATUS_FLOW.indexOf(s);
}

function getIncidentById(id) {
  return loadIncidents().find((i) => i.id === id) || null;
}

function updateIncident(id, patch) {
  const incidents = loadIncidents();
  const idx = incidents.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  incidents[idx] = Object.assign({}, incidents[idx], patch, { updatedAt: new Date().toISOString() });
  saveIncidents(incidents);
  return incidents[idx];
}

function appendTimeline(incidentId, status, note) {
  const incidents = loadIncidents();
  const inc = incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  inc.timeline = inc.timeline || [];
  inc.timeline.push({ status, note: note || '', at: new Date().toISOString() });
  saveIncidents(incidents);
}

function createIncident(data) {
  const incidents = loadIncidents();
  const id = generateId('INC', incidents);
  const now = new Date().toISOString();
  const incident = {
    id,
    title: data.title,
    type: data.type,
    severity: data.severity,
    dateTime: data.dateTime,
    affectedSystem: data.affectedSystem || '',
    description: data.description,
    evidence: data.evidence || '',
    reportedBy: data.reportedBy,
    assignedInvestigator: null,
    status: 'SUBMITTED',
    createdAt: now,
    updatedAt: now,
    timeline: [{ status: 'SUBMITTED', note: 'Incident reported', at: now }],
  };
  incidents.unshift(incident);
  saveIncidents(incidents);
  return incident;
}

function getInvestigation(incidentId) {
  return loadInvestigations().find((i) => i.incidentId === incidentId) || null;
}

function saveInvestigation(incidentId, patch) {
  const invs = loadInvestigations();
  let inv = invs.find((i) => i.incidentId === incidentId);
  if (!inv) {
    inv = {
      id: generateId('INV', invs),
      incidentId,
      investigatorId: null,
      status: 'NOT_STARTED',
      findings: '',
      actionsTaken: '',
      evidence: '',
      startedAt: null,
      completedAt: null,
    };
    invs.push(inv);
  }
  Object.assign(inv, patch);
  saveInvestigations(invs);
  return inv;
}

function getResolution(incidentId) {
  return loadResolutions().find((r) => r.incidentId === incidentId) || null;
}

function saveResolution(incidentId, patch) {
  const res = loadResolutions();
  let r = res.find((x) => x.incidentId === incidentId);
  if (!r) {
    r = { id: generateId('RES', res), incidentId, description: '', resolvedBy: null, resolvedAt: null, closedAt: null };
    res.push(r);
  }
  Object.assign(r, patch);
  saveResolutions(res);
  return r;
}

function notify(userId, incidentId, message) {
  if (!userId) return;
  const nots = loadNotifications();
  nots.unshift({
    id: generateId('NOT', nots),
    userId,
    incidentId,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  saveNotifications(nots);
}

// Convenience helper: notify a user identified by email address.
function notifyUserByEmail(email, incidentId, message) {
  const target = loadUsers().find((u) => String(u.email).toLowerCase() === String(email || '').toLowerCase());
  if (target) notify(target.id, incidentId, message);
}

function getNotificationsFor(userId) {
  return loadNotifications().filter((n) => n.userId === userId);
}

function countUnread(userId) {
  return getNotificationsFor(userId).filter((n) => n.isRead !== true).length;
}

// Marks every notification for a user as read. Returns the number changed.
function markNotificationsRead(userId) {
  const nots = loadNotifications();
  let changed = 0;
  const next = nots.map((n) => {
    if (n.userId === userId && n.isRead !== true) {
      changed += 1;
      return Object.assign({}, n, { isRead: true });
    }
    return n;
  });
  if (changed) saveNotifications(next);
  return changed;
}

// Investigators that may currently be assigned work. Deactivated accounts
// are excluded, matching the check used when an administrator assigns work.
function availableInvestigators() {
  return loadUsers().filter((u) => u.role === 'INVESTIGATOR' && u.isActive !== false);
}

// Number of incidents currently assigned to a given investigator.
function assignedCount(email) {
  const target = String(email || '').toLowerCase();
  return loadIncidents().filter(
    (i) => String(i.assignedInvestigator || '').toLowerCase() === target && statusIndex(i.status) < 3
  ).length;
}

function findUserById(id) {
  return loadUsers().find((u) => u.id === id) || null;
}

// Updates a user record. Used by the administrator user-management screen.
// Passwords are never edited here: this prototype stores them in plaintext
// and there is no password-storage or hashing mechanism to maintain.
function updateUser(id, patch) {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = Object.assign({}, users[idx], patch);
  saveUsers(users);
  return users[idx];
}

// Self-registration from the public register form. The role is a hardcoded
// literal and is never taken from the form, the URL or stored data, so nobody
// can register an administrator, investigator or management account. Those
// roles stay with the predefined demo accounts and the administrator
// user-management screen.
// The id is generated with the same helper the rest of the prototype uses, so
// it continues the seeded U-0001..U-0005 sequence.
// The password is stored the same way every other password in this prototype
// is: as plaintext, because there is no hashing mechanism to maintain.
function registerUser(fullName, email, password) {
  const users = loadUsers();
  const norm = String(email || '').trim().toLowerCase();
  if (users.some((u) => String(u.email).toLowerCase() === norm)) {
    return { ok: false, message: 'An account already exists with that email address.' };
  }
  const user = {
    id: generateId('U', users),
    fullName: String(fullName || '').trim(),
    email: String(email || '').trim(),
    password,
    role: 'REPORTER',
    isActive: true,
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user };
}

window.STATUS_FLOW = STATUS_FLOW;
window.statusIndex = statusIndex;
window.getIncidentById = getIncidentById;
window.updateIncident = updateIncident;
window.appendTimeline = appendTimeline;
window.createIncident = createIncident;
window.getInvestigation = getInvestigation;
window.saveInvestigation = saveInvestigation;
window.getResolution = getResolution;
window.saveResolution = saveResolution;
window.notify = notify;
window.notifyUserByEmail = notifyUserByEmail;
window.getNotificationsFor = getNotificationsFor;
window.countUnread = countUnread;
window.markNotificationsRead = markNotificationsRead;
window.availableInvestigators = availableInvestigators;
window.assignedCount = assignedCount;
window.findUserById = findUserById;
window.updateUser = updateUser;
window.registerUser = registerUser;
