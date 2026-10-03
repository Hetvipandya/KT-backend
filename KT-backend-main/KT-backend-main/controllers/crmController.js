const Lead =
  require("../models/Lead");

const Customer =
  require("../models/Customer");

const FollowUp =
  require("../models/FollowUp");


// ========================
// CREATE LEAD
// ========================
exports.createLead =
  async (req, res) => {
    try {
      const lead =
        await Lead.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Lead created successfully",
        data: lead,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// GET ALL LEADS
// ========================
exports.getAllLeads =
  async (req, res) => {
    try {
      const leads =
        await Lead.find()
          .populate(
            "assignedTo",
            "name email"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        count:
          leads.length,
        data: leads,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// GET SINGLE LEAD
// ========================
exports.getSingleLead =
  async (req, res) => {
    try {
      const lead =
        await Lead.findById(
          req.params.id
        ).populate(
          "assignedTo",
          "name email"
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found",
        });
      }

      res.status(200).json({
        success: true,
        data: lead,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// UPDATE LEAD
// ========================
exports.updateLead =
  async (req, res) => {
    try {
      const lead =
        await Lead.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Lead updated successfully",
        data: lead,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// DELETE LEAD
// ========================
exports.deleteLead =
  async (req, res) => {
    try {
      const lead =
        await Lead.findById(
          req.params.id
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found",
        });
      }

      await Lead.findByIdAndDelete(
        req.params.id
      );

      res.status(200).json({
        success: true,
        message:
          "Lead deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// UPDATE LEAD STATUS
// ========================
exports.updateLeadStatus =
  async (req, res) => {
    try {
      const { status } =
        req.body;

      const lead =
        await Lead.findById(
          req.params.id
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found",
        });
      }

      lead.status =
        status;

      await lead.save();

      // Lead Won → Customer
      if (
        status === "won"
      ) {
        const existingCustomer =
          await Customer.findOne({
            leadId:
              lead._id,
          });

        if (
          !existingCustomer
        ) {
          const customer =
            await Customer.create({
              leadId:
                lead._id,
              customerName:
                lead.leadName,
              companyName:
                lead.companyName,
              email:
                lead.email,
              phone:
                lead.phone,
            });

          return res
            .status(200)
            .json({
              success: true,
              message:
                "Lead converted to customer",
              data:
                customer,
            });
        }
      }

      res.status(200).json({
        success: true,
        message:
          "Lead status updated",
        data: lead,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// CREATE FOLLOWUP
// ========================
exports.createFollowUp =
  async (req, res) => {
    try {
      const lead =
        await Lead.findById(
          req.body.leadId
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message:
            "Lead not found",
        });
      }

      const followUp =
        await FollowUp.create(
          req.body
        );

      lead.status =
        "followup";

      await lead.save();

      res.status(201).json({
        success: true,
        message:
          "Follow up created successfully",
        data:
          followUp,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// GET FOLLOWUPS
// ========================
exports.getFollowUps =
  async (req, res) => {
    try {
      const followups =
        await FollowUp.find()
          .populate(
            "leadId"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        count:
          followups.length,
        data:
          followups,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// DELETE FOLLOWUP
// ========================
exports.deleteFollowUp =
  async (req, res) => {
    try {
      const followup =
        await FollowUp.findById(
          req.params.id
        );

      if (
        !followup
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Followup not found",
        });
      }

      await FollowUp.findByIdAndDelete(
        req.params.id
      );

      res.status(200).json({
        success: true,
        message:
          "Followup deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// CREATE CUSTOMER
// ========================
exports.createCustomer =
  async (req, res) => {
    try {
      const customer =
        await Customer.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Customer created successfully",
        data:
          customer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// GET CUSTOMERS
// ========================
exports.getCustomers =
  async (req, res) => {
    try {
      const customers =
        await Customer.find()
          .populate(
            "leadId"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        count:
          customers.length,
        data:
          customers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// GET SINGLE CUSTOMER
// ========================
exports.getSingleCustomer =
  async (req, res) => {
    try {
      const customer =
        await Customer.findById(
          req.params.id
        ).populate(
          "leadId"
        );

      if (
        !customer
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer not found",
        });
      }

      res.status(200).json({
        success: true,
        data:
          customer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// UPDATE CUSTOMER
// ========================
exports.updateCustomer =
  async (req, res) => {
    try {
      const customer =
        await Customer.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (
        !customer
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Customer updated successfully",
        data:
          customer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// DELETE CUSTOMER
// ========================
exports.deleteCustomer =
  async (req, res) => {
    try {
      const customer =
        await Customer.findById(
          req.params.id
        );

      if (
        !customer
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer not found",
        });
      }

      await Customer.findByIdAndDelete(
        req.params.id
      );

      res.status(200).json({
        success: true,
        message:
          "Customer deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

  // ========================
// GET SINGLE FOLLOWUP
// ========================
exports.getSingleFollowUp =
  async (req, res) => {
    try {
      const followup =
        await FollowUp.findById(
          req.params.id
        ).populate(
          "leadId"
        );

      if (!followup) {
        return res.status(404).json({
          success: false,
          message:
            "FollowUp not found",
        });
      }

      res.status(200).json({
        success: true,
        data: followup,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ========================
// UPDATE FOLLOWUP
// ========================
exports.updateFollowUp =
  async (req, res) => {
    try {
      const followup =
        await FollowUp.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!followup) {
        return res.status(404).json({
          success: false,
          message:
            "FollowUp not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "FollowUp updated successfully",
        data: followup,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };