// Structural checks: links, assets, ids, labels and duplicate ids per page.
// Run: node tools/structure.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
// Signed-out pages. They show the shared authentication card and are
// deliberately outside the authenticated application layout, so neither the
// signed-in landmark checks nor role-navigation reachability apply to them.
const AUTH_PAGES = ['index.html', 'register.html'];
let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  }
}

console.log('Structural verification (' + pages.length + ' pages)\n');

const collectedLinks = new Set();

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html, {
    url: 'file:///' + page,
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const doc = dom.window.document;
  const body = doc.body;

  console.log(page);

  check(page + ': has a title', !!doc.title && doc.title.length > 0);
  check(page + ': declares lang', doc.documentElement.getAttribute('lang') === 'en');
  check(page + ': has a viewport meta', !!doc.querySelector('meta[name="viewport"]'));
  // <meta charset> carries its value in the attribute, not in content.
  check(page + ': has charset meta', /UTF-8/i.test((doc.querySelector('meta[charset]') || {}).getAttribute('charset') || ''));
  check(page + ': has exactly one h1', doc.querySelectorAll('h1').length === 1, String(doc.querySelectorAll('h1').length));

  // Local assets and stylesheets resolve.
  doc.querySelectorAll('link[rel="stylesheet"], script[src]').forEach((n) => {
    const ref = n.getAttribute('href') || n.getAttribute('src');
    if (/^(https?:|data:)/.test(ref)) return;
    check(page + ': asset ' + ref, fs.existsSync(path.join(ROOT, ref)));
  });

  // No external network resources.
  const external = [...doc.querySelectorAll('[src], [href]')]
    .map((n) => n.getAttribute('src') || n.getAttribute('href'))
    .filter((v) => /^(https?:)?\/\//.test(v));
  check(page + ': no external resources', external.length === 0, external.join(','));

  // ids are unique
  const ids = [...doc.querySelectorAll('[id]')].map((n) => n.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  check(page + ': no duplicate ids', dupes.length === 0, [...new Set(dupes)].join(','));

  // every label points at a control, and every control has a label
  doc.querySelectorAll('label[for]').forEach((l) => {
    check(page + ': label target #' + l.getAttribute('for') + ' exists', !!doc.getElementById(l.getAttribute('for')));
  });
  doc.querySelectorAll('input, select, textarea').forEach((f) => {
    const hasLabel =
      (f.id && doc.querySelector('label[for="' + f.id + '"]')) ||
      f.closest('label') ||
      f.getAttribute('aria-label') ||
      f.getAttribute('aria-labelledby') ||
      f.type === 'hidden';
    check(page + ': control is labelled (' + (f.id || f.name || f.type) + ')', !!hasLabel);
  });

  // images need alt text (there are none today, so this is a guard)
  doc.querySelectorAll('img').forEach((i) => check(page + ': img has alt', i.hasAttribute('alt')));

  // buttons have an accessible name
  doc.querySelectorAll('button').forEach((b) => {
    const name = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title');
    check(page + ': button has a name', !!name);
  });

  // anchors that navigate have visible text
  doc.querySelectorAll('a[href]').forEach((a) => {
    const name = (a.textContent || '').trim() || a.getAttribute('aria-label');
    check(page + ': link has text', !!name, a.getAttribute('href'));
    const href = a.getAttribute('href');
    if (/^[a-z0-9._-]+\.html(\?|$)/.test(href)) collectedLinks.add(href.split('?')[0]);
  });

  // required landmark / nav structure on signed-in pages
  if (!AUTH_PAGES.includes(page)) {
    check(page + ': has header', !!doc.querySelector('header.header'));
    check(page + ': has sidebar nav', !!doc.querySelector('nav.sidebar'));
    check(page + ': has main', !!doc.querySelector('main.main'));
    check(page + ': has notice bar', !!doc.querySelector('.notice-bar'));
  } else {
    // A signed-out page must not render the authenticated navigation.
    check(page + ': has authentication card', !!doc.querySelector('.auth-card'));
    check(page + ': has no authenticated sidebar', !doc.querySelector('nav.sidebar'));
    check(page + ': has no authenticated header', !doc.querySelector('header.header'));
  }
}

console.log('\nCross-page link graph');
pages.forEach((p) => {
  const html = fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  [...html.matchAll(/href="([a-z0-9._-]+\.html)/g)].forEach((m) => {
    check(p + ' -> ' + m[1] + ' exists', fs.existsSync(path.join(ROOT, m[1])));
  });
});

// Every page must be reachable from at least one sidebar or a link.
console.log('\nReachability');
const authNav = fs.readFileSync(path.join(ROOT, 'js/auth.js'), 'utf8');
const navTargets = [...authNav.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
navTargets.forEach((t) => check('nav target ' + t + ' exists', fs.existsSync(path.join(ROOT, t))));
pages.forEach((p) => {
  const reachable = navTargets.includes(p) || AUTH_PAGES.includes(p);
  check(p + ' reachable from a role navigation or the login page', reachable);
});

console.log('\n' + '='.repeat(64));
console.log('PASS: ' + pass + '   FAIL: ' + fail);
if (fail) process.exit(1);
console.log('All structural checks passed.');
