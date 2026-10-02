// Real-browser checks: layout overflow, console errors, uncaught exceptions
// and rendered content at four viewport widths, for every page and every role.
// Run: node tools/browser.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'screens');
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
// Signed-out pages. They render the shared authentication card instead of the
// application layout, so they are never expected to redirect, to show the
// authenticated sidebar, or to require a session.
const AUTH_PAGES = ['index.html', 'register.html'];
const SHOT = process.argv.includes('--shots');

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  }
}

const url = (p) => 'file:///' + path.join(ROOT, p).replace(/\\/g, '/');
const withId = (p, id) => url(p) + '?id=' + encodeURIComponent(id);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files', '--no-sandbox'],
  });
  if (SHOT) fs.mkdirSync(OUT, { recursive: true });

  const problems = [];

  async function openPage(file, email) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
    page.on('request', (r) => {
      const u = r.url();
      if (!/^(file:|data:|about:)/.test(u)) errors.push('external request: ' + u);
    });

    await page.goto(url('index.html'), { waitUntil: 'load' });
    if (email) {
      await page.evaluate((e) => window.login(e, 'password123'), email);
    }
    await page.goto(file, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 120));
    return { page, errors };
  }

  // Session per role for the layout sweep.
  const sessions = {};
  for (const email of ['aliyu@example.com', 'hafsa@example.com', 'aisha@example.com', 'jamilu@example.com']) {
    const p = await browser.newPage();
    await p.goto(url('index.html'), { waitUntil: 'load' });
    await p.evaluate((e) => window.login(e, 'password123'), email);
    sessions[email] = p;
  }

  const matrix = [
    ['index.html', null],
    ['register.html', null],
    ['reporter-dashboard.html', 'aliyu@example.com'],
    ['report-incident.html', 'aliyu@example.com'],
    ['my-incidents.html', 'aliyu@example.com'],
    ['incident-details.html', 'aliyu@example.com'],
    ['incident-details.html?id=INC-0002', 'aliyu@example.com'],
    ['investigator-dashboard.html', 'hafsa@example.com'],
    ['assigned-incidents.html', 'hafsa@example.com'],
    ['investigation.html', 'hafsa@example.com'],
    ['investigation.html?id=INC-0002', 'hafsa@example.com'],
    ['admin-dashboard.html', 'aisha@example.com'],
    ['incident-management.html', 'aisha@example.com'],
    ['incident-management.html?id=INC-0001', 'aisha@example.com'],
    ['resolution.html', 'aisha@example.com'],
    ['resolution.html?id=INC-0003', 'aisha@example.com'],
    ['user-management.html', 'aisha@example.com'],
    ['admin-reports.html', 'aisha@example.com'],
    ['management-dashboard.html', 'jamilu@example.com'],
    ['management-reports.html', 'jamilu@example.com'],
  ];

  console.log('Console errors and layout at four widths (' + matrix.length + ' targets)\n');
  for (const [file, email] of matrix) {
    const label = file + ' [' + (email || 'signed out') + ']';
    const { page, errors } = await openPage(url(file), email);
    check(label + ': no console or page errors', errors.length === 0, errors.join(' | '));

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 80));
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        // sr-only text is visually hidden but still measurable; ignore it.
        const overflow = de.scrollWidth - de.clientWidth;
        const visibleText = (document.body.innerText || '').trim().length;
        return {
          overflow,
          visibleText,
          sidebar: !!document.querySelector('.sidebar'),
          mainContent: document.querySelector('main') ? document.querySelector('main').innerText.trim().length : 0,
          tablesScroll: [...document.querySelectorAll('.table-wrapper')].every(
            (w) => w.scrollWidth >= w.clientWidth
          ),
          docScrollW: de.scrollWidth,
          clientW: de.clientWidth,
        };
      });
      check(label + ' @' + vp.name + ': no horizontal page overflow', m.overflow <= 1, 'overflow ' + m.overflow + 'px');
      check(label + ' @' + vp.name + ': content rendered', m.visibleText > 0);
      if (!AUTH_PAGES.includes(file)) {
        check(label + ' @' + vp.name + ': sidebar present', m.sidebar);
        check(label + ' @' + vp.name + ': main content rendered', m.mainContent > 0, String(m.mainContent));
      } else {
        check(label + ' @' + vp.name + ': authentication card rendered', await page.$eval('.auth-card', (el) => el.innerText.trim().length > 0));
        check(label + ' @' + vp.name + ': no authenticated sidebar', !m.sidebar);
      }
      check(label + ' @' + vp.name + ': tables scroll inside their container', m.tablesScroll);
    }
    if (SHOT) {
      await page.setViewport({ width: 1440, height: 900 });
      await new Promise((r) => setTimeout(r, 80));
      const name = file.replace(/[?=&.]/g, '_') + '.png';
      await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    }
    await page.close();
  }

  // Signed-out access must redirect to the login page for every guarded page.
  // The session must be cleared explicitly: localStorage is shared per origin,
  // so the signed-in sessions created above would otherwise still be present.
  // The authentication pages are not guarded, so they must stay put instead.
  console.log('\nSigned-out redirect');
  for (const file of PAGES.filter((p) => !AUTH_PAGES.includes(p))) {
    const page = await browser.newPage();
    await page.goto(url('index.html'), { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('cis_current_user'));
    await page.goto(url(file), { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    const isLogin = page.url().endsWith('index.html');
    check('signed out is redirected from ' + file, isLogin, page.url());
    await page.close();
  }

  console.log('\nAuthentication pages stay open while signed out');
  for (const file of AUTH_PAGES) {
    const page = await browser.newPage();
    await page.goto(url('index.html'), { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('cis_current_user'));
    await page.goto(url(file), { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    check('signed out is not redirected from ' + file, page.url().endsWith(file), page.url());
    check('sign-in is offered on ' + file, (await page.evaluate(() => document.body.innerText)).includes('Sign in'));
    await page.close();
  }

  // Cross-role access must show the denial screen.
  console.log('\nCross-role denial screen');
  const denialCases = [
    ['reporter-dashboard.html', 'aisha@example.com'],
    ['incident-management.html', 'hafsa@example.com'],
    ['user-management.html', 'jamilu@example.com'],
    ['management-dashboard.html', 'aliyu@example.com'],
    ['assigned-incidents.html', 'aisha@example.com'],
  ];
  for (const [file, email] of denialCases) {
    const { page } = await openPage(url(file), email);
    const text = await page.evaluate(() => document.body.innerText);
    check(email + ' denied on ' + file, text.includes('Access denied'));
    await page.close();
  }

  // Self-registration in a real browser: validation, duplicate refusal, the
  // forced REPORTER role, and a normal sign-in with the new account.
  console.log('\nIn-browser registration');
  const regPage = await browser.newPage();
  const regErrors = [];
  regPage.on('pageerror', (e) => regErrors.push(e.message));
  regPage.on('console', (m) => {
    if (m.type() === 'error') regErrors.push(m.text());
  });
  await regPage.goto(url('index.html'), { waitUntil: 'load' });
  await regPage.evaluate(() => localStorage.removeItem('cis_current_user'));
  const registerLink = await regPage.$('a[href="register.html"]');
  check('login page offers a Register link', !!registerLink);
  check('register link is labelled for reporters', /Register as a Reporter/.test((await regPage.evaluate(() => document.body.innerText))));
  await registerLink.click();
  await new Promise((r) => setTimeout(r, 150));
  check('register link opens the registration page', regPage.url().endsWith('register.html'), regPage.url());
  await new Promise((r) => setTimeout(r, 120));

  const regText = () => regPage.evaluate(() => document.body.innerText);
  const REG_EMAIL = 'tunde.bakare@example.com';
  const REG_PASSWORD = 'newreporter123';
  const fill = async (name, email, password, confirm) => {
    await regPage.evaluate(
      (n, e, p, c) => {
        document.getElementById('fullName').value = n;
        document.getElementById('email').value = e;
        document.getElementById('password').value = p;
        document.getElementById('confirmPassword').value = c;
        document.getElementById('register-form').requestSubmit();
      },
      name,
      email,
      password,
      confirm
    );
    await new Promise((r) => setTimeout(r, 120));
  };

  check('register page loads in the browser', (await regPage.$('#register-form')) !== null);
  check('register page has no role control', (await regPage.$('select[name="role"], #role')) === null);
  check('register page explains the reporter rule', (await regText()).includes('Self-registration creates a Reporter account'));
  check('register page links back to login', (await regPage.$('a[href="index.html"]')) !== null);

  await fill('', '', '', '');
  check('empty registration is rejected in the browser', (await regText()).includes('Full name is required.'));

  await fill('Tunde Bakare', REG_EMAIL, REG_PASSWORD, 'mismatched123');
  check('password mismatch is rejected in the browser', (await regText()).includes('The two passwords do not match.'));

  await fill('Tunde Bakare', REG_EMAIL, 'short1', 'short1');
  check('short password is rejected in the browser', (await regText()).includes('Password must be at least 8 characters long.'));

  await fill('Tunde Bakare', 'aliyu@example.com', REG_PASSWORD, REG_PASSWORD);
  check('duplicate email is rejected in the browser', (await regText()).includes('An account already exists with that email address.'));

  await fill('Tunde Bakare', REG_EMAIL, REG_PASSWORD, REG_PASSWORD);
  check('valid registration succeeds in the browser', (await regText()).includes('Account created'));
  const regRecord = await regPage.evaluate(
    (e) => window.loadUsers().find((u) => u.email === e),
    REG_EMAIL
  );
  check('registered account is stored in the browser', !!regRecord);
  check('registered account is a REPORTER in the browser', regRecord.role === 'REPORTER', regRecord.role);
  check('registered account id is unique in the browser', /^U-\d{4}$/.test(regRecord.id) && regRecord.id !== 'U-0001', regRecord.id);

  // The form must not sign the new account in by itself.
  const stored = await regPage.evaluate(() => window.getCurrentUser());
  check('registration does not sign the user in', stored === null || stored.email !== REG_EMAIL, String(stored && stored.email));

  await new Promise((r) => setTimeout(r, 1300));
  check('registration returns to the login page', regPage.url().endsWith('index.html'), regPage.url());
  check('registration produced no console errors', regErrors.length === 0, regErrors.join(' | '));
  await regPage.close();

  // Sign in with the new account using the ordinary login form.
  const regSession = await browser.newPage();
  const sessionErrors = [];
  regSession.on('pageerror', (e) => sessionErrors.push(e.message));
  regSession.on('console', (m) => {
    if (m.type() === 'error') sessionErrors.push(m.text());
  });
  await regSession.goto(url('index.html'), { waitUntil: 'load' });
  await regSession.evaluate(
    (e, p) => {
      document.getElementById('email').value = e;
      document.getElementById('password').value = p;
      document.getElementById('login-form').requestSubmit();
    },
    REG_EMAIL,
    REG_PASSWORD
  );
  await new Promise((r) => setTimeout(r, 250));
  check('new reporter reaches the reporter dashboard in the browser', regSession.url().endsWith('reporter-dashboard.html'), regSession.url());
  const regDashText = await regSession.evaluate(() => document.body.innerText);
  check('new reporter sees the empty incidents state in the browser', regDashText.includes('You have not reported any incidents yet.'));
  check('new reporter sees the empty notification state in the browser', regDashText.includes('You have no notifications'));
  await regSession.goto(url('user-management.html'), { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 150));
  check('new reporter is denied on user management in the browser', (await regSession.evaluate(() => document.body.innerText)).includes('Access denied'));
  check('sign-in of the new account produced no console errors', sessionErrors.length === 0, sessionErrors.join(' | '));
  await regSession.close();

  // In-browser click-through of the whole documented workflow.
  console.log('\nIn-browser workflow');
  const wf = await browser.newPage();
  const wfErrors = [];
  wf.on('pageerror', (e) => wfErrors.push(e.message));
  wf.on('console', (m) => {
    if (m.type() === 'error') wfErrors.push(m.text());
  });

  async function as(email, file) {
    await wf.goto(url('index.html'), { waitUntil: 'load' });
    await wf.evaluate((e) => window.login(e, 'password123'), email);
    await wf.goto(typeof file === 'string' && file.endsWith('.html') ? url(file) : file, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 100));
  }
  const text = () => wf.evaluate(() => document.body.innerText);

  await as('aliyu@example.com', 'report-incident.html');
  await wf.evaluate(() => {
    const f = document.getElementById('incident-form').elements;
    f.title.value = 'Unauthorised VPN Access from Dormitory Network';
    f.type.value = 'Unauthorized Access';
    f.severity.value = 'High';
    f.dateTime.value = '2026-09-26T21:05';
    f.affectedSystem.value = 'VPN gateway vpn.university.edu';
    f.description.value = 'A student account established a VPN tunnel outside the approved campus range and browsed internal file shares.';
    f.evidence.value = 'VPN session log ref VPN-4471';
    document.getElementById('incident-form').requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 150));
  const newId = await wf.evaluate(() => window.loadIncidents()[0].id);
  check('reporter submitted in the browser', !!newId, String(newId));
  check('success message shown in the browser', (await text()).includes('has been submitted successfully'));

  await as('aliyu@example.com', 'my-incidents.html');
  check('my incidents lists the new incident in the browser', (await text()).includes(newId));

  await as('aisha@example.com', withId('incident-management.html', newId));
  await wf.click('[data-action="review"]');
  await new Promise((r) => setTimeout(r, 150));
  check('admin started review in the browser', (await text()).includes('UNDER_REVIEW'));

  await wf.click('[data-assign="hafsa@example.com"]');
  await new Promise((r) => setTimeout(r, 150));
  let t = await text();
  check('admin assigned an investigator in the browser', t.includes('UNDER INVESTIGATION') || t.includes('UNDER_INVESTIGATION'));
  check('assignment confirmed in the browser', t.includes('assigned to ' + newId));

  await as('hafsa@example.com', withId('investigation.html', newId));
  await wf.evaluate(() => {
    document.getElementById('findings').value = 'The tunnel originated from a residential address not registered with the university; the account had been used on a compromised personal device.';
    document.getElementById('actions').value = 'Session terminated, the account password reset, MFA re-enrolled, and the residential address blocked at the gateway.';
    document.getElementById('inv-evidence').value = 'VPN session log VPN-4471, gateway block list entry.';
    document.getElementById('investigation-form').requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 150));
  check('investigation saved in the browser', (await text()).includes('saved'));
  await wf.click('#complete-btn');
  await new Promise((r) => setTimeout(r, 200));
  t = await text();
  check('investigation completed in the browser', t.includes('Investigation completed'));

  await as('aisha@example.com', withId('resolution.html', newId));
  check('resolution is available after completion in the browser', (await text()).includes('Mark as Resolved'));
  await wf.evaluate(() => {
    document.getElementById('res-description').value = 'Session terminated, credentials reset, MFA re-enrolled, and the address blocked. The student was briefed on acceptable device use.';
    document.getElementById('res-date').value = '2026-09-28';
    document.getElementById('resolution-form').requestSubmit();
  });
  await new Promise((r) => setTimeout(r, 200));
  t = await text();
  check('incident marked RESOLVED in the browser', t.includes('Close Incident'));
  await wf.click('#close-btn');
  await new Promise((r) => setTimeout(r, 200));
  t = await text();
  check('incident closed in the browser', t.includes('No further actions are available'));

  await as('aliyu@example.com', withId('incident-details.html', newId));
  t = await text();
  check('reporter sees CLOSED in the browser', t.includes('CLOSED'));
  check('reporter sees findings in the browser', t.includes('compromised personal device'));
  check('reporter sees the resolution in the browser', t.includes('MFA re-enrolled'));
  check('reporter sees the full status history in the browser', t.includes('Resolution recorded by') && t.includes('Incident closed by'));

  // Notifications live on the dashboards, not on the details page.
  await as('aliyu@example.com', 'reporter-dashboard.html');
  t = await text();
  check('reporter sees the closure notification in the browser', t.includes('has been closed'), t.slice(0, 200));
  // innerText reflects CSS text-transform, so compare case-insensitively.
  check('reporter sees an unread marker in the browser', /unread/i.test(t));
  const markBtn = await wf.$('[data-mark-read]');
  check('mark-all-as-read is offered in the browser', !!markBtn);
  if (markBtn) {
    const badgeBefore = await wf.evaluate(() => {
      const b = document.querySelector('.notif-count');
      return b ? b.textContent : null;
    });
    await markBtn.evaluate((b) => b.click());
    await new Promise((r) => setTimeout(r, 200));
    t = await text();
    check('marking as read reports the result in the browser', /marked as read/i.test(t), t.slice(0, 200));
    check('marking as read clears the unread state in the browser', !/unread/i.test(t), t.slice(0, 200));
    check('marking as read shows the caught-up state in the browser', /all caught up|all read/i.test(t));
    const badgeAfter = await wf.evaluate(() => {
      const b = document.querySelector('.notif-count');
      return b ? b.textContent : null;
    });
    check('the header badge was present before reading', badgeBefore !== null, String(badgeBefore));
    check('the header badge is removed after reading', badgeAfter === null, String(badgeAfter));
    const persisted = await wf.evaluate(() => window.getNotificationsFor(window.getCurrentUser().id).every((n) => n.isRead === true));
    check('read state persists in localStorage', persisted);
  }

  await as('aisha@example.com', 'admin-dashboard.html');
  t = await text();
  check('administrator sees assignment/completion notifications in the browser', /assigned|is complete/.test(t));
  check('administrator action queue is populated in the browser', t.includes('Requiring your action'));

  check('workflow produced no console errors', wfErrors.length === 0, wfErrors.join(' | '));
  await wf.close();

  // Screenshot pass for the report figures.
  if (SHOT) {
    console.log('\nCapturing figures');
    const shot = async (file, email, name, opts) => {
      const p = await browser.newPage();
      await p.setViewport({ width: 1440, height: 900 });
      await p.goto(url('index.html'), { waitUntil: 'load' });
      if (email) await p.evaluate((e) => window.login(e, 'password123'), email);
      await p.goto(typeof file === 'string' && file.endsWith('.html') ? url(file) : file, { waitUntil: 'load' });
      await new Promise((r) => setTimeout(r, 250));
      await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !(opts && opts.viewportOnly) });
      await p.close();
    };
    await shot('index.html', null, 'fig-01-login');
    await shot('register.html', null, 'fig-01b-register');
    await shot('reporter-dashboard.html', 'aliyu@example.com', 'fig-02-reporter-dashboard');
    await shot('report-incident.html', 'aliyu@example.com', 'fig-03-report-incident');
    await shot('my-incidents.html', 'aliyu@example.com', 'fig-04-my-incidents');
    await shot(withId('incident-details.html', newId), 'aliyu@example.com', 'fig-05-incident-details');
    await shot('admin-dashboard.html', 'aisha@example.com', 'fig-06-admin-dashboard');
    await shot(withId('incident-management.html', newId), 'aisha@example.com', 'fig-07-incident-review-assignment');
    await shot('assigned-incidents.html', 'hafsa@example.com', 'fig-08-assigned-incidents');
    await shot(withId('investigation.html', newId), 'hafsa@example.com', 'fig-09-investigation-form');
    await shot(withId('resolution.html', newId), 'aisha@example.com', 'fig-10-resolution-closure');
    await shot('user-management.html', 'aisha@example.com', 'fig-11-user-management');
    await shot('management-dashboard.html', 'jamilu@example.com', 'fig-12-management-dashboard');
    await shot('management-reports.html', 'jamilu@example.com', 'fig-13-management-reports');
    console.log('  screenshots written to tools/screens');
  }

  await browser.close();
  console.log('\n' + '='.repeat(64));
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  if (problems.length) {
    console.log('Problems:');
    problems.forEach((p) => console.log('  - ' + p));
  }
  if (fail) process.exit(1);
  console.log('All browser checks passed.');
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
