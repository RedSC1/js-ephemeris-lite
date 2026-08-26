import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import {
  CHINESE_ERA_RULER_NAMES,
  CHINESE_ERA_RULER_SEGMENTS,
} from '../src/chinese-era-ruler-names.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sxwnlPath = process.argv[2]
  ?? '/Users/rzliu/Developer/OpenDestiny/sxwnl/src/lunar.js';
const dilaPath = process.argv[3]
  ?? '/tmp/dila-time-inspect/authority_time_chinese/authority_time_chinese.sql';
const outputPath = process.argv[4]
  ?? path.join(projectRoot, 'src/generated/chinese-era-data.js');
const manakaiPath = process.argv[5]
  ?? '/tmp/manakai-era-defs.json';
const manakaiTagsPath = process.argv[6]
  ?? '/tmp/manakai-tags.json';
const CHINA_OFFSET_DAYS = 8 / 24;
// Shou Xing uses 9999 years as the open-ended modern-era sentinel. That ends
// inside DE441's supported future span, so preserve the meaning with a much
// larger finite value that remains JSON-serializable.
const OPEN_ENDED_ERA_DURATION_YEARS = 999_999_999;
const LATER_HAN_TIANFU_SOURCE = Object.freeze([
  947, 12, 0, '五代/汉', '高祖', '刘知远', '天福',
]);

function extractInsert(sql, table) {
  const match = sql.match(new RegExp('INSERT INTO `' + table + '` VALUES (.*?);', 's'));
  if (!match) throw new Error(`table ${table} is absent from ${dilaPath}`);
  return match[1];
}

