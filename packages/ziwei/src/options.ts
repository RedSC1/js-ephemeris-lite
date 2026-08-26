import {
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  type CalendarMode,
  type PillarHistoricalMode,
  type RatHourMode,
} from 'js-ephemeris-lite';
import {
  LEAP_MONTH_STRATEGY,
  FLOW_MONTH_PALACE_STRATEGY,
  PILLAR_BOUNDARY,
  ZIWEI_CHART_MODE,
  ZIWEI_GENDER,
  type LeapMonthStrategy,
  type FlowMonthPalaceStrategy,
  type PillarBoundary,
  type ZiweiChartMode,
  type ZiweiGender,
  CHILDHOOD_STRATEGY,
  type ChildhoodStrategy,
} from './types.js';
import { ZiweiRuleset } from './ruleset.js';

export const ZIWEI_CLOCK_MODE = Object.freeze({
  CIVIL: 'civil',
  MEAN_SOLAR: 'mean-solar',
  TRUE_SOLAR: 'true-solar',
} as const);
export type ZiweiClockMode = typeof ZIWEI_CLOCK_MODE[keyof typeof ZIWEI_CLOCK_MODE];

export const ZIWEI_RULE_OPTION = Object.freeze({
  OPTION_1: 'option1',
  OPTION_2: 'option2',
  OPTION_3: 'option3',
  OPTION_4: 'option4',
} as const);

export interface ZiweiRuleSelectionInput {
  placementDefault?: string;
  brightnessDefault?: string;
  sihuaDefault?: string;
  masters?: string;
  /** Selects one coherent variant for all twelve longevity-cycle stars. */
  longevity?: string;
  /** Per-star placement overrides, keyed by the stable romanized star key. */
  placement?: Readonly<Record<string, string>>;
  /** Per-star brightness overrides, keyed by the stable romanized star key. */
  brightness?: Readonly<Record<string, string>>;
  /** Per-heavenly-stem Four Transform overrides (`jia` ... `gui`). */
  sihua?: Readonly<Record<string, string>>;
  /** Optional immutable runtime resource patch, applied after bundled variants. */
  ruleset?: ZiweiRuleset;
}

export interface ZiweiRuleSelection {
  readonly placementDefault: string;
  readonly brightnessDefault: string;
  readonly sihuaDefault: string;
  readonly masters: string;
  readonly longevity: string;
  readonly placement: Readonly<Record<string, string>>;
  readonly brightness: Readonly<Record<string, string>>;
  readonly sihua: Readonly<Record<string, string>>;
  readonly ruleset: ZiweiRuleset;
}

export interface ZiweiOptionsInput {
  gender: ZiweiGender;
  mode?: CalendarMode;
  utcOffsetMinutes?: number;
  meridianDeg?: number;
  pillarHistoricalMode?: PillarHistoricalMode;
  ratHourMode?: RatHourMode;
  clockMode?: ZiweiClockMode;
  longitudeDeg?: number;
  leapMonthStrategy?: LeapMonthStrategy;
  flowMonthPalaceStrategy?: FlowMonthPalaceStrategy;
  chartMode?: ZiweiChartMode;
  wuHuDunYearBoundary?: PillarBoundary;
  sihuaYearBoundary?: PillarBoundary;
  bodyMasterYearBoundary?: PillarBoundary;
  /** Calendar boundary used to resolve flow year/month/day. */
  flowLimitBoundary?: PillarBoundary;
  childhoodStrategy?: ChildhoodStrategy;
  rules?: ZiweiRuleSelectionInput;
}

function includes<T>(values: readonly T[], value: T): boolean {
  return values.includes(value);
}

