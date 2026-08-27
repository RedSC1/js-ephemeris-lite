import {
  asUt1JulianDay,
  calculateFourPillars,
  getNayinId,
  ganzhiBranch,
  ganzhiStem,
  meanSolarTime,
  normalizeChartVirtualTime,
  trueSolarTime,
  type CivilDateTime,
  type FourPillars,
  type Ganzhi,
  type Ut1Input,
  type ZonedTime,
} from 'js-ephemeris-lite';
import {
  type DaYunEntry,
  type QiYunResult,
  calculateQiYun,
  generateDaYun,
  getRenyuanSilingSegments,
  type RenyuanSilingSegment,
} from './fortune.js';
import {
  type NatalShenShaBitsets,
  type ShenShaBitset,
  type ShenShaTarget,
  collectNatalShenSha,
  collectTargetShenSha,
  shenShaIds,
  SHEN_SHA_NAMES,
} from './shen-sha.js';
import {
  BAZI_CLOCK_MODE,
  BaziOptions,
  resolveBaziOptions,
  type BaziOptionsInput,
} from './options.js';
import { GENDER, LIFE_STAGE_NAMES, TEN_GOD_NAMES, type LifeStageId, type TenGodId } from './constants.js';
import { collectChartRelations } from './relations.js';
import { calculateExtraPillars, getHiddenStems, getLifeStage, getTenGod } from './rules.js';
import { unpackPillar, type DecodedPillar } from './pillar.js';

export type BaziColumnKey = 'year' | 'month' | 'day' | 'hour';

export interface BaziColumn extends DecodedPillar {
  readonly key: BaziColumnKey;
  readonly visibleTenGod: TenGodId;
  readonly hiddenStems: readonly number[];
  readonly hiddenTenGods: readonly TenGodId[];
  readonly lifeStage: LifeStageId;
  readonly nayinId: number;
}

function freezePillars(pillars: FourPillars): Readonly<FourPillars> {
  ganzhiStem(pillars.year);
  ganzhiStem(pillars.month);
  ganzhiStem(pillars.day);
  ganzhiStem(pillars.hour);
  return Object.freeze({ ...pillars });
}

function freezeCivilTime(value: CivilDateTime): Readonly<CivilDateTime> {
  return Object.freeze({
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  });
}

/** Rule-layer interpretation of four known pillars; it has no birth context. */
export interface BaziPillarAnalysis {
  readonly pillars: Readonly<FourPillars>;
  readonly extraPillars: Readonly<{
    mingGong: Ganzhi;
    shenGong: Ganzhi;
    taiYuan: Ganzhi;
    taiXi: Ganzhi;
  }>;
  readonly dayMaster: number;
  readonly columns: readonly [BaziColumn, BaziColumn, BaziColumn, BaziColumn];
}

export interface BaziPillarAnalysisOptions {
  earthPalaceMode?: BaziOptionsInput['earthPalaceMode'];
}

/** Interpret known pillars without pretending that a birth instant is known. */
export function analyzePillars(
  rawPillars: FourPillars,
  rawOptions: BaziPillarAnalysisOptions = {},
): BaziPillarAnalysis {
  const options = resolveBaziOptions(rawOptions);
  const pillars = freezePillars(rawPillars);
  const dayMaster = ganzhiStem(pillars.day);
  const keys = ['year', 'month', 'day', 'hour'] as const;
  const values = [pillars.year, pillars.month, pillars.day, pillars.hour] as const;
  const columns = Object.freeze(values.map((value, index): BaziColumn => {
    const decoded = unpackPillar(value);
    const hiddenStems = getHiddenStems(ganzhiBranch(value));
    return Object.freeze({
      ...decoded,
      key: keys[index]!,
      visibleTenGod: getTenGod(dayMaster, ganzhiStem(value)),
      hiddenStems,
      hiddenTenGods: Object.freeze(hiddenStems.map((stem) => getTenGod(dayMaster, stem))),
      lifeStage: getLifeStage(dayMaster, ganzhiBranch(value), options.earthPalaceMode),
      nayinId: getNayinId(value),
    });
  })) as unknown as readonly [BaziColumn, BaziColumn, BaziColumn, BaziColumn];
  return Object.freeze({
    pillars,
    extraPillars: calculateExtraPillars(pillars.year, pillars.month, pillars.day, pillars.hour),
    dayMaster,
    columns,
  });
}

/** A complete BaZi chart backed by a real birth instant and resolved clock. */
export class BaziChart implements BaziPillarAnalysis {
  readonly pillars: Readonly<FourPillars>;
  readonly extraPillars: BaziPillarAnalysis['extraPillars'];
  readonly dayMaster: number;
  readonly columns: BaziPillarAnalysis['columns'];
  readonly options: BaziOptions;
  readonly birthJdUT1: number;
  /** Original clock supplied to fromZonedTime; null for the low-level instant API. */
  readonly birthClockTime: Readonly<ReturnType<ZonedTime['toJSON']>> | null;
  /** The calculation's virtual clock, NOT necessarily the original birth clock. */
  readonly birthCivilTime: Readonly<CivilDateTime>;

  private constructor(
    analysis: BaziPillarAnalysis,
    options: BaziOptions,
    birthJdUT1: number,
    birthCivilTime: Readonly<CivilDateTime>,
    birthClockTime: BaziChart['birthClockTime'] = null,
  ) {
    this.pillars = analysis.pillars;
    this.extraPillars = analysis.extraPillars;
    this.dayMaster = analysis.dayMaster;
    this.columns = analysis.columns;
    this.options = options;
    this.birthJdUT1 = birthJdUT1;
    this.birthCivilTime = birthCivilTime;
    this.birthClockTime = birthClockTime;
    Object.freeze(this);
  }

