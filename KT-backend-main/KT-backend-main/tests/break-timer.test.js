const assert = require("assert");
const { calculateBreakTimerState } = require("../controllers/attendanceController");

const runTests = () => {
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
};

if (typeof describe === "function") {
  describe("Break Time Management & Reminder System", () => {
    test("handles no active break", () => {
      const state1 = calculateBreakTimerState({ breaks: [] });
      expect(state1.isOnBreak).toBe(false);
      expect(state1.status).toBe("no_active_break");
      expect(state1.maxDurationMinutes).toBe(60);
      expect(state1.remainingSeconds).toBe(3600);
      expect(state1.showPopup).toBe(false);
    });

    test("handles 10 mins elapsed (50m remaining)", () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const state2 = calculateBreakTimerState({ breaks: [{ startTime: tenMinAgo, endTime: null }] });
      expect(state2.isOnBreak).toBe(true);
      expect(state2.status).toBe("on_break");
      expect(state2.remainingMinutes).toBe(50);
      expect(state2.showPopup).toBe(false);
      expect(state2.isOverdue).toBe(false);
    });

    test("handles 10-minute remaining popup reminder", () => {
      const fiftyMinAgo = new Date(Date.now() - 50 * 60 * 1000);
      const state3 = calculateBreakTimerState({ breaks: [{ startTime: fiftyMinAgo, endTime: null }] });
      expect(state3.isOnBreak).toBe(true);
      expect(state3.status).toBe("on_break");
      expect(state3.remainingMinutes).toBe(10);
      expect(state3.showPopup).toBe(true);
      expect(state3.reminder).toBe("10_min_left");
      expect(state3.popupType).toBe("warning");
    });

    test("handles 5-minute remaining popup reminder", () => {
      const fiftyFiveMinAgo = new Date(Date.now() - 55 * 60 * 1000);
      const state4 = calculateBreakTimerState({ breaks: [{ startTime: fiftyFiveMinAgo, endTime: null }] });
      expect(state4.isOnBreak).toBe(true);
      expect(state4.status).toBe("on_break");
      expect(state4.remainingMinutes).toBe(5);
      expect(state4.showPopup).toBe(true);
      expect(state4.reminder).toBe("5_min_left");
      expect(state4.popupType).toBe("urgent");
    });

    test("handles 60+ minutes break time exceeded popup", () => {
      const sixtyTwoMinAgo = new Date(Date.now() - 62 * 60 * 1000);
      const state5 = calculateBreakTimerState({ breaks: [{ startTime: sixtyTwoMinAgo, endTime: null }] });
      expect(state5.isOnBreak).toBe(true);
      expect(state5.status).toBe("break_time_exceeded");
      expect(state5.statusDisplay).toBe("Break Time Exceeded");
      expect(state5.remainingMinutes).toBe(0);
      expect(state5.isOverdue).toBe(true);
      expect(state5.overdueMinutes).toBe(2);
      expect(state5.showPopup).toBe(true);
      expect(state5.reminder).toBe("break_over");
      expect(state5.popupType).toBe("overdue");
    });
  });
} else {
  runTests();
  console.log("🎉 All Break Time Management & Reminder System tests passed successfully!");
}
