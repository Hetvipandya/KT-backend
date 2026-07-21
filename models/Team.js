const mongoose =
  require("mongoose");
 
const teamSchema =
  new mongoose.Schema(
   {
     teamLeadUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },

    teamLeadEmployee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
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