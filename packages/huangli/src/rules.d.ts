export interface AlmanacRuleInput {
  /** Indices: monthBranch 0=子; day/yearIndex 0=甲子. NOT packed Ganzhi values. */
  monthBranch: number; dayIndex: number; yearIndex: number;
  /** 1..13; 13 preserves an early historical intercalary month, not month 1. */
  lunarMonth: number;
  lunarDay: number; mansion: string;
  /** 0=小寒, 1=大寒, ..., 23=冬至. */
  nextSolarTermIndex: number;
  seasonIndex?: number; monthSeasonTypeIndex?: number;
  isSiJue?: boolean; isSiLi?: boolean; isTuWangYongShi?: boolean;
  isPhaseOfMoon?: boolean; isYeargodDuty?: boolean;
  /** Filtering affects only presentation, never rule resolution. */
  activityMask?: readonly number[];
}
export interface AlmanacRulesResult {
  godIds: number[]; auspiciousGods: string[]; inauspiciousGods: string[];
  suitableIds: number[]; tabooIds: number[]; suitableActivities: string[]; tabooActivities: string[];
  officerIndex: number; officer: string; thingLevel: number; conflictLevel: number;
}
export interface AlmanacOutputOptions { locale?: 'zh-Hans' | 'zh-Hant'; }
export const ALMANAC_GODS: readonly Readonly<{ key: string; label: string; index: number; auspicious: boolean }>[];
export const ALMANAC_ACTIVITIES: readonly Readonly<{ key: string; label: string; index: number }>[];
export function getAlmanacGodCatalog(locale?: 'zh-Hans' | 'zh-Hant'): typeof ALMANAC_GODS;
export function getAlmanacActivityCatalog(locale?: 'zh-Hans' | 'zh-Hant'): typeof ALMANAC_ACTIVITIES;
export const ACTIVITY_MASKS: Readonly<Record<'civilian37' | 'imperial67' | 'tongshu60' | 'cnlunarLegacy38', readonly number[]>>;
export const ALMANAC_RULE_INFO: Readonly<{source: string; gods: number; activities: number; convention: string; monthIndex: string}>;
export function evaluateAlmanacRules(input: AlmanacRuleInput, options?: AlmanacOutputOptions): AlmanacRulesResult;
