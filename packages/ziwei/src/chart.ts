import { ZonedTime, ganzhiBranch, ganzhiStem, lunarToSolar, type LunarDate } from 'js-ephemeris-lite';
import { computePalaceStems, type ZiweiAnchors } from './anchors.js';
import { resolveZiweiBirth, type ResolvedZiweiBirth } from './calendar.js';
import { ZiweiOptions, type ZiweiOptionsInput } from './options.js';
import {
  evaluateNatalPlacement,
  selectZiweiRules,
  type SelectedZiweiRules,
} from './rules.js';
import type { StarInfo } from './stars.js';
import {
  PALACE,
  PILLAR_BOUNDARY,
  type TransformSet,
  type ZiweiCalendarFacts,
} from './types.js';
import { dynamicChartForTime, resolveZiweiFlow, type ResolvedZiweiFlow } from './flow-calendar.js';
import type { ZiweiDynamicChart } from './flow.js';
import { ZiweiLimitManager } from './limit-manager.js';
import { ZiweiTimelineProvider } from './timeline.js';
import type { FlowLevel } from './types.js';
import { arrangeModifiedStars, placementOverrides, type ZiweiPlacementInput,
  type ZiweiModifyInput, type ZiweiModification } from './placement.js';

import { ZiweiPlate, buildZiweiPlate, type ZiweiPalaceState } from './plate.js';

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

export type { ZiweiPalaceState, ZiweiStarPlacement } from './plate.js';

export class ZiweiChart extends ZiweiPlate {
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
  protected readonly ruleTables: SelectedZiweiRules;
  private readonly originalChart: ZiweiChart | null;
  readonly modification: ZiweiModification | null;
  readonly placementInput: Readonly<ZiweiPlacementInput>;
  readonly omittedPlacements: readonly { readonly starId: number; readonly missingInputs: readonly string[] }[];

  private constructor(
    birth: ResolvedZiweiBirth, lunarInput: ZiweiChart['lunarInput'] = null,
    adjustment?: { original: ZiweiChart; modification: ZiweiModification; placementSource?: ZiweiChart },
  ) {
    super();
    this.birthClockTime = birth.clockTime ? Object.freeze({ ...birth.clockTime }) : null;
    this.lunarInput = lunarInput ? Object.freeze({ ...lunarInput }) : null;
    this.options = birth.options;
    this.ruleTables = selectZiweiRules(this.options.rules);
    this.starCatalog = this.ruleTables.catalog;
    this.facts = birth.facts;
    this.originalChart = adjustment?.original ?? null;
    this.modification = adjustment?.modification ?? null;
    const preserved = adjustment?.placementSource;
    const placement = adjustment && !preserved ? arrangeModifiedStars(
      adjustment.modification.overrides, this.options, birth,
      adjustment.modification.updateBureau ? undefined : birth.anchors.bureau,
    ) : null;
    this.placementInput = preserved?.placementInput ?? placement?.input ?? Object.freeze({
      yearGanIndex: ganzhiStem(birth.anchors.lunar.year),
      yearZhiIndex: ganzhiBranch(birth.anchors.lunar.year),
      month: birth.facts.effectiveLunarMonth, day: birth.facts.lunarDate.day,
      hourZhiIndex: ganzhiBranch(birth.anchors.lunar.hour),
    });
    this.omittedPlacements = preserved?.omittedPlacements ?? placement?.omittedPlacements ?? Object.freeze([]);
    this.anchors = adjustment ? Object.freeze({
      ...birth.anchors,
      bureau: preserved?.anchors.bureau ?? placement!.bureau,
      ziwei: preserved?.anchors.ziwei ?? placement!.ziwei,
      tianfu: preserved?.anchors.tianfu ?? placement!.tianfu,
      palacePositions: Object.freeze(birth.anchors.palacePositions.map(
        (branch) => (branch + adjustment.modification.lifePalaceShift) % 12,
      )),
    }) : birth.anchors;
    this.bodyPalace = birth.bodyPalace;
    const palaceYear = this.options.wuHuDunYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
      ? this.anchors.solarTerm.year
      : this.anchors.lunar.year;
    this.palaceStems = computePalaceStems(ganzhiStem(palaceYear));

    const positions = Array<number>(this.starCatalog.length).fill(-1);
    for (const rule of this.ruleTables.natalPlacements) {
      positions[rule.starId] = preserved?.starPositions[rule.starId] ?? placement?.starPositions[rule.starId]
        ?? evaluateNatalPlacement(rule, this.facts, this.anchors, this.bodyPalace);
    }

    const sihuaYear = this.options.sihuaYearBoundary === PILLAR_BOUNDARY.SOLAR_TERM
      ? this.anchors.solarTerm.year
      : this.anchors.lunar.year;
    this.birthYearTransformations = preserved?.birthYearTransformations ?? placement?.yearTransformations ?? this.ruleTables.sihua[ganzhiStem(sihuaYear)]!;
    const plate = buildZiweiPlate(this.ruleTables, this.anchors, this.palaceStems,
      positions, this.birthYearTransformations);
    this.starPositions = plate.starPositions;
    this.palaces = plate.palaces;
    this.transformationMasks = plate.transformationMasks;

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
    this.lifeMaster = adjustment?.original.lifeMaster ?? this.ruleTables.masters.life.stars[lifeMasterBranch]!;
    this.bodyMaster = adjustment?.original.bodyMaster ?? this.ruleTables.masters.body.stars[bodyMasterBranch]!;
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

  /** Re-place stars with selective overrides; birth remains unchanged; a new bureau also reschedules limits. */
  modify(input: ZiweiModifyInput): ZiweiChart {
    const changes = placementOverrides(input);
    if (input.updateBureau !== undefined && typeof input.updateBureau !== 'boolean') {
      throw new TypeError('updateBureau must be boolean');
    }
    return this.withModification(Object.freeze({
      overrides: Object.freeze({ ...this.modification?.overrides, ...changes }),
      updateBureau: input.updateBureau ?? this.modification?.updateBureau ?? false,
      lifePalaceShift: this.modification?.lifePalaceShift ?? 0,
    }));
  }

  /** Shift palace roles and decade locations by branches; stars and body palace stay fixed. */
  shiftLifePalace(steps: number): ZiweiChart {
    if (!Number.isSafeInteger(steps)) throw new RangeError('steps must be a safe integer');
    const shift = ((this.modification?.lifePalaceShift ?? 0) + steps % 12 + 12) % 12;
    return this.withModification(Object.freeze({
      overrides: this.modification?.overrides ?? Object.freeze({}),
      updateBureau: this.modification?.updateBureau ?? false,
      lifePalaceShift: shift,
    }), this);
  }

  /** Restore the original chart, including any manually shifted palace roles. */
  reset(): ZiweiChart {
    return this.originalChart ?? this;
  }

  /** Descriptive alias for reset(). */
  resetModification(): ZiweiChart {
    return this.reset();
  }

  private withModification(modification: ZiweiModification, placementSource?: ZiweiChart): ZiweiChart {
    const original = this.originalChart ?? this;
    return new ZiweiChart({
      facts: original.facts, anchors: original.anchors, bodyPalace: original.bodyPalace,
      options: original.options, clockTime: original.birthClockTime ?? undefined,
    }, original.lunarInput, { original, modification, placementSource });
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
      modification: this.modification,
      placementInput: this.placementInput,
      omittedPlacements: this.omittedPlacements,
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
      palaces: this.serializePalaces('birthYear'),
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
