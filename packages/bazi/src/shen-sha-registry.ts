import { ganzhiIndex, type FourPillars, type Ganzhi } from 'js-ephemeris-lite';
import { GENDER, type Gender } from './constants.js';
import {
  collectTargetShenSha, hasShenSha, SHEN_SHA_NAMES,
  type ShenShaChart, type ShenShaId, type ShenShaTarget,
} from './shen-sha.js';

export interface ShenShaContext {
  readonly pillars: Readonly<FourPillars>;
  readonly target: Ganzhi;
  readonly targetKind: ShenShaTarget;
  readonly gender: Gender | undefined;
}
/** Synchronous, pure predicate. Captured application state is not snapshotted. */
export interface ShenShaRule {
  readonly id: string;
  readonly name: string;
  readonly test: (context: ShenShaContext) => boolean;
}
export interface ShenShaMatch {
  readonly id: string;
  readonly name: string;
  /** Present only when this is the unmodified built-in rule. */
  readonly builtinId?: ShenShaId;
}
type Entry = Readonly<ShenShaMatch & { test?: ShenShaRule['test'] }>;

function defaults(): Entry[] {
  return SHEN_SHA_NAMES.map((name, builtinId) => Object.freeze({
    id: `builtin:${builtinId}`, name, builtinId: builtinId as ShenShaId,
  }));
}
function copyRule(rule: ShenShaRule): Entry {
  if (!rule || typeof rule.id !== 'string' || !rule.id.trim()
    || typeof rule.name !== 'string' || !rule.name.trim() || typeof rule.test !== 'function') {
    throw new TypeError('A rule requires nonempty id/name and a synchronous test');
  }
  return Object.freeze({ id: rule.id, name: rule.name, test: rule.test });
}

/** Mutable, instance-local builder. No global registry is modified. */
export class ShenShaRegistry {
  #rules = new Map<string, Entry>();
  constructor({ includeBuiltins = true }: { includeBuiltins?: boolean } = {}) {
    if (includeBuiltins) this.reset();
  }
  get size(): number { return this.#rules.size; }
  register(rule: ShenShaRule): this {
    const entry = copyRule(rule);
    if (entry.id.startsWith('builtin:')) throw new RangeError('builtin: is reserved; use replace for an existing built-in');
    if (this.#rules.has(entry.id)) throw new RangeError(`Duplicate rule: ${entry.id}`);
    this.#rules.set(entry.id, entry);
    return this;
  }
  replace(rule: ShenShaRule): this {
    const entry = copyRule(rule);
    if (!this.#rules.has(entry.id)) throw new RangeError(`Unknown rule: ${entry.id}`);
    this.#rules.set(entry.id, entry);
    return this;
  }
  remove(id: string): boolean { return this.#rules.delete(id); }
  clear(): void { this.#rules.clear(); }
  /** Restore exactly the default 66 rules, discarding custom entries. */
  reset(): void { this.#rules = new Map(defaults().map(rule => [rule.id, rule])); }
  snapshot(): ShenShaRuleSet { return new ShenShaRuleSet([...this.#rules.values()]); }
  bind(chart: ShenShaChart, options: { gender?: Gender } = {}): BoundShenSha {
    return this.snapshot().bind(chart, options);
  }
}

export class ShenShaRuleSet {
  readonly #rules: readonly Entry[];
  /** @internal Obtain snapshots from ShenShaRegistry. */
  constructor(entries: readonly Entry[]) {
    const seen = new Set<string>();
    this.#rules = Object.freeze(entries.map(entry => {
      if (seen.has(entry.id)) throw new RangeError(`Duplicate rule: ${entry.id}`);
      seen.add(entry.id);
      if (entry.builtinId !== undefined) {
        const id = entry.builtinId;
        if (!Number.isInteger(id) || id < 0 || id >= 66 || entry.id !== `builtin:${id}`
          || entry.name !== SHEN_SHA_NAMES[id] || entry.test !== undefined) {
          throw new RangeError('Invalid built-in rule descriptor');
        }
        return Object.freeze({ id: entry.id, name: entry.name, builtinId: id });
      }
      return copyRule(entry as ShenShaRule);
    }));
    Object.freeze(this);
  }
  get size(): number { return this.#rules.length; }
  bind(chart: ShenShaChart, options: { gender?: Gender } = {}): BoundShenSha {
    return new BoundShenSha(this, chart, options.gender);
  }
  evaluate(context: ShenShaContext): readonly ShenShaMatch[] {
    const { year, month, day, hour } = context.pillars;
    [year, month, day, hour, context.target].forEach(ganzhiIndex);
    const gender = context.gender;
    if (gender !== undefined && gender !== GENDER.FEMALE && gender !== GENDER.MALE) throw new RangeError('unknown gender');
    if (!Number.isInteger(context.targetKind) || context.targetKind < 0 || context.targetKind > 12) throw new RangeError('unknown targetKind');
    const frozen = Object.freeze({ pillars: Object.freeze({ year, month, day, hour }), target: context.target, targetKind: context.targetKind, gender });
    const bits = this.#rules.some(rule => rule.builtinId !== undefined)
      ? collectTargetShenSha(frozen, frozen.target, frozen.targetKind, { gender }) : 0n;
    const results: ShenShaMatch[] = [];
    for (const rule of this.#rules) {
      const matched = rule.builtinId === undefined ? rule.test!(frozen) : hasShenSha(bits, rule.builtinId);
      if (typeof matched !== 'boolean') throw new TypeError(`Rule ${rule.id} must return boolean (not a Promise)`);
      if (matched) results.push(Object.freeze({ id: rule.id, name: rule.name,
        ...(rule.builtinId === undefined ? {} : { builtinId: rule.builtinId }) }));
    }
    return Object.freeze(results);
  }
}

/** Rule collection and natal pillars are copied; rule closures must remain pure. */
export class BoundShenSha {
  readonly #rules: ShenShaRuleSet;
  readonly #pillars: Readonly<FourPillars>;
  readonly #gender: Gender | undefined;
  constructor(rules: ShenShaRuleSet, chart: ShenShaChart, gender?: Gender) {
    const { year, month, day, hour } = chart.pillars;
    [year, month, day, hour].forEach(ganzhiIndex);
    if (gender !== undefined && gender !== GENDER.FEMALE && gender !== GENDER.MALE) throw new RangeError('unknown gender');
    this.#rules = rules;
    this.#pillars = Object.freeze({ year, month, day, hour });
    this.#gender = gender;
    Object.freeze(this);
  }
  forTarget(target: Ganzhi, targetKind: ShenShaTarget): readonly ShenShaMatch[] {
    return this.#rules.evaluate({ pillars: this.#pillars, target, targetKind, gender: this.#gender });
  }
  natal(): Readonly<Record<'year' | 'month' | 'day' | 'hour', readonly ShenShaMatch[]>> {
    return Object.freeze({ year: this.forTarget(this.#pillars.year, 0),
      month: this.forTarget(this.#pillars.month, 1), day: this.forTarget(this.#pillars.day, 2),
      hour: this.forTarget(this.#pillars.hour, 3) });
  }
}
