import {
  CHINESE_ERA_RECORDS,
  MANAKAI_SUPPLEMENTAL_ERA_RECORDS,
} from './generated/chinese-era-data.js';
import {
  CALENDAR_MODE,
  instantToLunar,
  lunarToSolar,
} from './chinese-calendar.js';
import {
  asUt1JulianDay,
  calendarDateFromJulianDay,
  julianDay,
} from './time.js';

const CHINA_OFFSET_MINUTES = 480;
const CHINA_OFFSET_DAYS = CHINA_OFFSET_MINUTES / 1440;
const ERA_CALENDAR_OPTIONS = Object.freeze({
  mode:CALENDAR_MODE.HISTORICAL,
  utcOffsetMinutes:CHINA_OFFSET_MINUTES,
});
const LUNAR_YEAR_START_CACHE = new Map();
const ALL_CHINESE_ERA_RECORDS = Object.freeze([
  ...CHINESE_ERA_RECORDS,
  ...MANAKAI_SUPPLEMENTAL_ERA_RECORDS,
]);

// Shou Xing splits Ying Zheng's record when his public title changes from
// king to First Emperor, but its carried-year field is zero on both rows.
// The historical regnal count did not restart: First Emperor year 26 follows
// King Zheng year 25. Keep the generated source table intact and apply the
// attested carry here as a narrowly scoped source correction.
const ERA_YEAR_OFFSET_CORRECTIONS = new Map([
  ['秦\u0000始皇帝\u0000嬴政\u0000始皇', 25],
]);

function eraYearOffset(record) {
  return ERA_YEAR_OFFSET_CORRECTIONS.get(record.slice(3, 7).join('\u0000')) ?? record[2];
}

function sourceBoundaries(record) {
  const boundaryData = record[7];
  const ddbcSegments = Array.isArray(boundaryData) ? boundaryData : boundaryData?.ddbc;
  const manakai = Array.isArray(boundaryData?.manakai) ? boundaryData.manakai : null;
  const starts = [
    Number.isFinite(manakai?.[0]) ? manakai[0] : null,
    Number.isFinite(ddbcSegments?.[0]?.[0]) ? ddbcSegments[0][0] : null,
  ].filter(Number.isFinite);
  const ends = [
    Number.isFinite(manakai?.[1]) ? manakai[1] : null,
    Number.isFinite(ddbcSegments?.at(-1)?.[1]) ? ddbcSegments.at(-1)[1] : null,
  ].filter(Number.isFinite);
  return {
    // When both sources exist, runtime uses their intersection.
    start:starts.length ? Math.max(...starts) : null,
    end:ends.length ? Math.min(...ends) : null,
  };
}

function rulerLineKey(record) {
  return record.slice(3, 6).join('\u0000');
}

