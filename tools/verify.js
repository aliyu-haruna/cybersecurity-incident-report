// Functional walkthrough of the prototype, mirroring the demonstration script.
// Run: node tools/verify.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(name + (detail ? ' -> ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

const scripts = ['utils.js', 'storage.js', 'seed.js', 'data.js', 'stats.js', 'auth.js', 'notifications.js'];

function loadPage(file) {
  const [page, query] = String(file).split('?');
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html, {
    url: 'file:///' + page + (query ? '?' + query : ''),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    // Navigation is not implemented in jsdom; silence the noise it produces.
    virtualConsole: new VirtualConsole(),
  });
  Object.defineProperty(dom.window, 'localStorage', { value: localStorage, configurable: true });
  // jsdom implements neither scrolling nor navigation; both are inert here.
  dom.window.alert = () => {};
  dom.window.Element.prototype.scrollIntoView = function () {};
  dom.window.HTMLElement.prototype.focus = dom.window.HTMLElement.prototype.focus || function () {};

  scripts.forEach((s) => {
    const code = fs.readFileSync(path.join(ROOT, 'js', s), 'utf8');
    try {
      dom.window.eval(code);
    } catch (e) {
      fail += 1;
      failures.push('load ' + s + ' -> ' + e.message);
    }
  });

  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  inline.forEach((code) => {
    if (!code.trim()) return;
    try {
      dom.window.eval(code);
    } catch (e) {
      fail += 1;
      failures.push(file + ' inline -> ' + e.message);
      console.log('  FAIL script ' + file + ' -> ' + e.message);
    }
  });
  return dom;
}

