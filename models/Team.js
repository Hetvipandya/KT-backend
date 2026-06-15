const mongoose =
  require("mongoose");

const teamSchema =
  new mongoose.Schema(
   {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project", 
        required: true,
      },

      projectManager: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      teamLead: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      developers: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,
          ref: "User",
        },
      ],

      interns: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,
          ref: "User",
        },
      ],

      designers: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,
          ref: "User",
        },
      ],

      testers: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,
          ref: "User",
        },
      ],
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Team",
    teamSchema
  );