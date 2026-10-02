# Chapter 4 Implementation Mapping

**Project:** Cybersecurity Incident Reporting System
**Path:** `C:\Users\User\Documents\Software-Projects\cybersecurity-incident-reporting-system`
**Status:** Complete. All three verification suites pass. Self-registration (Reporter accounts only)
was added without altering the incident workflow.

This document maps the implemented prototype to the Chapter 4 requirements. It states exactly what
is implemented and, where relevant, what is deliberately **not** implemented, so the write-up can
describe the system accurately.

---

## 1. Scope and constraints

The prototype is a browser-only academic demonstration. It was extended incrementally from the
existing code: nothing was rebuilt from scratch, and the original design, data model, and workflow
were preserved.

| Constraint | Status |
| --- | --- |
| Runs with no server, database, or build step | Implemented |
| No framework, no external API, no network requests | Verified — asserted by `tools/browser.js` on every page |
| All data in `localStorage` | Implemented |
| Simulated authentication | Implemented, with plaintext-password limitation disclosed |
| Client-side role-based authorization | Implemented, with bypass limitation disclosed |
| 16 application pages, 3 stylesheets, 7 scripts | Implemented |

---

## 2. Requirement mapping

### 2.1 Roles and access control

| Requirement | Implementation | Files |
| --- | --- | --- |
| Four distinct roles | `REPORTER`, `INVESTIGATOR`, `ADMINISTRATOR`, `MANAGEMENT` | `js/seed.js`, `js/auth.js:5` |
| Simulated sign-in with validation | Email format, unknown-account, wrong-password, deactivated-account paths | `js/auth.js:29`, `index.html` |
| Self-registration | Public registration form creating a **Reporter** account only; linked from the login page | `register.html`, `js/data.js` `registerUser()` |
| Role escalation prevention | The role is a hardcoded literal in `registerUser()`; the form has no role control, and role changes remain administrator-only | `js/data.js` `registerUser()`, `user-management.html` |
| Session persistence | `cis_current_user` in `localStorage` | `js/storage.js` |
| Role-specific navigation | Per-role nav arrays; a user only ever sees their own links | `js/auth.js:117` |
| Page-level role guard | `requireAuth()` renders "Access denied" then redirects to the user's own dashboard | `js/auth.js:50` |
| Logout | Clears the session and returns to login | `js/auth.js:44` |

Verified: every one of the 14 guarded pages redirects a signed-out visitor to login, the two
authentication pages stay open while signed out, and five role/page mismatches were confirmed to
show the denial screen rather than content.

### 2.2 Incident reporting

| Requirement | Implementation | Files |
| --- | --- | --- |
| Submission form | Title, type, severity, date-time, affected system, description, evidence | `report-incident.html` |
| Field validation | Required fields, minimum lengths, valid date-time | `report-incident.html` |
| Automatic ID generation | `INC-0004`, `INC-0005`, … | `js/data.js:32` |
| Reporter's own incidents only | Filtered by `reportedBy === user.email` | `reporter-dashboard.html`, `my-incidents.html` |
| Search and filters | Live text search plus status and severity filters | `my-incidents.html` |

### 2.3 Administrator: review, triage, assignment

| Requirement | Implementation | Files |
| --- | --- | --- |
| Start review | `SUBMITTED → UNDER_REVIEW` | `incident-management.html`, `js/data.js:2` |
| Triage | Type and severity, editable only while `SUBMITTED`/`UNDER_REVIEW` | `incident-management.html` |
| Assignment | Dropdown and per-row actions; blocked before review and after resolution | `incident-management.html` |
| Assignment context | Current status, current assignee, description, evidence, affected system, reporter | `incident-management.html` |
| Investigator availability | Active investigators only, each with current workload | `js/data.js:142`, `js/data.js:147` |
| Reassignment during investigation | Allowed while `UNDER_INVESTIGATION` | `incident-management.html` |
| Action queue | Dashboard lists incidents requiring administrator action | `admin-dashboard.html` |

### 2.4 Investigation

| Requirement | Implementation | Files |
| --- | --- | --- |
| Assigned queue with filters | Search, status, severity, investigation status | `assigned-incidents.html` |
| Scoped access | Only incidents assigned to the signed-in investigator | `investigator-dashboard.html`, `assigned-incidents.html` |
| Findings, actions, evidence | Text areas; findings and actions required | `investigation.html` |
| Save and complete | Save draft, then Complete Investigation | `investigation.html` |
| Completion gate | Resolution is unavailable until the investigation is `COMPLETED` | `resolution.html`, `js/data.js` |

