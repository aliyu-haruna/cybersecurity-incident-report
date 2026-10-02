// Seed data. Only runs when a localStorage key does not already exist,
// so user-created data is never destroyed on load.
// A key is considered missing when it is absent *or* holds unparseable data.
// Without the parse check, a corrupted value would read back as an empty
// collection forever and the user would see a permanently blank application.
function isUsable(key) {
  const raw = localStorage.getItem(key);
  if (raw == null) return false;
  const parsed = safeParse(raw);
  return Array.isArray(parsed);
}

function seedIfMissing() {
  if (!isUsable(KEYS.users)) {
    saveUsers([
      {
        id: 'U-0001',
        fullName: 'Aliyu',
        email: 'aliyu@example.com',
        password: 'password123',
        role: 'REPORTER',
        isActive: true,
      },
      {
        id: 'U-0002',
        fullName: 'Hafsa',
        email: 'hafsa@example.com',
        password: 'password123',
        role: 'INVESTIGATOR',
        isActive: true,
      },
      {
        id: 'U-0005',
        fullName: 'Noor Haddad',
        email: 'investigator2@example.com',
        password: 'password123',
        role: 'INVESTIGATOR',
        isActive: true,
      },
      {
        id: 'U-0003',
        fullName: 'Aisha',
        email: 'aisha@example.com',
        password: 'password123',
        role: 'ADMINISTRATOR',
        isActive: true,
      },
      {
        id: 'U-0004',
        fullName: 'Jamilu',
        email: 'jamilu@example.com',
        password: 'password123',
        role: 'MANAGEMENT',
        isActive: true,
      },
    ]);
  }

  if (!isUsable(KEYS.incidents)) {
    const now = new Date();
    const iso = (daysAgo, hour) => {
      const d = new Date(now.getTime() - daysAgo * 86400000);
      d.setHours(hour, 15, 0, 0);
      return d.toISOString();
    };
    saveIncidents([
      {
        id: 'INC-0001',
        title: 'Suspicious Email Requesting Password',
        type: 'Phishing',
        severity: 'Medium',
        dateTime: iso(2, 9),
        affectedSystem: 'Finance shared mailbox (finance-dept@university.edu)',
        description:
          'A user received a suspicious email requesting a username and password. The message claimed the account would be suspended unless credentials were re-entered within 24 hours. The link domain is similar to the university login portal but not an exact match.',
        evidence: 'Original email saved as email-suspicious.eml. Sender: it-helpdesk@uni-support-desk.net',
        reportedBy: 'aliyu@example.com',
        assignedInvestigator: null,
        status: 'SUBMITTED',
        createdAt: iso(2, 9),
        updatedAt: iso(2, 9),
        timeline: [{ status: 'SUBMITTED', note: 'Incident reported by aliyu@example.com', at: iso(2, 9) }],
      },
      {
        id: 'INC-0002',
        title: 'Unauthorized Login Attempt',
        type: 'Unauthorized Access',
        severity: 'High',
        dateTime: iso(5, 22),
        affectedSystem: 'Student records application (student-portal.university.edu)',
        description:
          'Six failed login attempts followed by a successful login from an IP address outside the campus network range. The account belongs to a staff member in the registrar office. Session activity shows a bulk data export approximately 40 minutes after login.',
        evidence: 'Auth logs export 2024-auth-logs.csv, lines 4821-4834. Suspicious IP 203.0.113.47',
        reportedBy: 'aliyu@example.com',
        assignedInvestigator: 'hafsa@example.com',
        status: 'UNDER_INVESTIGATION',
        createdAt: iso(5, 22),
        updatedAt: iso(4, 10),
        timeline: [
          { status: 'SUBMITTED', note: 'Incident reported by aliyu@example.com', at: iso(5, 22) },
          { status: 'UNDER_REVIEW', note: 'Triage completed by aisha@example.com', at: iso(5, 23) },
          {
            status: 'UNDER_INVESTIGATION',
            note: 'Assigned to hafsa@example.com',
            at: iso(4, 10),
          },
        ],
      },
      {
        id: 'INC-0003',
        title: 'Compromised User Account',
        type: 'Account Compromise',
        severity: 'Critical',
        dateTime: iso(12, 14),
        affectedSystem: 'Research lab workstation LAB-WS-14 (Windows 11)',
        description:
          'A research workstation showed signs of credential theft. An infostealer binary executed from a downloaded attachment and harvested browser-stored passwords. The account was used to access an internal file share containing unpublished research data.',
        evidence: 'Memory capture lab-ws14.mem, hash 9f2c1a...e44b of the infostealer sample',
        reportedBy: 'aliyu@example.com',
        assignedInvestigator: 'hafsa@example.com',
        status: 'RESOLVED',
        createdAt: iso(12, 14),
        updatedAt: iso(9, 16),
        timeline: [
          { status: 'SUBMITTED', note: 'Incident reported by aliyu@example.com', at: iso(12, 14) },
          { status: 'UNDER_REVIEW', note: 'Confirmed as account compromise', at: iso(12, 15) },
          { status: 'UNDER_INVESTIGATION', note: 'Assigned to hafsa@example.com', at: iso(11, 9) },
          { status: 'RESOLVED', note: 'Account recovered, credentials reset, workstation rebuilt', at: iso(9, 16) },
        ],
      },
    ]);
  }

  if (!isUsable(KEYS.investigations)) {
    const now = new Date();
    const iso = (daysAgo, hour) => {
      const d = new Date(now.getTime() - daysAgo * 86400000);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    saveInvestigations([
      {
        id: 'INV-0001',
        incidentId: 'INC-0002',
        investigatorId: 'U-0002',
        status: 'IN_PROGRESS',
        findings:
          'Failed logins originated from 203.0.113.47, a host not registered with the university. The successful login reused the correct password, which suggests the credential was obtained externally rather than guessed. A bulk export of 1,204 student records was generated shortly after login. No evidence of persistence on internal systems was found.',
        actionsTaken:
          'Account password reset and forced logout of all sessions. MFA re-enrolment requested with the account owner. Bulk export file located and quarantined. Network firewall rule added to block the source address. Registrar office notified to review the exported records.',
        evidence: 'Auth log extract, firewall rule change ticket SEC-2291, quarantined export file.',
        startedAt: iso(4, 11),
        completedAt: null,
      },
      {
        id: 'INV-0002',
        incidentId: 'INC-0003',
        investigatorId: 'U-0002',
        status: 'COMPLETED',
        findings:
          'The infostealer sample executed with user privileges and exfiltrated browser-stored credentials. The same credentials were reused on the internal file share, which granted access to unpublished research data. The attacker accessed 3 shared folders and downloaded approximately 1.8 GB. Containment was achieved before any further lateral movement was observed.',
        actionsTaken:
          'Workstation LAB-WS-14 removed from the network and rebuilt from a clean image. All credentials stored in the browser profile were reset. File share permissions were reviewed and least-privilege access applied. Endpoint detection rules were updated to match the sample family.',
        evidence: 'Memory capture lab-ws14.mem, sample hash record, file share access log for 12 days prior.',
        startedAt: iso(11, 10),
        completedAt: iso(10, 17),
      },
    ]);
  }

  if (!isUsable(KEYS.resolutions)) {
    const now = new Date();
    const iso = (daysAgo, hour) => {
      const d = new Date(now.getTime() - daysAgo * 86400000);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    saveResolutions([
      {
        id: 'RES-0001',
        incidentId: 'INC-0003',
        description:
          'Incident contained and closed. The compromised account was recovered, all affected credentials were reset, the workstation was rebuilt from a clean image, and the exfiltrated data set was identified. The research group was notified and confirmed no further use of the affected file share. Follow-up security awareness training was assigned to the research group.',
        resolvedBy: 'aisha@example.com',
        resolvedAt: iso(9, 16),
        closedAt: null,
      },
    ]);
  }

  if (!isUsable(KEYS.notifications)) {
    const now = new Date();
    const iso = (daysAgo, hour) => {
      const d = new Date(now.getTime() - daysAgo * 86400000);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    saveNotifications([
      {
        id: 'NOT-0001',
        userId: 'U-0001',
        incidentId: 'INC-0001',
        message: 'Incident INC-0001 has been submitted and is awaiting review.',
        isRead: false,
        createdAt: iso(2, 9),
      },
      {
        id: 'NOT-0002',
        userId: 'U-0001',
        incidentId: 'INC-0002',
        message: 'Incident INC-0002 is now under investigation.',
        isRead: false,
        createdAt: iso(4, 10),
      },
      {
        id: 'NOT-0003',
        userId: 'U-0001',
        incidentId: 'INC-0003',
        message: 'Incident INC-0003 has been resolved.',
        isRead: true,
        createdAt: iso(9, 16),
      },
      {
        id: 'NOT-0004',
        userId: 'U-0002',
        incidentId: 'INC-0002',
        message: 'You have been assigned to incident INC-0002.',
        isRead: true,
        createdAt: iso(4, 10),
      },
      {
        id: 'NOT-0006',
        userId: 'U-0005',
        incidentId: 'INC-0002',
        message: 'You have been added as an investigator. Incidents assigned to you will appear here.',
        isRead: true,
        createdAt: iso(6, 9),
      },
      {
        id: 'NOT-0005',
        userId: 'U-0003',
        incidentId: 'INC-0003',
        message: 'Investigation for INC-0003 is complete. Resolution can now be recorded.',
        isRead: false,
        createdAt: iso(10, 17),
      },
    ]);
  }
}

// Development helper: restore the original demo data.
function resetDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  seedIfMissing();
}

window.seedIfMissing = seedIfMissing;
window.resetDemoData = resetDemoData;
