const mongoose =
  require("mongoose");

const teamMemberSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      projectId: { 
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      role: {
        type: String,
        enum: [
          "Project Manager",
          "Team Lead",
          "Senior Developer",
          "Junior Developer",
          "Intern",
          "UI/UX Designer",
          "Graphic Designer",
          "QA Tester",
          "Business Analyst",
        ],
        required: true,
      },

      status: {
        type: String,
        enum: [
          "Assigned",
          "Transferred",
          "Replaced",
        ],
        default: "Assigned",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "TeamMember",
    teamMemberSchema
  );