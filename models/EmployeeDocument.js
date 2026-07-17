const mongoose =
  require("mongoose");

const employeeDocumentSchema =
  new mongoose.Schema(
    {
      employeeID: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },

      aadharCard: {
        type: String,
        default: "", 
      },

      panCard: {
        type: String,
        default: "",
      },

      resume: {
        type: String,
        default: "",
      },

      offerLetter: {
        type: String,
        default: "",
      },

      joiningLetter: {
        type: String,
        default: "",
      },

      certificates: [
        {
          type: String,
        },
      ],
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "EmployeeDocument",
    employeeDocumentSchema
  );