function primaryNames(sql, table) {
  return new Map(
    [...extractInsert(sql, table).matchAll(/\((\d+),'([^']*)',(\d+),(\d+)\)/g)]
      .filter((match) => match[3] === '0' && match[4] === '1')
      .map((match) => [Number(match[1]), match[2]]),
  );
}

function allNames(sql, table) {
  const result = new Map();
  for (const match of extractInsert(sql, table).matchAll(/\((\d+),'([^']*)',(\d+),(\d+)\)/g)) {
    // Ranking 0 is the canonical DILA name. Alternate spellings are useful
    // for search, but must not bind a distinct Shou Xing era to the same DILA
    // record (for example 永兴 as an alternate spelling of 永熙).
    if (match[3] !== '0' || match[4] !== '1') continue;
    const id = Number(match[1]);
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(match[2]);
  }
  return result;
}

function pairs(sql, table) {
  return new Map(
    [...extractInsert(sql, table).matchAll(/\((\d+),(\d+)\)/g)]
      .map((match) => [Number(match[1]), Number(match[2])]),
  );
}

const TRADITIONAL_TO_SIMPLIFIED = Object.freeze({
  '紀':'纪','稱':'称','復':'复','斷':'断','詳':'详',
  '後':'后','漢':'汉','晉':'晋','陳':'陈','齊':'齐','國':'国','號':'号','劉':'刘','蕭':'萧','楊':'杨','趙':'赵','吳':'吴','呉':'吴','閩':'闽','遼':'辽','萬':'万','曆':'历','暦':'历','歷':'历','慶':'庆','興':'兴','寧':'宁','甯':'宁','貞':'贞','觀':'观','龍':'龙','寶':'宝','顯':'显','順':'顺','開':'开','義':'义','廣':'广','應':'应','鳳':'凤','載':'载','聖':'圣','歲':'岁','長':'长','樂':'乐','紹':'绍','統':'统','禎':'祯','賜':'赐','儀':'仪','會':'会','冊':'册','證':'证','豐':'丰','臺':'台','昇':'升','欽':'钦','廢':'废','獻':'献','莊':'庄','靈':'灵','簡':'简','懷':'怀','閔':'闵','肅':'肃','煬':'炀','則':'则','溫':'温','圖':'图','貼':'贴','鐵':'铁','愛':'爱','爾':'尔','鏐':'镠','彥':'彦','欎':'郁','詧':'察','贇':'赟','頊':'顼','緯':'纬','顥':'颢','燾':'焘','詡':'诩','勗':'勖','從':'从','璵':'玙','佑':'祐','徳':'德','査':'查','尭':'尧','華':'华','異':'异','説':'说','諱':'讳','偽':'伪','書':'书',
});

function normalized(value) {
  return [...String(value ?? '')]
    .map((character) => TRADITIONAL_TO_SIMPLIFIED[character] ?? character)
    .join('')
    .replace(/[\s·・（）()「」『』\[\]、，,]/g, '')
    .replace(/大(?=宁|安|定|同|和)/g, '太');
}

const DYNASTY_ALIASES = Object.freeze({
  '战国-秦':'秦', '三国-魏':'曹魏',
  '南朝/宋':'刘宋', '南朝/齐':'南齐', '南朝/梁':'南梁', '南朝/陈':'陈', '南朝/后梁':'西梁',
  '北朝/北魏':'北魏', '北朝/东魏':'东魏', '北朝/西魏':'西魏', '北朝/北齐':'北齐', '北朝/北周':'北周',
  '五代/梁':'后梁', '五代/唐':'后唐', '五代/晋':'后晋', '五代/汉':'后汉', '五代/周':'后周',
});

// manakai covers many kinds of eras worldwide. Supplemental runtime records
// are deliberately limited to Chinese historical polities missing from the
// Shou Xing skeleton. Central dynasties remain sourced from Shou Xing.
const SUPPLEMENTAL_MANAKAI_POLITIES = Object.freeze({
  '蜀漢':'蜀汉', '孫呉':'孙吴',
  '朱梁':'后梁', '後唐':'后唐', '後晋':'后晋', '五代後漢':'后汉', '後周':'后周',
  '前蜀':'前蜀', '後蜀':'后蜀', '楊呉':'杨吴', '南唐':'南唐', '呉越':'吴越',
  '十国閩':'闽', '南漢':'南汉', '北漢':'北汉',
  '契丹 (耶律阿保機)':'契丹', '大契丹':'辽', '大遼 (耶律尭骨)':'辽',
  '大遼 (耶律査剌)':'辽', '北遼':'北辽', '興遼':'兴辽',
  '前西北遼':'西北辽', '西遼':'西辽',
  '西夏':'西夏', '金':'金', '大金国':'金', '完顔部':'女真',
  '渤海国':'渤海', '大渤海':'渤海', '大真国':'大真', '東丹国':'东丹',
  '蒙古帝国':'蒙古帝国', '于闐':'于阗',
  '南明':'南明', '呉周':'吴周', '順 (李自成)':'大顺', '韓宋':'韩宋', '明夏':'明夏',
});

// Before imperial-era names became the norm, the source models the major
// Warring States through ruler-accession chronologies. They use the same
// ordinal-year shape as an era, but their calendar boundaries are only
// year-precise. Limit this layer to the seven major states; importing every
// Spring and Autumn polity would overwhelm the compact chart UI.
const SUPPLEMENTAL_MANAKAI_REIGN_POLITIES = Object.freeze({
  '春秋戦国秦':'秦',
  '姜斉':'齐', '田斉':'齐', '春秋戦国齊':'齐',
  '春秋戦国楚':'楚', '春秋戦国燕':'燕', '春秋戦国韓':'韩',
  '春秋戦国趙':'赵', '春秋戦国魏':'魏',
});

const NOMINAL_START_ALLOWED_POLITIES = new Set(['蜀漢', '孫呉', '西夏']);

function supplementalDynasty(era) {
  return SUPPLEMENTAL_MANAKAI_POLITIES[era.country]
    ?? SUPPLEMENTAL_MANAKAI_REIGN_POLITIES[era.country]
    ?? null;
}

function normalizedDynasty(value) {
  const aliased = DYNASTY_ALIASES[value] ?? value;
  return normalized(aliased.includes('/') ? aliased.split('/').at(-1) : aliased);
}

function gregorianYearFromJdn(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return 100 * b + d - 4800 + Math.floor(m / 10);
}

function chineseCivilDayStartJd(civilDayNumber) {
  return civilDayNumber - 0.5 - CHINA_OFFSET_DAYS;
}

function readSxwnlRecords(source) {
  const start = source.indexOf('  var s =', source.indexOf('JNB'));
  const end = source.indexOf('  this.JNB', start);
  if (start < 0 || end < 0) throw new Error(`JNB is absent from ${sxwnlPath}`);
  const joined = [...source.slice(start, end).matchAll(/'([^']*)'/g)]
    .map((match) => match[1])
    .join('');
  const values = joined.split(',');
  const records = [];
  for (let index = 0; index + 6 < values.length; index += 7) {
    records.push([
      Number(values[index]), Number(values[index + 1]), Number(values[index + 2]),
      values[index + 3], values[index + 4], values[index + 5], values[index + 6],
    ]);
  }
  return records;
}

function readDilaEras(sql) {
  const dynastyNames = primaryNames(sql, 't_dynasty_names');
  const emperorNames = primaryNames(sql, 't_emperor_names');
  const eraAliases = allNames(sql, 't_era_names');
  const emperorDynasty = pairs(sql, 't_emperor');
  const eraEmperor = pairs(sql, 't_era');
  const byEra = new Map();
  const monthPattern = /\((\d+),(\d+),(\d+),'([^']*)',(\d+),(\d+),(\d+),(\d+),'([^']*)',(\d+),'([SP])',(\d+)\)/g;
  for (const match of extractInsert(sql, 't_month').matchAll(monthPattern)) {
    if (match[11] !== 'S') continue;
    const eraId = Number(match[6]);
    if (!byEra.has(eraId)) byEra.set(eraId, []);
    byEra.get(eraId).push({
      ordinal:Number(match[2]), first:Number(match[7]), last:Number(match[8]),
    });
  }
  const result = [];
  for (const [eraId, months] of byEra) {
    months.sort((left, right) => left.first - right.first);
    const segments = [];
    for (const month of months) {
      const previous = segments.at(-1);
      if (previous && previous[2] === month.ordinal && month.first <= previous[1] + 1) {
        previous[1] = Math.max(previous[1], month.last);
      } else {
        segments.push([month.first, month.last, month.ordinal]);
      }
    }
    const emperorId = eraEmperor.get(eraId);
    const dynastyId = emperorDynasty.get(emperorId);
    result.push({
      dynasty:dynastyNames.get(dynastyId) ?? '',
      title:emperorNames.get(emperorId) ?? '',
      aliases:eraAliases.get(eraId) ?? [],
      first:segments[0][0],
      last:segments.at(-1)[1],
      firstYear:gregorianYearFromJdn(segments[0][0]),
      // Runtime boundaries are double UT JD values. DILA supplies Chinese
      // civil-day numbers, so each boundary is normalized to UTC+8 midnight.
      segments:segments.map(([first, last, ordinal]) => [
        chineseCivilDayStartJd(first),
        chineseCivilDayStartJd(last + 1),
        ordinal,
      ]),
    });
  }
  return result;
}

function matchDilaRecord(record, dilaEras) {
  const [startYear, duration, , dynasty, title, , eraName] = record;
  if (startYear < -220 || startYear > 1912) return null;
  const normalizedEra = normalized(eraName);
  const normalizedSourceDynasty = normalizedDynasty(dynasty);
  const normalizedTitle = normalized(title).replace(/帝$/, '');
  const candidates = [];
  for (const candidate of dilaEras) {
    if (!candidate.aliases.some((alias) => normalized(alias) === normalizedEra)) continue;
    const yearDifference = Math.abs(candidate.firstYear - startYear);
    if (yearDifference > 1) continue;
    let score = yearDifference === 0 ? 120 : 45;
    if (normalizedDynasty(candidate.dynasty) === normalizedSourceDynasty) score += 80;
    const candidateTitle = normalized(candidate.title).replace(/帝$/, '');
    if (normalizedTitle && candidateTitle === normalizedTitle) score += 35;
    const approximateYears = Math.max(1, gregorianYearFromJdn(candidate.last) - candidate.firstYear + 1);
    score -= Math.min(20, Math.abs(approximateYears - duration));
    candidates.push({ candidate, score });
  }
  candidates.sort((left, right) => right.score - left.score || left.candidate.first - right.candidate.first);
  if (!candidates.length || candidates[0].score < 115) return null;
  if (candidates[1] && candidates[1].score === candidates[0].score) return null;
  return candidates[0].candidate;
}

function readManakaiTags(source) {
  const tags = JSON.parse(source).tags ?? {};
  return new Map(Object.values(tags).map((tag) => [tag.id, {
    simplified:tag.name_cn ?? tag.label_cn ?? '',
    traditional:tag.name_tw ?? tag.label_tw ?? '',
  }]));
}

function readManakaiEras(source, localizedTags) {
  const parsed = JSON.parse(source);
  return Object.values(parsed.eras ?? {}).flatMap((era) => {
    const startYear = era.start_year ?? era.start_day?.year;
    const endYear = era.end_year ?? era.end_day?.year;
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)
      || !Number.isFinite(era.end_day?.jd)) return [];
    const names = new Set([
      era.key,
      era.name,
      era.name_cn,
      era.name_tw,
      ...Object.keys(era.names ?? {}),
    ].map(normalized).filter(Boolean));
    const tags = new Set(Object.values(era.tag_ids ?? {}).map(normalized).filter(Boolean));
    const hasDiscontinuousUse = [...tags].some((tag) => (
      tag.includes('再开') || tag.includes('中断') || tag.includes('恢复')
    ));
    return [{
      id:era.id,
      key:era.key,
      names,
      tags,
      country:era.tag_ids?.[era.country_tag_id] ?? '',
      ruler:localizedTags.get(era.monarch_tag_id)?.simplified ?? '',
      rulerTraditional:localizedTags.get(era.monarch_tag_id)?.traditional ?? '',
      monarchTagId:era.monarch_tag_id ?? null,
      displayName:era.name_cn ?? normalized(era.name_tw ?? era.name ?? era.key),
      continuous:!hasDiscontinuousUse,
      reignOnly:[...tags].some((tag) => (
        tag.includes('即位纪年') || tag.includes('称制纪年')
      )),
      startYear,
      endYear,
      // Some canonical manakai sequences, notably most Western Xia eras,
      // provide only the nominal first year and an exact last civil day.
      // Preserve that distinction: runtime falls back to the first day of the
      // historical lunar year and reports year precision instead of inventing
      // an exact transition day.
      startJd:Number.isFinite(era.start_day?.jd)
        ? era.start_day.jd - CHINA_OFFSET_DAYS
        : null,
      // manakai end_day is the last applicable civil day, whereas the runtime
      // interval is half-open. Its JD values denote civil midnights without a
      // zone, so normalize both ends to UTC+8 midnight like the DDBC rows.
      endJdExclusive:era.end_day.jd + 1 - CHINA_OFFSET_DAYS,
    }];
  });
}

