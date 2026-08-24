export const INVALID_ID = 0xff;

export const WUXING = Object.freeze({
  WATER: 0,
  WOOD: 1,
  METAL: 2,
  EARTH: 3,
  FIRE: 4,
} as const);
export type WuxingId = typeof WUXING[keyof typeof WUXING];

export const WUXING_NAMES = Object.freeze([
  '水', '木', '金', '土', '火',
] as const);

export const TEN_GOD = Object.freeze({
  BI_JIAN: 0,
  JIE_CAI: 1,
  SHI_SHEN: 2,
  SHANG_GUAN: 3,
  PIAN_CAI: 4,
  ZHENG_CAI: 5,
  QI_SHA: 6,
  ZHENG_GUAN: 7,
  PIAN_YIN: 8,
  ZHENG_YIN: 9,
} as const);
export type TenGodId = typeof TEN_GOD[keyof typeof TEN_GOD];

export const TEN_GOD_NAMES = Object.freeze([
  '比肩', '劫财', '食神', '伤官', '偏财',
  '正财', '七杀', '正官', '偏印', '正印',
] as const);

export const LIFE_STAGE = Object.freeze({
  CHANG_SHENG: 0,
  MU_YU: 1,
  GUAN_DAI: 2,
  LIN_GUAN: 3,
  DI_WANG: 4,
  SHUAI: 5,
  BING: 6,
  SI: 7,
  MU: 8,
  JUE: 9,
  TAI: 10,
  YANG: 11,
} as const);
export type LifeStageId = typeof LIFE_STAGE[keyof typeof LIFE_STAGE];

export const LIFE_STAGE_NAMES = Object.freeze([
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰',
  '病', '死', '墓', '绝', '胎', '养',
] as const);

export const EARTH_PALACE_MODE = Object.freeze({
  FIRE_EARTH: 0,
  WATER_EARTH: 1,
} as const);
export type EarthPalaceMode = typeof EARTH_PALACE_MODE[keyof typeof EARTH_PALACE_MODE];

export const GENDER = Object.freeze({ FEMALE: 0, MALE: 1 } as const);
export type Gender = typeof GENDER[keyof typeof GENDER];

export const QIYUN_TIME_MODEL = Object.freeze({
  TRADITIONAL_CALENDAR: 0,
  JULIAN_YEAR: 1,
  TROPICAL_YEAR: 2,
} as const);
export type QiYunTimeModel = typeof QIYUN_TIME_MODEL[keyof typeof QIYUN_TIME_MODEL];

export const DAYUN_BOUNDARY_MODEL = Object.freeze({
  CIVIL_YEARS: 0,
  JULIAN_YEARS: 1,
  TROPICAL_YEARS: 2,
} as const);
export type DaYunBoundaryModel = typeof DAYUN_BOUNDARY_MODEL[keyof typeof DAYUN_BOUNDARY_MODEL];

export const STEM_RELATION_FLAG = Object.freeze({
  COMBINATION: 1 << 0,
  CLASH: 1 << 1,
  RESTRAINT: 1 << 2,
} as const);

export const BRANCH_RELATION_FLAG = Object.freeze({
  COMBINATION: 1 << 0,
  CLASH: 1 << 1,
  HARM: 1 << 2,
  DESTRUCTION: 1 << 3,
  PUNISHMENT: 1 << 4,
  SELF_PUNISHMENT: 1 << 5,
  HIDDEN_COMBINATION: 1 << 6,
  SEVERANCE: 1 << 7,
} as const);

export const BRANCH_TRIPLE_RELATION_FLAG = Object.freeze({
  COMBINATION: 1 << 0,
  DIRECTION: 1 << 1,
  PUNISHMENT: 1 << 2,
} as const);

export const RELATION_KIND = Object.freeze({
  STEM_COMBINATION: 0,
  STEM_CLASH: 1,
  STEM_RESTRAINT: 2,
  BRANCH_COMBINATION: 3,
  BRANCH_CLASH: 4,
  BRANCH_HARM: 5,
  BRANCH_DESTRUCTION: 6,
  BRANCH_TRIPLE_PUNISHMENT: 7,
  BRANCH_PUNISHMENT: 8,
  BRANCH_SELF_PUNISHMENT: 9,
  BRANCH_TRIPLE_COMBINATION: 10,
  BRANCH_TRIPLE_DIRECTION: 11,
  BRANCH_HALF_COMBINATION: 12,
  BRANCH_ARCHING_COMBINATION: 13,
  BRANCH_HIDDEN_COMBINATION: 14,
  BRANCH_SEVERANCE: 15,
} as const);
export type RelationKind = typeof RELATION_KIND[keyof typeof RELATION_KIND];
export const RELATION_KIND_MASK_ALL = (1 << 16) - 1;

export const PILLAR_SLOT = Object.freeze({
  YEAR: 0,
  MONTH: 1,
  DAY: 2,
  HOUR: 3,
  MING_GONG: 4,
  SHEN_GONG: 5,
  TAI_YUAN: 6,
  TAI_XI: 7,
} as const);

export const PILLAR_MASK = Object.freeze({
  YEAR: 1 << 0,
  MONTH: 1 << 1,
  DAY: 1 << 2,
  HOUR: 1 << 3,
  MING_GONG: 1 << 4,
  SHEN_GONG: 1 << 5,
  TAI_YUAN: 1 << 6,
  TAI_XI: 1 << 7,
  PRIMARY: 0x0f,
  EXTRA: 0xf0,
  ALL: 0xff,
} as const);

export const RENYUAN_SILING_TABLE = Object.freeze({
  SAN_MING_TONG_HUI: 0,
  COMMON: 1,
} as const);
export type RenyuanSilingTable = typeof RENYUAN_SILING_TABLE[keyof typeof RENYUAN_SILING_TABLE];

export const RENYUAN_SILING_ORIGIN = Object.freeze({
  STEM: 0,
  GEN_EARTH: 1,
  KUN_EARTH: 2,
} as const);
export type RenyuanSilingOrigin = typeof RENYUAN_SILING_ORIGIN[keyof typeof RENYUAN_SILING_ORIGIN];
