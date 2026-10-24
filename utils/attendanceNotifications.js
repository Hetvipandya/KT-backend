const { notify } = require("./sendNotification");

const notifyAutoCheckoutSuccess = async (attendance) => {
  if (!attendance?.userId || !attendance?.checkOutTime) {
    return;
  }

  await notify({
    userId: attendance.userId,
    title: "Automatic checkout complete",
    message: "You have been automatically checked out successfully.",
    type: "ATTENDANCE_AUTO_CHECKOUT",
    channel: "PUSH",
    meta: {
      attendanceId: String(attendance._id),
      checkOutTime: new Date(attendance.checkOutTime).toISOString(),
      autoCheckedOut: true,
    },
  });
};

module.exports = { notifyAutoCheckoutSuccess };
