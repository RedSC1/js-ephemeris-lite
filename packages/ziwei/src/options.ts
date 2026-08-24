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
  PILLAR_BOUNDARY,
  ZIWEI_CHART_MODE,
  ZIWEI_GENDER,
  type LeapMonthStrategy,
  type PillarBoundary,
  type ZiweiChartMode,
  type ZiweiGender,
} from './types.js';

export const ZIWEI_CLOCK_MODE = Object.freeze({
  CIVIL: 'civil',
  MEAN_SOLAR: 'mean-solar',
  TRUE_SOLAR: 'true-solar',
} as const);
export type ZiweiClockMode = typeof ZIWEI_CLOCK_MODE[keyof typeof ZIWEI_CLOCK_MODE];

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
  chartMode?: ZiweiChartMode;
  wuHuDunYearBoundary?: PillarBoundary;
  sihuaYearBoundary?: PillarBoundary;
  bodyMasterYearBoundary?: PillarBoundary;
}

function includes<T>(values: readonly T[], value: T): boolean {
  return values.includes(value);
}

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
  readonly chartMode: ZiweiChartMode;
  readonly wuHuDunYearBoundary: PillarBoundary;
  readonly sihuaYearBoundary: PillarBoundary;
  readonly bodyMasterYearBoundary: PillarBoundary;

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
    this.chartMode = input.chartMode ?? ZIWEI_CHART_MODE.TIAN_PAN;
    this.wuHuDunYearBoundary = input.wuHuDunYearBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.sihuaYearBoundary = input.sihuaYearBoundary ?? PILLAR_BOUNDARY.LUNAR;
    this.bodyMasterYearBoundary = input.bodyMasterYearBoundary ?? PILLAR_BOUNDARY.LUNAR;

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
    if (!includes(Object.values(ZIWEI_CHART_MODE), this.chartMode)) throw new RangeError('unknown Ziwei chart mode');
    for (const boundary of [
      this.wuHuDunYearBoundary,
      this.sihuaYearBoundary,
      this.bodyMasterYearBoundary,
    ]) {
      if (!includes(Object.values(PILLAR_BOUNDARY), boundary)) throw new RangeError('unknown pillar boundary');
    }
    Object.freeze(this);
  }

  with(overrides: Partial<ZiweiOptionsInput>): ZiweiOptions {
    return new ZiweiOptions({ ...this.toJSON(), ...overrides });
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
      chartMode: this.chartMode,
      wuHuDunYearBoundary: this.wuHuDunYearBoundary,
      sihuaYearBoundary: this.sihuaYearBoundary,
      bodyMasterYearBoundary: this.bodyMasterYearBoundary,
    };
  }
}

export function resolveZiweiOptions(options: ZiweiOptions | ZiweiOptionsInput): ZiweiOptions {
  return options instanceof ZiweiOptions ? options : new ZiweiOptions(options);
}
