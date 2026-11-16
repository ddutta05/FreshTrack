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
    message = "We couldn't find that item.";
  }

  if (error.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_RESOURCE";
    message = "This item already exists.";
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      code = "FILE_TOO_LARGE";
      message = "Your file is too large. Please choose a smaller image.";
    } else {
      statusCode = 400;
      code = "UPLOAD_ERROR";
      message = "Please upload a valid file.";
    }
  }

  if (error.message === "Unsupported file type") {
    statusCode = 422;
    code = "INVALID_FILE_TYPE";
    message = "Please upload a valid image file.";
  }

  if (error.details) {
    details = error.details;
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction && statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  const responseMessage = isProduction && statusCode >= 500
    ? "Something went wrong on the server. Please try again."
    : message;

  return res.status(statusCode).json({
    success: false,
    message: responseMessage,
    error: {
      code,
      ...(details ? { details } : {})
    }
  });
}

module.exports = errorHandler;
