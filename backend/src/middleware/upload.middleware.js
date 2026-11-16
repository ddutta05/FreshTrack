const multer = require("multer");
const env = require("../config/env");
const { isAllowedImageMimeType } = require("../utils/imageStorage");
const { AppError } = require("../utils/errors");

function fileFilter(_req, file, cb) {
  if (!isAllowedImageMimeType(file.mimetype)) {
    return cb(new AppError("Unsupported image type. Please upload a supported image file.", 422, "INVALID_IMAGE_MIME_TYPE"));
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
