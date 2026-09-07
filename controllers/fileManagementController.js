const File =
  require(
    "../models/File"
  );

const FileVersion =
  require(
    "../models/FileVersion"
  );

  const SharedResource =
  require(
    "../models/SharedResource"
  );

// ======================
// UPLOAD FILE
// ======================
exports.uploadFile =
  async (
    req,
    res
  ) => {
    try {
      const {
        projectId,
        uploadedBy,
        category,
      } = req.body;

      const file =
        await File.create({
          projectId,
          uploadedBy,
          category,

          fileName:
            req.file.filename,

          originalName:
            req.file
              .originalname,

          fileType:
            req.file
              .originalname
              .split(".")
              .pop()
              .toUpperCase(),

          filePath:
            req.file.path,

          fileSize:
            req.file.size,
        });

      await FileVersion.create(
        {
          fileId:
            file._id,
          versionNumber: 1,
          uploadedBy,
          filePath:
            req.file.path,
          changeLog:
            "Initial Upload",
        }
      );

      res.status(201)
        .json({
          success: true,
          message:
            "File uploaded successfully",
          data: file,
        });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// ======================
// GET FILE LIST
// ======================
exports.getFileList =
  async (
    req,
    res
  ) => {
    try {
      const files =
        await File.find({
          isDeleted:
            false,
        })
          .populate(
            "uploadedBy",
            "name email"
          )
          .populate(
            "projectId",
            "projectName"
          );

      res.status(200)
        .json({
          success: true,
          total:
            files.length,
          data: files,
        });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// ======================
// DELETE FILE
// ======================
exports.removeFile =
  async (
    req,
    res
  ) => {
    try {
      const { id } =
        req.params;

      const file =
        await File.findById(
          id
        );

      if (!file) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "File not found",
          });
      }

      file.isDeleted =
        true;

      await file.save();

      res.status(200)
        .json({
          success: true,
          message:
            "File removed successfully",
        });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

  // ======================
// SHARE FILE RESOURCE
// ======================
exports.shareFileResource =
  async (
    req,
    res
  ) => {
    try {
      const {
        fileId,
        sharedWith,
        accessType,
      } = req.body;

      const file =
        await File.findById(
          fileId
        );

      if (!file) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "File not found",
          });
      }

      const sharedResource =
        await SharedResource.create(
          {
            fileId,
            sharedWith,
            accessType,
          }
        );

      res.status(201)
        .json({
          success: true,
          message:
            "File shared successfully",
          data:
            sharedResource,
        });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

  // ======================
// GET SHARED RESOURCES
// ======================
exports.getSharedResources =
  async (
    req,
    res
  ) => {
    try {
      const resources =
        await SharedResource.find()
          .populate(
            "fileId",
            "fileName originalName filePath"
          )
          .populate(
            "sharedWith",
            "name email"
          );

      res.status(200)
        .json({
          success: true,
          total:
            resources.length,
          data:
            resources,
        });
    } catch (error) {
      res.status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };