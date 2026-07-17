const multer =
  require("multer");

const {
  CloudinaryStorage,
} = require(
  "multer-storage-cloudinary"
);

const cloudinary =
  require(
    "../config/cloudinary"
  );

const storage =
  new CloudinaryStorage({
    cloudinary, 

    params: async (
      req,
      file
    ) => {
      return {
        folder:
          "file-management",

        resource_type:
          "auto",

        public_id:
          Date.now() +
          "-" +
          file.originalname
            .split(".")[0],

        allowed_formats:
          [
            "pdf",
            "docx",
            "xlsx",
            "zip",
            "rar",
            "png",
            "jpg",
            "jpeg",
            "mp4",
            "pptx",
          ],
      };
    },
  });

const upload =
  multer({
    storage,
  });

module.exports =
  upload;