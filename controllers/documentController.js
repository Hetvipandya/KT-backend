const Document = require("../models/Document");

// Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    const {
      title,
      description,
      documentType,
      referenceId,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File is required",
      });
    }

    const doc = await Document.create({
      title,
      description,
      documentType,
      referenceId,
      fileName: req.file.originalname,
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      uploadedBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: doc,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Get All Documents
exports.getAllDocuments = async (req, res) => {
  try {
    const docs = await Document.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: docs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Get By Type (employee/student/company/project)
exports.getByType = async (req, res) => {
  try {
    const { type } = req.params;

    const docs = await Document.find({
      documentType: type,
    });

    res.json({
      success: true,
      data: docs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Delete Document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    await Document.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Document deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};