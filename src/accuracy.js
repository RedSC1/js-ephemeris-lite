export const ACCURACY = Object.freeze({
  FAST: 'fast',
  MID: 'mid',
  ACCURATE: 'accurate',
});

export function checkedAccuracy(accuracy, fallback = ACCURACY.ACCURATE) {
  const value = accuracy === undefined ? fallback : accuracy;
  if (value !== ACCURACY.FAST && value !== ACCURACY.MID && value !== ACCURACY.ACCURATE) {
    throw new RangeError("accuracy must be 'fast', 'mid', or 'accurate'");
  }
  return value;
}
