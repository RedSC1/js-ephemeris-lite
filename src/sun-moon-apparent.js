import { createApparentEvaluator } from './apparent-core.js';

// This entry intentionally never imports other planetary models.
export const { apparentGeometry, apparentBodyPosition, apparentBodyState } = createApparentEvaluator(
  body => { throw new RangeError(`unsupported Sun/Moon body: ${body}`); },
);