function manakaiReliabilityScore(era) {
  let score = 0;
  if (era.tags.has('公年号')) score += 100;
  if (era.tags.has('中华王朝の公年号')) score += 30;
  if (!/[（(]/.test(era.key)) score += 10;
  if (era.displayName) score += 5;
  if (era.tags.has('六国年表即位纪年')) score += 35;
  if (era.tags.has('十二诸侯年表即位纪年')) score += 20;
  if (era.tags.has('竹书纪年')) score -= 25;
  if ([...era.tags].some((tag) => tag.includes('避讳'))) score -= 20;
  return score;
}

function isUsableSupplementalEra(era) {
  const isReviewedReign = Boolean(SUPPLEMENTAL_MANAKAI_REIGN_POLITIES[era.country])
    && era.reignOnly && era.startYear >= -500;
  if (!supplementalDynasty(era)) return false;
  // Shou Xing's Qin main line begins at astronomical year -305. Keep only
  // the earlier Qin accession records in the supplemental layer so one
  // instant cannot expose two competing Qin ordinals.
  if (era.country === '春秋戦国秦' && era.startYear >= -305) return false;
  if (!era.continuous || !era.ruler || era.startYear >= 1912
    || (!isReviewedReign && era.startYear < 220)) return false;
  if (!Number.isFinite(era.startJd)
    && !NOMINAL_START_ALLOWED_POLITIES.has(era.country) && !isReviewedReign) return false;
  const rejectedTags = new Set(['旧说', '旧説', '异说', '異説', '错误', '誤り', '架空']);
  return (!era.reignOnly || isReviewedReign)
    && ![...era.tags].some((tag) => rejectedTags.has(tag)
      || tag.includes('伪书初出') || tag.includes('年不详'));
}

function buildManakaiSupplementalRecords(manakaiEras, matchedIds) {
  const candidates = manakaiEras.filter(isUsableSupplementalEra);
  const byEra = new Map();
  for (const era of candidates) {
    const dynasty = supplementalDynasty(era);
    const key = era.reignOnly
      ? [dynasty, normalized(era.ruler), 'reign'].join('|')
      : [dynasty, normalized(era.ruler), normalized(era.displayName)].join('|');
    if (!byEra.has(key)) byEra.set(key, []);
    byEra.get(key).push(era);
  }

  const resolved = [];
  for (const alternatives of byEra.values()) {
    if (alternatives.some((era) => matchedIds.has(era.id))) continue;
    alternatives.sort((left, right) => manakaiReliabilityScore(right) - manakaiReliabilityScore(left)
      || (left.startJd ?? Number.POSITIVE_INFINITY)
        - (right.startJd ?? Number.POSITIVE_INFINITY)
      || left.id - right.id);
    const best = alternatives[0];
    const runnerUp = alternatives[1];
    if (runnerUp && manakaiReliabilityScore(runnerUp) === manakaiReliabilityScore(best)
      && (runnerUp.startJd !== best.startJd || runnerUp.endJdExclusive !== best.endJdExclusive)) {
      // Multiple equally supported boundaries: retain none until a source can
      // adjudicate them instead of publishing false precision.
      continue;
    }
    resolved.push(best);
  }

  // Different spellings of the same polity/ruler interval (for example taboo
  // variants) collapse to the best-supported public name.
  const byInterval = new Map();
  for (const era of resolved) {
    const dynasty = supplementalDynasty(era);
    const key = [dynasty, normalized(era.ruler), era.startJd, era.endJdExclusive].join('|');
    const current = byInterval.get(key);
    if (!current || manakaiReliabilityScore(era) > manakaiReliabilityScore(current)) {
      byInterval.set(key, era);
    }
  }

  const ordered = [...byInterval.values()]
    .sort((left, right) => left.startYear - right.startYear
      || (left.startJd ?? Number.POSITIVE_INFINITY)
        - (right.startJd ?? Number.POSITIVE_INFINITY)
      || left.id - right.id);
  const nextReignStartYears = new Map();
  const reignsByDynasty = new Map();
  for (const era of ordered.filter((candidate) => candidate.reignOnly)) {
    const dynasty = supplementalDynasty(era);
    if (!reignsByDynasty.has(dynasty)) reignsByDynasty.set(dynasty, []);
    reignsByDynasty.get(dynasty).push(era);
  }
  for (const reigns of reignsByDynasty.values()) {
    reigns.sort((left, right) => left.startYear - right.startYear || left.id - right.id);
    for (let index = 0; index + 1 < reigns.length; index += 1) {
      nextReignStartYears.set(reigns[index], reigns[index + 1].startYear);
    }
  }

  return ordered.flatMap((era) => {
      const dynasty = supplementalDynasty(era);
      const startYear = era.startYear;
      const nextReignStartYear = nextReignStartYears.get(era);
      let effectiveEndYear = Number.isFinite(nextReignStartYear)
        ? Math.min(era.endYear, nextReignStartYear - 1)
        : era.endYear;
      if (era.country === '春秋戦国秦') effectiveEndYear = Math.min(effectiveEndYear, -306);
      const duration = Math.max(1, effectiveEndYear - era.startYear + 1);
      const reviewedSegments = CHINESE_ERA_RULER_SEGMENTS[era.id];
      const segments = reviewedSegments ?? [{
        startJd:era.startJd,
        endJdExclusive:era.endJdExclusive,
        monarchTagId:era.monarchTagId,
      }];
      return segments.map((segment) => {
        const monarchTagId = segment.monarchTagId;
        const publicRuler = CHINESE_ERA_RULER_NAMES[monarchTagId];
        const sourceRuler = monarchTagId === era.monarchTagId
          ? era.ruler
          : (manakaiTags.get(monarchTagId)?.simplified ?? '');
        return [
          startYear,
          duration,
          0,
          dynasty,
          era.reignOnly ? '' : (publicRuler?.title ?? ''),
          era.reignOnly ? '' : (publicRuler?.ruler ?? sourceRuler),
          era.displayName,
          {
            ddbc:null,
            // The Warring States accession tables are year-level historical
            // chronology. Preserve their source ID without presenting a
            // synthetic January boundary as a known accession day.
            manakai:era.reignOnly
              ? [null, null, era.id]
              : [
                segment.startJd ?? era.startJd,
                segment.endJdExclusive ?? era.endJdExclusive,
                era.id,
              ],
            ...(reviewedSegments ? { rulerSegment:{ monarchTagId } } : {}),
          },
        ];
      });
    });
}

function scoreManakaiRecord(record, candidate) {
  const [startYear, duration, , dynasty, title, ruler, eraName] = record;
  if (!candidate.continuous
    || (!Number.isFinite(candidate.startJd) && !Number.isFinite(candidate.endJdExclusive))
    || !candidate.names.has(normalized(eraName))) {
    return Number.NEGATIVE_INFINITY;
  }
  const yearDifference = Math.abs(candidate.startYear - startYear);
  if (yearDifference > 1) return Number.NEGATIVE_INFINITY;

  let score = yearDifference === 0 ? 120 : 55;
  if (candidate.tags.has(normalizedDynasty(dynasty))) score += 100;
  if (ruler && candidate.tags.has(normalized(ruler))) score += 90;
  if (title && candidate.tags.has(normalized(title))) score += 40;
  if (normalized(candidate.key) === normalized(eraName)) score += 25;
  if (candidate.tags.has('公年号')) score += 10;
  if (candidate.tags.has('旧说') || candidate.tags.has('异说')) score -= 35;

  const approximateYears = Math.max(1, candidate.endYear - candidate.startYear + 1);
  score -= Math.min(20, Math.abs(approximateYears - duration));
  return score;
}

function matchManakaiRecord(record, manakaiEras) {
  const [startYear] = record;
  // Do not manufacture day precision for the legendary chronology. manakai
  // remains useful here as a transition authority for the historical table.
  if (startYear < -220 || startYear > 1912) return null;
  const candidates = manakaiEras
    .map((candidate) => ({ candidate, score:scoreManakaiRecord(record, candidate) }))
    .filter(({ score }) => score >= 115)
    .sort((left, right) => right.score - left.score
      || (left.candidate.startJd ?? Number.POSITIVE_INFINITY)
        - (right.candidate.startJd ?? Number.POSITIVE_INFINITY)
      || left.candidate.id - right.candidate.id);
  if (!candidates.length) return null;
  if (candidates[1] && candidates[1].score === candidates[0].score
    && (candidates[1].candidate.startJd !== candidates[0].candidate.startJd
      || candidates[1].candidate.endJdExclusive !== candidates[0].candidate.endJdExclusive)) {
    return null;
  }
  return candidates[0].candidate;
}

const sxwnlRecords = readSxwnlRecords(fs.readFileSync(sxwnlPath, 'utf8'));
const modernRecord = sxwnlRecords.find((record) => (
  record[0] === 1949 && record[3] === '当代' && record[6] === '公历纪元'
));
if (modernRecord) modernRecord[1] = OPEN_ENDED_ERA_DURATION_YEARS;
const laterHanTianfuRecord = sxwnlRecords.find((record) => (
  record.every((value, index) => value === LATER_HAN_TIANFU_SOURCE[index])
));
if (!laterHanTianfuRecord) throw new Error('Shou Xing Later Han Tianfu source record changed');
// Shou Xing stores this row as duration=12, usedYears=0. The surrounding
// rows and the historical continuation of Tianfu show those values were
// transposed: Later Han used only Tianfu year 12 before Qianyou.
laterHanTianfuRecord[1] = 1;
laterHanTianfuRecord[2] = 11;
const dilaEras = readDilaEras(fs.readFileSync(dilaPath, 'utf8'));
const manakaiSource = fs.readFileSync(manakaiPath, 'utf8');
const manakaiSha256 = createHash('sha256').update(manakaiSource).digest('hex');
const manakaiTagsSource = fs.readFileSync(manakaiTagsPath, 'utf8');
const manakaiTagsSha256 = createHash('sha256').update(manakaiTagsSource).digest('hex');
const manakaiTags = readManakaiTags(manakaiTagsSource);
const manakaiEras = readManakaiEras(manakaiSource, manakaiTags);
let dilaMatches = 0;
let manakaiMatches = 0;
const matchedManakaiIds = new Set();
const generated = sxwnlRecords.map((record) => {
  const dilaMatch = matchDilaRecord(record, dilaEras);
  const manakaiMatch = matchManakaiRecord(record, manakaiEras);
  if (dilaMatch) dilaMatches += 1;
  if (manakaiMatch) {
    manakaiMatches += 1;
    matchedManakaiIds.add(manakaiMatch.id);
  }
  if (!dilaMatch && !manakaiMatch) return [...record, null]; // 月日不详
  return [...record, {
    ddbc:dilaMatch?.segments ?? null,
    manakai:manakaiMatch
      ? [manakaiMatch.startJd, manakaiMatch.endJdExclusive, manakaiMatch.id]
      : null,
  }];
});
const supplemental = buildManakaiSupplementalRecords(manakaiEras, matchedManakaiIds);

// DILA sometimes starts a new era partway through a lunar month and leaves
// the preceding days outside the old era's S rows. When two adjacent Shou
// Xing records from the same polity both have exact data, the new era's
// start is also the old era's end. Fill only that short, explicit hand-off;
// never jump across an intervening 月日不详 record.
for (let index = 0; index + 1 < generated.length; index += 1) {
  const current = generated[index];
  const next = generated[index + 1];
  const currentSegments = current[7]?.ddbc;
  const nextSegments = next[7]?.ddbc;
  if (!currentSegments || !nextSegments) continue;
  if (normalizedDynasty(current[3]) !== normalizedDynasty(next[3])) continue;
  const currentEnd = currentSegments.at(-1)[1];
  const nextStart = nextSegments[0][0];
  const gap = nextStart - currentEnd;
  if (gap >= 0 && gap <= 45) currentSegments.at(-1)[1] = nextStart;
}

const header = `// Generated by tools/build-chinese-era-data.mjs. Do not edit by hand.\n`
  + `// Text: Shou Xing Tian Wen Li / 寿星天文历, Xu Jianwei (许剑伟).\n`
  + `// Exact JD boundaries: DDBC Time Authority Database, Dharma Drum Buddhist College.\n`
  + `// DDBC download page: https://authority.dila.edu.tw/docs/open_content/download.php\n`
  + `// The DDBC archive includes CC BY-SA 3.0 Unported; its download page also states CC BY-SA 2.5 Taiwan.\n`
  + `// Era transition boundaries: manakai/data-locale calendar-era-defs.json (CC0).\n`
  + `// manakai source: https://github.com/manakai/data-locale\n`
  + `// manakai merged-data SHA-256: ${manakaiSha256}\n`
  + `// manakai tags SHA-256: ${manakaiTagsSha256}\n`
  + `// manakai calendar-day JDs are normalized to UTC+8 midnight; end_day is made exclusive.\n`
  + `// Open-ended modern duration sentinel: 9999 source years, expanded to ${OPEN_ENDED_ERA_DURATION_YEARS}.\n`
  + `// Later Han Tianfu source typo: duration/used-years 12/0 normalized to 1/11.\n`
  + `// Null boundary data means: 月日不详; runtime falls back to that lunar year's first JD.\n`;
fs.mkdirSync(path.dirname(outputPath), { recursive:true });
fs.writeFileSync(
  outputPath,
  `${header}export const CHINESE_ERA_RECORDS = Object.freeze(${JSON.stringify(generated)});\n`
    + `export const MANAKAI_SUPPLEMENTAL_ERA_RECORDS = Object.freeze(${JSON.stringify(supplemental)});\n`,
);
console.log(
  `wrote ${generated.length} records (${dilaMatches} with DILA JD boundaries; `
  + `${manakaiMatches} with manakai transition boundaries) plus `
  + `${supplemental.length} conservative manakai-only records to ${outputPath}`,
);
