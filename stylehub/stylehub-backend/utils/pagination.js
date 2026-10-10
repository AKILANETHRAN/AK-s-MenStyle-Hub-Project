export function parsePagination(query, defaultPageSize = 12) {
  if (query.page === undefined) return null;

  const page = Number(query.page);
  const pageSize = query.limit === undefined ? defaultPageSize : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { error: 'Page must be a positive integer and limit must be between 1 and 100.' };
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) return { error: 'Page number is too large.' };
  return { page, pageSize, offset };
}

export function paginationMeta(total, pagination) {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize)
  };
}
