import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/pagination.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const pagination = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const { fetchPaginatedPages, MAX_FETCH_ALL_PAGES } = pagination;

function response(items, { page, limit, total, pages }) {
  return { data: { items, pagination: { page, limit, total, pages } } };
}

test('fetches and combines every page using the requested page size', async () => {
  const calls = [];
  const items = await fetchPaginatedPages(async (page, limit) => {
    calls.push({ page, limit });
    const data = [[1, 2], [3, 4], [5]][page - 1];
    return response(data, { page, limit, total: 5, pages: 3 });
  }, 2);

  assert.deepEqual(items, [1, 2, 3, 4, 5]);
  assert.deepEqual(calls, [
    { page: 1, limit: 2 },
    { page: 2, limit: 2 },
    { page: 3, limit: 2 },
  ]);
});

test('returns an empty result for the backend one-page empty response', async () => {
  const calls = [];
  const items = await fetchPaginatedPages(async (page, limit) => {
    calls.push({ page, limit });
    return response([], { page, limit, total: 0, pages: 1 });
  });

  assert.deepEqual(items, []);
  assert.deepEqual(calls, [{ page: 1, limit: 50 }]);
});

test('rejects rather than returning accumulated data when a later page fails', async () => {
  let calls = 0;
  await assert.rejects(
    fetchPaginatedPages(async (page, limit) => {
      calls += 1;
      if (page === 2) throw new Error('page request failed');
      return response([1, 2], { page, limit, total: 3, pages: 2 });
    }, 2),
    /page request failed/,
  );
  assert.equal(calls, 2);
});

test('rejects malformed, mismatched, or inconsistent pagination metadata', async (t) => {
  const invalidCases = [
    ['fractional page', (page, limit) => response([1], { page: 1.5, limit, total: 1, pages: 1 })],
    ['returned page mismatch', (page, limit) => response([1], { page: page + 1, limit, total: 1, pages: 1 })],
    ['returned limit mismatch', (page, limit) => response([1], { page, limit: limit + 1, total: 1, pages: 1 })],
    ['pages disagree with total', (page, limit) => response([1], { page, limit, total: 1, pages: 2 })],
    ['excessive page count', (page, limit) => response([1, 2], {
      page,
      limit,
      total: MAX_FETCH_ALL_PAGES * limit + 1,
      pages: MAX_FETCH_ALL_PAGES + 1,
    })],
  ];

  for (const [name, makeResponse] of invalidCases) {
    await t.test(name, async () => {
      let calls = 0;
      await assert.rejects(fetchPaginatedPages(async (page, limit) => {
        calls += 1;
        return makeResponse(page, limit);
      }, 2));
      assert.equal(calls, 1);
    });
  }

  await t.test('metadata changes between pages', async () => {
    await assert.rejects(fetchPaginatedPages(async (page, limit) => {
      return page === 1
        ? response([1, 2], { page, limit, total: 3, pages: 2 })
        : response([3, 4], { page, limit, total: 4, pages: 2 });
    }, 2), /metadata changed/);
  });
});
