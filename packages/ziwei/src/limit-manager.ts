import { ganzhiBranch, makeGanzhi, type ZonedTime } from 'js-ephemeris-lite';
import { resolveZiweiVirtualTime } from './calendar.js';
import type { ZiweiChart } from './chart.js';
import {
  resolveZiweiFlow,
  resolveZiweiFlowFromInstant,
  stepZiweiFlowDayTarget,
  stepZiweiFlowHourTarget,
  type ResolvedZiweiFlow,
  type ZiweiFlowTarget,
} from './flow-calendar.js';
import { ZiweiDynamicChart, makeFlowLayer, makeSmallLimitLayer } from './flow.js';
import {
  getEffectiveBirthYear,
  makeChildhoodDecade,
  makeDecadeByIndex,
  makeDecadeForYear,
  makeFlowDay,
  makeFlowHourFromPillar,
  makeFlowMonthFromBuildingBranch,
  makeFlowYear,
  makeSmallLimit,
  type DecadeLimit,
  type FlowDayLimit,
  type FlowHourLimit,
  type FlowMonthLimit,
  type FlowYearLimit,
  type SmallLimit,
} from './limits.js';
import { ZiweiTimelineProvider, type DayNode, type HourNode, type MonthNode, type TimelineManifest } from './timeline.js';
import { FLOW_LEVEL, RAT_HOUR_SEGMENT, type FlowLevel } from './types.js';

export interface ZiweiLimitContext {
  readonly decade?: DecadeLimit;
  readonly smallLimit?: SmallLimit;
  readonly year?: FlowYearLimit;
  readonly month?: FlowMonthLimit;
  readonly day?: FlowDayLimit;
  readonly hour?: FlowHourLimit;
}

function frozenContext(value: ZiweiLimitContext): ZiweiLimitContext {
  return Object.freeze({ ...value });
}

export class ZiweiLimitManager {
  readonly baseChart: ZiweiChart;
  readonly timeline: ZiweiTimelineProvider;
  private contextValue: ZiweiLimitContext = Object.freeze({});
  private targetValue: ZiweiFlowTarget | null = null;
  private resolvedValue: ResolvedZiweiFlow | null = null;

  constructor(chart: ZiweiChart) {
    this.baseChart = chart;
    this.timeline = new ZiweiTimelineProvider(chart);
  }

  get context(): ZiweiLimitContext { return this.contextValue; }
  get currentTarget(): ZiweiFlowTarget | null { return this.targetValue; }
  get resolvedFlow(): ResolvedZiweiFlow | null { return this.resolvedValue; }

  get dynamicChart(): ZiweiDynamicChart {
    const limits = [
      this.contextValue.decade?.limit,
      this.contextValue.year?.limit,
      this.contextValue.month?.limit,
      this.contextValue.day?.limit,
      this.contextValue.hour?.limit,
    ];
    let result = new ZiweiDynamicChart(this.baseChart);
    if (this.contextValue.smallLimit !== undefined) {
      result = result.withSmallLimit(makeSmallLimitLayer(
        this.baseChart,
        this.contextValue.smallLimit.coordinate,
      ));
    }
    for (let level = 0; level < limits.length; level += 1) {
      const limit = limits[level];
      if (limit === undefined) break;
      result = result.push(makeFlowLayer(this.baseChart, level as FlowLevel, limit.coordinate));
    }
    return result;
  }

  get manifest(): TimelineManifest {
    return this.timeline.getManifest({
      year: this.contextValue.year?.year,
      decadeIndex: this.contextValue.decade?.index,
      month: this.contextValue.month?.month,
      isLeap: this.contextValue.month?.isLeap,
      day: this.contextValue.day?.day,
    });
  }

  reset(): void {
    this.contextValue = Object.freeze({});
    this.targetValue = null;
    this.resolvedValue = null;
  }

  setDecadeIndex(index: number, targetChildhoodYear?: number): void {
    const birthYear = getEffectiveBirthYear(this.baseChart);
    const decade = index === 0
      ? makeChildhoodDecade(this.baseChart, birthYear, targetChildhoodYear ?? birthYear)
      : makeDecadeByIndex(this.baseChart, birthYear, index);
    this.contextValue = frozenContext({ decade });
    this.targetValue = null;
    this.resolvedValue = null;
  }

