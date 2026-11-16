export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const MAX_PAGE_SIZE = 50;
export const MAX_FETCH_ALL_PAGES = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object'
);

const unwrapPaginated = <T,>(
  payload: unknown,
  requestedPage: number,
  requestedLimit: number,
): PaginatedResult<T> => {
  const body = isRecord(payload) && 'data' in payload ? payload.data : payload;
  if (!isRecord(body) || !Array.isArray(body.items) || !isRecord(body.pagination)) {
    throw new Error('Invalid paginated API response');
  }

  const { page, limit, total, pages } = body.pagination;
  const isIntegerInRange = (value: unknown, min: number, max: number): value is number => (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max
  );
  if (!isIntegerInRange(page, 1, Number.MAX_SAFE_INTEGER)
    || !isIntegerInRange(limit, 1, MAX_PAGE_SIZE)
    || !isIntegerInRange(total, 0, Number.MAX_SAFE_INTEGER)
    || !isIntegerInRange(pages, 1, MAX_FETCH_ALL_PAGES)) {
    throw new Error('Invalid pagination metadata in API response');
  }
  if (page !== requestedPage || limit !== requestedLimit) {
    throw new Error('Paginated API response does not match the requested page and limit');
  }

  const expectedPages = Math.max(1, Math.ceil(total / limit));
  if (pages !== expectedPages || page > pages) {
    throw new Error('Inconsistent pagination page count in API response');
  }

  const expectedItemCount = Math.max(0, Math.min(limit, total - (page - 1) * limit));
  if (body.items.length !== expectedItemCount) {
    throw new Error('Paginated API returned an unexpected number of items');
  }

  return {
    items: body.items as T[],
    pagination: { page, limit, total, pages },
  };
};

export const fetchPaginatedPages = async <T,>(
  loadPage: (page: number, limit: number) => Promise<unknown>,
  limit = MAX_PAGE_SIZE,
): Promise<T[]> => {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`Pagination limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }

  const firstPage = unwrapPaginated<T>(await loadPage(1, limit), 1, limit);
  const { total, pages } = firstPage.pagination;
  const items = [...firstPage.items];

  for (let page = 2; page <= pages; page += 1) {
    const result = unwrapPaginated<T>(await loadPage(page, limit), page, limit);
    if (result.pagination.total !== total || result.pagination.pages !== pages) {
      throw new Error('Pagination metadata changed while fetching results');
    }
    items.push(...result.items);
  }

  return items;
};
