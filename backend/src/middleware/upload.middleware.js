const multer = require("multer");
const env = require("../config/env");
const { isAllowedImageMimeType } = require("../utils/imageStorage");

function fileFilter(_req, file, cb) {
  if (!isAllowedImageMimeType(file.mimetype)) {
    return cb(new Error("Unsupported image type"));
  }
  return cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  }
});

module.exports = {
  upload
};