### 2.5 Resolution and closure

| Requirement | Implementation | Files |
| --- | --- | --- |
| Resolution recording | Description and date, both required | `resolution.html` |
| Incident picker | Lists eligible incidents; ineligible ones are shown as blocked with a reason | `resolution.html` |
| Closure | Only a `RESOLVED` incident can be closed; records a closure timestamp | `resolution.html` |
| Guard enforcement | Arbitrary status jumps are impossible; only valid transitions are offered | `js/data.js:2` |

### 2.6 Notifications

| Requirement | Implementation | Files |
| --- | --- | --- |
| Workflow-triggered records | Written on submission, review, assignment, completion, resolution, closure | `js/data.js:97` |
| Delivered to the right user | Scoped by `userId`, filterable by email | `js/data.js:112`, `js/data.js:117` |
| Read/unread state | Per-notification flag persisted in `localStorage` | `js/data.js:126` |
| Unread count in the header | Badge refreshes when notifications are read | `js/auth.js:87` |
| Mark all as read | Clears the badge, updates the panel, persists state | `js/notifications.js:56` |
| Panels on dashboards | Reporter, Investigator, Administrator | three dashboards + `js/notifications.js` |

**Not implemented:** email, SMS, or push delivery. Notifications are local records only. Read state
is per browser, not per user across devices.

### 2.7 Management reporting

| Requirement | Implementation | Files |
| --- | --- | --- |
| Read-only dashboard | Totals and distributions by status, severity, and type | `management-dashboard.html` |
| Read-only reports page | Totals, severity and type breakdowns, six-month volume trend, incident register | `management-reports.html` |
| Filtering | Date range, status, severity, type | `management-reports.html` |
| No write access | No management page exposes any mutating action | verified by suite |
| Prototype-data disclosure | Read-only note on both pages | both pages |

**Not implemented:** live or institution-wide reporting, predictive analytics, export to PDF/CSV.
The six-month trend is a plain count of incidents by creation month.

### 2.8 User management

| Requirement | Implementation | Files |
| --- | --- | --- |
| Registration form | Full name, email, password, confirmation; reuses the shared authentication card and field styles | `register.html` |
| Registration validation | Name 2&ndash;80 characters, email format, case-insensitive duplicate check, password minimum 8 characters, confirmation must match | `register.html` |
| Reporter-only account creation | `role: 'REPORTER'` is a hardcoded literal; the form exposes no role control | `js/data.js` `registerUser()` |
| Account list with search and role filter | Live filters | `user-management.html` |
| Role change | Applied and reported back to the administrator | `js/data.js:161` |
| Activation / deactivation | Toggle with confirmation of the effect | `user-management.html` |
| Self-lockout prevention | An administrator cannot change their own role or deactivate their own account | `user-management.html` |
| Open-work protection | An investigator with open assigned incidents cannot be demoted or deactivated | `user-management.html`, `js/data.js:147` |

**Not implemented:** password reset, password policy enforcement beyond the eight-character
minimum, administrator creation of accounts, or any provisioning workflow. Passwords are never
edited through the UI. Account creation is limited to Reporter self-registration.

### 2.9 Error handling and reporting

| Requirement | Implementation |
| --- | --- |
| Invalid input | Inline, per-field messages wired with `aria-describedby` |
| Unknown incident ID | "Not found" message with a link back |
| Wrong role | "Access denied" with a manual link plus an automatic redirect |
| Invalid transition | Rejected with an explanation |
| Corrupt storage | Detected and re-seeded instead of throwing |
| Missing data | Falls back to an empty state rather than an error |

---

## 3. Design and presentation

| Chapter 4 aspect | Implementation |
| --- | --- |
| Consistent design system | `css/styles.css` — tokens, badges, buttons, cards, tables, focus states |
| Page layouts | `css/app.css` — header, sidebar, dashboards, timelines, detail views |
| Login and registration presentation | `css/auth.css` |
| Responsive behaviour | Verified at 1440, 1024, 768 and 390 px; tables scroll inside their container |
| Accessibility | Labelled controls, `aria-live` alerts, unique ids, one `h1` per page, named buttons and links, keyboard-operable controls |
| Status representation | Coloured badges plus a 5-step visual timeline per incident |

---

## 4. Verification summary

