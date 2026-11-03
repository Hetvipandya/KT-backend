require("dotenv").config();
const axios = require("axios");
const cloudinary = require("../config/cloudinary");
const TaskManagement = require("../models/taskModel");
const { connectDB, disconnectDB } = require("../config/db");

const uploadBuffer = (buffer, fileName) =>
  new Promise((resolve, reject) => {
    const ext = fileName.split(".").pop().toLowerCase();
    const resourceType = ext === "pdf" ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "file-management",
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

const migrateTaskAttachments = async () => {
  await connectDB();

  const tasks = await TaskManagement.find({
    "attachments.fileUrl": /(^\/uploads\/|\/uploads\/)/,
  }).select("_id attachments");

  let migrated = 0;
  let removedUnavailable = 0;
  let failed = 0;

  for (const task of tasks) {
    let changed = false;

    for (const attachment of task.attachments) {
      const url = attachment.fileUrl || "";
      if (!url || url.includes("res.cloudinary.com")) continue;

      try {
        const sourceUrl =
          /^https?:\/\//i.test(url)
            ? url
            : `${(process.env.BASE_URL || "https://kt-backend-ttzj.onrender.com").replace(/\/$/, "")}${url.startsWith("/") ? url : `/uploads/${url}`}`;
        const response = await axios.get(sourceUrl, {
          responseType: "arraybuffer",
          timeout: 120000,
          validateStatus: (status) => status >= 200 && status < 300,
        });
        const result = await uploadBuffer(
          Buffer.from(response.data),
          attachment.fileName || url.split("/").pop()
        );
        attachment.fileUrl = result.secure_url;
        changed = true;
        migrated++;
      } catch (error) {
        failed++;
        const status = error.response?.status;
        if (status === 404) {
          task.attachments = task.attachments.filter((item) => item !== attachment);
          changed = true;
          removedUnavailable++;
          continue;
        }
        console.error(
          `Could not migrate task ${task._id}, attachment ${attachment.fileName}:`,
          error.message
        );
      }
    }

    if (changed) await task.save();
  }

  console.log(
    `Task attachment migration complete: ${migrated} migrated, ${removedUnavailable} unavailable attachments removed, ${failed} failed`
  );
  await disconnectDB();
};

migrateTaskAttachments().catch(async (error) => {
  console.error("Task attachment migration failed:", error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
