const assert = require("assert");
const { calculateBreakTimerState } = require("../controllers/attendanceController");

console.log("🧪 Running Break Time Management & Reminder System Tests...");

// Test 1: No active break
const noBreakDoc = {
  breaks: []
};
const state1 = calculateBreakTimerState(noBreakDoc);
assert.strictEqual(state1.isOnBreak, false);
assert.strictEqual(state1.status, "no_active_break");
assert.strictEqual(state1.maxDurationMinutes, 60);
assert.strictEqual(state1.remainingSeconds, 3600);
assert.strictEqual(state1.showPopup, false);
console.log("✅ Test 1 Passed: No active break handling.");

// Test 2: Active break started 10 minutes ago (50 minutes remaining)
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
const break10Doc = {
  breaks: [{ startTime: tenMinAgo, endTime: null }]
};
const state2 = calculateBreakTimerState(break10Doc);
assert.strictEqual(state2.isOnBreak, true);
assert.strictEqual(state2.status, "on_break");
assert.strictEqual(state2.remainingMinutes, 50);
assert.strictEqual(state2.showPopup, false);
assert.strictEqual(state2.isOverdue, false);
console.log("✅ Test 2 Passed: 10 mins elapsed (50m remaining).");

// Test 3: Active break started 50 minutes ago (10 minutes remaining reminder)
const fiftyMinAgo = new Date(Date.now() - 50 * 60 * 1000);
const break50Doc = {
  breaks: [{ startTime: fiftyMinAgo, endTime: null }]
};
const state3 = calculateBreakTimerState(break50Doc);
assert.strictEqual(state3.isOnBreak, true);
assert.strictEqual(state3.status, "on_break");
assert.strictEqual(state3.remainingMinutes, 10);
assert.strictEqual(state3.showPopup, true);
assert.strictEqual(state3.reminder, "10_min_left");
assert.strictEqual(state3.reminderMessage, "10 minutes remaining. Please return to work soon.");
assert.strictEqual(state3.popupType, "warning");
console.log("✅ Test 3 Passed: 10-minute remaining popup reminder.");

// Test 4: Active break started 55 minutes ago (5 minutes remaining reminder)
const fiftyFiveMinAgo = new Date(Date.now() - 55 * 60 * 1000);
const break55Doc = {
  breaks: [{ startTime: fiftyFiveMinAgo, endTime: null }]
};
const state4 = calculateBreakTimerState(break55Doc);
assert.strictEqual(state4.isOnBreak, true);
assert.strictEqual(state4.status, "on_break");
assert.strictEqual(state4.remainingMinutes, 5);
assert.strictEqual(state4.showPopup, true);
assert.strictEqual(state4.reminder, "5_min_left");
assert.strictEqual(state4.reminderMessage, "5 minutes remaining. Please return to work.");
assert.strictEqual(state4.popupType, "urgent");
console.log("✅ Test 4 Passed: 5-minute remaining popup reminder.");

// Test 5: Active break started 62 minutes ago (Break time exceeded / overdue)
const sixtyTwoMinAgo = new Date(Date.now() - 62 * 60 * 1000);
const break62Doc = {
  breaks: [{ startTime: sixtyTwoMinAgo, endTime: null }]
};
const state5 = calculateBreakTimerState(break62Doc);
assert.strictEqual(state5.isOnBreak, true);
assert.strictEqual(state5.status, "break_time_exceeded");
assert.strictEqual(state5.statusDisplay, "Break Time Exceeded");
assert.strictEqual(state5.remainingMinutes, 0);
assert.strictEqual(state5.isOverdue, true);
assert.strictEqual(state5.overdueMinutes, 2);
assert.strictEqual(state5.showPopup, true);
assert.strictEqual(state5.reminder, "break_over");
assert.strictEqual(state5.reminderMessage, "Your break time is over. Please return to work.");
assert.strictEqual(state5.popupType, "overdue");
console.log("✅ Test 5 Passed: 60+ minutes break time exceeded popup.");

console.log("🎉 All Break Time Management & Reminder System tests passed successfully!");
