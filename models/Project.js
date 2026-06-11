const mongoose =
  require("mongoose");

const projectSchema =
  new mongoose.Schema(
    {
      projectName: {
        type: String,
        required: true,
        trim: true,
      },

      // Auto Generate
      // Example:
      // PR1, PR2, PR3
      projectCode: {
        type: String,
        unique: true,
      },

      clientName: {
        type: String,
        required: true,
        trim: true,
      },

      projectType: {
        type: String,
        enum: [
          "Website",
          "Mobile App",
          "CRM",
          "ERP",
          "Software",
          "Marketing",
          "Other",
        ],
        default: "Other",
      },

      projectDescription: {
        type: String,
        default: "",
      },

      projectBudget: {
        type: Number,
        default: 0,
      },

      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },

      priority: {
        type: String,
        enum: [
          "Low",
          "Medium",
          "High",
          "Critical",
        ],
        default: "Medium",
      },

      projectManager: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      teamLead: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      teamMembers: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      status: {
        type: String,
        enum: [
          "Draft",
          "Pending Approval",
          "Planning",
          "Active",
          "On Hold",
          "Under Review",
          "Completed",
          "Delivered",
          "Cancelled",
        ],
        default: "Draft",
      },

      progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },

      isDeleted: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

// Fix OverwriteModelError
delete mongoose.models.Project;

module.exports =
  mongoose.model(
    "Project",
    projectSchema
  );