// A coarse record can safely inherit only a directly adjacent transition:
// the previous era's exact exclusive end or the next era's exact start. This
// does not guess a calendar date; it states that two consecutive era names of
// the same polity and ruler hand off at the already sourced boundary.
const ADJACENT_TRANSITION_BOUNDARIES = (() => {
  const groups = new Map();
  for (const record of ALL_CHINESE_ERA_RECORDS) {
    const key = rulerLineKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const result = new Map();
  for (const records of groups.values()) {
    for (let index = 0; index < records.length; index += 1) {
      const previous = records[index - 1];
      const next = records[index + 1];
      result.set(records[index], Object.freeze({
        start:previous ? sourceBoundaries(previous).end : null,
        end:next ? sourceBoundaries(next).start : null,
      }));
    }
  }
  return result;
})();

/** 1949-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const MODERN_CHINA_ERA_START_JD = 2432917.1666666665;

/** 1949-10-01 15:00:00 at UTC+8, represented as a UT Julian Day. */
export const MODERN_CHINA_ESTABLISHMENT_JD = 2433190.7916666665;

/** 1912-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const REPUBLIC_OF_CHINA_ERA_START_JD = 2419402.1666666665;

/** 1916-01-01 00:00:00 at UTC+8, represented as a UT Julian Day. */
export const HONGXIAN_ERA_START_JD = 2420863.1666666665;

/** 1916-03-24 00:00:00 at UTC+8; March 23 is the last attested civil day. */
export const HONGXIAN_ERA_END_JD_EXCLUSIVE = 2420946.1666666665;

const HONGXIAN_ERA_RECORD = Object.freeze([
  1916, 1, 0, '中华帝国', '', '', '洪宪', null,
]);

function lunarYearStartJd(lunarYear) {
  const cached = LUNAR_YEAR_START_CACHE.get(lunarYear);
  if (cached !== undefined) return cached;
  const solar = lunarToSolar({
    year:lunarYear,
    month:1,
    day:1,
    isLeap:false,
  }, ERA_CALENDAR_OPTIONS);
  const value = julianDay({ ...solar, hour:0, minute:0, second:0 }) - CHINA_OFFSET_DAYS;
  LUNAR_YEAR_START_CACHE.set(lunarYear, value);
  return value;
}

function formatFullText(dynasty, title, ruler, era, yearNumber) {
  const rulerText = [title, ruler].filter(Boolean).join(' ');
  return `[${dynasty}]${rulerText ? `${rulerText} ` : ''}${era}${yearNumber}年`;
}

function makeResult(record, yearNumber, startJd, endJdExclusive, precision, boundarySource) {
  const [, , , dynasty, title, ruler, era] = record;
  return Object.freeze({
    dynasty,
    title,
    ruler,
    era,
    yearNumber,
    startJd,
    endJdExclusive,
    precision,
    boundarySource,
    text:formatFullText(dynasty, title, ruler, era, yearNumber),
  });
}

function chinaCivilYear(jdUT1) {
  return calendarDateFromJulianDay(jdUT1 + CHINA_OFFSET_DAYS).year;
}

/**
 * Return every Shou Xing era name active at a physical instant.
 *
 * DDBC and manakai boundaries are stored as double UT JD values at UTC+8
 * midnight and have day precision. manakai supplies the actual era transition
 * interval; DDBC can additionally supply the historical era-year ordinal. If
 * neither has a usable boundary, the Shou Xing start year falls back to that
 * historical lunar year's first-day JD (月日不详).
 * The Republic uses its documented civil-day boundary. The modern Gregorian
 * year label covers all of 1949, while the Republic label remains alongside it
 * until the documented modern-China establishment instant.
 */
export function getChineseEraNames(value) {
  const jdUT1 = asUt1JulianDay(value);
  const lunar = instantToLunar(jdUT1, ERA_CALENDAR_OPTIONS);
  const civilYear = chinaCivilYear(jdUT1);
  const results = [];

  for (const record of ALL_CHINESE_ERA_RECORDS) {
    const [startYear, duration, , dynasty, , , , boundaryData] = record;
    const usedYears = eraYearOffset(record);

    if (dynasty === '当代' && startYear === 1949) {
      if (jdUT1 < MODERN_CHINA_ERA_START_JD) continue;
      results.push(makeResult(
        record,
        civilYear,
        MODERN_CHINA_ERA_START_JD,
        Number.POSITIVE_INFINITY,
        'day',
        'historical-decision',
      ));
      continue;
    }

    if (dynasty === '近、现代' && startYear === 1912) {
      const startJd = REPUBLIC_OF_CHINA_ERA_START_JD;
      if (jdUT1 < startJd || jdUT1 >= MODERN_CHINA_ESTABLISHMENT_JD) continue;
      results.push(makeResult(
        record,
        civilYear - startYear + 1 + usedYears,
        startJd,
        MODERN_CHINA_ESTABLISHMENT_JD,
        'day',
        'historical-event',
      ));
      continue;
    }

    const ddbcSegments = Array.isArray(boundaryData) ? boundaryData : boundaryData?.ddbc;
    const rawManakaiBoundary = Array.isArray(boundaryData?.manakai)
      ? boundaryData.manakai
      : null;
    const adjacentBoundary = ADJACENT_TRANSITION_BOUNDARIES.get(record);
    const hasExactManakaiStart = Number.isFinite(rawManakaiBoundary?.[0]);
    const hasExactManakaiEnd = Number.isFinite(rawManakaiBoundary?.[1]);
    const hasAdjacentStart = !hasExactManakaiStart && Number.isFinite(adjacentBoundary?.start);
    const hasAdjacentEnd = !hasExactManakaiEnd && Number.isFinite(adjacentBoundary?.end);
    const isYearOnlyManakaiBoundary = rawManakaiBoundary
      && !hasExactManakaiStart && !hasExactManakaiEnd
      && !hasAdjacentStart && !hasAdjacentEnd;
    if (isYearOnlyManakaiBoundary
      && (lunar.year < startYear || lunar.year >= startYear + duration)) continue;
    const hasTransitionBoundary = rawManakaiBoundary || hasAdjacentStart || hasAdjacentEnd;
    const manakaiBoundary = hasTransitionBoundary
      ? [
        hasExactManakaiStart
          ? rawManakaiBoundary[0]
          : (hasAdjacentStart ? adjacentBoundary.start : lunarYearStartJd(startYear)),
        hasExactManakaiEnd
          ? rawManakaiBoundary[1]
          : (hasAdjacentEnd
            ? adjacentBoundary.end
            : lunarYearStartJd(startYear + duration)),
      ]
      : null;
    if (manakaiBoundary
      && (jdUT1 < manakaiBoundary[0] || jdUT1 >= manakaiBoundary[1])) continue;

    if (ddbcSegments) {
      const segment = ddbcSegments.find(([startJd, endJdExclusive]) => (
        jdUT1 >= startJd && jdUT1 < endJdExclusive
      ));
      if (segment) {
        const startJd = manakaiBoundary
          ? Math.max(segment[0], manakaiBoundary[0])
          : segment[0];
        const endJdExclusive = manakaiBoundary
          ? Math.min(segment[1], manakaiBoundary[1])
          : segment[1];
        if (jdUT1 >= startJd && jdUT1 < endJdExclusive) {
          results.push(makeResult(
            record,
            segment[2],
            startJd,
            endJdExclusive,
            'day',
            manakaiBoundary ? 'ddbc+manakai' : 'ddbc',
          ));
          continue;
        }
      }
      // DDBC provides explicit historical month segments. Once a record has
      // them, an instant outside every segment is outside that era; do not
      // resurrect it through a broader manakai or year-fallback interval.
      continue;
    }

    if (manakaiBoundary) {
      const yearNumber = lunar.year - startYear + 1 + usedYears;
      const startJd = Math.max(manakaiBoundary[0], lunarYearStartJd(lunar.year));
      const endJdExclusive = Math.min(manakaiBoundary[1], lunarYearStartJd(lunar.year + 1));
      if (yearNumber > 0 && jdUT1 >= startJd && jdUT1 < endJdExclusive) {
        results.push(makeResult(
          record,
          yearNumber,
          startJd,
          endJdExclusive,
          (hasExactManakaiStart || hasAdjacentStart)
            && (hasExactManakaiEnd || hasAdjacentEnd) ? 'day' : 'year',
          rawManakaiBoundary ? 'manakai' : 'transition-handoff',
        ));
      }
      continue;
    }

    if (lunar.year < startYear || lunar.year >= startYear + duration) continue;
    const startJd = lunarYearStartJd(startYear); // 月日不详
    const endJdExclusive = lunarYearStartJd(startYear + duration); // 月日不详
    if (jdUT1 < startJd || jdUT1 >= endJdExclusive) continue;
    results.push(makeResult(
      record,
      lunar.year - startYear + 1 + usedYears,
      startJd,
      endJdExclusive,
      'year',
      'sxwnl-year',
    ));
  }

  if (jdUT1 >= HONGXIAN_ERA_START_JD && jdUT1 < HONGXIAN_ERA_END_JD_EXCLUSIVE) {
    results.push(makeResult(
      HONGXIAN_ERA_RECORD,
      1,
      HONGXIAN_ERA_START_JD,
      HONGXIAN_ERA_END_JD_EXCLUSIVE,
      'day',
      'historical-event',
    ));
  }

  // Shou Xing contains a few duplicate source rows for the same ruler and era
  // (for example two overlapping Later Han 乾祐 durations). Exact transition
  // data can make those rows resolve to the same label and interval; expose the
  // historical candidate once rather than duplicating an identical UI line.
  return Object.freeze(results.filter((entry, index) => (
    results.findIndex((candidate) => candidate.text === entry.text) === index
  )));
}
