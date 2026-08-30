const path = require("path");
const multer = require("multer");
const env = require("../config/env");

const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(process.cwd(), "uploads"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext && ext.length <= 6 ? ext : ".jpg";
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, safeName);
  }
});

function fileFilter(_req, file, cb) {
  if (!allowedMimes.has(file.mimetype)) {
    return cb(new Error("Unsupported file type"));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  }
});

module.exports = {
  upload
};
