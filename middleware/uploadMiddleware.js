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
  "gif",
  "svg",
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File format .${ext} is not allowed. Only PDF and Images (JPG, JPEG, PNG, WEBP, GIF, SVG) are permitted.`
      ),
      false
    );
  }
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const isImage = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
    const resourceType = isImage ? "image" : "raw";

    const cleanBaseName = path
      .parse(file.originalname)
      .name.replace(/[^a-zA-Z0-9_-]/g, "_");

    const isProfile =
      file.fieldname &&
      /profile|avatar|photo/i.test(file.fieldname);

    const folder = isProfile ? "kt-crm/profiles" : "file-management";

    // For raw files (PDF), include the extension in public_id
    const publicId =
      resourceType === "raw"
        ? `${Date.now()}-${cleanBaseName}.${ext}`
        : `${Date.now()}-${cleanBaseName}`;

    return {
      folder,
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

// Middleware specifically for profile image upload:
// Gracefully accepts profileImage, profileImg, photo, avatar, image, file, or whatever field name is sent
const profileImageUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed",
      });
    }

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const match =
        req.files.find((f) =>
          /profile|avatar|photo|image/i.test(f.fieldname)
        ) || req.files[0];
      req.file = match;
    }

    next();
  });
};

upload.profileImageUpload = profileImageUpload;
module.exports = upload;
module.exports.upload = upload;
module.exports.profileImageUpload = profileImageUpload;