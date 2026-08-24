import { ganzhiBranch, ganzhiStem } from 'js-ephemeris-lite';
import {
  BRANCH_RELATION_FLAG,
  PILLAR_MASK,
  RELATION_KIND,
  RELATION_KIND_MASK_ALL,
  STEM_RELATION_FLAG,
  type RelationKind,
  type WuxingId,
} from './constants.js';
import type { BaziChart } from './chart.js';
import {
  BRANCH_TRIPLE_COMBINATION,
  BRANCH_TRIPLE_DIRECTION,
  BRANCH_TRIPLE_PUNISHMENT,
  TRIPLE_ELEMENT,
  calculateBranchRelation,
  calculateStemRelation,
} from './rules.js';

export interface BaziRelation {
  readonly kind: RelationKind;
  readonly pillarMask: number;
  readonly combinedElement: WuxingId | null;
}

interface Node {
  value: number;
  sourceId: number;
  pillarFlag: number;
}

interface PendingRelation {
  kind: RelationKind;
  pillarMask: number;
  combinedElement: WuxingId | null;
  valueMask: number;
}

function pillarValues(chart: BaziChart): readonly number[] {
  return [
    chart.pillars.year,
    chart.pillars.month,
    chart.pillars.day,
    chart.pillars.hour,
    chart.extraPillars.mingGong,
    chart.extraPillars.shenGong,
    chart.extraPillars.taiYuan,
    chart.extraPillars.taiXi,
  ];
}

function buildNodes(chart: BaziChart, pillarMask: number, useStem: boolean): Node[] {
  return pillarValues(chart).flatMap((pillar, sourceId) => (
    (pillarMask & (1 << sourceId)) === 0 ? [] : [{
      value: useStem ? ganzhiStem(pillar) : ganzhiBranch(pillar),
      sourceId,
      pillarFlag: 1 << sourceId,
    }]
  ));
}

function nodeMask(nodes: readonly Node[]): number {
  return nodes.reduce((mask, node) => mask | node.pillarFlag, 0);
}

function valueMask(nodes: readonly Node[]): number {
  return nodes.reduce((mask, node) => mask | (1 << node.value), 0);
}

function addRelation(
  relations: PendingRelation[],
  kind: RelationKind,
  nodes: readonly Node[],
  combinedElement: WuxingId | null,
): void {
  const candidate = {
    kind,
    pillarMask: nodeMask(nodes),
    valueMask: valueMask(nodes),
    combinedElement,
  };
  const existing = relations.find((relation) => relation.kind === kind
    && relation.combinedElement === combinedElement
    && (relation.valueMask & candidate.valueMask) !== 0);
  if (existing) {
    existing.pillarMask |= candidate.pillarMask;
    existing.valueMask |= candidate.valueMask;
  } else {
    relations.push(candidate);
  }
}

function enabled(mask: number, kind: RelationKind): boolean {
  return (mask & (1 << kind)) !== 0;
}

function gather(nodes: readonly Node[], first: number, second?: number): Node[] {
  return nodes.filter((node) => node.value === first || node.value === second);
}

function matchesTriple(nodes: readonly Node[], group: readonly number[]): boolean {
  return nodes.length === 3 && new Set(nodes.map((node) => node.value)).size === 3
    && nodes.every((node) => group.includes(node.value));
}

function appendStemRelations(nodes: readonly Node[], mask: number, relations: PendingRelation[]): void {
  for (let first = 0; first < 5; first += 1) {
    const second = first + 5;
    const matched = gather(nodes, first, second);
    if (enabled(mask, RELATION_KIND.STEM_COMBINATION)
      && valueMask(matched) === ((1 << first) | (1 << second))) {
      addRelation(relations, RELATION_KIND.STEM_COMBINATION, matched,
        calculateStemRelation(first, second).combinedElement);
    }
  }
  for (let first = 0; first < 4; first += 1) {
    const second = first + 6;
    const matched = gather(nodes, first, second);
    if (enabled(mask, RELATION_KIND.STEM_CLASH)
      && valueMask(matched) === ((1 << first) | (1 << second))) {
      addRelation(relations, RELATION_KIND.STEM_CLASH, matched, null);
    }
  }
  for (let first = 0; first < 10; first += 1) {
    const second = (first + 4) % 10;
    const matched = gather(nodes, first, second);
    if (enabled(mask, RELATION_KIND.STEM_RESTRAINT)
      && valueMask(matched) === ((1 << first) | (1 << second))) {
      addRelation(relations, RELATION_KIND.STEM_RESTRAINT, matched, null);
    }
  }
}

function pairKey(first: number, second: number): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

