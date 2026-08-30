const mongoose = require("mongoose");
const multer = require("multer");
const { AppError } = require("../utils/errors");

function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message || "Internal server error";
  let details;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  }

  if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = "INVALID_ID";
    message = "Invalid resource id";
  }

  if (error.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_RESOURCE";
    message = "Resource already exists";
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      code = "FILE_TOO_LARGE";
      message = "Uploaded file is too large";
    } else {
      statusCode = 400;
      code = "UPLOAD_ERROR";
      message = "Invalid upload payload";
    }
  }

  if (error.message === "Unsupported file type") {
    statusCode = 422;
    code = "INVALID_FILE_TYPE";
    message = "Unsupported file type";
  }

  if (error.details) {
    details = error.details;
  }

  if (process.env.NODE_ENV !== "test" && statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      ...(details ? { details } : {})
    }
  });
}

module.exports = errorHandler;
