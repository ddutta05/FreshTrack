function getPagination(query, defaultLimit = 10, maxLimit = 50) {
  const page = Math.max(Number(query.page) || 1, 1);
  const parsedLimit = Number(query.limit) || defaultLimit;
  const limit = Math.min(Math.max(parsedLimit, 1), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function toPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1
  };
}

module.exports = {
  getPagination,
  toPagination
};