  setYear(year: number): void {
    const birthYear = getEffectiveBirthYear(this.baseChart);
    const decade = makeDecadeForYear(this.baseChart, birthYear, year);
    const virtualAge = year - birthYear + 1;
    const smallLimit = makeSmallLimit(
      this.baseChart,
      ganzhiBranch(this.baseChart.facts.solarTermPillars.year),
      virtualAge,
    );
    this.contextValue = frozenContext({
      decade,
      smallLimit,
      year: makeFlowYear(this.baseChart, year),
    });
    this.targetValue = null;
    this.resolvedValue = null;
  }

  addYear(delta: number): void {
    if (this.contextValue.year === undefined) return;
    this.setYear(this.contextValue.year.year + delta);
  }

  selectMonth(node: MonthNode): void {
    const year = this.contextValue.year?.year;
    if (year === undefined) throw new Error('select a flow year first');
    const month = makeFlowMonthFromBuildingBranch(
      this.baseChart,
      year,
      node.month,
      node.sequence,
      node.isLeap,
      node.monthBuildingBranch,
    );
    this.contextValue = frozenContext({
      decade: this.contextValue.decade,
      smallLimit: this.contextValue.smallLimit,
      year: this.contextValue.year,
      month,
    });
    this.targetValue = null;
    this.resolvedValue = null;
  }

  setMonth(month: number, isLeap = false): void {
    const year = this.contextValue.year?.year;
    if (year === undefined) throw new Error('select a flow year first');
    const node = this.timeline.getMonths(year).find((value) => value.month === month && value.isLeap === isLeap);
    if (node === undefined) throw new RangeError('requested flow month does not exist');
    this.selectMonth(node);
  }

  /** Move across the real timeline, so leap and historical reform months are not skipped. */
  addMonth(delta: number): void {
    if (!Number.isSafeInteger(delta)) throw new RangeError('month delta must be a safe integer');
    if (delta === 0) return;
    const current = this.contextValue.month;
    const currentYear = this.contextValue.year?.year;
    if (current === undefined || currentYear === undefined) return;
    let year = currentYear;
    let months = this.timeline.getMonths(year);
    let index = months.findIndex((node) => node.month === current.month
      && node.sequence === current.sequence && node.isLeap === current.isLeap);
    if (index < 0) throw new Error('current flow month is absent from the timeline');
    const direction = Math.sign(delta);
    for (let step = 0; step < Math.abs(delta); step += 1) {
      index += direction;
      if (index >= months.length) {
        year += 1;
        months = this.timeline.getMonths(year);
        index = 0;
      } else if (index < 0) {
        year -= 1;
        months = this.timeline.getMonths(year);
        index = months.length - 1;
      }
      if (months.length === 0) throw new Error(`no flow months are available for ${year}`);
    }
    if (year !== currentYear) this.setYear(year);
    this.selectMonth(months[index]!);
  }

  selectDay(node: DayNode): void {
    const month = this.contextValue.month;
    if (month === undefined) throw new Error('select a flow month first');
    const day = makeFlowDay(this.baseChart, month, node.day, node.stem);
    this.contextValue = frozenContext({
      decade: this.contextValue.decade,
      smallLimit: this.contextValue.smallLimit,
      year: this.contextValue.year,
      month,
      day,
    });
    this.targetValue = null;
    this.resolvedValue = null;
  }

  setDay(day: number): void {
    const year = this.contextValue.year?.year;
    const month = this.contextValue.month;
    if (year === undefined || month === undefined) throw new Error('select a flow month first');
    const node = this.timeline.getDays(year, month.month, month.isLeap)[day - 1];
    if (node === undefined) throw new RangeError('requested flow day does not exist');
    this.selectDay(node);
  }

  selectHour(node: HourNode): void {
    const day = this.contextValue.day;
    if (day === undefined) throw new Error('select a flow day first');
    const segment = node.isEarlyRat
      ? RAT_HOUR_SEGMENT.EARLY
      : node.isLateRat
        ? RAT_HOUR_SEGMENT.LATE
        : node.branchIndex === 0
          ? RAT_HOUR_SEGMENT.UNIFIED
          : RAT_HOUR_SEGMENT.NONE;
    const hour = makeFlowHourFromPillar(
      this.baseChart,
      day,
      makeGanzhi(node.stem, node.branchIndex),
      segment,
    );
    this.contextValue = frozenContext({ ...this.contextValue, hour });
    this.targetValue = null;
    this.resolvedValue = null;
  }

  /** 0..11 selects a branch; 12 explicitly selects late-Zi in split-Zi modes. */
  setHour(hourIndex: number): void {
    const day = this.contextValue.day;
    if (day === undefined) throw new Error('select a flow day first');
    const hours = this.timeline.getHours(makeGanzhi(
      day.limit.coordinate.stem,
      day.limit.coordinate.stem & 1,
    ));
    const node = hours.find((value) => value.hourIndex === hourIndex);
    if (node === undefined) throw new RangeError('requested logical flow hour does not exist');
    this.selectHour(node);
  }

  setPhysicalTime(target: ZonedTime, deepestLevel: FlowLevel = FLOW_LEVEL.HOUR): void {
    const flow = resolveZiweiFlow(this.baseChart, target);
    this.installResolved(flow, deepestLevel);
    this.targetValue = Object.freeze({
      jdUT1: target.toJulianTime().jdUT1,
      virtualTime: Object.freeze(resolveZiweiVirtualTime(target, this.baseChart.options)),
    });
  }

  private installResolved(flow: ResolvedZiweiFlow, deepestLevel: FlowLevel): void {
    this.resolvedValue = flow;
    this.contextValue = frozenContext({
      decade: flow.decade,
      smallLimit: flow.smallLimit,
      ...(deepestLevel >= FLOW_LEVEL.YEAR ? { year: flow.year } : {}),
      ...(deepestLevel >= FLOW_LEVEL.MONTH ? { month: flow.month } : {}),
      ...(deepestLevel >= FLOW_LEVEL.DAY ? { day: flow.day } : {}),
      ...(deepestLevel >= FLOW_LEVEL.HOUR ? { hour: flow.hour } : {}),
    });
  }

  nextDay(): void { this.stepDay(1); }
  previousDay(): void { this.stepDay(-1); }
  nextHour(): void { this.stepHour(1); }
  previousHour(): void { this.stepHour(-1); }

  private stepDay(direction: -1 | 1): void {
    if (this.targetValue === null) throw new Error('setPhysicalTime must be called before physical stepping');
    this.targetValue = stepZiweiFlowDayTarget(this.targetValue, direction);
    this.installResolved(resolveZiweiFlowFromInstant(
      this.baseChart,
      this.targetValue.jdUT1,
      this.targetValue.virtualTime,
    ), FLOW_LEVEL.HOUR);
  }

  private stepHour(direction: -1 | 1): void {
    if (this.targetValue === null) throw new Error('setPhysicalTime must be called before physical stepping');
    this.targetValue = stepZiweiFlowHourTarget(
      this.targetValue,
      this.baseChart.options.ratHourMode,
      direction,
    );
    this.installResolved(resolveZiweiFlowFromInstant(
      this.baseChart,
      this.targetValue.jdUT1,
      this.targetValue.virtualTime,
    ), FLOW_LEVEL.HOUR);
  }

  clear(level: FlowLevel): void {
    const keep = level;
    const entries = [
      this.contextValue.decade,
      this.contextValue.year,
      this.contextValue.month,
      this.contextValue.day,
      this.contextValue.hour,
    ].slice(0, keep);
    this.contextValue = frozenContext({
      decade: entries[0] as DecadeLimit | undefined,
      smallLimit: keep > FLOW_LEVEL.YEAR ? this.contextValue.smallLimit : undefined,
      year: entries[1] as FlowYearLimit | undefined,
      month: entries[2] as FlowMonthLimit | undefined,
      day: entries[3] as FlowDayLimit | undefined,
      hour: entries[4] as FlowHourLimit | undefined,
    });
    this.targetValue = null;
    this.resolvedValue = null;
  }


  clearDecade(): void { this.clear(FLOW_LEVEL.DECADE); }
  clearYear(): void { this.clear(FLOW_LEVEL.YEAR); }
  clearMonth(): void { this.clear(FLOW_LEVEL.MONTH); }
  clearDay(): void { this.clear(FLOW_LEVEL.DAY); }
  clearHour(): void { this.clear(FLOW_LEVEL.HOUR); }
}
