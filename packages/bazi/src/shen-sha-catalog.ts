import { ganzhiIndex, type Ganzhi } from 'js-ephemeris-lite';
import { GENDER, type Gender } from './constants.js';
import type { BaziPillarAnalysis } from './chart.js';
import { collectTargetShenSha, hasShenSha, type ShenShaId, type ShenShaTarget } from './shen-sha.js';

export interface BaziShenShaInput {
  readonly chart: BaziPillarAnalysis;
  readonly target: Ganzhi;
  readonly targetKind: ShenShaTarget;
  readonly gender: Gender | undefined;
}
export interface BaziShenShaRule {
  readonly id: string;
  readonly name: string;
  /** Synchronous pure predicate; captured mutable state is not copied. */
  readonly test: (input: BaziShenShaInput) => boolean;
}
export interface BaziShenShaMatch {
  readonly id: string;
  /** Built-in names are empty; localize using builtinId. */
  readonly name: string;
  readonly builtinId: number; // -1 for custom rules
}
export interface BaziShenShaSelection { readonly disabledIds?: readonly string[] }
function key(value: string): void {
  if (typeof value !== 'string' || !value || /[:\s]/u.test(value)) throw new TypeError('Keys must be nonempty without whitespace or colon');
}
function label(value: string): void {
  key(value);
  if (value === 'builtin' || value === 'option1') throw new RangeError('Reserved module label');
}
export class BaziShenShaModule {
  readonly label: string;
  readonly rules: readonly BaziShenShaRule[];
  constructor(moduleLabel: string, rules: readonly BaziShenShaRule[]) {
    label(moduleLabel);
    if (!Array.isArray(rules) || !rules.length) throw new RangeError('Empty module');
    const seen = new Set<string>();
    this.label = moduleLabel;
    this.rules = Object.freeze(rules.map(rule => {
      key(rule.id);
      if (seen.has(rule.id) || typeof rule.name !== 'string' || !rule.name.trim() || typeof rule.test !== 'function') throw new TypeError('Invalid or duplicate rule');
      seen.add(rule.id);
      return Object.freeze({ id: rule.id, name: rule.name, test: rule.test });
    }));
    Object.freeze(this);
  }
}
export class BaziShenShaCatalog {
  readonly modules: readonly BaziShenShaModule[];
  constructor(modules: readonly BaziShenShaModule[] = []) {
    const seen = new Set<string>();
    this.modules = Object.freeze(modules.map(module => {
      const copy = new BaziShenShaModule(module.label, module.rules);
      if (seen.has(copy.label)) throw new RangeError('Duplicate module label');
      seen.add(copy.label);
      return copy;
    }));
    Object.freeze(this);
  }
  addModule(module: BaziShenShaModule): BaziShenShaCatalog {
    return new BaziShenShaCatalog([...this.modules, module]);
  }
  removeModule(moduleLabel: string): BaziShenShaCatalog {
    label(moduleLabel);
    if (!this.modules.some(module => module.label === moduleLabel)) throw new RangeError('Unknown module');
    return new BaziShenShaCatalog(this.modules.filter(module => module.label !== moduleLabel));
  }
  createContext(selection: BaziShenShaSelection = {}): BaziShenShaContext {
    return new BaziShenShaContext(this, selection);
  }
}
export class BaziShenShaContext {
  readonly #modules: readonly BaziShenShaModule[];
  readonly #disabled: ReadonlySet<string>;
  constructor(catalog: BaziShenShaCatalog, selection: BaziShenShaSelection = {}) {
    this.#modules = new BaziShenShaCatalog(catalog.modules).modules;
    const known = new Set(Array.from({ length: 66 }, (_, i) => `builtin:${i}`));
    for (const module of this.#modules) for (const rule of module.rules) known.add(`${module.label}:${rule.id}`);
    const disabled = new Set<string>();
    for (const id of selection.disabledIds ?? []) {
      if (!known.has(id) || disabled.has(id)) throw new RangeError('Unknown or duplicate disabled ID');
      disabled.add(id);
    }
    this.#disabled = disabled;
    Object.freeze(this);
  }
  evaluate(chart: BaziPillarAnalysis, target: Ganzhi, targetKind: ShenShaTarget, gender?: Gender): readonly BaziShenShaMatch[] {
    const { year, month, day, hour } = chart.pillars;
    [year, month, day, hour, target].forEach(ganzhiIndex);
    if (gender !== undefined && gender !== GENDER.FEMALE && gender !== GENDER.MALE) throw new RangeError('Invalid gender');
    if (!Number.isInteger(targetKind) || targetKind < 0 || targetKind > 12) throw new RangeError('Invalid target kind');
    // Copy the complete rule-layer chart, including extras and derived columns.
    // Birth/ephemeris ownership is deliberately not part of this API.
    const copy: BaziPillarAnalysis = Object.freeze({
      pillars: Object.freeze({ year, month, day, hour }),
      extraPillars: Object.freeze({ ...chart.extraPillars }), dayMaster: chart.dayMaster,
      columns: Object.freeze(chart.columns.map(column => Object.freeze({ ...column,
        hiddenStems: Object.freeze([...column.hiddenStems]),
        hiddenTenGods: Object.freeze([...column.hiddenTenGods]),
      }))) as unknown as BaziPillarAnalysis['columns'],
    });
    const input = Object.freeze({ chart: copy, target, targetKind, gender });
    const bits = collectTargetShenSha(copy, target, targetKind, { gender });
    const matches: BaziShenShaMatch[] = [];
    for (let id = 0; id < 66; id++) if (!this.#disabled.has(`builtin:${id}`) && hasShenSha(bits, id as ShenShaId)) {
      matches.push(Object.freeze({ id: `builtin:${id}`, name: '', builtinId: id }));
    }
    for (const module of this.#modules) for (const rule of module.rules) {
      const id = `${module.label}:${rule.id}`;
      if (this.#disabled.has(id)) continue;
      const result: unknown = rule.test(input);
      if (typeof result !== 'boolean') {
        if (result instanceof Promise) void result.catch(() => {});
        throw new TypeError(`Rule ${id} must return a synchronous boolean`);
      }
      if (result) matches.push(Object.freeze({ id, name: rule.name, builtinId: -1 }));
    }
    return Object.freeze(matches);
  }
}