| Suite | Command | Result |
| --- | --- | --- |
| Functional walkthrough (jsdom) | `node tools/verify.js` | 312 passed, 0 failed |
| Structural (jsdom) | `node tools/structure.js` | 417 passed, 0 failed |
| Headless Chrome (Puppeteer) | `node tools/browser.js` | 493 passed, 0 failed |

The full incident lifecycle is executed twice in the functional suite and once more through real
clicks in Chrome, ending with the reporter confirming the closed status. Self-registration is
exercised in both suites: field validation, duplicate refusal, the forced `REPORTER` role, sign-in
with the new account, and the empty states a new Reporter sees.

Two genuine defects were found by the browser suite during this work and fixed:

1. Wide tables pushed the page sideways on a 390 px viewport because absolutely positioned
   `.sr-only` text was not contained by the scroller (`css/styles.css` — `.table-wrapper`).
2. The header unread badge went stale after marking notifications as read, and the panel
   reported "0 unread" (`js/auth.js` — `updateUnreadBadge`, `js/notifications.js`).

---

## 5. Recommended figures

Captured at 1440×900 into `tools/screens/` via `node tools/browser.js --shots`.

| Figure | Page | File |
| --- | --- | --- |
| 4.1 | Login and demo accounts | `fig-01-login.png` |
| 4.1b | Registration and self-service Reporter accounts | `fig-01b-register.png` |
| 4.2 | Reporter dashboard and notifications | `fig-02-reporter-dashboard.png` |
| 4.3 | Report an incident | `fig-03-report-incident.png` |
| 4.4 | My incidents | `fig-04-my-incidents.png` |
| 4.5 | Incident details and status timeline | `fig-05-incident-details.png` |
| 4.6 | Administrator dashboard and action queue | `fig-06-admin-dashboard.png` |
| 4.7 | Incident review, triage and assignment | `fig-07-incident-review-assignment.png` |
| 4.8 | Assigned incidents | `fig-08-assigned-incidents.png` |
| 4.9 | Investigation record | `fig-09-investigation-form.png` |
| 4.10 | Resolution and closure | `fig-10-resolution-closure.png` |
| 4.11 | User management | `fig-11-user-management.png` |
| 4.12 | Management dashboard | `fig-12-management-dashboard.png` |
| 4.13 | Management reports and trends | `fig-13-management-reports.png` |

Figure 4.7 and 4.10 are captured against a completed incident so that the assignment panel and the
resolution/closure controls are both visible in a meaningful state.

---

## 6. Limitations to state plainly in Chapter 4

These are documented in `README.md` as well. They should not be overclaimed in the write-up.

1. Authentication is simulated. Passwords are plaintext in `localStorage` and are readable by
   anyone with browser access. This is true of the seeded demo accounts and of accounts created by
   self-registration; the prototype has no password hashing at all.
2. Authorization is client-side only and can be bypassed by editing the page or stored data.
3. Storage is `localStorage` only. There is no database, no server-side validation, and clearing
   browser data deletes everything.
4. Notifications are not delivered externally. Nothing is emailed, texted, or pushed.
5. Evidence is a text description or reference. There is no file upload or file storage.
6. There is no automated threat detection; incidents are created by users.
7. There is no encryption at rest or in transit and no HTTPS.
8. Audit history is the per-incident timeline only, and it is editable by anyone with browser access.
9. Account creation is limited to Reporter self-registration. There is no email confirmation or
   approval step, no password reset, and the Administrator cannot create administrator, investigator
   or management accounts or change passwords.
10. Management statistics reflect only what is in the current browser. They are not live,
    institution-wide, or independently verified.
11. The six-month trend is a simple monthly count, not a forecast or statistical model.
12. There is no pagination or sorting; all matching rows are rendered.

---

## 7. What a production version would need

Server-side authentication, password hashing (bcrypt or Argon2), secure session tokens,
server-side authorization on every request, a real database, secure file storage with malware
scanning, HTTPS, tamper-resistant audit logging, verified email or messaging delivery, an account
provisioning and password-policy process, and institution-appropriate security controls.

---

## 8. How to run

Open `index.html` directly, or serve the folder:

```
python -m http.server 8000
```

Sign in with any demo account; every password is `password123`. A new Reporter account can be created
from the `Register as a Reporter` link on the login page. Seeding is write-once, so a browser that
already holds older demo data must be reset first with `resetDemoData()` from the browser console
(or by clearing site data); nothing is reset automatically on page load.

To re-run verification:

```
npm install jsdom puppeteer --no-save
node tools/verify.js
node tools/structure.js
node tools/browser.js
node tools/browser.js --shots
```
