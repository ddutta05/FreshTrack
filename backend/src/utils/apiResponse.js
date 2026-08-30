function success(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function paginated(res, statusCode, message, items, pagination) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      items,
      pagination
    }
  });
}

module.exports = {
  success,
  paginated
};
