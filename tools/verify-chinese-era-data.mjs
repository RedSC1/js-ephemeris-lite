import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CHINESE_ERA_RECORDS,
  MANAKAI_SUPPLEMENTAL_ERA_RECORDS,
} from '../src/generated/chinese-era-data.js';
import {
  CHINESE_ERA_RULER_NAMES,
  CHINESE_ERA_RULER_SEGMENTS,
} from './chinese-era-ruler-names.js';

const sxwnlPath = process.argv[2]
  ?? '/Users/rzliu/Developer/OpenDestiny/sxwnl/src/lunar.js';
const manakaiPath = process.argv[3]
  ?? '/tmp/manakai-era-defs.json';
const manakaiTagsPath = process.argv[4]
  ?? '/tmp/manakai-tags.json';
const CHINA_OFFSET_DAYS = 8 / 24;
const OPEN_ENDED_ERA_DURATION_YEARS = 999_999_999;
const ORIGINAL_MODERN_RECORD = Object.freeze([
  1949, 9999, 1948, '当代', '中国', '', '公历纪元',
]);
const LATER_HAN_TIANFU_SOURCE = Object.freeze([
  947, 12, 0, '五代/汉', '高祖', '刘知远', '天福',
]);

function readSxwnlRecords(source) {
  const start = source.indexOf('  var s =', source.indexOf('JNB'));
  const end = source.indexOf('  this.JNB', start);
  assert.ok(start >= 0 && end >= 0, `JNB is absent from ${sxwnlPath}`);
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

const sourceRecords = readSxwnlRecords(fs.readFileSync(sxwnlPath, 'utf8'));
assert.equal(CHINESE_ERA_RECORDS.length, sourceRecords.length, 'record count differs from Shou Xing');

let normalizedDifferences = 0;
let ddbcBoundaryRecords = 0;
let manakaiBoundaryRecords = 0;
const reviewedRulerIdsUsed = new Set();
const manakaiEras = JSON.parse(fs.readFileSync(manakaiPath, 'utf8')).eras;
const manakaiErasById = new Map(Object.values(manakaiEras).map((era) => [era.id, era]));
const manakaiTags = JSON.parse(fs.readFileSync(manakaiTagsPath, 'utf8')).tags;
for (let index = 0; index < sourceRecords.length; index += 1) {
  const source = sourceRecords[index];
  const generated = CHINESE_ERA_RECORDS[index];
  assert.equal(generated.length, 8, `generated record ${index} must have seven source fields plus boundaries`);

  const expected = [...source];
  if (source[0] === 1949 && source[3] === '当代' && source[6] === '公历纪元') {
    assert.deepEqual(source, ORIGINAL_MODERN_RECORD, 'Shou Xing modern sentinel or offset changed');
    expected[1] = OPEN_ENDED_ERA_DURATION_YEARS;
    normalizedDifferences += 1;
  }
  if (source.every((value, field) => value === LATER_HAN_TIANFU_SOURCE[field])) {
    expected[1] = 1;
    expected[2] = 11;
    normalizedDifferences += 1;
  }
  assert.deepEqual(generated.slice(0, 7), expected, `source fields differ at record ${index}`);

  const boundaryData = generated[7];
  if (boundaryData === null) continue;
  assert.equal(typeof boundaryData, 'object', `invalid boundary object at record ${index}`);
  assert.ok(boundaryData.ddbc || boundaryData.manakai, `empty boundary object at record ${index}`);

  if (boundaryData.ddbc) {
    assert.ok(Array.isArray(boundaryData.ddbc) && boundaryData.ddbc.length > 0,
      `invalid DDBC boundaries at record ${index}`);
    ddbcBoundaryRecords += 1;
    for (const [startJd, endJdExclusive, yearNumber] of boundaryData.ddbc) {
      assert.ok(Number.isFinite(startJd), `invalid DDBC start JD at record ${index}`);
      assert.ok(Number.isFinite(endJdExclusive) && endJdExclusive > startJd,
        `invalid DDBC end JD at record ${index}`);
      assert.ok(Number.isInteger(yearNumber) && yearNumber > 0,
        `invalid DDBC era year at record ${index}`);
    }
  }

  if (boundaryData.manakai) {
    const [startJd, endJdExclusive, eraId] = boundaryData.manakai;
    assert.ok(startJd === null || Number.isFinite(startJd),
      `invalid manakai start JD at record ${index}`);
    assert.ok(Number.isFinite(endJdExclusive)
      && (startJd === null || endJdExclusive > startJd),
      `invalid manakai end JD at record ${index}`);
    assert.ok(Number.isInteger(eraId) && eraId > 0, `invalid manakai era ID at record ${index}`);
    const sourceEra = manakaiErasById.get(eraId);
    assert.ok(sourceEra, `manakai era ${eraId} is absent at record ${index}`);
    assert.equal(startJd, Number.isFinite(sourceEra.start_day?.jd)
      ? sourceEra.start_day.jd - CHINA_OFFSET_DAYS
      : null, `manakai start JD differs at record ${index}`);
    assert.equal(endJdExclusive, sourceEra.end_day.jd + 1 - CHINA_OFFSET_DAYS,
      `manakai end JD differs at record ${index}`);
    manakaiBoundaryRecords += 1;
  }
}

for (let index = 0; index < MANAKAI_SUPPLEMENTAL_ERA_RECORDS.length; index += 1) {
  const record = MANAKAI_SUPPLEMENTAL_ERA_RECORDS[index];
  assert.equal(record.length, 8, `supplemental record ${index} must have eight fields`);
  const [startYear, duration, usedYears, dynasty, title, ruler, eraName, boundaryData] = record;
  assert.ok(Number.isInteger(startYear) && startYear >= -500 && startYear < 1912,
    `invalid supplemental start year at record ${index}`);
  assert.ok(Number.isInteger(duration) && duration > 0,
    `invalid supplemental duration at record ${index}`);
  assert.equal(usedYears, 0, `supplemental used-year offset differs at record ${index}`);
  assert.ok(dynasty && eraName, `incomplete supplemental label at record ${index}`);
  assert.equal(/[\u3040-\u30ff]/u.test(`${dynasty}${ruler}${eraName}`), false,
    `Japanese kana leaked into supplemental record ${index}`);
  assert.equal(boundaryData.ddbc, null, `supplemental record ${index} must not claim DDBC data`);
  const [startJd, endJdExclusive, eraId] = boundaryData.manakai;
  const sourceEra = manakaiErasById.get(eraId);
  assert.ok(sourceEra, `supplemental manakai era ${eraId} is absent at record ${index}`);
  const sourceTags = Object.values(sourceEra.tag_ids ?? {});
  const isReignOnly = sourceTags.some((tag) => (
    tag.includes('即位紀年') || tag.includes('称制紀年')
  ));
  const reviewedSegment = boundaryData.rulerSegment;
  const monarchTagId = reviewedSegment
    ? reviewedSegment.monarchTagId
    : sourceEra.monarch_tag_id;
  const monarchTag = manakaiTags[monarchTagId];
  const simplifiedRuler = monarchTag?.name_cn ?? monarchTag?.label_cn ?? '';
  const publicRuler = CHINESE_ERA_RULER_NAMES[monarchTagId];
  if (publicRuler && !isReignOnly) {
    reviewedRulerIdsUsed.add(monarchTagId);
    assert.notDeepEqual([publicRuler.title, publicRuler.ruler], ['', simplifiedRuler],
      `reviewed ruler ${monarchTagId} does not normalize its source label`);
  }
  assert.equal(title, isReignOnly ? '' : (publicRuler?.title ?? ''),
    `supplemental ruler title differs from the reviewed display label at record ${index}`);
  assert.equal(ruler, isReignOnly ? '' : (publicRuler?.ruler ?? simplifiedRuler),
    `supplemental ruler differs from the reviewed display label at record ${index}`);
  if (isReignOnly) {
    assert.equal(startJd, null,
      `year-precision reign record must not claim a start JD at record ${index}`);
    assert.equal(endJdExclusive, null,
      `year-precision reign record must not claim an end JD at record ${index}`);
  } else if (reviewedSegment) {
    const sourceSegments = CHINESE_ERA_RULER_SEGMENTS[eraId];
    const sourceStartJd = Number.isFinite(sourceEra.start_day?.jd)
      ? sourceEra.start_day.jd - CHINA_OFFSET_DAYS
      : null;
    const sourceEndJdExclusive = sourceEra.end_day.jd + 1 - CHINA_OFFSET_DAYS;
    const expectedSegment = sourceSegments?.find((segment) => (
      (segment.startJd ?? sourceStartJd) === startJd
      && (segment.endJdExclusive ?? sourceEndJdExclusive) === endJdExclusive
      && segment.monarchTagId === monarchTagId
    ));
    assert.ok(expectedSegment, `unreviewed ruler segment at supplemental record ${index}`);
  } else {
    assert.equal(startJd, Number.isFinite(sourceEra.start_day?.jd)
      ? sourceEra.start_day.jd - CHINA_OFFSET_DAYS
      : null, `supplemental manakai start JD differs at record ${index}`);
    assert.equal(endJdExclusive, sourceEra.end_day.jd + 1 - CHINA_OFFSET_DAYS,
      `supplemental manakai end JD differs at record ${index}`);
  }
}

for (const [monarchTagId, publicRuler] of Object.entries(CHINESE_ERA_RULER_NAMES)) {
  assert.ok(publicRuler.title && publicRuler.ruler,
    `reviewed ruler ${monarchTagId} must have both title and common name`);
  assert.ok(reviewedRulerIdsUsed.has(Number(monarchTagId)),
    `reviewed ruler ${monarchTagId} is no longer used by any supplemental record`);
}

for (let index = 0; index < CHINESE_ERA_RECORDS.length; index += 1) {
  const current = CHINESE_ERA_RECORDS[index];
  for (let nextIndex = index + 1; nextIndex < CHINESE_ERA_RECORDS.length; nextIndex += 1) {
    const next = CHINESE_ERA_RECORDS[nextIndex];
    if (next[0] >= current[0] + current[1]) break;
    if (current[3] !== next[3] || current[6] === next[6]) continue;
    assert.ok(current[0] + current[1] - next[0] <= 2,
      `implausible multi-year same-polity overlap between records ${index} and ${nextIndex}`);
  }
}

assert.equal(normalizedDifferences, 2, 'expected exactly two documented source normalizations');
console.log(
  `verified ${sourceRecords.length} Shou Xing records; `
  + `${ddbcBoundaryRecords} have DDBC JD boundaries; `
  + `${manakaiBoundaryRecords} have manakai transition boundaries; `
  + `${MANAKAI_SUPPLEMENTAL_ERA_RECORDS.length} manakai-only records passed source checks; `
  + 'the two documented source-field normalizations passed; '
  + 'the modern source offset 1948 remains unchanged',
);
