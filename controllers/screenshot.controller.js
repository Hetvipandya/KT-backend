const mongoose = require("mongoose");
const Screenshot = require("../models/Screenshot");

const getAuthenticatedUserId = (req) => req.user?._id || req.user?.id;

exports.createScreenshot = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { sessionId, date, captureTime } = req.body;
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (typeof sessionId !== "string" || !sessionId.trim() || !imageUrl) {
      return res.status(400).json({
        success: false, 
        message: "sessionId and imageUrl are required",
      });
    }

    const parsedDate = typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : null;
    if (
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        success: false,
        message: "date must be a valid YYYY-MM-DD date",
      });
    }

    const parsedCaptureTime = captureTime === undefined ? undefined : new Date(captureTime);
    if (parsedCaptureTime && Number.isNaN(parsedCaptureTime.getTime())) {
      return res.status(400).json({ success: false, message: "captureTime must be a valid date" });
    }

    const screenshot = await Screenshot.create({
      sessionId: sessionId.trim(),
      userId,
      employeeName: req.user.name,
      role: req.user.role || "",
      date,
      ...(parsedCaptureTime ? { captureTime: parsedCaptureTime } : {}),
      imageUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Screenshot saved successfully",
      data: screenshot,
    });
  } catch (error) {
    return res.status(error.name === "ValidationError" ? 400 : 500).json({
      success: false,
      message: error.message || "Error saving screenshot",
    });
  }
};

exports.listScreenshots = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = { userId };

    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    if (req.query.date) filter.date = req.query.date;

    const [screenshots, total] = await Promise.all([
      Screenshot.find(filter)
        .sort({ captureTime: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Screenshot.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: screenshots.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: screenshots,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching screenshots",
    });
  }
};

exports.getScreenshotById = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid screenshot ID" });
    }

    const screenshot = await Screenshot.findOne({ _id: req.params.id, userId });
    if (!screenshot) {
      return res.status(404).json({ success: false, message: "Screenshot not found" });
    }

    return res.status(200).json({ success: true, data: screenshot });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching screenshot",
    });
  }
};

exports.deleteScreenshot = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid screenshot ID" });
    }

    const screenshot = await Screenshot.findOneAndDelete({ _id: req.params.id, userId });
    if (!screenshot) {
      return res.status(404).json({ success: false, message: "Screenshot not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Screenshot deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting screenshot",
    });
  }
};