import "@testing-library/jest-dom/vitest";

global.fetch = vi.fn();

beforeEach(() => {
  global.fetch.mockReset();
  localStorage.clear();
});
