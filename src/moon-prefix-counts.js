// Per-power retained-term counts for the shared lunar argument priority.
// Runtime truncation performs no ranking and keeps each argument envelope intact.
export const MOON_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([90, 51, 27, 3, 1, 1, 1]),
    mid: Object.freeze([274, 140, 36, 4, 2, 2, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([60, 29, 14]),
    mid: Object.freeze([146, 48, 14]),
  }),
  Object.freeze({
    fast: Object.freeze([79, 39, 20]),
    mid: Object.freeze([173, 53, 24]),
  }),
]);
