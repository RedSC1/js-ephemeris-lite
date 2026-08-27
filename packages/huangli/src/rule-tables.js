import { DATA } from './data.js';
import { BitSet } from './bitset.js';
export const G = Object.freeze(Object.fromEntries(DATA.gods.map(([name], i) => [name, i])));
export const A = Object.freeze(Object.fromEntries(DATA.activities.map(([name], i) => [name, i])));
const activities = indices => new BitSet(DATA.activities.length, indices);
const pair = p => p === null ? null : p.map(activities);
export const OfficerThings = { good: DATA.officerGood.map(activities), bad: DATA.officerBad.map(activities) };
export const Day8CharThings = { stemRules: DATA.stemActivities.map(pair), branchRules: DATA.branchActivities.map(pair) };
export const GodActivities = { table: Object.fromEntries(Object.entries(DATA.godActivities).map(([id, p]) => [id, pair(p)])) };
const levels = DATA.levels.map(([months, gods, virtual, level]) => [months, new BitSet(DATA.gods.length, gods), virtual, level]);
export function thingLevel(monthBranch, gods, virtual) {
  let level = -1;
  for (const [months, required, mask, value] of levels) {
    if ((months & (1 << monthBranch)) && (virtual & mask) === mask && gods.containsAll(required)) level = Math.max(level, value);
  }
  return level;
}
export const mod = (x, n) => ((x % n) + n) % n;
export function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be ${min}..${max}`);
  return value;
}
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const v of Object.values(value)) deepFreeze(v); Object.freeze(value); }
  return value;
}
deepFreeze(DATA);
