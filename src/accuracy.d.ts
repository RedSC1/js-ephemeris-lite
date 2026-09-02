export type Accuracy = 'fast' | 'mid' | 'accurate';

export const ACCURACY: Readonly<{
  FAST: 'fast';
  MID: 'mid';
  ACCURATE: 'accurate';
}>;

export function checkedAccuracy(accuracy?: Accuracy, fallback?: Accuracy): Accuracy;
