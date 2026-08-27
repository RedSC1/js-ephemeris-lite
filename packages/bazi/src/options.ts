import {
  CALENDAR_DAY_BOUNDARY_MODE,
  CALENDAR_MODE,
  PILLAR_HISTORICAL_MODE,
  RAT_HOUR_MODE,
  type CalendarDayBoundaryMode,
  type CalendarMode,
  type FourPillarsOptions,
  type PillarHistoricalMode,
  type RatHourMode,
} from 'js-ephemeris-lite';
import {
  DAYUN_BOUNDARY_MODEL,
  EARTH_PALACE_MODE,
  GENDER,
  QIYUN_TIME_MODEL,
  RENYUAN_SILING_TABLE,
  type DaYunBoundaryModel,
  type EarthPalaceMode,
  type Gender,
  type QiYunTimeModel,
  type RenyuanSilingTable,
} from './constants.js';
import type { DaYunOptions, QiYunOptions } from './fortune.js';

export const BAZI_CLOCK_MODE = Object.freeze({
  CIVIL: 'civil',
  MEAN_SOLAR: 'mean-solar',
  TRUE_SOLAR: 'true-solar',
} as const);
export type BaziClockMode = typeof BAZI_CLOCK_MODE[keyof typeof BAZI_CLOCK_MODE];

/** All persistent choices that define a BaZi calculation. */
export interface BaziOptionsInput {
  mode?: CalendarMode;
  dayBoundaryMode?: CalendarDayBoundaryMode;
  utcOffsetMinutes?: number;
  meridianDeg?: number;
  pillarHistoricalMode?: PillarHistoricalMode;
  ratHourMode?: RatHourMode;
  earthPalaceMode?: EarthPalaceMode;
  gender?: Gender;
  clockMode?: BaziClockMode;
  longitudeDeg?: number;
  qiYunTimeModel?: QiYunTimeModel;
  daYunBoundaryModel?: DaYunBoundaryModel;
  daYunCount?: number;
  renyuanSilingTable?: RenyuanSilingTable;
}

function includes<T>(values: readonly T[], value: T): boolean {
  return values.includes(value);
}

/**
 * Immutable, validated BaZi settings. Pass one instance when constructing a
 * chart; chart-level helpers will reuse the exact same conventions.
 */
export class BaziOptions {
  readonly mode: CalendarMode;
  readonly dayBoundaryMode: CalendarDayBoundaryMode;
  readonly utcOffsetMinutes: number;
  readonly meridianDeg: number | undefined;
  readonly pillarHistoricalMode: PillarHistoricalMode;
  readonly ratHourMode: RatHourMode;
  readonly earthPalaceMode: EarthPalaceMode;
  readonly gender: Gender | undefined;
  readonly clockMode: BaziClockMode;
  readonly longitudeDeg: number | undefined;
  readonly qiYunTimeModel: QiYunTimeModel;
  readonly daYunBoundaryModel: DaYunBoundaryModel;
  readonly daYunCount: number;
  readonly renyuanSilingTable: RenyuanSilingTable;

