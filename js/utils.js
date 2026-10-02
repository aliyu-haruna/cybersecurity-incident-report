// Utility helpers
function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

function toISODateTime(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // Basic email validation
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function generateId(prefix, collection) {
  const items = collection || [];
  let num = items.length + 1;
  let id = `${prefix}-${String(num).padStart(4, '0')}`;
  // ensure uniqueness
  while (items.some((it) => it.id === id)) {
    num++;
    id = `${prefix}-${String(num).padStart(4, '0')}`;
  }
  return id;
}

function showAlert(container, type, message) {
  if (!container) return;
  const cls = type === 'error' ? 'alert alert-error' : type === 'success' ? 'alert alert-success' : 'alert alert-info';
  container.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function badgeStatus(status) {
  if (!status) return '';
  const map = {
    SUBMITTED: 'badge badge-submitted',
    UNDER_REVIEW: 'badge badge-under_review',
    UNDER_INVESTIGATION: 'badge badge-under_investigation',
    RESOLVED: 'badge badge-resolved',
    CLOSED: 'badge badge-closed',
  };
  return `<span class="${map[status] || 'badge'}">${escapeHtml(status.replace(/_/g, ' '))}</span>`;
}

function badgeSeverity(sv) {
  if (!sv) return '';
  const map = {
    Low: 'badge badge-low',
    Medium: 'badge badge-medium',
    High: 'badge badge-high',
    Critical: 'badge badge-critical',
  };
  return `<span class="${map[sv] || 'badge'}">${escapeHtml(sv)}</span>`;
}

function badgeType(t) {
  if (!t) return '';
  const key = t.toLowerCase();
  const map = {
    phishing: 'badge badge-phishing',
    malware: 'badge badge-malware',
    'unauthorized access': 'badge badge-unauthorized',
    'data breach': 'badge badge-breach',
    'account compromise': 'badge badge-compromise',
    'lost/stolen device': 'badge badge-lost',
    other: 'badge badge-other',
  };
  const cls = map[key] || 'badge badge-other';
  return `<span class="${cls}">${escapeHtml(t)}</span>`;
}

window.$ = $;
window.$all = $all;
window.formatDate = formatDate;
window.toISODateTime = toISODateTime;
window.isValidEmail = isValidEmail;
window.generateId = generateId;
window.showAlert = showAlert;
window.escapeHtml = escapeHtml;
window.safeParse = safeParse;
window.badgeStatus = badgeStatus;
window.badgeSeverity = badgeSeverity;
window.badgeType = badgeType;
