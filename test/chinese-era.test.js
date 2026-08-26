import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALENDAR_MODE,
  HONGXIAN_ERA_END_JD_EXCLUSIVE,
  HONGXIAN_ERA_START_JD,
  MODERN_CHINA_ESTABLISHMENT_JD,
  MODERN_CHINA_ERA_START_JD,
  REPUBLIC_OF_CHINA_ERA_START_JD,
  ZonedTime,
  getChineseEraNames,
  lunarToSolar,
} from '../src/index.js';
import {
  CHINESE_ERA_RECORDS,
  MANAKAI_SUPPLEMENTAL_ERA_RECORDS,
} from '../src/generated/chinese-era-data.js';

const HISTORICAL_CHINA = Object.freeze({
  mode:CALENDAR_MODE.HISTORICAL,
  utcOffsetMinutes:480,
});

function lunarNoon(year, month, day) {
  const solar = lunarToSolar({ year, month, day, isLeap:false }, HISTORICAL_CHINA);
  return new ZonedTime({ ...solar, hour:12, offsetMinutes:480 }).toJulianTime();
}

function civilNoon(year, month, day) {
  return new ZonedTime({ year, month, day, hour:12, offsetMinutes:480 }).toJulianTime();
}

test('First Emperor title change preserves Ying Zheng regnal-year numbering', () => {
  // Astronomical year -212 is 213 BCE. Under the Qin calendar this instant is
  // the later ninth month of the historical 214 BCE-labelled lunar year.
  const entries = getChineseEraNames(civilNoon(-212, 10, 21));
  const qin = entries.find((entry) => entry.dynasty === '秦' && entry.era === '始皇');
  assert.equal(qin?.yearNumber, 33);
  assert.equal(qin?.text, '[秦]始皇帝 嬴政 始皇33年');
});

test('DDBC day boundaries separate the three Liu Song era names in 465', () => {
  assert.deepEqual(
    getChineseEraNames(lunarNoon(465, 8, 12))
      .filter((entry) => entry.dynasty === '南朝/宋').map((entry) => entry.era),
    ['永光'],
  );
  assert.deepEqual(
    getChineseEraNames(lunarNoon(465, 8, 13))
      .filter((entry) => entry.dynasty === '南朝/宋').map((entry) => entry.era),
    ['景和'],
  );
  assert.deepEqual(
    getChineseEraNames(lunarNoon(465, 12, 6))
      .filter((entry) => entry.dynasty === '南朝/宋').map((entry) => entry.era),
    ['景和'],
  );
  assert.deepEqual(
    getChineseEraNames(lunarNoon(465, 12, 7))
      .filter((entry) => entry.dynasty === '南朝/宋').map((entry) => entry.era),
    ['泰始'],
  );
});

test('mixed day- and year-precision records coexist across historical polities', () => {
  const entries = getChineseEraNames(lunarNoon(562, 4, 15));
  assert.ok(entries.length >= 4);
  assert.ok(entries.some((entry) => entry.text === '[南朝/陈]文帝 陈蒨 天嘉3年'));
  assert.ok(entries.some((entry) => entry.precision === 'year'));
  for (const entry of entries) {
    assert.equal(typeof entry.startJd, 'number');
    assert.equal(typeof entry.endJdExclusive, 'number');
    assert.ok(entry.startJd < entry.endJdExclusive);
  }
});

test('manakai transition removes Northern Zhou exactly when Sui Kaihuang begins', () => {
  const before = getChineseEraNames(civilNoon(581, 3, 3));
  assert.ok(before.some((entry) => entry.dynasty === '北朝/北周' && entry.era === '大定'));
  assert.ok(!before.some((entry) => entry.dynasty === '隋' && entry.era === '开皇'));

  const at = getChineseEraNames(civilNoon(581, 3, 4));
  assert.ok(!at.some((entry) => entry.dynasty === '北朝/北周' && entry.era === '大定'));
  const kaihuang = at.find((entry) => entry.dynasty === '隋' && entry.era === '开皇');
  assert.equal(kaihuang?.yearNumber, 1);
  assert.equal(kaihuang?.precision, 'day');
  assert.equal(kaihuang?.boundarySource, 'manakai');

  const april = getChineseEraNames(civilNoon(581, 4, 16));
  assert.ok(april.some((entry) => entry.dynasty === '隋' && entry.era === '开皇'));
  assert.ok(!april.some((entry) => entry.dynasty === '北朝/北周'));
});

