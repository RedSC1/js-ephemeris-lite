import { HUANGLI_LOCALE, localizeHuangliText, validateHuangliLocale } from './locale.js';

const mod = (n, base) => ((n % base) + base) % base;
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be ${min}..${max}`);
  }
}

const BOARD_PATH = [4, 8, 5, 6, 1, 7, 2, 3, 0];
const PALACE_INDEX = [7, 2, 3, 0, 4, 8, 5, 6, 1];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
export const PALACE_DIRECTIONS = Object.freeze(['东南', '正南', '西南', '正东', '中宫', '正西', '东北', '正北', '西北']);
const TRADITIONAL_PALACE_DIRECTIONS = Object.freeze(PALACE_DIRECTIONS.map(value => localizeHuangliText(value, HUANGLI_LOCALE.TRADITIONAL)));

export function getPalaceDirections(locale = HUANGLI_LOCALE.SIMPLIFIED) {
  return validateHuangliLocale(locale) === HUANGLI_LOCALE.TRADITIONAL ? TRADITIONAL_PALACE_DIRECTIONS : PALACE_DIRECTIONS;
}

export function createFlyingStarBoard(centerNumber, forward = true) {
  integer(centerNumber, 1, 9, 'centerNumber');
  if (typeof forward !== 'boolean') throw new TypeError('forward must be boolean');
  const board = new Array(9);
  for (let i = 0; i < 9; i++) board[BOARD_PATH[i]] = mod(centerNumber - 1 + i * (forward ? 1 : -1), 9) + 1;
  return board;
}

export function getThreeCyclesNinePeriods(year) {
  integer(year, -6000, 10000, 'year');
  const n = mod(year - 1864, 180);
  return { cycle: ['上元', '中元', '下元'][Math.floor(n / 60)], period: Math.floor(n / 20) + 1 };
}

// Clockwise from north. Each palace contains earth, heaven and human dragons.
const ROWS = [
  ['zi', '子', 1, 'heaven', false], ['gui', '癸', 1, 'human', false],
  ['chou', '丑', 8, 'earth', false], ['gen', '艮', 8, 'heaven', true],
  ['yin', '寅', 8, 'human', true], ['jia', '甲', 3, 'earth', true],
  ['mao', '卯', 3, 'heaven', false], ['yi', '乙', 3, 'human', false],
  ['chen', '辰', 4, 'earth', false], ['xun', '巽', 4, 'heaven', true],
  ['si', '巳', 4, 'human', true], ['bing', '丙', 9, 'earth', true],
  ['wu', '午', 9, 'heaven', false], ['ding', '丁', 9, 'human', false],
  ['wei', '未', 2, 'earth', false], ['kun', '坤', 2, 'heaven', true],
  ['shen', '申', 2, 'human', true], ['geng', '庚', 7, 'earth', true],
  ['you', '酉', 7, 'heaven', false], ['xin', '辛', 7, 'human', false],
  ['xu', '戌', 6, 'earth', false], ['qian', '乾', 6, 'heaven', true],
  ['hai', '亥', 6, 'human', true], ['ren', '壬', 1, 'earth', true],
];
export const MOUNTAINS = Object.freeze(ROWS.map(([key, name, luoShuNumber, dragon, isYang], index) => Object.freeze({
  key, name, luoShuNumber, dragon, isYang, azimuthDeg: index * 15,
})));
export const MOUNTAIN = Object.freeze(Object.fromEntries(MOUNTAINS.map(m => [m.key.toUpperCase(), m.key])));
const MOUNTAIN_BY_NAME = new Map(MOUNTAINS.flatMap(m => [[m.key, m], [m.name, m]]));

export function getMountain(value) {
  const mountain = MOUNTAIN_BY_NAME.get(value);
  if (!mountain) throw new RangeError(`unknown mountain: ${String(value)}`);
  return mountain;
}

/** Azimuth measured clockwise from north; sectors are [center - 7.5, center + 7.5). */
export function mountainForAzimuth(azimuthDeg) {
  if (!Number.isFinite(azimuthDeg)) throw new RangeError('azimuthDeg must be finite');
  return MOUNTAINS[Math.floor((mod(azimuthDeg, 360) + 7.5) / 15) % 24];
}

export function oppositeMountain(value) {
  const mountain = getMountain(value);
  return MOUNTAINS[(mountain.azimuthDeg / 15 + 12) % 24];
}

function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== 9 || new Set(board).size !== 9) {
    throw new RangeError('earthPlate must contain each star 1..9 exactly once');
  }
  for (const star of board) integer(star, 1, 9, 'earthPlate star');
}

function plateParameters(earthPlate, value) {
  validateBoard(earthPlate);
  const mountain = getMountain(value);
  const centerNumber = earthPlate[PALACE_INDEX[mountain.luoShuNumber - 1]];
  const forward = centerNumber === 5 ? mountain.isYang
    : mountain.dragon === 'earth' ? centerNumber % 2 === 1 : centerNumber % 2 === 0;
  return { centerNumber, forward };
}

export function createEarthPlate(period) {
  return createFlyingStarBoard(period);
}

export function createMountainPlate(earthPlate, sitting) {
  const { centerNumber, forward } = plateParameters(earthPlate, sitting);
  return createFlyingStarBoard(centerNumber, forward);
}

export function createFacingPlate(earthPlate, facing) {
  const { centerNumber, forward } = plateParameters(earthPlate, facing);
  return createFlyingStarBoard(centerNumber, forward);
}

/** Natal period chart; facing is the mountain opposite sitting. */
export function createFengShuiChart({ period, sitting }) {
  const earthPlate = createEarthPlate(period);
  const sittingInfo = getMountain(sitting), facingInfo = oppositeMountain(sitting);
  return {
    period, sitting: sittingInfo, facing: facingInfo, earthPlate,
    mountainPlate: createMountainPlate(earthPlate, sittingInfo.key),
    facingPlate: createFacingPlate(earthPlate, facingInfo.key),
    mountainForward: plateParameters(earthPlate, sittingInfo.key).forward,
    facingForward: plateParameters(earthPlate, facingInfo.key).forward,
  };
}

const PAI_LONG_STARS = ['破军', '右弼', '廉贞', '破军', '武曲', '贪狼', '破军', '左辅', '文曲', '破军', '巨门', '禄存'];
// Pairs: 子癸、丑艮、寅甲……亥壬. Independent of the flying-star palace mapping.
const paiLongPalace = mountain => Math.floor(mountain.azimuthDeg / 30);

export function calculatePaiLong(laiLong, facing, options = {}) {
  const { locale = HUANGLI_LOCALE.SIMPLIFIED } = options;
  for (const key of Object.keys(options)) if (key !== 'locale') throw new RangeError(`unknown PaiLong option: ${key}`);
  validateHuangliLocale(locale);
  const source = getMountain(laiLong), target = getMountain(facing);
  const startBranch = (paiLongPalace(source) + 6) % 12;
  const forward = BRANCHES.includes(source.name), step = forward ? 1 : -1;
  const stars = BRANCHES.map((branchName, branch) => ({
    branch, branchName: localizeHuangliText(branchName, locale),
    star: localizeHuangliText(PAI_LONG_STARS[mod((branch - startBranch) * step, 12)], locale),
  }));
  return { laiLong: source, facing: target, startBranch, forward, stars, facingStar: stars[paiLongPalace(target)].star };
}

export function getPaiLongFacingStar(laiLong, facing, options = {}) {
  return calculatePaiLong(laiLong, facing, options).facingStar;
}