function appendBranchRelations(nodes: readonly Node[], mask: number, relations: PendingRelation[]): void {
  const suppressed = new Set<string>();
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      for (let k = j + 1; k < nodes.length; k += 1) {
        const trio = [nodes[i]!, nodes[j]!, nodes[k]!];
        const suppress = (): void => {
          suppressed.add(pairKey(trio[0]!.sourceId, trio[1]!.sourceId));
          suppressed.add(pairKey(trio[0]!.sourceId, trio[2]!.sourceId));
          suppressed.add(pairKey(trio[1]!.sourceId, trio[2]!.sourceId));
        };
        BRANCH_TRIPLE_DIRECTION.forEach((group, groupIndex) => {
          if (!matchesTriple(trio, group)) return;
          if (enabled(mask, RELATION_KIND.BRANCH_TRIPLE_DIRECTION)) {
            addRelation(relations, RELATION_KIND.BRANCH_TRIPLE_DIRECTION, trio,
              TRIPLE_ELEMENT[groupIndex] as WuxingId);
          }
          suppress();
        });
        BRANCH_TRIPLE_COMBINATION.forEach((group, groupIndex) => {
          if (!matchesTriple(trio, group)) return;
          if (enabled(mask, RELATION_KIND.BRANCH_TRIPLE_COMBINATION)) {
            addRelation(relations, RELATION_KIND.BRANCH_TRIPLE_COMBINATION, trio,
              TRIPLE_ELEMENT[groupIndex] as WuxingId);
          }
          suppress();
        });
        BRANCH_TRIPLE_PUNISHMENT.forEach((group) => {
          if (!matchesTriple(trio, group)) return;
          if (enabled(mask, RELATION_KIND.BRANCH_TRIPLE_PUNISHMENT)) {
            addRelation(relations, RELATION_KIND.BRANCH_TRIPLE_PUNISHMENT, trio, null);
          }
          suppress();
        });
      }
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const first = nodes[i]!;
      const second = nodes[j]!;
      const pair = [first, second];
      if (!suppressed.has(pairKey(first.sourceId, second.sourceId))) {
        BRANCH_TRIPLE_COMBINATION.forEach((group, groupIndex) => {
          const values: readonly number[] = group;
          if (first.value === second.value || !values.includes(first.value) || !values.includes(second.value)) return;
          const kind = first.value === group[1] || second.value === group[1]
            ? RELATION_KIND.BRANCH_HALF_COMBINATION
            : RELATION_KIND.BRANCH_ARCHING_COMBINATION;
          if (enabled(mask, kind)) addRelation(relations, kind, pair, TRIPLE_ELEMENT[groupIndex] as WuxingId);
        });
      }
      const relation = calculateBranchRelation(first.value, second.value);
      const mappings = [
        [BRANCH_RELATION_FLAG.PUNISHMENT, RELATION_KIND.BRANCH_PUNISHMENT, true],
        [BRANCH_RELATION_FLAG.COMBINATION, RELATION_KIND.BRANCH_COMBINATION, false],
        [BRANCH_RELATION_FLAG.CLASH, RELATION_KIND.BRANCH_CLASH, false],
        [BRANCH_RELATION_FLAG.HARM, RELATION_KIND.BRANCH_HARM, false],
        [BRANCH_RELATION_FLAG.DESTRUCTION, RELATION_KIND.BRANCH_DESTRUCTION, false],
        [BRANCH_RELATION_FLAG.HIDDEN_COMBINATION, RELATION_KIND.BRANCH_HIDDEN_COMBINATION, false],
        [BRANCH_RELATION_FLAG.SEVERANCE, RELATION_KIND.BRANCH_SEVERANCE, false],
      ] as const;
      mappings.forEach(([flag, kind, suppressible]) => {
        if ((relation.flags & flag) === 0 || !enabled(mask, kind)
          || (suppressible && suppressed.has(pairKey(first.sourceId, second.sourceId)))) return;
        addRelation(relations, kind, pair,
          kind === RELATION_KIND.BRANCH_COMBINATION ? relation.combinedElement : null);
      });
    }
  }

  if (enabled(mask, RELATION_KIND.BRANCH_SELF_PUNISHMENT)) {
    [4, 6, 9, 11].forEach((value) => {
      const matched = gather(nodes, value);
      if (matched.length >= 2) addRelation(relations, RELATION_KIND.BRANCH_SELF_PUNISHMENT, matched, null);
    });
  }
}

export interface CollectRelationsOptions {
  pillarMask?: number;
  relationMask?: number;
}

export function collectChartRelations(
  chart: BaziChart,
  options: CollectRelationsOptions = {},
): readonly BaziRelation[] {
  const pillarMask = options.pillarMask ?? PILLAR_MASK.PRIMARY;
  const relationMask = options.relationMask ?? RELATION_KIND_MASK_ALL;
  if (!Number.isInteger(pillarMask) || pillarMask <= 0 || (pillarMask & ~PILLAR_MASK.ALL) !== 0) {
    throw new RangeError('pillarMask must select one or more known pillars');
  }
  if (!Number.isInteger(relationMask) || relationMask < 0
    || (relationMask & ~RELATION_KIND_MASK_ALL) !== 0) {
    throw new RangeError('relationMask contains an unknown relation kind');
  }
  const pending: PendingRelation[] = [];
  appendStemRelations(buildNodes(chart, pillarMask, true), relationMask, pending);
  appendBranchRelations(buildNodes(chart, pillarMask, false), relationMask, pending);
  return Object.freeze(pending.map(({ valueMask: _ignored, ...relation }) => Object.freeze(relation)));
}