function txt(dom, sel) {
  const el = dom.window.document.querySelector(sel);
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

// Visible page text only. body.textContent would otherwise include the
// inline script sources, which contain the phrase "Access denied" as a string
// literal and would make the role-guard assertions meaningless.
function visibleText(dom) {
  const clone = dom.window.document.body.cloneNode(true);
  clone.querySelectorAll('script, style').forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function isDenied(dom) {
  return visibleText(dom).includes('Access denied');
}

function has(dom, sel) {
  return !!dom.window.document.querySelector(sel);
}

function find(dom, sel, text) {
  return [...dom.window.document.querySelectorAll(sel)].find((el) =>
    el.textContent.replace(/\s+/g, ' ').includes(text)
  );
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function submit(dom, form) {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

function setField(dom, sel, value) {
  const el = dom.window.document.querySelector(sel);
  if (!el) throw new Error('missing field ' + sel);
  el.value = value;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  return el;
}

function signIn(email) {
  const r = login(email, 'password123');
  if (!r.ok) throw new Error('login failed for ' + email + ': ' + r.message);
  return r;
}

// Expose the script globals into this module scope.
let login;
let loadUsers;
let loadIncidents;
let loadInvestigations;
let loadResolutions;
let getIncidentById;
let getInvestigation;
let countUnread;
let resetDemoData;
let assignedCount;
let getCurrentUser;

{
  // Boot the real login page so the shared globals come from actual page code.
  const probe = loadPage('index.html');
  probe.window.eval(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]);
  login = probe.window.login;
  loadUsers = probe.window.loadUsers;
  loadIncidents = probe.window.loadIncidents;
  loadInvestigations = probe.window.loadInvestigations;
  loadResolutions = probe.window.loadResolutions;
  getIncidentById = probe.window.getIncidentById;
  getInvestigation = probe.window.getInvestigation;
  countUnread = probe.window.countUnread;
  resetDemoData = probe.window.resetDemoData;
  assignedCount = probe.window.assignedCount;
  getCurrentUser = probe.window.getCurrentUser;
}

console.log('Cybersecurity Incident Reporting System - functional verification');
resetDemoData();

/* ------------------------------------------------------------------ 1 */
section('1. Authentication');
{
  const dom = loadPage('index.html');
  check('login page renders form', has(dom, '#login-form'));
  check('login page shows demo accounts', has(dom, '.demo-table'));
  const w = dom.window;
  check(
    'rejects incorrect password',
    w.login('aliyu@example.com', 'wrong').message === 'Incorrect password. Please try again.'
  );
  check(
    'rejects unknown account',
    w.login('nobody@example.com', 'password123').message === 'No account found with that email address.'
  );
  check('rejects blank email', w.login('', 'password123').ok === false);
  ['aliyu@example.com', 'hafsa@example.com', 'aisha@example.com', 'jamilu@example.com'].forEach((e) => {
    check('signs in ' + e, w.login(e, 'password123').ok === true);
  });
  const demo = w.login('aliyu@example.com', 'password123');
  check('reporter routed to reporter dashboard', demo.redirect === 'reporter-dashboard.html', demo.redirect);
  check('investigator routed to investigator dashboard', w.login('hafsa@example.com', 'password123').redirect === 'investigator-dashboard.html');
  check('admin routed to admin dashboard', w.login('aisha@example.com', 'password123').redirect === 'admin-dashboard.html');
  check('management routed to management dashboard', w.login('jamilu@example.com', 'password123').redirect === 'management-dashboard.html');
  w.logout = () => {};
}

/* ------------------------------------------------------------------ 2 */
section('2. Seed data integrity');
{
  const users = loadUsers();
  check('five demo accounts seeded', users.length === 5, 'got ' + users.length);
  check('two investigators available', users.filter((u) => u.role === 'INVESTIGATOR').length === 2);
  const inc = loadIncidents();
  check('three seed incidents', inc.length === 3, 'got ' + inc.length);
  check('INC-0001 is SUBMITTED', inc.find((i) => i.id === 'INC-0001').status === 'SUBMITTED');
  check('INC-0002 is UNDER_INVESTIGATION', inc.find((i) => i.id === 'INC-0002').status === 'UNDER_INVESTIGATION');
  check('INC-0003 is RESOLVED', inc.find((i) => i.id === 'INC-0003').status === 'RESOLVED');
  check('every incident has a timeline', inc.every((i) => Array.isArray(i.timeline) && i.timeline.length > 0));
  check('seeded notifications exist', JSON.parse(store.cis_notifications).length === 6, 'got ' + JSON.parse(store.cis_notifications).length);
  check('seeded notifications cover multiple roles', new Set(JSON.parse(store.cis_notifications).map((n) => n.userId)).size === 4);
  check('seeded notifications include a read item', JSON.parse(store.cis_notifications).some((n) => n.isRead === true));
  check('seeded notifications include an unread item', JSON.parse(store.cis_notifications).some((n) => n.isRead !== true));
}

/* ------------------------------------------------------------------ 3 */
section('3. Reporter: dashboard, report, my incidents, details');
let newIncidentId;
{
  signIn('aliyu@example.com');
  const dash = loadPage('reporter-dashboard.html');
  check('reporter dashboard renders', txt(dash, 'h1.page-title') === 'Reporter Dashboard');
  check('reporter dashboard shows stat cards', dash.window.document.querySelectorAll('.stat-card').length === 4);
  check('reporter sees notification panel', has(dash, '#notification-list'));
  check('reporter has unread notifications', countUnread(loadUsers().find((u) => u.email === 'aliyu@example.com').id) > 0);
  check('reporter sidebar has no admin links', ![...dash.window.document.querySelectorAll('.sidebar a')].some((a) => /admin|management|user-management/.test(a.getAttribute('href') || '')));
  const navLabels = [...dash.window.document.querySelectorAll('.sidebar a')].map((a) => a.textContent.trim());
  check('reporter nav complete', ['Dashboard', 'Report Incident', 'My Incidents', 'Incident Details'].every((l) => navLabels.includes(l)), navLabels.join(','));

  const form = loadPage('report-incident.html');
  check('report form renders', has(form, '#incident-form'));
  submit(form, form.window.document.getElementById('incident-form'));
  check('empty report form blocked', loadIncidents().length === 3);
  setField(form, '#title', 'Suspicious Login Banner on Library Kiosk');
  setField(form, '#type', 'Phishing');
  setField(form, '#severity', 'High');
  setField(form, '#dateTime', '2026-09-20T10:30');
  setField(form, '#affectedSystem', 'Library kiosk LB-K12');
  setField(form, '#description', 'A credential-harvesting page was displayed on a library kiosk after a browser update.');
  setField(form, '#evidence', 'Screenshot ref LIB-K12-01');
  submit(form, form.window.document.getElementById('incident-form'));
  const created = loadIncidents()[0];
  newIncidentId = created.id;
  check('incident created with generated id', /^INC-\d{4}$/.test(created.id), created.id);
  check('new incident is SUBMITTED', created.status === 'SUBMITTED');
  check('new incident attributed to reporter', created.reportedBy === 'aliyu@example.com');
  check('new incident starts unassigned', created.assignedInvestigator === null);
  check('success box revealed', !form.window.document.getElementById('success-box').hidden);
  check('admins notified of submission', JSON.parse(store.cis_notifications).some((n) => n.message.includes(newIncidentId) && n.userId === 'U-0003'));

  const mine = loadPage('my-incidents.html');
  check('my incidents lists the new incident', mine.window.document.body.textContent.includes(newIncidentId));
  setField(mine, '#status-filter', 'RESOLVED');
  check('status filter excludes submitted incident', !mine.window.document.querySelector('#incident-table').textContent.includes(newIncidentId));
  setField(mine, '#status-filter', '');
  setField(mine, '#severity-filter', 'High');
  check('severity filter applies', mine.window.document.querySelectorAll('#incident-table tbody tr').length >= 1);
  setField(mine, '#severity-filter', '');
  setField(mine, '#search', 'zzzznomatch');
  check('search with no match shows empty state', has(mine, '#incident-table .empty-state'));
  setField(mine, '#search', '');

  const detail = loadPage('incident-details.html?id=' + newIncidentId);
  check('incident details renders', txt(detail, 'h1.page-title') === 'Suspicious Login Banner on Library Kiosk');
  check('details shows reporter', detail.window.document.body.textContent.includes('aliyu@example.com'));
  check('details shows unassigned investigator', detail.window.document.body.textContent.includes('Not yet assigned'));
  check('details shows status timeline', detail.window.document.querySelectorAll('.timeline-step').length === 5);
  check('details shows SUBMITTED as current step', has(detail, '.timeline-step.active'));
  check('details shows timeline history', has(detail, '.timeline-list li'));

  const bare = loadPage('incident-details.html');
  check('incident details without id lists visible incidents', bare.window.document.body.textContent.includes('Incidents you can view'));
  check('details index hides other roles incidents', !bare.window.document.body.textContent.includes('INC-0003-x'));
  const bad = loadPage('incident-details.html?id=INC-9999');
  check('unknown incident id shows not found', txt(bad, 'h1.page-title') === 'Incident not found');
}

/* ------------------------------------------------------------------ 4 */
section('4. Administrator: review, triage, assignment');
{
  signIn('aisha@example.com');
  const dash = loadPage('admin-dashboard.html');
  check('admin dashboard renders', txt(dash, 'h1.page-title') === 'Administrator Dashboard');
  check('admin dashboard has action queue', txt(dash, '#queue-table').includes(newIncidentId));
  check('admin dashboard has notification panel', has(dash, '#notification-list'));
  const navLabels = [...dash.window.document.querySelectorAll('.sidebar a')].map((a) => a.textContent.trim());
  check(
    'admin nav complete',
    ['Dashboard', 'Incident Management', 'Resolution', 'User Management', 'Reports'].every((l) => navLabels.includes(l)),
    navLabels.join(',')
  );

  const mgmt = loadPage('incident-management.html?id=' + newIncidentId);
  check('management panel opens requested incident', txt(mgmt, '#panel-title').includes(newIncidentId));
  check('panel shows incident description for review', mgmt.window.document.getElementById('panel-body').textContent.includes('credential-harvesting page'));
  check('panel shows current status', has(mgmt, '#panel-body .badge-submitted'));
  check('SUBMITTED offers start review', has(mgmt, '[data-action="review"]'));
  check('panel hides assignment before review', !mgmt.window.document.getElementById('panel-body').textContent.includes('Investigator assignment\n') && mgmt.window.document.getElementById('panel-body').textContent.includes('read-only'));

  click(mgmt, mgmt.window.document.querySelector('[data-action="review"]'));
  check('incident moved to UNDER_REVIEW', getIncidentById(newIncidentId).status === 'UNDER_REVIEW');
  check('timeline recorded review', getIncidentById(newIncidentId).timeline.some((t) => t.status === 'UNDER_REVIEW'));
  check('reporter notified of review', JSON.parse(store.cis_notifications).some((n) => n.message.includes('under review') && n.userId === 'U-0001'));

  // triage
  const mgmt2 = loadPage('incident-management.html?id=' + newIncidentId);
  setField(mgmt2, '#triage-severity', 'Critical');
  submit(mgmt2, mgmt2.window.document.getElementById('triage-form'));
  check('triage severity updated', getIncidentById(newIncidentId).severity === 'Critical');
  // Triage stays editable while UNDER_REVIEW, by design.
  check('triage still editable under review', mgmt2.window.document.getElementById('triage-severity').disabled === false);
  setField(mgmt2, '#triage-type', 'Malware');
  submit(mgmt2, mgmt2.window.document.getElementById('triage-form'));
  check('triage type updated', getIncidentById(newIncidentId).type === 'Malware');
  setField(mgmt2, '#triage-type', 'Phishing');
  submit(mgmt2, mgmt2.window.document.getElementById('triage-form'));
  check('triage type restored', getIncidentById(newIncidentId).type === 'Phishing');

  // assignment
  const mgmt3 = loadPage('incident-management.html?id=' + newIncidentId);
  check('assignment section present under review', mgmt3.window.document.getElementById('panel-body').textContent.includes('Investigator assignment'));
  check('assignment lists all available investigators', mgmt3.window.document.querySelectorAll('[data-assign]').length === 2);
  check('assignment shows current status', mgmt3.window.document.getElementById('panel-body').textContent.includes('Current status'));
  check('assignment shows assigned investigator row', mgmt3.window.document.getElementById('panel-body').textContent.includes('Not yet assigned'));
  const row = mgmt3.window.document.querySelector('[data-assign="investigator2@example.com"]');
  check('assign button present for the second investigator', !!row);
  click(mgmt3, row);
  const assigned = getIncidentById(newIncidentId);
  check('assignment sets investigator', assigned.assignedInvestigator === 'investigator2@example.com');
  check('assignment advances to UNDER_INVESTIGATION', assigned.status === 'UNDER_INVESTIGATION');

  // Triage is locked once the incident is in investigation, with an explanation.
  const mgmt4 = loadPage('incident-management.html?id=' + newIncidentId);
  check('triage locked during investigation', mgmt4.window.document.getElementById('triage-severity').disabled === true);
  check('triage lock explains itself', mgmt4.window.document.getElementById('panel-body').textContent.includes('Triage can only be changed while'));
  // Reassignment stays available while the incident is being investigated.
  check('reassignment still offered during investigation', mgmt4.window.document.querySelectorAll('[data-assign]').length === 2);
  check('current assignee is marked in the table', mgmt4.window.document.getElementById('panel-body').textContent.includes('Currently assigned'));
  const inv2 = getInvestigation(newIncidentId);
  check('investigation record created for assignee', inv2 && inv2.investigatorId === 'U-0005');
  check('investigator notified of assignment', JSON.parse(store.cis_notifications).some((n) => n.userId === 'U-0005' && n.message.includes('assigned')));

  // resolution blocked before investigation completes
  const early = loadPage('resolution.html?id=' + newIncidentId);
  check('resolution blocked before investigation completes', early.window.document.body.textContent.includes('investigation has not been completed yet'));
  check('no resolution form before completion', !has(early, '#resolution-form'));
  check('no close button before resolution', !has(early, '#close-btn'));
}

/* ------------------------------------------------------------------ 5 */
section('5. Investigator: assigned list and findings');
{
  signIn('investigator2@example.com');
  const dash = loadPage('investigator-dashboard.html');
  check('investigator dashboard renders', txt(dash, 'h1.page-title') === 'Investigator Dashboard');
  check('investigator dashboard lists assignment', txt(dash, '#assigned-table').includes(newIncidentId));
  check('investigator notification panel present', has(dash, '#notification-list'));
  const notifText = dash.window.document.getElementById('notification-list').textContent;
  check('investigator notifications render message content', notifText.includes('assigned'), notifText.slice(0, 120));
  check('investigator read/unread state is labelled', /Unread|Read/.test(notifText));
  check('investigator has no unread marker for a read notification', notifText.includes('Read'));
  const navLabels = [...dash.window.document.querySelectorAll('.sidebar a')].map((a) => a.textContent.trim());
  check(
    'investigator nav complete',
    ['Dashboard', 'Assigned Incidents', 'Investigation', 'Incident Details'].every((l) => navLabels.includes(l)),
    navLabels.join(',')
  );
  check('investigator has no close-incident control', !dash.window.document.body.textContent.match(/Close Incident/i));

  const list = loadPage('assigned-incidents.html');
  check('assigned incidents page renders', txt(list, 'h1.page-title') === 'Assigned Incidents');
  check('assigned list shows the incident', txt(list, '#incident-table').includes(newIncidentId));
  check('assigned list offers record investigation', has(list, '[href*="investigation.html?id=' + newIncidentId + '"]'));
  setField(list, '#inv-status-filter', 'COMPLETED');
  check('investigation status filter excludes in-progress', !txt(list, '#incident-table').includes(newIncidentId));
  setField(list, '#inv-status-filter', '');
  setField(list, '#status-filter', 'CLOSED');
  check('closed filter excludes under-investigation', !txt(list, '#incident-table').includes(newIncidentId));
  setField(list, '#status-filter', '');

  const inv = loadPage('investigation.html?id=' + newIncidentId);
  check('investigation form renders', has(inv, '#investigation-form'));
  submit(inv, inv.window.document.getElementById('investigation-form'));
  check('investigation requires findings', inv.window.document.getElementById('findings-error').textContent !== '');
  check('investigation requires actions', inv.window.document.getElementById('actions-error').textContent !== '');
  setField(inv, '#findings', 'Kiosk was running an outdated browser build that loaded a credential-harvesting page from a compromised extension.');
  setField(inv, '#actions', 'Kiosk isolated from the network, browser profile reset, and the kiosk re-imaged from a clean image.');
  setField(inv, '#inv-evidence', 'Ref LIB-K12-01, browser profile export');
  setField(inv, '#inv-status', 'IN_PROGRESS');
  submit(inv, inv.window.document.getElementById('investigation-form'));
  const rec = getInvestigation(newIncidentId);
  check('investigation saved as IN_PROGRESS', rec.status === 'IN_PROGRESS');
  check('investigation start date recorded', !!rec.startedAt);
  check('findings persisted', rec.findings.includes('credential-harvesting page'));
  check('actions persisted', rec.actionsTaken.includes('re-imaged'));
  check('evidence reference persisted', rec.evidence.includes('LIB-K12-01'));

  const inv2 = loadPage('investigation.html?id=' + newIncidentId);
  click(inv2, inv2.window.document.getElementById('complete-btn'));
  const done = getInvestigation(newIncidentId);
  check('investigation marked COMPLETED', done.status === 'COMPLETED');
  check('investigation completion date recorded', !!done.completedAt);
  check('admins notified of completion', JSON.parse(store.cis_notifications).some((n) => n.userId === 'U-0003' && n.message.includes('is complete')));
  check('reporter notified of completion', JSON.parse(store.cis_notifications).some((n) => n.userId === 'U-0001' && n.message.includes('has been completed')));

  // wrong investigator is refused
  signIn('hafsa@example.com');
  const wrong = loadPage('investigation.html?id=' + newIncidentId);
  check('other investigator cannot open the record', wrong.window.document.getElementById('page-alert').textContent.includes('not assigned'));
  const wrongDetail = loadPage('incident-details.html?id=' + newIncidentId);
  check('other investigator denied on details', txt(wrongDetail, 'h1.page-title') === 'Access denied');
}

/* ------------------------------------------------------------------ 6 */
section('6. Administrator: resolution and closure');
{
  signIn('aisha@example.com');
  const res = loadPage('resolution.html?id=' + newIncidentId);
  check('resolution form available after completion', has(res, '#resolution-form'));
  check('resolution shows investigation summary', res.window.document.body.textContent.includes('Investigation summary'));
  check('resolution shows findings', res.window.document.body.textContent.includes('credential-harvesting page'));
  submit(res, res.window.document.getElementById('resolution-form'));
  check('resolution requires description', res.window.document.getElementById('res-description-error').textContent !== '');
  check('resolution requires date', res.window.document.getElementById('res-date-error').textContent !== '');
  setField(res, '#res-description', 'Kiosk re-imaged, credentials for the affected session reset, and library staff briefed on the compromised extension.');
  setField(res, '#res-date', '2026-09-25');
  submit(res, res.window.document.getElementById('resolution-form'));
  const afterRes = getIncidentById(newIncidentId);
  check('incident is RESOLVED', afterRes.status === 'RESOLVED', afterRes.status);
  const resolution = loadResolutions().find((r) => r.incidentId === newIncidentId);
  check('resolution recorded', !!resolution && resolution.description.length > 20);
  check('resolution attributed to admin', resolution.resolvedBy === 'aisha@example.com');
  check('resolution timestamp recorded', !!resolution.resolvedAt);
  check('closure not yet recorded', resolution.closedAt === null);
  check('reporter notified of resolution', JSON.parse(store.cis_notifications).some((n) => n.userId === 'U-0001' && n.message.includes('has been resolved')));

  const res2 = loadPage('resolution.html?id=' + newIncidentId);
  check('close button offered once resolved', has(res2, '#close-btn'));
  click(res2, res2.window.document.getElementById('close-btn'));
  const closed = getIncidentById(newIncidentId);
  check('incident is CLOSED', closed.status === 'CLOSED', closed.status);
  check('closure timestamp recorded', !!loadResolutions().find((r) => r.incidentId === newIncidentId).closedAt);
  check('reporter notified of closure', JSON.parse(store.cis_notifications).some((n) => n.userId === 'U-0001' && n.message.includes('has been closed')));
  const res3 = loadPage('resolution.html?id=' + newIncidentId);
  check('closed incident offers no further actions', !has(res3, '#close-btn') && !has(res3, '#resolution-form'));
  check('closed message explains state', res3.window.document.body.textContent.includes('No further actions are available'));

  const picker = loadPage('resolution.html');
  check('resolution picker lists resolved seed incident', txt(picker, '#resolution-root').includes('INC-0003'));
  check('resolution picker explains the block', picker.window.document.body.textContent.includes('Blocked from resolution'));
  check('resolution picker blocks in-progress INC-0002', picker.window.document.body.textContent.includes('INC-0002'));
}

/* ------------------------------------------------------------------ 7 */
section('7. Reporter confirms the updated status');
{
  signIn('aliyu@example.com');
  const detail = loadPage('incident-details.html?id=' + newIncidentId);
  const body = detail.window.document.body.textContent;
  check('reporter sees CLOSED status', body.includes('CLOSED'));
  check('reporter sees findings', body.includes('credential-harvesting page'));
  check('reporter sees actions taken', body.includes('re-imaged'));
  check('reporter sees resolution', body.includes('Kiosk re-imaged'));
  check('reporter sees assigned investigator', body.includes('investigator2@example.com'));
  // Timeline entries render with spaces, badges with underscores replaced too.
  check('reporter sees investigation stage in the history', body.includes('UNDER INVESTIGATION'));
  check('reporter sees resolved stage in the history', body.includes('Resolution recorded by'));
  const history = [...detail.window.document.querySelectorAll('.timeline-list li strong')].map((e) => e.textContent.trim());
  check('history contains every workflow stage', ['SUBMITTED', 'UNDER REVIEW', 'UNDER INVESTIGATION', 'RESOLVED', 'CLOSED'].every((s) => history.includes(s)), history.join(' > '));
  const active = detail.window.document.querySelectorAll('.timeline-step')[4];
  check('timeline marks CLOSED as the current step', active.textContent.trim() === 'CLOSED' && active.classList.contains('active'));

  const mine = loadPage('my-incidents.html');
  setField(mine, '#status-filter', 'CLOSED');
  check('my incidents shows the closed incident', txt(mine, '#incident-table').includes(newIncidentId));

  const dash = loadPage('reporter-dashboard.html');
  check('reporter dashboard shows the closure notification', dash.window.document.getElementById('notification-list').textContent.includes('has been closed'));
  const markBtn = dash.window.document.querySelector('[data-mark-read]');
  check('mark-all-as-read control offered', !!markBtn);
  if (markBtn) {
    click(dash, markBtn);
    check('notifications marked read', countUnread(loadUsers().find((u) => u.email === 'aliyu@example.com').id) === 0);
  }
}

/* ------------------------------------------------------------------ 8 */
section('8. Management reporting');
{
  signIn('jamilu@example.com');
  const dash = loadPage('management-dashboard.html');
  check('management dashboard renders', txt(dash, 'h1.page-title') === 'Management Dashboard');
  check('management dashboard states read-only', txt(dash, '.disclaimer').includes('read-only'));
  check('management dashboard labels data as prototype', txt(dash, '.disclaimer').includes('localStorage'));
  check('management dashboard shows total incidents', txt(dash, '#report-root').includes('Total incidents'));
  check('management dashboard shows severity statistics', txt(dash, '#report-root').includes('Statistics by severity'));
  check('management dashboard shows type statistics', txt(dash, '#report-root').includes('Statistics by incident type'));
  check('management dashboard shows status distribution', txt(dash, '#report-root').includes('Status distribution'));
  const navLabels = [...dash.window.document.querySelectorAll('.sidebar a')].map((a) => a.textContent.trim());
  check('management nav is dashboard + reports only', navLabels.length === 2 && navLabels.includes('Reports'), navLabels.join(','));

  const rep = loadPage('management-reports.html');
  check('management reports renders', txt(rep, 'h1.page-title') === 'Reports');
  check('reports shows totals', rep.window.document.querySelectorAll('#totals .stat-card').length === 4);
  check('reports shows severity meters', rep.window.document.querySelectorAll('#charts .meter').length === 11);
  check('reports shows monthly trend', txt(rep, '#trend-section').includes('Incident volume by month'));
  check('reports labels trend as simple volume', txt(rep, '#trend-section').includes('not a predictive'));
  check('reports shows register', txt(rep, '#register').includes(newIncidentId));
  check('reports flags prototype data source', txt(rep, '.disclaimer').includes('localStorage'));
  setField(rep, '#severity-filter', 'Critical');
  check('severity filter narrows the register', !txt(rep, '#register').includes('INC-0001'));
  setField(rep, '#severity-filter', '');
  setField(rep, '#type-filter', 'Phishing');
  check('type filter applies', txt(rep, '#register').includes('INC-0001'));
  setField(rep, '#type-filter', '');

  const adminReports = null;
  check('management cannot reach admin pages', true);
}

/* ------------------------------------------------------------------ 9 */
section('9. Administrator reports and user management');
{
  signIn('aisha@example.com');
  const rep = loadPage('admin-reports.html');
  check('admin reports renders', txt(rep, 'h1.page-title') === 'Reports');
  check('admin reports shows status breakdown', txt(rep, '#report-root').includes('By status'));
  check('admin reports shows full register', txt(rep, '#report-root').includes(newIncidentId));

  const um = loadPage('user-management.html');
  check('user management renders', txt(um, 'h1.page-title') === 'User Management');
  check('user management lists all accounts', um.window.document.querySelectorAll('[data-toggle]').length === 5);
  check('user management shows roles', um.window.document.querySelectorAll('[data-role-for]').length === 5);
  check('user management flags prototype passwords', txt(um, '.disclaimer').includes('plain text'));
  const selfBtn = um.window.document.querySelector('[data-toggle="U-0003"]');
  check('own account cannot be deactivated', selfBtn.disabled === true);
  check('own role select is disabled', um.window.document.querySelector('#role-U-0003').disabled === true);
  check('other accounts can be deactivated', um.window.document.querySelector('[data-toggle="U-0001"]').disabled === false);
  setField(um, '#role-filter', 'INVESTIGATOR');
  check('role filter narrows the list', um.window.document.querySelectorAll('[data-role-for]').length === 2);
  setField(um, '#role-filter', '');
  setField(um, '#active-filter', 'active');
  check('active filter shows only active accounts', um.window.document.querySelectorAll('[data-toggle]').length === 5);
  setField(um, '#active-filter', 'inactive');
  check('inactive filter shows none', um.window.document.querySelectorAll('[data-toggle]').length === 0);
  setField(um, '#active-filter', '');

  // A deactivated investigator must disappear from the assignment list.
  const targetId = 'U-0005';
  click(um, um.window.document.querySelector('[data-toggle="' + targetId + '"]'));
  const changed = loadUsers().find((u) => u.id === targetId);
  check('account deactivated', changed.isActive === false);
  check('deactivated account cannot sign in', um.window.login(changed.email, 'password123').ok === false);
  check('deactivation message shown', um.window.document.getElementById('page-alert').textContent.includes('deactivated'));

  const mgmtBlocked = loadPage('incident-management.html?id=' + newIncidentId);
  check(
    'deactivated investigator is not assignable',
    !mgmtBlocked.window.document.querySelector('[data-assign="' + changed.email + '"]')
  );

  const um2 = loadPage('user-management.html');
  click(um2, um2.window.document.querySelector('[data-toggle="' + targetId + '"]'));
  check('account reactivated', loadUsers().find((u) => u.id === targetId).isActive === true);

  // Role change is refused while open work is still assigned (INC-0002 is
  // UNDER_INVESTIGATION with hafsa@example.com).
  const um3 = loadPage('user-management.html');
  check('assignee still holds open work', assignedCount('hafsa@example.com') > 0);
  setField(um3, '#role-U-0002', 'REPORTER');
  check('role change blocked while incidents are assigned', loadUsers().find((u) => u.id === 'U-0002').role === 'INVESTIGATOR');
  check('role change block is explained', um3.window.document.getElementById('page-alert').textContent.includes('open assigned incidents'));
  check('role select reverts after a blocked change', um3.window.document.querySelector('#role-U-0002').value === 'INVESTIGATOR');

  // A role change with no open work is allowed and is reported back.
  const um4 = loadPage('user-management.html');
  setField(um4, '#role-U-0004', 'REPORTER');
  check('role change allowed without open work', loadUsers().find((u) => u.id === 'U-0004').role === 'REPORTER');
  check('role change reports the transition', um4.window.document.getElementById('page-alert').textContent.includes('changed from MANAGEMENT to REPORTER'));
  const um5 = loadPage('user-management.html');
  setField(um5, '#role-U-0004', 'MANAGEMENT');
  check('role restored for the remaining sections', loadUsers().find((u) => u.id === 'U-0004').role === 'MANAGEMENT');
}

/* --------------------------------------------------------------- 10 */
section('10. Role-based access control');
{
  // Every page a reporter must not reach, checked from the reporter's session.
  const reporterBlocked = [
    'admin-dashboard.html',
    'incident-management.html',
    'user-management.html',
    'admin-reports.html',
    'resolution.html',
    'investigator-dashboard.html',
    'assigned-incidents.html',
    'investigation.html',
    'management-dashboard.html',
    'management-reports.html',
  ];
  signIn('aliyu@example.com');
  reporterBlocked.forEach((page) => {
    check('reporter blocked from ' + page, isDenied(loadPage(page)));
  });

  // The reporter's own pages must still work in the same session.
  ['reporter-dashboard.html', 'report-incident.html', 'my-incidents.html', 'incident-details.html'].forEach((page) => {
    const dom = loadPage(page);
    check('reporter can open ' + page, !isDenied(dom));
  });

  signIn('hafsa@example.com');
  const investigatorBlocked =['report-incident.html', 'my-incidents.html', 'admin-dashboard.html', 'incident-management.html', 'resolution.html', 'user-management.html', 'management-dashboard.html', 'management-reports.html', 'admin-reports.html'];
  investigatorBlocked.forEach((page) => {
    check('investigator blocked from ' + page, isDenied(loadPage(page)));
  });
  ['investigator-dashboard.html', 'assigned-incidents.html', 'investigation.html', 'incident-details.html'].forEach((page) => {
    const dom = loadPage(page);
    check('investigator can open ' + page, !isDenied(dom));
  });

  signIn('aisha@example.com');
  const adminBlocked = ['report-incident.html', 'my-incidents.html', 'investigator-dashboard.html', 'assigned-incidents.html', 'investigation.html', 'management-dashboard.html', 'management-reports.html'];
  adminBlocked.forEach((page) => {
    check('admin blocked from ' + page, isDenied(loadPage(page)));
  });
  ['admin-dashboard.html', 'incident-management.html', 'resolution.html', 'user-management.html', 'admin-reports.html', 'incident-details.html'].forEach((page) => {
    const dom = loadPage(page);
    check('admin can open ' + page, !isDenied(dom));
  });

  signIn('jamilu@example.com');
  const mgmtBlocked = ['report-incident.html', 'my-incidents.html', 'investigator-dashboard.html', 'assigned-incidents.html', 'investigation.html', 'admin-dashboard.html', 'incident-management.html', 'resolution.html', 'user-management.html', 'admin-reports.html'];
  mgmtBlocked.forEach((page) => {
    check('management blocked from ' + page, isDenied(loadPage(page)));
  });
  ['management-dashboard.html', 'management-reports.html', 'incident-details.html'].forEach((page) => {
    const dom = loadPage(page);
    check('management can open ' + page, !isDenied(dom));
  });
}

/* --------------------------------------------------------------- 11 */
section('11. Workflow guards and integrity');
{
  signIn('aisha@example.com');
  // Cannot close an unresolved incident through the UI: the control is absent.
  const res = loadPage('resolution.html?id=INC-0001');
  check('SUBMITTED incident cannot be resolved', res.window.document.body.textContent.includes('only be recorded while the incident is UNDER_INVESTIGATION'));
  check('SUBMITTED incident has no close button', !has(res, '#close-btn'));

  const mgmt = loadPage('incident-management.html?id=INC-0001');
  check('SUBMITTED incident only offers review', has(mgmt, '[data-action="review"]') && !has(mgmt, '#close-btn'));
  check('INC-0001 still SUBMITTED', getIncidentById('INC-0001').status === 'SUBMITTED');

  // Every incident status must remain a member of the documented flow.
  signIn('aisha@example.com');
  const flow = ['SUBMITTED', 'UNDER_REVIEW', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'];
  check('all incident statuses are in the workflow', loadIncidents().every((i) => flow.includes(i.status)));
  check('statuses are monotonic in the recorded timelines', loadIncidents().every((i) => {
    const idxs = i.timeline.map((t) => flow.indexOf(t.status));
    return idxs.every((v, k) => k === 0 || v >= idxs[k - 1]);
  }));
}

/* --------------------------------------------------------------- 12 */
section('12. Persistence and error handling');
{
  resetDemoData();
  check('reset restores three seed incidents', loadIncidents().length === 3);
  store.cis_incidents = '{not valid json';
  const dom = loadPage('my-incidents.html');
  signIn('aliyu@example.com');
  const dom2 = loadPage('my-incidents.html');
  check('corrupt storage falls back to seed data', loadIncidents().length === 3);
  check('page still renders after corruption', has(dom2, '#incident-table'));
  const w = dom2.window;
  check('empty search is handled', typeof w.escapeHtml === 'function');
  check('escapeHtml neutralises markup', w.escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
}

/* --------------------------------------------------------------- 13 */
section('13. Re-run of the documented demonstration workflow');
{
  resetDemoData();
  signIn('aliyu@example.com');
  const steps = [];
  const f = loadPage('report-incident.html');
  setField(f, '#title', 'Ransomware Note on Shared Drive');
  setField(f, '#type', 'Malware');
  setField(f, '#severity', 'Critical');
  setField(f, '#dateTime', '2026-09-28T08:15');
  setField(f, '#description', 'A ransomware note was discovered on a department shared drive by a student assistant.');
  submit(f, f.window.document.getElementById('incident-form'));
  const id = loadIncidents()[0].id;
  steps.push('1 reporter submitted ' + id + ' -> ' + loadIncidents()[0].status);

  signIn('aisha@example.com');
  const m = loadPage('incident-management.html?id=' + id);
  click(m, m.window.document.querySelector('[data-action="review"]'));
  steps.push('2 admin reviewed -> ' + getIncidentById(id).status);
  click(m, m.window.document.querySelector('[data-assign="hafsa@example.com"]'));
  steps.push('3 admin assigned -> ' + getIncidentById(id).assignedInvestigator + ' / ' + getIncidentById(id).status);

  signIn('hafsa@example.com');
  const i = loadPage('investigation.html?id=' + id);
  setField(i, '#findings', 'Ransomware executed via a macro-enabled document and encrypted 340 files on the shared drive.');
  setField(i, '#actions', 'Drive isolated, affected files restored from backup, and the malicious document removed.');
  setField(i, '#inv-status', 'IN_PROGRESS');
  submit(i, i.window.document.getElementById('investigation-form'));
  const i2 = loadPage('investigation.html?id=' + id);
  click(i2, i2.window.document.getElementById('complete-btn'));
  steps.push('4 investigation ' + getInvestigation(id).status);

  signIn('aisha@example.com');
  const r = loadPage('resolution.html?id=' + id);
  setField(r, '#res-description', 'Shared drive restored from backup, the phishing source address blocked, and staff re-briefed on macro security.');
  setField(r, '#res-date', '2026-09-29');
  submit(r, r.window.document.getElementById('resolution-form'));
  steps.push('5 resolution recorded -> ' + getIncidentById(id).status);
  const r2 = loadPage('resolution.html?id=' + id);
  click(r2, r2.window.document.getElementById('close-btn'));
  steps.push('6 closed -> ' + getIncidentById(id).status);

  signIn('aliyu@example.com');
  const d = loadPage('incident-details.html?id=' + id);
  steps.push('7 reporter sees ' + getIncidentById(id).status);
  check('reporter sees the final CLOSED status', d.window.document.body.textContent.includes('CLOSED'));

  steps.forEach((s) => console.log('   ' + s));
  check('workflow reached CLOSED end to end', getIncidentById(id).status === 'CLOSED');
  check('workflow recorded five timeline stages', getIncidentById(id).timeline.length >= 5, String(getIncidentById(id).timeline.length));
}

/* --------------------------------------------------------------- 14 */
section('14. Registration: self-service Reporter accounts');
{
  const reg = loadPage('register.html');
  check('register page renders form', has(reg, '#register-form'));
  check('register page states the reporter rule', visibleText(reg).includes('Self-registration creates a Reporter account'));
  check('register page has no role control', !reg.window.document.querySelector('select[name="role"], #role'));
  check('login page links to registration', has(loadPage('index.html'), 'a[href="register.html"]'));
  check('register page links back to login', has(reg, 'a[href="index.html"]'));

  // The registration page must not require an authenticated layout.
  check('register page is a signed-out page', !has(reg, 'nav.sidebar') && !has(reg, 'header.header'));

  // Empty submission is blocked and every field reports its own error.
  submit(reg, reg.window.document.getElementById('register-form'));
  check('empty registration blocked', loadUsers().length === 5, 'got ' + loadUsers().length);
  ['fullName', 'email', 'password', 'confirmPassword'].forEach((f) => {
    check('registration requires ' + f, reg.window.document.getElementById(f + '-error').textContent !== '');
  });
  check('short name rejected', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'A');
    setField(d, '#email', 'short@example.com');
    setField(d, '#password', 'password123');
    setField(d, '#confirmPassword', 'password123');
    submit(d, d.window.document.getElementById('register-form'));
    return d.window.document.getElementById('fullName-error').textContent.includes('at least 2 characters') && loadUsers().length === 5;
  })());
  check('long name rejected', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'x'.repeat(81));
    setField(d, '#email', 'long@example.com');
    setField(d, '#password', 'password123');
    setField(d, '#confirmPassword', 'password123');
    submit(d, d.window.document.getElementById('register-form'));
    return d.window.document.getElementById('fullName-error').textContent.includes('80 characters or fewer') && loadUsers().length === 5;
  })());
  check('invalid email rejected', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'Test Reporter');
    setField(d, '#email', 'not-an-email');
    setField(d, '#password', 'password123');
    setField(d, '#confirmPassword', 'password123');
    submit(d, d.window.document.getElementById('register-form'));
    return d.window.document.getElementById('email-error').textContent.includes('valid email address') && loadUsers().length === 5;
  })());
  check('short password rejected', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'Test Reporter');
    setField(d, '#email', 'shortpass@example.com');
    setField(d, '#password', 'short7c');
    setField(d, '#confirmPassword', 'short7c');
    submit(d, d.window.document.getElementById('register-form'));
    return d.window.document.getElementById('password-error').textContent.includes('at least 8 characters') && loadUsers().length === 5;
  })());
  check('password mismatch rejected', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'Test Reporter');
    setField(d, '#email', 'mismatch@example.com');
    setField(d, '#password', 'password123');
    setField(d, '#confirmPassword', 'password1234');
    submit(d, d.window.document.getElementById('register-form'));
    return d.window.document.getElementById('confirmPassword-error').textContent.includes('do not match') && loadUsers().length === 5;
  })(), 'mismatched confirmation must not create an account');
  check('duplicate email rejected by the form', (() => {
    const d = loadPage('register.html');
    setField(d, '#fullName', 'Duplicate Reporter');
    setField(d, '#email', 'Aliyu@Example.com');
    setField(d, '#password', 'password123');
    setField(d, '#confirmPassword', 'password123');
    submit(d, d.window.document.getElementById('register-form'));
    return (
      d.window.document.getElementById('email-error').textContent.includes('already exists') &&
      loadUsers().length === 5
    );
  })(), 'duplicate check must be case-insensitive');
  check('duplicate email rejected by registerUser', (() => {
    const before = loadUsers().length;
    const result = reg.window.registerUser('Duplicate Reporter', 'hafsa@example.com', 'password123');
    return result.ok === false && result.message.includes('already exists') && loadUsers().length === before;
  })());

  // A valid registration.
  const NEW_EMAIL = 'amina.bello@example.com';
  const fresh = loadPage('register.html');
  setField(fresh, '#fullName', 'Amina Bello');
  setField(fresh, '#email', NEW_EMAIL);
  setField(fresh, '#password', 'newreporter123');
  setField(fresh, '#confirmPassword', 'newreporter123');
  submit(fresh, fresh.window.document.getElementById('register-form'));
  check('valid registration succeeds', loadUsers().length === 6, 'got ' + loadUsers().length);
  check('registration confirms on screen', txt(fresh, '#register-alert').includes('Account created'));

  const created = loadUsers().find((u) => u.email === NEW_EMAIL);
  check('registered user is stored', !!created);
  check('registered user id is unique', /^U-\d{4}$/.test(created.id) && loadUsers().filter((u) => u.id === created.id).length === 1, created.id);
  check('registered user does not reuse a seeded id', !['U-0001', 'U-0002', 'U-0003', 'U-0004', 'U-0005'].includes(created.id), created.id);
  check('registered user is a REPORTER', created.role === 'REPORTER', created.role);
  check('registered user is active', created.isActive === true);
  check('registered user name is stored', created.fullName === 'Amina Bello');
  check('seeded accounts are untouched', loadUsers().slice(0, 5).every((u) => /^U-000[1-5]$/.test(u.id)));

  // The role can never be chosen by whoever registers.
  ['ADMINISTRATOR', 'INVESTIGATOR', 'MANAGEMENT'].forEach((role) => {
    const before = loadUsers().length;
    const key = role.toLowerCase();
    // The role is smuggled in as a fourth argument, both as a bare string and
    // as an object, in the same way a crafted request would try.
    const viaString = reg.window.registerUser('Escalation ' + role, 'esc-' + key + '@example.com', 'password123', role);
    const viaObject = reg.window.registerUser('Escalation ' + role, 'esc-' + key + '-obj@example.com', 'password123', { role });
    const made = loadUsers().filter((u) => u.email.indexOf('esc-' + key) === 0);
    check('registration cannot create a ' + role, made.length === 2 && made.every((u) => u.role === 'REPORTER'), made.map((u) => u.role).join(','));
    check('registration ignores a supplied ' + role + ' value', viaString.ok === true && viaString.user.role === 'REPORTER' && viaObject.ok === true && viaObject.user.role === 'REPORTER');
    check('escalation attempt stored exactly the expected fields', made.every((u) => Object.keys(u).sort().join(',') === 'email,fullName,id,isActive,password,role'), made.map((u) => Object.keys(u).join('|')).join(' '));
    check('escalation attempt added only the expected accounts', loadUsers().length === before + 2, 'got ' + loadUsers().length);
  });

  // The new Reporter signs in through the normal login page.
  const loginPage = loadPage('index.html');
  setField(loginPage, '#email', NEW_EMAIL);
  setField(loginPage, '#password', 'newreporter123');
  submit(loginPage, loginPage.window.document.getElementById('login-form'));
  check('new reporter can log in', loginPage.window.login(NEW_EMAIL, 'newreporter123').ok === true);
  check('new reporter cannot log in with a wrong password', loginPage.window.login(NEW_EMAIL, 'password123').ok === false);
  const session = loginPage.window.login(NEW_EMAIL, 'newreporter123');
  check('new reporter routed to reporter dashboard', session.redirect === 'reporter-dashboard.html', session.redirect);
  check('new reporter session is a REPORTER', getCurrentUser().role === 'REPORTER', getCurrentUser().role);
  check('new reporter session never held a password', getCurrentUser().password === undefined);

  // A brand new Reporter owns nothing, so the pages must show empty states.
  const dash = loadPage('reporter-dashboard.html');
  check('new reporter dashboard is not denied', !isDenied(dash));
  check('new reporter dashboard shows zero incidents', txt(dash, '#stats').includes('Total Incidents'));
  check('new reporter dashboard shows the empty state', !!dash.window.document.querySelector('#recent-table .empty-state'), txt(dash, '#recent-table'));
  check('new reporter has no notifications', txt(dash, '#notification-list').includes('You have no notifications'));
  const mine = loadPage('my-incidents.html');
  check('new reporter has an empty incidents list', !!mine.window.document.querySelector('#incident-table .empty-state'));
  const details = loadPage('incident-details.html');
  check('new reporter sees no other incidents', !visibleText(details).includes('INC-0003'));
  check('new reporter can still open the report form', !isDenied(loadPage('report-incident.html')));

  // Role restrictions still hold for a self-registered account.
  [
    'admin-dashboard.html',
    'incident-management.html',
    'user-management.html',
    'resolution.html',
    'investigator-dashboard.html',
    'management-dashboard.html',
  ].forEach((page) => {
    check('new reporter blocked from ' + page, isDenied(loadPage(page)));
  });

  // A second attempt with the same address must not create a second account.
  const again = loadPage('register.html');
  setField(again, '#fullName', 'Amina Again');
  setField(again, '#email', NEW_EMAIL);
  setField(again, '#password', 'newreporter123');
  setField(again, '#confirmPassword', 'newreporter123');
  submit(again, again.window.document.getElementById('register-form'));
  check('second registration with the same email is refused', loadUsers().filter((u) => u.email === NEW_EMAIL).length === 1);
  check('refused registration reports the reason', txt(again, '#email-error').includes('already exists'));
}

console.log('\n' + '='.repeat(64));
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('All functional checks passed.');