  constructor(input: BaziOptionsInput = {}) {
    this.mode = input.mode ?? CALENDAR_MODE.HISTORICAL;
    this.dayBoundaryMode = input.dayBoundaryMode
      ?? CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET;
    this.utcOffsetMinutes = input.utcOffsetMinutes ?? 480;
    this.meridianDeg = input.meridianDeg;
    this.pillarHistoricalMode = input.pillarHistoricalMode
      ?? PILLAR_HISTORICAL_MODE.FOLLOW_CALENDAR;
    this.ratHourMode = input.ratHourMode ?? RAT_HOUR_MODE.NEXT_DAY;
    this.earthPalaceMode = input.earthPalaceMode ?? EARTH_PALACE_MODE.FIRE_EARTH;
    this.gender = input.gender;
    this.clockMode = input.clockMode ?? BAZI_CLOCK_MODE.CIVIL;
    this.longitudeDeg = input.longitudeDeg;
    this.qiYunTimeModel = input.qiYunTimeModel ?? QIYUN_TIME_MODEL.TRADITIONAL_CALENDAR;
    this.daYunBoundaryModel = input.daYunBoundaryModel ?? DAYUN_BOUNDARY_MODEL.CIVIL_YEARS;
    this.daYunCount = input.daYunCount ?? 8;
    this.renyuanSilingTable = input.renyuanSilingTable
      ?? RENYUAN_SILING_TABLE.SAN_MING_TONG_HUI;

    if (!includes(Object.values(CALENDAR_MODE), this.mode)) throw new RangeError('unknown calendar mode');
    if (!includes(Object.values(CALENDAR_DAY_BOUNDARY_MODE), this.dayBoundaryMode)) {
      throw new RangeError('unknown calendar day-boundary mode');
    }
    if (!Number.isFinite(this.utcOffsetMinutes) || Math.abs(this.utcOffsetMinutes) > 14 * 60) {
      throw new RangeError('utcOffsetMinutes must be within ±14 hours');
    }
    if (this.meridianDeg !== undefined
      && (!Number.isFinite(this.meridianDeg) || Math.abs(this.meridianDeg) > 180)) {
      throw new RangeError('meridianDeg must be within ±180 degrees');
    }
    if (this.dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.MEAN_SOLAR_MERIDIAN
      && this.meridianDeg === undefined) {
      throw new RangeError('meridianDeg is required for mean-solar-meridian day boundaries');
    }
    if (this.dayBoundaryMode === CALENDAR_DAY_BOUNDARY_MODE.FIXED_UTC_OFFSET
      && this.meridianDeg !== undefined) {
      throw new RangeError('meridianDeg is only valid with mean-solar-meridian day boundaries');
    }
    if (!includes(Object.values(PILLAR_HISTORICAL_MODE), this.pillarHistoricalMode)) {
      throw new RangeError('unknown pillar historical mode');
    }
    if (!includes(Object.values(RAT_HOUR_MODE), this.ratHourMode)) {
      throw new RangeError('unknown rat-hour mode');
    }
    if (!includes(Object.values(EARTH_PALACE_MODE), this.earthPalaceMode)) {
      throw new RangeError('unknown earth-palace mode');
    }
    if (this.gender !== undefined && !includes(Object.values(GENDER), this.gender)) {
      throw new RangeError('unknown gender');
    }
    if (!includes(Object.values(BAZI_CLOCK_MODE), this.clockMode)) {
      throw new RangeError('unknown BaZi clock mode');
    }
    if (this.longitudeDeg !== undefined
      && (!Number.isFinite(this.longitudeDeg) || Math.abs(this.longitudeDeg) > 180)) {
      throw new RangeError('longitudeDeg must be within ±180 degrees');
    }
    if (this.clockMode !== BAZI_CLOCK_MODE.CIVIL && this.longitudeDeg === undefined) {
      throw new RangeError('longitudeDeg is required for mean or true solar time');
    }
    if (!includes(Object.values(QIYUN_TIME_MODEL), this.qiYunTimeModel)) {
      throw new RangeError('unknown Qi-Yun time model');
    }
    if (!includes(Object.values(DAYUN_BOUNDARY_MODEL), this.daYunBoundaryModel)) {
      throw new RangeError('unknown Da-Yun boundary model');
    }
    if (!Number.isInteger(this.daYunCount) || this.daYunCount < 0) {
      throw new RangeError('daYunCount must be a non-negative integer');
    }
    if (!includes(Object.values(RENYUAN_SILING_TABLE), this.renyuanSilingTable)) {
      throw new RangeError('unknown Renyuan-Siling table');
    }
    Object.freeze(this);
  }

  with(overrides: BaziOptionsInput): BaziOptions {
    return new BaziOptions({ ...this.toJSON(), ...overrides });
  }

  toFourPillarsOptions(): FourPillarsOptions {
    return Object.freeze({
      mode: this.mode,
      dayBoundaryMode: this.dayBoundaryMode,
      utcOffsetMinutes: this.utcOffsetMinutes,
      meridianDeg: this.meridianDeg,
      pillarHistoricalMode: this.pillarHistoricalMode,
      ratHourMode: this.ratHourMode,
    });
  }

  toQiYunOptions(): QiYunOptions {
    return Object.freeze({
      mode: this.mode,
      dayBoundaryMode: this.dayBoundaryMode,
      utcOffsetMinutes: this.utcOffsetMinutes,
      meridianDeg: this.meridianDeg,
      timeModel: this.qiYunTimeModel,
    });
  }

  toDaYunOptions(): DaYunOptions {
    return Object.freeze({
      count: this.daYunCount,
      boundaryModel: this.daYunBoundaryModel,
    });
  }

  toJSON(): Required<Omit<BaziOptionsInput, 'meridianDeg' | 'gender' | 'longitudeDeg'>>
    & Pick<BaziOptionsInput, 'meridianDeg' | 'gender' | 'longitudeDeg'> {
    return {
      mode: this.mode,
      dayBoundaryMode: this.dayBoundaryMode,
      utcOffsetMinutes: this.utcOffsetMinutes,
      meridianDeg: this.meridianDeg,
      pillarHistoricalMode: this.pillarHistoricalMode,
      ratHourMode: this.ratHourMode,
      earthPalaceMode: this.earthPalaceMode,
      gender: this.gender,
      clockMode: this.clockMode,
      longitudeDeg: this.longitudeDeg,
      qiYunTimeModel: this.qiYunTimeModel,
      daYunBoundaryModel: this.daYunBoundaryModel,
      daYunCount: this.daYunCount,
      renyuanSilingTable: this.renyuanSilingTable,
    };
  }
}

export function resolveBaziOptions(options: BaziOptions | BaziOptionsInput = {}): BaziOptions {
  return options instanceof BaziOptions ? options : new BaziOptions(options);
}