  static fromInstant(
    instant: Ut1Input,
    virtualTime: CivilDateTime,
    options: BaziOptions | BaziOptionsInput = {},
  ): BaziChart {
    const resolved = resolveBaziOptions(options);
    const jdUT1 = asUt1JulianDay(instant);
    const pillars = calculateFourPillars(jdUT1, virtualTime, resolved.toFourPillarsOptions());
    return new BaziChart(
      analyzePillars(pillars, { earthPalaceMode: resolved.earthPalaceMode }),
      resolved,
      jdUT1,
      freezeCivilTime(normalizeChartVirtualTime(virtualTime)),
    );
  }

  static fromZonedTime(
    zonedTime: ZonedTime,
    options: BaziOptions | BaziOptionsInput = {},
  ): BaziChart {
    const resolved = resolveBaziOptions(options);
    let virtualTime: CivilDateTime = zonedTime;
    if (resolved.clockMode === BAZI_CLOCK_MODE.MEAN_SOLAR) {
      virtualTime = meanSolarTime(zonedTime, resolved.longitudeDeg!);
    } else if (resolved.clockMode === BAZI_CLOCK_MODE.TRUE_SOLAR) {
      virtualTime = trueSolarTime(zonedTime, resolved.longitudeDeg!);
    }
    const chart = BaziChart.fromInstant(zonedTime.toJulianTime(), virtualTime, resolved);
    return new BaziChart(chart, resolved, chart.birthJdUT1, chart.birthCivilTime,
      Object.freeze(zonedTime.toJSON()));
  }

  /** Versioned, JSON-safe natal chart, including the original and calculation clocks. */
  toJSON() {
    const shenSha = this.getShenSha();
    const qiYun = this.options.gender === undefined ? null : this.getQiYun();
    return {
      schemaVersion: 'bazi-chart-v1' as const,
      kind: 'bazi' as const,
      scope: 'natal' as const,
      birth: {
        calendar: 'julian-gregorian-1582' as const,
        yearNumbering: 'astronomical' as const,
        jdUT1: this.birthJdUT1,
        clockTime: this.birthClockTime,
        virtualTime: this.birthCivilTime,
        clockMode: this.options.clockMode,
        longitudeDeg: this.options.longitudeDeg ?? null,
        gender: this.options.gender === undefined ? null
          : this.options.gender === GENDER.MALE ? 'male' as const : 'female' as const,
      },
      options: this.options.toJSON(),
      pillars: this.pillars,
      dayMaster: this.dayMaster,
      columns: this.columns.map((column) => ({
        ...column,
        visibleTenGodName: TEN_GOD_NAMES[column.visibleTenGod],
        hiddenTenGodNames: column.hiddenTenGods.map((id) => TEN_GOD_NAMES[id]),
        lifeStageName: LIFE_STAGE_NAMES[column.lifeStage],
        shenSha: shenShaIds(shenSha[column.key]).map((id) => ({ id, name: SHEN_SHA_NAMES[id] })),
      })),
      extraPillars: Object.fromEntries(Object.entries(this.extraPillars).map(
        ([key, value]) => [key, unpackPillar(value)],
      )),
      relations: collectChartRelations(this),
      renyuanSiling: this.getRenyuanSiling(),
      fortune: qiYun === null ? null : {
        clockBasis: 'virtual-time' as const,
        qiYun,
        decades: generateDaYun(this.birthCivilTime, this, qiYun, this.options.toDaYunOptions())
          .map((entry) => ({ ...entry, pillarName: unpackPillar(entry.pillar).name })),
      },
    };
  }

  getQiYun(): QiYunResult {
    const gender = this.requireGender();
    return calculateQiYun(
      this.birthJdUT1,
      this.birthCivilTime,
      this,
      gender,
      this.options.toQiYunOptions(),
    );
  }

  getDaYunTable(): readonly DaYunEntry[] {
    return generateDaYun(
      this.birthCivilTime,
      this,
      this.getQiYun(),
      this.options.toDaYunOptions(),
    );
  }

  getShenSha(): NatalShenShaBitsets {
    return collectNatalShenSha(this, { gender: this.options.gender });
  }

  getTargetShenSha(target: Ganzhi, targetKind: ShenShaTarget): ShenShaBitset {
    return collectTargetShenSha(this, target, targetKind, { gender: this.options.gender });
  }

  getRenyuanSiling(): readonly RenyuanSilingSegment[] {
    return getRenyuanSilingSegments(
      ganzhiBranch(this.pillars.month),
      this.options.renyuanSilingTable,
    );
  }

  private requireGender(): NonNullable<BaziOptions['gender']> {
    if (this.options.gender === undefined) throw new Error('Qi-Yun requires options.gender');
    return this.options.gender;
  }
}

export type BaziChartJSON = ReturnType<BaziChart['toJSON']>;

export type CalculateBaziOptions = BaziOptionsInput;

export function calculateBazi(
  instant: Ut1Input,
  virtualTime: CivilDateTime,
  options: BaziOptions | BaziOptionsInput = {},
): BaziChart {
  return BaziChart.fromInstant(instant, virtualTime, options);
}

export function baziForZonedTime(
  zonedTime: ZonedTime,
  options: BaziOptions | BaziOptionsInput = {},
): BaziChart {
  return BaziChart.fromZonedTime(zonedTime, options);
}
