const express =
  require("express");

const router =
  express.Router();

const {
  uploadFile,
  getFileList,
  removeFile,
  shareFileResource,
  getSharedResources,
} = require(
  "../controllers/fileManagementController"
);

const upload =
  require(
    "../middleware/uploadMiddleware"
  );

// ===================
// FILE UPLOAD
// ===================
router.post(
  "/upload",
  upload.single(
    "file"
  ),
  uploadFile
);

// ===================
// FILE LIST
// ===================
router.get(
  "/list",
  getFileList
);

// ===================
// REMOVE FILE
// ===================
router.delete(
  "/remove/:id",
  removeFile
);

// ===================
// SHARE FILE
// ===================
router.post(
  "/share",
  shareFileResource
);

// ===================
// GET SHARED FILES
// ===================
router.get(
  "/shared/list",
  getSharedResources
);

module.exports =
  router;