const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Only PDF and Standard Images are allowed
const allowedExtensions = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File format .${ext} is not allowed. Only PDF and Images (JPG, JPEG, PNG, WEBP) are permitted.`
      ),
      false
    );
  }
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
    const resourceType = isImage ? "image" : "raw";

    const cleanBaseName = path
      .parse(file.originalname)
      .name.replace(/[^a-zA-Z0-9_-]/g, "_");

    // For raw files (PDF), include the extension in public_id
    const publicId =
      resourceType === "raw"
        ? `${Date.now()}-${cleanBaseName}.${ext}`
        : `${Date.now()}-${cleanBaseName}`;

    return {
      folder: "file-management",
      resource_type: resourceType,
      public_id: publicId,
    };
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

module.exports = upload;