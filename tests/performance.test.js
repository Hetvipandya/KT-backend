const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPerformanceSummary, getOverallGrade } = require('../utils/performance');

test('buildPerformanceSummary returns the requested performance snapshot', () => {
  const summary = buildPerformanceSummary({
    attendance: 96,
    taskCompletion: 90,
    projectContribution: 88,
    lateComing: 1,
    leave: 2,
    managerRating: 4.5,
    kpiScore: 89,
  });

  assert.equal(summary.attendance, 96);
  assert.equal(summary.taskCompletion, 90);
  assert.equal(summary.projectContribution, 88);
  assert.equal(summary.lateComing, 1);
  assert.equal(summary.leave, 2);
  assert.equal(summary.managerRating, 4.5);
  assert.equal(summary.kpiScore, 89);
  assert.equal(summary.overallGrade, 'A');
});

test('getOverallGrade maps KPI score to grade', () => {
  assert.equal(getOverallGrade(95), 'A');
  assert.equal(getOverallGrade(84), 'B');
  assert.equal(getOverallGrade(68), 'C');
});