function ruleOption(value: string | undefined, fallback: string, label: string): string {
  const resolved = value ?? fallback;
  if (typeof resolved !== 'string' || resolved.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty option name`);
  }
  return resolved;
}

function ruleOverrides(
  value: Readonly<Record<string, string>> | undefined,
  label: string,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, option] of Object.entries(value ?? {})) {
    if (key.trim().length === 0) throw new RangeError(`${label} contains an empty rule key`);
    result[key] = ruleOption(option, '', `${label}.${key}`);
  }
  return Object.freeze(result);
}

function normalizeRuleSelection(input: ZiweiRuleSelectionInput = {}): ZiweiRuleSelection {
  if (input.ruleset !== undefined && !(input.ruleset instanceof ZiweiRuleset)) {
    throw new TypeError('rules.ruleset must be a ZiweiRuleset');
  }
  return Object.freeze({
    placementDefault: ruleOption(input.placementDefault, ZIWEI_RULE_OPTION.OPTION_1, 'placementDefault'),
    brightnessDefault: ruleOption(input.brightnessDefault, ZIWEI_RULE_OPTION.OPTION_1, 'brightnessDefault'),
    sihuaDefault: ruleOption(input.sihuaDefault, ZIWEI_RULE_OPTION.OPTION_1, 'sihuaDefault'),
    masters: ruleOption(input.masters, ZIWEI_RULE_OPTION.OPTION_1, 'masters'),
    longevity: ruleOption(input.longevity, ZIWEI_RULE_OPTION.OPTION_1, 'longevity'),
    placement: ruleOverrides(input.placement, 'placement'),
    brightness: ruleOverrides(input.brightness, 'brightness'),
    sihua: ruleOverrides(input.sihua, 'sihua'),
    ruleset: input.ruleset ?? ZiweiConfigDefaults.ruleset,
  });
}

const ZiweiConfigDefaults = Object.freeze({ ruleset: new ZiweiRuleset() });

export class ZiweiOptions {
  readonly gender: ZiweiGender;
  readonly mode: CalendarMode;
  readonly utcOffsetMinutes: number;
  readonly meridianDeg: number | undefined;
  readonly pillarHistoricalMode: PillarHistoricalMode;
  readonly ratHourMode: RatHourMode;
  readonly clockMode: ZiweiClockMode;
  readonly longitudeDeg: number | undefined;
  readonly leapMonthStrategy: LeapMonthStrategy;
  readonly flowMonthPalaceStrategy: FlowMonthPalaceStrategy;
  readonly chartMode: ZiweiChartMode;
  readonly wuHuDunYearBoundary: PillarBoundary;
  readonly sihuaYearBoundary: PillarBoundary;
  readonly bodyMasterYearBoundary: PillarBoundary;
  readonly flowLimitBoundary: PillarBoundary;
  readonly childhoodStrategy: ChildhoodStrategy;
  readonly rules: ZiweiRuleSelection;

  constructor(input: ZiweiOptionsInput) {
    this.gender = input.gender;
    this.mode = input.mode ?? CALENDAR_MODE.HISTORICAL;
    this.utcOffsetMinutes = input.utcOffsetMinutes ?? 480;
    this.meridianDeg = input.meridianDeg;
    this.pillarHistoricalMode = input.pillarHistoricalMode
      ?? PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR;
    this.ratHourMode = input.ratHourMode ?? RAT_HOUR_MODE.NEXT_DAY;
    this.clockMode = input.clockMode ?? ZIWEI_CLOCK_MODE.CIVIL;
    this.longitudeDeg = input.longitudeDeg;
    this.leapMonthStrategy = input.leapMonthStrategy
      ?? LEAP_MONTH_STRATEGY.SPLIT_AFTER_FIFTEENTH;
    this.flowMonthPalaceStrategy = input.flowMonthPalaceStrategy
      ?? FLOW_MONTH_PALACE_STRATEGY.PHYSICAL_SEQUENCE;
    this.chartMode = input.chartMode ?? ZIWEI_CHART_MODE.TIAN_PAN;
    this.wuHuDunYearBoundary = input.wuHuDunYearBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.sihuaYearBoundary = input.sihuaYearBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.bodyMasterYearBoundary = input.bodyMasterYearBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.flowLimitBoundary = input.flowLimitBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.childhoodStrategy = input.childhoodStrategy ?? CHILDHOOD_STRATEGY.SKIP;
    this.rules = normalizeRuleSelection(input.rules);

    if (!includes(Object.values(ZIWEI_GENDER), this.gender)) throw new RangeError('unknown Ziwei gender');
    if (!includes(Object.values(CALENDAR_MODE), this.mode)) throw new RangeError('unknown calendar mode');
    if (!Number.isFinite(this.utcOffsetMinutes) || Math.abs(this.utcOffsetMinutes) > 840) {
      throw new RangeError('utcOffsetMinutes must be within ±14 hours');
    }
    if (this.meridianDeg !== undefined
      && (!Number.isFinite(this.meridianDeg) || Math.abs(this.meridianDeg) > 180)) {
      throw new RangeError('meridianDeg must be within ±180 degrees');
    }
    if (!includes(Object.values(PILLAR_HISTORICAL_MODE), this.pillarHistoricalMode)) {
      throw new RangeError('unknown pillar historical mode');
    }
    if (!includes(Object.values(RAT_HOUR_MODE), this.ratHourMode)) throw new RangeError('unknown rat-hour mode');
    if (!includes(Object.values(ZIWEI_CLOCK_MODE), this.clockMode)) throw new RangeError('unknown Ziwei clock mode');
    if (this.longitudeDeg !== undefined
      && (!Number.isFinite(this.longitudeDeg) || Math.abs(this.longitudeDeg) > 180)) {
      throw new RangeError('longitudeDeg must be within ±180 degrees');
    }
    if (this.clockMode !== ZIWEI_CLOCK_MODE.CIVIL && this.longitudeDeg === undefined) {
      throw new RangeError('longitudeDeg is required for mean or true solar time');
    }
    if (!includes(Object.values(LEAP_MONTH_STRATEGY), this.leapMonthStrategy)) {
      throw new RangeError('unknown leap-month strategy');
    }
    if (!includes(Object.values(FLOW_MONTH_PALACE_STRATEGY), this.flowMonthPalaceStrategy)) {
      throw new RangeError('unknown flow-month palace strategy');
    }
    if (!includes(Object.values(ZIWEI_CHART_MODE), this.chartMode)) throw new RangeError('unknown Ziwei chart mode');
    for (const boundary of [
      this.wuHuDunYearBoundary,
      this.sihuaYearBoundary,
      this.bodyMasterYearBoundary,
      this.flowLimitBoundary,
    ]) {
      if (!includes(Object.values(PILLAR_BOUNDARY), boundary)) throw new RangeError('unknown pillar boundary');
    }
    if (!includes(Object.values(CHILDHOOD_STRATEGY), this.childhoodStrategy)) {
      throw new RangeError('unknown childhood strategy');
    }
    Object.freeze(this);
  }

  with(overrides: Partial<ZiweiOptionsInput>): ZiweiOptions {
    const rules = overrides.rules === undefined
      ? this.rules
      : {
        ...this.rules,
        ...overrides.rules,
        placement: { ...this.rules.placement, ...overrides.rules.placement },
        brightness: { ...this.rules.brightness, ...overrides.rules.brightness },
        sihua: { ...this.rules.sihua, ...overrides.rules.sihua },
      };
    return new ZiweiOptions({ ...this.toJSON(), ...overrides, rules });
  }

  toCalendarOptions(): {
    mode: CalendarMode;
    utcOffsetMinutes: number;
    meridianDeg: number | undefined;
  } {
    return Object.freeze({
      mode: this.mode,
      utcOffsetMinutes: this.utcOffsetMinutes,
      meridianDeg: this.meridianDeg,
    });
  }

  toJSON(): ZiweiOptionsInput {
    return {
      gender: this.gender,
      mode: this.mode,
      utcOffsetMinutes: this.utcOffsetMinutes,
      meridianDeg: this.meridianDeg,
      pillarHistoricalMode: this.pillarHistoricalMode,
      ratHourMode: this.ratHourMode,
      clockMode: this.clockMode,
      longitudeDeg: this.longitudeDeg,
      leapMonthStrategy: this.leapMonthStrategy,
      flowMonthPalaceStrategy: this.flowMonthPalaceStrategy,
      chartMode: this.chartMode,
      wuHuDunYearBoundary: this.wuHuDunYearBoundary,
      sihuaYearBoundary: this.sihuaYearBoundary,
      bodyMasterYearBoundary: this.bodyMasterYearBoundary,
      flowLimitBoundary: this.flowLimitBoundary,
      childhoodStrategy: this.childhoodStrategy,
      rules: this.rules,
    };
  }
}

export function resolveZiweiOptions(options: ZiweiOptions | ZiweiOptionsInput): ZiweiOptions {
  return options instanceof ZiweiOptions ? options : new ZiweiOptions(options);
}
