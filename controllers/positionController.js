const Position = require("../models/Position");

// ================= ADD POSITION =================
exports.addPosition = async (req, res) => {
  try {
    const {
      title,
      type,
      category,
      desc,
      skills,
      responsibilities,
      exp,
      location,
      isActive,
    } = req.body;

    const newPosition = new Position({
      title,
      type,
      category,
      desc,
      skills,
      responsibilities,
      exp,
      location,
      isActive,
    });

    await newPosition.save();

    res.status(201).json({
      success: true,
      message: "Position added successfully",
      data: newPosition,
    });
  } catch (error) {
    console.error("Add Position Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add position",
      error: error.message,
    });
  }
};

// ================= GET ALL POSITIONS =================
exports.getAllPositions = async (req, res) => {
  try {
    const positions = await Position.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: positions.length,
      data: positions,
    });
  } catch (error) {
    console.error("Get Positions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch positions",
      error: error.message,
    });
  }
};

// ================= GET SINGLE POSITION =================
exports.getPositionById = async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);

    if (!position) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.status(200).json({
      success: true,
      data: position,
    });
  } catch (error) {
    console.error("Get Position Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch position",
      error: error.message,
    });
  }
};

// ================= UPDATE POSITION =================
exports.updatePosition = async (req, res) => {
  try {
    const updatedPosition = await Position.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedPosition) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Position updated successfully",
      data: updatedPosition,
    });
  } catch (error) {
    console.error("Update Position Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update position",
      error: error.message,
    });
  }
};

// ================= DELETE POSITION =================
exports.deletePosition = async (req, res) => {
  try {
    const deletedPosition = await Position.findByIdAndDelete(req.params.id);

    if (!deletedPosition) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Position deleted successfully",
    });
  } catch (error) {
    console.error("Delete Position Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete position",
      error: error.message,
    });
  }
};