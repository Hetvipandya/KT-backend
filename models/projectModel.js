const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    projectDescription: {
      type: String,
      default: "",
    },

    clientName: {
      type: String,
      required: true,
      trim: true,
    },

    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    projectBudget: {
      type: Number,
      default: 0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "testing",
        "review",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },

    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    interns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    files: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ======================================================
// CASCADE DELETE MIDDLEWARE (Without Daily Update)
// ======================================================

// Pre-findOneAndDelete middleware for cascade delete
projectSchema.pre('findOneAndDelete', async function(next) {
  const projectId = this.getQuery()['_id'];
  
  if (projectId) {
    try {
      // 1. Get Milestone and Task models reference
      const Milestone = mongoose.model('Milestone');
      const Task = mongoose.model('Task');
      
      // 2. Find all milestones for this project
      const milestones = await Milestone.find({ projectId: projectId });
      const milestoneIds = milestones.map(m => m._id);
      
      if (milestoneIds.length > 0) {
        // 3. Delete all tasks related to these milestones
        await Task.deleteMany({ milestoneId: { $in: milestoneIds } });
        console.log(`Deleted tasks for ${milestoneIds.length} milestones`);
      }
      
      // 4. Delete all milestones related to this project
      await Milestone.deleteMany({ projectId: projectId });
      console.log(`Deleted ${milestoneIds.length} milestones`);
      
    } catch (error) {
      console.error('Error in cascade delete middleware:', error);
    }
  }
  
  next();
});

// Pre-remove middleware (if using remove() method)
projectSchema.pre('remove', async function(next) {
  const projectId = this._id;
  
  if (projectId) {
    try {
      const Milestone = mongoose.model('Milestone');
      const Task = mongoose.model('Task');
      
      const milestones = await Milestone.find({ projectId: projectId });
      const milestoneIds = milestones.map(m => m._id);
      
      if (milestoneIds.length > 0) {
        // Delete all tasks
        await Task.deleteMany({ milestoneId: { $in: milestoneIds } });
      }
      
      // Delete all milestones
      await Milestone.deleteMany({ projectId: projectId });
      
    } catch (error) {
      console.error('Error in cascade delete middleware:', error);
    }
  }
  
  next();
});

module.exports = mongoose.model("Project", projectSchema);