require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "domq86row",
  api_key: process.env.CLOUDINARY_API_KEY || "831937586592815",
  api_secret: process.env.CLOUDINARY_API_SECRET || "2PoHEcgp9Xk7usiFKJFTBFuJzko",
});

module.exports = cloudinary;