// Per-power retained-term counts for direct planetary position accuracy tiers.
// Coefficients are reordered offline by complete frequency envelope; no coefficients are duplicated here.

export const MERCURY_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([123, 27, 14, 15, 11, 6, 4, 1, 1]),
    mid: Object.freeze([190, 27, 14, 15, 11, 6, 4, 1, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([71, 13, 9, 8, 5, 5, 2, 1, 1]),
    mid: Object.freeze([116, 13, 9, 8, 5, 5, 2, 1, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([86, 23, 11, 8, 6, 5, 2, 1, 1]),
    mid: Object.freeze([131, 23, 12, 9, 7, 6, 3, 1, 1]),
  }),
]);

export const VENUS_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([74, 14, 6, 5, 5, 3, 3, 0, 1]),
    mid: Object.freeze([113, 14, 6, 5, 5, 3, 3, 0, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([38, 4, 4, 3, 4, 1, 1, 0, 1]),
    mid: Object.freeze([61, 4, 4, 3, 4, 1, 1, 0, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([51, 20, 10, 3, 3, 1, 2]),
    mid: Object.freeze([78, 20, 10, 3, 3, 1, 2]),
  }),
]);

export const MARS_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([217, 38, 50, 7, 28, 5, 12, 4, 6, 2]),
    mid: Object.freeze([334, 38, 50, 7, 28, 5, 12, 4, 6, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([62, 12, 10, 4, 4, 3, 2]),
    mid: Object.freeze([66, 12, 10, 4, 4, 3, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([149, 49, 37, 8, 21, 3, 13, 1, 3, 1]),
    mid: Object.freeze([261, 49, 44, 8, 28, 3, 15, 1, 3, 1]),
  }),
]);

export const JUPITER_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([136, 124, 94, 60, 37, 25, 11, 7, 5, 3, 2]),
    mid: Object.freeze([198, 126, 96, 61, 38, 26, 11, 7, 5, 3, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([49, 52, 34, 26, 13, 6, 5, 2]),
    mid: Object.freeze([79, 60, 34, 26, 13, 6, 5, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([119, 119, 109, 66, 55, 23, 12, 6, 3, 0, 1]),
    mid: Object.freeze([193, 156, 129, 71, 56, 23, 12, 6, 3, 0, 1]),
  }),
]);

export const SATURN_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([203, 169, 138, 83, 66, 28, 19, 7, 5, 2, 1]),
    mid: Object.freeze([281, 180, 144, 84, 69, 28, 22, 7, 5, 2, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([63, 59, 41, 28, 25, 9, 11, 3, 2]),
    mid: Object.freeze([118, 63, 42, 30, 26, 9, 11, 3, 2]),
  }),
  Object.freeze({
    fast: Object.freeze([215, 196, 176, 109, 92, 35, 27, 4, 4, 0, 1]),
    mid: Object.freeze([320, 228, 237, 119, 130, 38, 44, 4, 7, 0, 1]),
  }),
]);

export const URANUS_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([105, 91, 70, 40, 18, 2, 2, 1, 0]),
    mid: Object.freeze([162, 93, 74, 40, 23, 2, 6, 1, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([29, 26, 17, 8, 4]),
    mid: Object.freeze([63, 29, 17, 8, 4]),
  }),
  Object.freeze({
    fast: Object.freeze([129, 104, 107, 45, 43, 8, 13, 0, 0]),
    mid: Object.freeze([194, 123, 129, 47, 48, 8, 16, 0, 3]),
  }),
]);

export const NEPTUNE_PREFIX_COUNTS = Object.freeze([
  Object.freeze({
    fast: Object.freeze([38, 45, 19, 14, 3, 1, 1, 1]),
    mid: Object.freeze([64, 45, 19, 14, 3, 1, 1, 1]),
  }),
  Object.freeze({
    fast: Object.freeze([21, 29, 11, 10]),
    mid: Object.freeze([30, 34, 12, 11]),
  }),
  Object.freeze({
    fast: Object.freeze([38, 33, 22, 8, 2]),
    mid: Object.freeze([67, 43, 24, 10, 2]),
  }),
]);