test('manakai-only records add concurrent Liao and Western Xia chronology', () => {
  assert.deepEqual(
    getChineseEraNames(civilNoon(1039, 1, 1)).map((entry) => entry.text),
    [
      '[北宋]仁宗 赵祯 宝元1年',
      '[辽]兴宗 耶律宗真 重熙7年',
      '[西夏]李元昊 天授礼法延祚1年',
    ],
  );
});

test('Liao and Jin public labels use temple titles and common Chinese names', () => {
  const liao = getChineseEraNames(civilNoon(999, 7, 1))
    .find((entry) => entry.dynasty === '辽');
  assert.equal(liao?.text, '[辽]圣宗 耶律隆绪 统和17年');

  const jin = getChineseEraNames(civilNoon(1162, 7, 1))
    .find((entry) => entry.dynasty === '金');
  assert.equal(jin?.text, '[金]世宗 完颜雍 大定2年');
});

test('East Dan Ganlu changes ruler labels without resetting its era year', () => {
  const foundingRuler = getChineseEraNames(civilNoon(927, 1, 1))
    .find((entry) => entry.dynasty === '东丹');
  assert.equal(foundingRuler?.text, '[东丹]人皇王 耶律倍 甘露1年');

  const uncertainInterval = getChineseEraNames(civilNoon(935, 1, 1))
    .find((entry) => entry.dynasty === '东丹');
  assert.equal(uncertainInterval?.text, '[东丹]甘露9年');

  const finalRuler = getChineseEraNames(civilNoon(953, 1, 1))
    .find((entry) => entry.dynasty === '东丹');
  assert.equal(finalRuler?.text, '[东丹]明王 耶律安端 甘露27年');
});

test('Later Han Tianfu is year 12 for one year and cannot survive into 953', () => {
  const tianfu = getChineseEraNames(civilNoon(948, 1, 1))
    .find((entry) => entry.dynasty === '五代/汉' && entry.era === '天福');
  assert.equal(tianfu?.yearNumber, 12);

  const entries = getChineseEraNames(civilNoon(953, 1, 1));
  assert.equal(entries.some((entry) => entry.dynasty === '五代/汉'), false);
  assert.ok(entries.some((entry) => (
    entry.dynasty === '五代/周' && entry.era === '广顺' && entry.yearNumber === 2
  )));
});

test('supplemental title-only and non-Han ruler tags receive complete public labels', () => {
  const khotan = getChineseEraNames(civilNoon(950, 7, 1))
    .find((entry) => entry.dynasty === '于阗');
  assert.equal(khotan?.title, '于阗王');
  assert.equal(khotan?.ruler, '李圣天');

  const mongol = getChineseEraNames(civilNoon(1261, 7, 1))
    .find((entry) => entry.dynasty === '蒙古帝国');
  assert.equal(mongol?.title, '世祖');
  assert.equal(mongol?.ruler, '忽必烈');

  const southernMing = getChineseEraNames(civilNoon(1650, 7, 1))
    .find((entry) => entry.dynasty === '南明');
  assert.equal(southernMing?.title, '昭宗');
  assert.equal(southernMing?.ruler, '朱由榔');
});

