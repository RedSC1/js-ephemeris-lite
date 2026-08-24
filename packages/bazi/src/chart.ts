import {
  calculateFourPillars,
  fourPillarsForZonedTime,
  getNayinId,
  ganzhiBranch,
  ganzhiStem,
  type FourPillars,
  type FourPillarsOptions,
  type Ganzhi,
  type CivilDateTime,
  type Ut1Input,
  type ZonedTime,
} from 'js-ephemeris-lite';
import {
  EARTH_PALACE_MODE,
  type EarthPalaceMode,
  type LifeStageId,
  type TenGodId,
} from './constants.js';
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

export interface BaziChart {
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

export interface BaziChartOptions {
  earthPalaceMode?: EarthPalaceMode;
}

function freezePillars(pillars: FourPillars): Readonly<FourPillars> {
  // Calling the validators prevents a malformed byte from entering a chart.
  ganzhiStem(pillars.year);
  ganzhiStem(pillars.month);
  ganzhiStem(pillars.day);
  ganzhiStem(pillars.hour);
  return Object.freeze({ ...pillars });
}

export function calculateBaziChart(
  rawPillars: FourPillars,
  options: BaziChartOptions = {},
): BaziChart {
  const pillars = freezePillars(rawPillars);
  const earthPalaceMode = options.earthPalaceMode ?? EARTH_PALACE_MODE.FIRE_EARTH;
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
      lifeStage: getLifeStage(dayMaster, ganzhiBranch(value), earthPalaceMode),
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

export const createBaziChart = calculateBaziChart;

export interface CalculateBaziOptions extends FourPillarsOptions, BaziChartOptions {}

/** Resolve four pillars with the astronomy core, then interpret the BaZi chart. */
export function calculateBazi(
  instant: Ut1Input,
  virtualTime: CivilDateTime,
  options: CalculateBaziOptions = {},
): BaziChart {
  const { earthPalaceMode, ...fourPillarsOptions } = options;
  return calculateBaziChart(
    calculateFourPillars(instant, virtualTime, fourPillarsOptions),
    { earthPalaceMode },
  );
}

export function baziForZonedTime(
  zonedTime: ZonedTime,
  options: CalculateBaziOptions = {},
): BaziChart {
  const { earthPalaceMode, ...fourPillarsOptions } = options;
  return calculateBaziChart(
    fourPillarsForZonedTime(zonedTime, fourPillarsOptions),
    { earthPalaceMode },
  );
}
