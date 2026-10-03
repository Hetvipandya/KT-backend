const mongoose = require("mongoose");

const clientMeetingSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    meetingDate: Date,
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ClientMeeting",
  clientMeetingSchema
);