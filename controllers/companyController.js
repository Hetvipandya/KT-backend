const Company =
  require("../models/Company");

const Branch =
  require("../models/Branch");

const Holiday =
  require("../models/Holiday");

const Policy =
  require("../models/Policy");

// ================= CREATE COMPANY =================
exports.createCompany =
  async (req, res) => {
    try {
      const existCompany =
        await Company.findOne();

      if (existCompany) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Company already exists",
          });
      }

      const company =
        await Company.create({
          companyName:
            "KEVALON Technology",
          gstNumber:
            "24BQSPH0154B1Z9",
          panNumber:
            "BQSPH0154",
        });

      // Default Branch
      await Branch.create({
        branchName:
          "Ahmedabad",
      });

      // Default Policies
      await Policy.insertMany([
        {
          title:
            "Attendance Policy",
          description:
            "Employees must mark attendance daily.",
        },
        {
          title:
            "Leave Policy",
          description:
            "Paid leave requires manager approval.",
        },
        {
          title:
            "Dress Code",
          description:
            "Employees should maintain professional attire.",
        },
        {
          title:
            "Work Ethics",
          description:
            "Maintain discipline and professionalism.",
        },
      ]);

      // Holidays
      await Holiday.insertMany([
        {
          holidayName:
            "Republic Day",
          holidayDate:
            new Date(
              "2026-01-26"
            ),
        },
        {
          holidayName:
            "Independence Day",
          holidayDate:
            new Date(
              "2026-08-15"
            ),
        },
        {
          holidayName:
            "Diwali",
          holidayDate:
            new Date(
              "2026-11-08"
            ),
        },
      ]);

      res.status(201).json({
        success: true,
        message:
          "Company created successfully",
        company,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= GET COMPANY =================
exports.getCompanyDetails =
  async (req, res) => {
    try {
      const company =
        await Company.findOne();

      const branches =
        await Branch.find();

      const holidays =
        await Holiday.find();

      const policies =
        await Policy.find();

      res.status(200).json({
        success: true,
        company,
        branches,
        holidays,
        policies,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= UPDATE COMPANY =================
exports.updateCompany =
  async (req, res) => {
    try {
      const company =
        await Company.findOne();

      if (!company) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Company not found",
          });
      }

      const updated =
        await Company.findByIdAndUpdate(
          company._id,
          req.body,
          {
            new: true,
          }
        );

      res.status(200).json({
        success: true,
        message:
          "Company updated successfully",
        updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };