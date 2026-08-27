import { EARTHLY_BRANCHES, HEAVENLY_STEMS, ZonedTime, ganzhiBranch, ganzhiStem, lunarToSolar, type LunarDate } from 'js-ephemeris-lite';
import { computePalaceStems, type ZiweiAnchors } from './anchors.js';
import { resolveZiweiBirth, type ResolvedZiweiBirth } from './calendar.js';
import { ZiweiOptions, type ZiweiOptionsInput } from './options.js';
import {
  brightnessAt,
  evaluateNatalPlacement,
  selectZiweiRules,
  type SelectedZiweiRules,
} from './rules.js';
import type { StarInfo } from './stars.js';
import {
  PALACE,
  PALACE_NAMES,
  PILLAR_BOUNDARY,
  type Brightness,
  type PalaceId,
  type StarTransformMark,
  type TransformSet,
  type ZiweiCalendarFacts,
} from './types.js';
import { dynamicChartForTime, resolveZiweiFlow, type ResolvedZiweiFlow } from './flow-calendar.js';
import type { ZiweiDynamicChart } from './flow.js';
import { ZiweiLimitManager } from './limit-manager.js';
import { ZiweiTimelineProvider } from './timeline.js';
import type { FlowLevel } from './types.js';

export interface ZiweiPalaceState {
  readonly branch: number;
  readonly stem: number;
  readonly palaceId: PalaceId;
  readonly starBitset: bigint;
  readonly starIds: readonly number[];
}

export interface ZiweiStarPlacement extends StarInfo {
  readonly branch: number;
  readonly palaceId: PalaceId;
  readonly brightness: Brightness;
  readonly transformMask: number;
}

function addTransformSet(masks: number[], transforms: TransformSet, startMark: number): void {
  const ids = [transforms.lu, transforms.quan, transforms.ke, transforms.ji];
  for (let kind = 0; kind < 4; kind += 1) masks[ids[kind]!]! |= 1 << (startMark + kind);
}

function masterLookupBranch(
  input: SelectedZiweiRules['masters']['life']['input'],
  lifeBranch: number,
  anchors: ZiweiAnchors,
  configuredYear: number,
): number {
  switch (input) {
    case 'anchor.life': return lifeBranch;
    case 'lunar.year_branch': return ganzhiBranch(anchors.lunar.year);
    case 'solar.year_branch': return ganzhiBranch(anchors.solarTerm.year);
    case 'master.year_branch': return ganzhiBranch(configuredYear);
  }
}

export class ZiweiChart {
  readonly birthClockTime: Readonly<ReturnType<ZonedTime['toJSON']>> | null;
  readonly lunarInput: Readonly<LunarDate & { hour?: number; minute?: number; second?: number }> | null;
  readonly options: ZiweiOptions;
  readonly facts: ZiweiCalendarFacts;
  readonly anchors: ZiweiAnchors;
  readonly bodyPalace: number;
  readonly lifeMaster: number;
  readonly bodyMaster: number;
  readonly palaceStems: readonly number[];
  readonly palaces: readonly ZiweiPalaceState[];
  readonly birthYearTransformations: TransformSet;
  /** Built-in and ruleset-local custom stars. Built-in ids remain stable. */
  readonly starCatalog: readonly StarInfo[];
  readonly starPositions: readonly number[];
  readonly transformationMasks: readonly number[];
  private readonly ruleTables: SelectedZiweiRules;

  private constructor(birth: ResolvedZiweiBirth, lunarInput: ZiweiChart['lunarInput'] = null) {
    this.birthClockTime = birth.clockTime ? Object.freeze({ ...birth.clockTime }) : null;
    this.lunarInput = lunarInput ? Object.freeze({ ...lunarInput }) : null;
    this.options = birth.options;
    this.ruleTables = selectZiweiRules(this.options.rules);
    this.starCatalog = this.ruleTables.catalog;
    this.facts = birth.facts;
    this.anchors = birth.anchors;
    this.bodyPalace = birth.bodyPalace;
    const palaceYear = this.options.wuHuDunYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
      ? this.anchors.solarTerm.year
      : this.anchors.lunar.year;
    this.palaceStems = computePalaceStems(ganzhiStem(palaceYear));

    const positions = Array<number>(this.starCatalog.length).fill(-1);
    const bitsets = Array<bigint>(12).fill(0n);
    for (const rule of this.ruleTables.natalPlacements) {
      const branch = evaluateNatalPlacement(rule, this.facts, this.anchors, this.bodyPalace);
      positions[rule.starId] = branch;
      bitsets[branch] |= 1n << BigInt(rule.starId);
    }
    this.starPositions = Object.freeze(positions);

    const roleByBranch = Array<number>(12);
    for (let palace = 0; palace < 12; palace += 1) {
      roleByBranch[this.anchors.palacePositions[palace]!] = palace;
    }
    this.palaces = Object.freeze(Array.from({ length: 12 }, (_, branch) => {
      const starIds: number[] = [];
      for (const star of this.starCatalog) {
        if (star.natal && positions[star.id] === branch) starIds.push(star.id);
      }
      return Object.freeze({
        branch,
        stem: this.palaceStems[branch]!,
        palaceId: roleByBranch[branch]! as PalaceId,
        starBitset: bitsets[branch]!,
        starIds: Object.freeze(starIds),
      });
    }));

    const sihuaYear = this.options.sihuaYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
      ? this.anchors.solarTerm.year
      : this.anchors.lunar.year;
    this.birthYearTransformations = this.ruleTables.sihua[ganzhiStem(sihuaYear)]!;
    const masks = Array<number>(this.starCatalog.length).fill(0);
    addTransformSet(masks, this.birthYearTransformations, 0);
    for (let branch = 0; branch < 12; branch += 1) {
      const opposite = (branch + 6) % 12;
      const own = this.ruleTables.sihua[this.palaceStems[branch]!]!;
      const inward = this.ruleTables.sihua[this.palaceStems[opposite]!]!;
      const ownIds = [own.lu, own.quan, own.ke, own.ji];
      const inwardIds = [inward.lu, inward.quan, inward.ke, inward.ji];
      for (let kind = 0; kind < 4; kind += 1) {
        if (positions[ownIds[kind]!] === branch) masks[ownIds[kind]!]! |= 1 << (4 + kind);
        if (positions[inwardIds[kind]!] === branch) masks[inwardIds[kind]!]! |= 1 << (8 + kind);
      }
    }
    this.transformationMasks = Object.freeze(masks);

    const lifeBranch = this.anchors.palacePositions[PALACE.LIFE]!;
    const bodyMasterYear = this.options.bodyMasterYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
      ? this.anchors.solarTerm.year
      : this.anchors.lunar.year;
    const lifeMasterBranch = masterLookupBranch(
      this.ruleTables.masters.life.input,
      lifeBranch,
      this.anchors,
      bodyMasterYear,
    );
    const bodyMasterBranch = masterLookupBranch(
      this.ruleTables.masters.body.input,
      lifeBranch,
      this.anchors,
      bodyMasterYear,
    );
    this.lifeMaster = this.ruleTables.masters.life.stars[lifeMasterBranch]!;
    this.bodyMaster = this.ruleTables.masters.body.stars[bodyMasterBranch]!;
    Object.freeze(this);
  }

  static fromZonedTime(
    birth: ZonedTime,
    options: ZiweiOptions | ZiweiOptionsInput,
  ): ZiweiChart {
    return new ZiweiChart(resolveZiweiBirth(birth, options));
  }

  static fromLunar(
    lunar: LunarDate & { hour?: number; minute?: number; second?: number },
    rawOptions: ZiweiOptions | ZiweiOptionsInput,
  ): ZiweiChart {
    const options = rawOptions instanceof ZiweiOptions ? rawOptions : new ZiweiOptions(rawOptions);
    const solar = lunarToSolar(lunar, options.toCalendarOptions());
    const clock = new ZonedTime({
      ...solar,
      hour: lunar.hour ?? 0,
      minute: lunar.minute ?? 0,
      second: lunar.second ?? 0,
      offsetMinutes: options.utcOffsetMinutes,
    });
    return new ZiweiChart(resolveZiweiBirth(clock, options), lunar);
  }

  /** Advanced rule-core entry for already normalized calendar facts. */
  static fromResolvedBirth(birth: ResolvedZiweiBirth): ZiweiChart {
    return new ZiweiChart(birth);
  }

  getPalace(palaceId: PalaceId): ZiweiPalaceState {
    if (!Number.isInteger(palaceId) || palaceId < 0 || palaceId >= 12) {
      throw new RangeError('palaceId must be 0..11');
    }
    return this.palaces[this.anchors.palacePositions[palaceId]!]!;
  }

  getStarPosition(starId: number): ZiweiStarPlacement | null {
    const star = this.getStarInfo(starId);
    const branch = this.starPositions[starId]!;
    if (branch < 0) return null;
    return Object.freeze({
      ...star,
      branch,
      palaceId: this.palaces[branch]!.palaceId,
      brightness: brightnessAt(this.ruleTables, starId, branch),
      transformMask: this.transformationMasks[starId]!,
    });
  }

  findStarId(key: string): number | undefined {
    return this.starCatalog.find((star) => star.key === key)?.id;
  }

  getStarInfo(starId: number): StarInfo {
    const star = this.starCatalog[starId];
    if (star === undefined) throw new RangeError(`unknown star id in this chart: ${starId}`);
    return star;
  }

  getStarsAtBranch(branch: number): readonly ZiweiStarPlacement[] {
    if (!Number.isInteger(branch) || branch < 0 || branch >= 12) {
      throw new RangeError('branch must be 0..11');
    }
    return Object.freeze(this.palaces[branch]!.starIds.map(
      (starId) => this.getStarPosition(starId)!,
    ));
  }

  getStarsInPalace(palaceId: PalaceId): readonly ZiweiStarPlacement[] {
    return this.getStarsAtBranch(this.getPalace(palaceId).branch);
  }

  getBrightnessLabel(value: Brightness): string | null {
    if (value < -1 || value > 6) throw new RangeError('brightness must be -1..6');
    const label = this.ruleTables.brightnessLabels[String(value)];
    return value === -1 || label === undefined || label.length === 0 ? null : label;
  }

  hasTransform(starId: number, mark: StarTransformMark): boolean {
    if (!Number.isInteger(mark) || mark < 0 || mark >= 12) return false;
    return (((this.transformationMasks[starId] ?? 0) >>> mark) & 1) === 1;
  }

  timeline(): ZiweiTimelineProvider {
    return new ZiweiTimelineProvider(this);
  }

  createLimitManager(): ZiweiLimitManager {
    return new ZiweiLimitManager(this);
  }

  resolveFlow(target: ZonedTime): ResolvedZiweiFlow {
    return resolveZiweiFlow(this, target);
  }

  dynamicForTime(target: ZonedTime, deepestLevel?: FlowLevel): ZiweiDynamicChart {
    return dynamicChartForTime(this, target, deepestLevel).chart;
  }

  /** Versioned natal-chart snapshot. BigInt bitsets are exported as star arrays. */
  toJSON() {
    return {
      schemaVersion: 'ziwei-chart-v1' as const,
      kind: 'ziwei' as const,
      scope: 'natal' as const,
      birth: {
        calendar: 'julian-gregorian-1582' as const,
        yearNumbering: 'astronomical' as const,
        jdUT1: this.facts.jdUT1,
        clockTime: this.birthClockTime,
        virtualTime: this.facts.virtualTime,
        clockMode: this.options.clockMode,
        longitudeDeg: this.options.longitudeDeg ?? null,
        gender: this.facts.gender === 0 ? 'male' as const : 'female' as const,
        lunarInput: this.lunarInput,
        logicalLunarDate: this.facts.lunarDate,
      },
      facts: this.facts,
      anchors: this.anchors,
      bodyPalace: this.bodyPalace,
      lifeMaster: this.lifeMaster,
      bodyMaster: this.bodyMaster,
      palaceStems: this.palaceStems,
      starCatalog: this.starCatalog,
      starPositions: this.starPositions,
      birthYearTransformations: this.birthYearTransformations,
      transformationMasks: this.transformationMasks,
      brightnessLabels: this.ruleTables.brightnessLabels,
      palaces: this.palaces.map((palace) => ({
        branch: palace.branch,
        branchName: EARTHLY_BRANCHES[palace.branch]!,
        stem: palace.stem,
        stemName: HEAVENLY_STEMS[palace.stem]!,
        palaceId: palace.palaceId,
        name: PALACE_NAMES[palace.palaceId],
        isBodyPalace: palace.branch === this.bodyPalace,
        starIds: palace.starIds,
        stars: this.getStarsAtBranch(palace.branch).map((star) => ({
          ...star,
          brightnessLabel: this.getBrightnessLabel(star.brightness),
          transformations: (['birthYear', 'self', 'centripetal'] as const).flatMap((scope, index) => (
            (['lu', 'quan', 'ke', 'ji'] as const).flatMap((kind, kindIndex) => (
              (star.transformMask & (1 << (index * 4 + kindIndex))) !== 0 ? [{ scope, kind }] : []
            ))
          )),
        })),
      })),
      options: {
        ...this.options.toJSON(),
        rules: {
          ...this.options.rules,
          ruleset: {
            modules: this.options.rules.ruleset.modules.map(({ label, patch }) => ({ label, patch })),
          },
        },
      },
    };
  }
}

export type ZiweiChartJSON = ReturnType<ZiweiChart['toJSON']>;
