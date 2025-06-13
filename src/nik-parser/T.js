// String to Integer
export function T(e, t) {
  let n;
  const r = typeof e;
  return 'boolean' === r
    ? +e
    : 'string' === r
      ? ((n = parseInt(e, t || 10)), isNaN(n) || !isFinite(n) ? 0 : n)
      : 'number' === r && isFinite(e)
        ? 0 | e
        : 0;
}
