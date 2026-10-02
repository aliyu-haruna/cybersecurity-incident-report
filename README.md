
## Demo Accounts

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Reporter | Aliyu | `aliyu@example.com` | `password123` |
| Investigator | Hafsa | `hafsa@example.com` | `password123` |
| Investigator | Noor Haddad | `investigator2@example.com` | `password123` |
| Administrator | Aisha | `aisha@example.com` | `password123` |
| Management | Jamilu | `jamilu@example.com` | `password123` |

## How to Run

**Option 1 — open directly**

Double-click `index.html`. The prototype works from the filesystem (`file://`); this was verified
in Chrome.

**Option 2 — simple local server** (recommended if your browser restricts `file://` storage)

```
python -m http.server 8000
```

or, with Node.js:

```
npx serve .
```

Then visit `http://localhost:8000`
## Project Structure

```
index.html                  Login + demo accounts
register.html               Self-registration (creates a Reporter account)
reporter-dashboard.html     Reporter dashboard and notifications
report-incident.html        Report a new incident
my-incidents.html           Reporter's incidents with search/filters
incident-details.html       Incident detail, status timeline, event history
admin-dashboard.html        Administrator dashboard, action queue and notifications
incident-management.html    Triage, assignment, workflow actions
resolution.html             Resolution and closure
user-management.html        Accounts, roles, activation
admin-reports.html          Administrator distribution reports
investigator-dashboard.html  Assigned incidents and notifications
assigned-incidents.html     Investigator's assigned queue with filters
investigation.html          Investigation record entry
management-dashboard.html   Read-only management statistics
management-reports.html     Read-only management reports and trends