test('year-precision manakai records preserve Western Xia through the Southern Song period', () => {
  const entries = getChineseEraNames(civilNoon(1200, 7, 18));
  assert.ok(entries.some((entry) => entry.dynasty === '南宋' && entry.era === '庆元'));
  const westernXia = entries.find((entry) => entry.dynasty === '西夏');
  assert.equal(westernXia?.text, '[西夏]李纯佑 天庆7年');
  assert.equal(westernXia?.precision, 'year');
  assert.equal(westernXia?.boundarySource, 'manakai');
});

test('manakai-only records expose the concurrent Five Dynasties and Ten Kingdoms lines', () => {
  const entries = getChineseEraNames(civilNoon(934, 6, 1));
  assert.equal(entries.length, 7);
  for (const expected of ['后蜀', '南汉', '杨吴', '闽', '契丹', '东丹']) {
    assert.ok(entries.some((entry) => entry.dynasty === expected), `missing ${expected}`);
  }
});

test('Wu Zhou adjacent transitions never expose two successive era names', () => {
  const oneSecond = 1 / 86400;
  const wuRecords = CHINESE_ERA_RECORDS.filter((record) => record[3] === '武周');
  const zhengsheng = wuRecords.find((record) => record[6] === '证圣');
  const dengfeng = wuRecords.find((record) => record[6] === '万岁登封');
  const zhengshengEnd = zhengsheng?.[7]?.manakai?.[1];
  const dengfengStart = dengfeng?.[7]?.manakai?.[0];
  assert.ok(Number.isFinite(zhengshengEnd));
  assert.ok(Number.isFinite(dengfengStart));

  assert.deepEqual(
    getChineseEraNames(zhengshengEnd - oneSecond)
      .filter((entry) => entry.dynasty === '武周').map((entry) => entry.era),
    ['证圣'],
  );
  const tiance = getChineseEraNames(zhengshengEnd)
    .filter((entry) => entry.dynasty === '武周');
  assert.deepEqual(tiance.map((entry) => entry.era), ['天册万岁']);
  assert.equal(tiance[0].startJd, zhengshengEnd);

  const tianceBeforeDengfeng = getChineseEraNames(dengfengStart - oneSecond)
    .filter((entry) => entry.dynasty === '武周');
  assert.deepEqual(tianceBeforeDengfeng.map((entry) => entry.era), ['天册万岁']);
  assert.equal(tianceBeforeDengfeng[0].endJdExclusive, dengfengStart);
  assert.deepEqual(
    getChineseEraNames(dengfengStart)
      .filter((entry) => entry.dynasty === '武周').map((entry) => entry.era),
    ['万岁登封'],
  );
});

test('exact era starts do not overlap a different era of the same ruler line', () => {
  const records = [...CHINESE_ERA_RECORDS, ...MANAKAI_SUPPLEMENTAL_ERA_RECORDS];
  let checked = 0;
  for (const record of records) {
    const boundaryData = record[7];
    const ddbc = Array.isArray(boundaryData) ? boundaryData : boundaryData?.ddbc;
    const manakai = Array.isArray(boundaryData?.manakai) ? boundaryData.manakai : null;
    const starts = [manakai?.[0], ddbc?.[0]?.[0]].filter(Number.isFinite);
    if (!starts.length) continue;
    const startJd = Math.max(...starts);
    const [,,, dynasty, title, ruler, era] = record;
    const active = getChineseEraNames(startJd + 1 / 86400)
      .filter((entry) => entry.dynasty === dynasty
        && entry.title === title && entry.ruler === ruler);
    if (!active.some((entry) => entry.era === era)) continue;
    checked += 1;
    assert.deepEqual(
      active.filter((entry) => entry.era !== era).map((entry) => entry.text),
      [],
      `successor ${dynasty}/${title}/${ruler}/${era} overlaps its predecessor`,
    );
  }
  assert.ok(checked >= 400, 'too few exact transitions were checked');
});

