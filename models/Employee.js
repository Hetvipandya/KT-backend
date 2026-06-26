const mongoose =
  require("mongoose");

const employeeSchema =
  new mongoose.Schema(
    {
      employeeID: {
        type: String, 
        unique: true,
      },

      userID: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      // PERSONAL DETAILS
      firstName: {
        type: String,
        required: true,
        trim: true,
      },

      lastName: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
      },

      mobile: {
        type: String,
        required: true,
      },

      gender: {
        type: String,
        enum: [
          "Male",
          "Female",
          "Other",
        ],
      },

      dob: {
        type: Date, 
      },

      bloodGroup: {
        type: String,
      },

      profileImage: {
        type: String,
        default: "",
      },

      // ADDRESS DETAILS
     currentAddress: {
  type: String,
  default: "",
},

permanentAddress: {
  type: String,
  default: "",
},

      // EMERGENCY CONTACT
      emergencyContact: {
        name: String,
        relation: String,
        phone: String,
      },

      // EDUCATION
      education: [
        {
          degree: String,
          institute: String,
          passingYear: String,
          percentage: String,
        },
      ],

      // EXPERIENCE
      experience: [
        {
          companyName: String,
          designation: String,
          fromDate: Date,
          toDate: Date,
        },
      ],

      // SKILLS
        skills: {
        type: [String],
        default: [],
      },

      // SALARY STRUCTURE
      salaryStructure: {
        basicSalary: {
          type: Number,
          default: 0,
        },

        hra: {
          type: Number,
          default: 0,
        },

        allowances: {
          type: Number,
          default: 0,
        },

        deductions: {
          type: Number,
          default: 0,
        },

        grossSalary: {
          type: Number,
          default: 0,
        },
      },

      // DEPARTMENT
      department: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Department",
      },

      // TEAM LEAD
      teamLead: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      joiningDate: {
        type: Date,
        default: Date.now,
      },

      employeeStatus: {
        type: String,
        enum: [
          "Active",
          "Inactive",
          "Resigned",
          "Terminated",
        ],
        default: "Active",
      },
      currentAction: {
  type: String,
  enum: [
    "created",
    "probation",
    "confirmation",
    "resignation",
    "exit",
  ],
  default: "all",
},
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Employee",
    employeeSchema
  );