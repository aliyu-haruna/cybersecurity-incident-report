// Dashboard statistics
function countBy(items, key) {
  return items.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function computeStats(incidents) {
  const total = incidents.length;
  const byStatus = countBy(incidents, 'status');
  const bySeverity = countBy(incidents, 'severity');
  const byType = countBy(incidents, 'type');
  return {
    total,
    submitted: byStatus.SUBMITTED || 0,
    underReview: byStatus.UNDER_REVIEW || 0,
    underInvestigation: byStatus.UNDER_INVESTIGATION || 0,
    resolved: byStatus.RESOLVED || 0,
    closed: byStatus.CLOSED || 0,
    open: incidents.filter((i) => statusIndex(i.status) < 3).length,
    critical: bySeverity.Critical || 0,
    byStatus,
    bySeverity,
    byType,
  };
}

// Counts incidents per month for the most recent `months` months, oldest first.
// Uses the incident creation date, so this is a reportable volume trend rather
// than a forecast.
function monthlyCounts(incidents, months) {
  const span = months || 6;
  const buckets = [];
  const now = new Date();
  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: d.toLocaleString(undefined, { month: 'short' }) + ' ' + d.getFullYear(),
      count: 0,
    });
  }
  incidents.forEach((i) => {
    const d = new Date(i.createdAt || i.dateTime);
    if (isNaN(d.getTime())) return;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.count += 1;
  });
  return buckets;
}

window.computeStats = computeStats;
window.countBy = countBy;
window.monthlyCounts = monthlyCounts;
