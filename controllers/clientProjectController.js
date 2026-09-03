const Client = require("../models/Client");
const ClientMeeting = require("../models/ClientMeeting");
const ClientFeedback = require("../models/ClientFeedback");
const Deliverable = require("../models/Deliverable");


// ================= CLIENT =================
exports.addClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);

    res.status(201).json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getClients = async (req, res) => {
  try {
    const clients = await Client.find();

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= MEETING =================
exports.addMeeting = async (req, res) => {
  try {
    const meeting =
      await ClientMeeting.create(req.body);

    res.status(201).json({
      success: true,
      data: meeting,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= FEEDBACK =================
exports.addFeedback = async (req, res) => {
  try {
    const feedback =
      await ClientFeedback.create(req.body);

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= DELIVERABLE =================
exports.addDeliverable = async (req, res) => {
  try {
    const deliverable =
      await Deliverable.create(req.body);

    res.status(201).json({
      success: true,
      data: deliverable,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getDeliverables = async (req, res) => {
  try {
    const data = await Deliverable.find()
      .populate("clientId");

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};