function notFound(req, _res, next) {
  next({
    statusCode: 404,
    code: "NOT_FOUND",
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = notFound;
