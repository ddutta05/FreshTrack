function notFound(req, _res, next) {
  const isApiRoute = req.originalUrl.startsWith("/api");

  next({
    statusCode: 404,
    code: "NOT_FOUND",
    message: isApiRoute
      ? "The requested API endpoint was not found."
      : "The requested resource was not found."
  });
}

module.exports = notFound;
