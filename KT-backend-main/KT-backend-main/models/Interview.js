const mongoose =
  require("mongoose");

const interviewSchema =
  new mongoose.Schema(
    {
      candidateId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: true, 
      },

      interviewerName:
        String,

      date: Date,

      mode: {
        type: String,
        enum: [
          "online",
          "offline",
        ],
      },

      feedback: String,

      rating: Number,

      status: {
        type: String,
        enum: [
          "scheduled",
          "completed",
          "cancelled",
          "approved",
          "rejected",
        ],
        default:
          "scheduled",
      },

      approvedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      approvedAt: Date,

      rejectionReason:
        String,
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Interview",
    interviewSchema
  );
  