test('the modern 1949 label starts on January 1 while the Republic label remains', () => {
  const oneSecond = 1 / 86400;
  const before = getChineseEraNames(MODERN_CHINA_ERA_START_JD - oneSecond);
  assert.ok(before.some((entry) => entry.era === '民国' && entry.yearNumber === 37));
  assert.ok(!before.some((entry) => entry.era === '公历纪元'));

  const at = getChineseEraNames(MODERN_CHINA_ERA_START_JD);
  assert.deepEqual(at.map((entry) => entry.text), [
    '[近、现代]中华民国 民国38年',
    '[当代]中国 公历纪元1949年',
  ]);
  const modern = at.find((entry) => entry.era === '公历纪元');
  assert.equal(modern?.precision, 'day');
  assert.equal(modern?.boundarySource, 'historical-decision');
  assert.equal(modern?.startJd, MODERN_CHINA_ERA_START_JD);

  const startOf1950 = new ZonedTime({
    year:1950, month:1, day:1, hour:0, offsetMinutes:480,
  }).toJulianTime();
  assert.equal(getChineseEraNames(startOf1950)[0].yearNumber, 1950);
});

test('the Republic label ends at the exact 1949-10-01 15:00 UTC+8 instant', () => {
  const oneSecond = 1 / 86400;
  const before = getChineseEraNames(MODERN_CHINA_ESTABLISHMENT_JD - oneSecond);
  assert.ok(before.some((entry) => entry.era === '民国' && entry.yearNumber === 38));
  assert.ok(before.some((entry) => entry.era === '公历纪元' && entry.yearNumber === 1949));

  const at = getChineseEraNames(MODERN_CHINA_ESTABLISHMENT_JD);
  assert.deepEqual(at.map((entry) => entry.text), ['[当代]中国 公历纪元1949年']);

  const republicBefore = before.find((entry) => entry.era === '民国');
  assert.equal(republicBefore?.endJdExclusive, MODERN_CHINA_ESTABLISHMENT_JD);
});

test('the Republic calendar starts on the documented 1912-01-01 UTC+8 civil day', () => {
  const oneSecond = 1 / 86400;
  assert.equal(
    getChineseEraNames(REPUBLIC_OF_CHINA_ERA_START_JD - oneSecond).some((entry) => entry.era === '民国'),
    false,
  );
  const at = getChineseEraNames(REPUBLIC_OF_CHINA_ERA_START_JD).find((entry) => entry.era === '民国');
  assert.equal(at?.yearNumber, 1);
  assert.equal(at?.startJd, REPUBLIC_OF_CHINA_ERA_START_JD);
  assert.equal(at?.precision, 'day');
  assert.equal(at?.boundarySource, 'historical-event');
});

test('Hongxian runs alongside Republic year 5 through the attested March 23 civil day', () => {
  const oneSecond = 1 / 86400;
  const before = getChineseEraNames(HONGXIAN_ERA_START_JD - oneSecond);
  assert.deepEqual(before.map((entry) => entry.era), ['民国']);

  const atStart = getChineseEraNames(HONGXIAN_ERA_START_JD);
  assert.deepEqual(atStart.map((entry) => entry.text), [
    '[近、现代]中华民国 民国5年',
    '[中华帝国]洪宪1年',
  ]);

  const lastSecond = getChineseEraNames(HONGXIAN_ERA_END_JD_EXCLUSIVE - oneSecond);
  assert.deepEqual(lastSecond.map((entry) => entry.era), ['民国', '洪宪']);
  const hongxian = lastSecond.find((entry) => entry.era === '洪宪');
  assert.equal(hongxian?.yearNumber, 1);
  assert.equal(hongxian?.precision, 'day');
  assert.equal(hongxian?.boundarySource, 'historical-event');
  assert.equal(hongxian?.startJd, HONGXIAN_ERA_START_JD);
  assert.equal(hongxian?.endJdExclusive, HONGXIAN_ERA_END_JD_EXCLUSIVE);

  const after = getChineseEraNames(HONGXIAN_ERA_END_JD_EXCLUSIVE);
  assert.deepEqual(after.map((entry) => entry.era), ['民国']);
  assert.equal(after[0].yearNumber, 5);
});
