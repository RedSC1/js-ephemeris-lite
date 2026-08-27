# Sources and licenses

## chinese_lunar_almanac

- Source: <https://github.com/RedSC1/chinese_lunar_almanac>, version 0.1.5.
- Copyright (c) 2026 RedSC1; MIT License, reproduced in `LICENSE`.
- `src/data.js`, `src/rules.js`, `src/yi-ji.js`, and the supporting tables are
  native JavaScript ports of the active Dart rule engine and data. Almanac
  metadata and flying-star formulas also derive from this project.
  `src/feng-shui.js` uses its 24-mountain, mountain/facing plate and PaiLong rules.

## TuWang calendar rule

The automatic TuWang period uses the eighteen civil days before each of the
four seasonal starts, as described in the Five Elements chapter of
*Qinding Xieji Bianfang Shu* (钦定协纪辨方书).

- Text: <https://www.shidianguji.com/book/SK1619/chapter/1l9llosnxbyg2>.

## cnlunar

- Source: <https://github.com/OPN48/cnlunar>.
- License: <https://github.com/OPN48/cnlunar/blob/master/LICENSE>.
- Copyright (c) 2025 OPN48; MIT License, reproduced in `LICENSE`.
- The source Dart package attributes its traditional almanac rules and data
  to cnlunar. That attribution is retained for this JavaScript derivative.

## Festival names

`src/festivals.js` classifies the imported festival entries, separates combined
labels, and keeps original names and aliases. Selected public and memorial names
and the World Book and Copyright Day date follow these sources:

- State Council, *全国年节及纪念日放假办法* (2024 revision):
  <https://app.www.gov.cn/govdata/gov/202411/12/521605/article.html>.
- Ministry of Foreign Affairs, *外交史上的今天* (September 3):
  <https://www.fmprc.gov.cn/web/ziliao_674904/historytoday_674971/200309/t20030903_9284634.shtml>.
- Nanjing Municipal Government, 2025 national memorial ceremony notice:
  <https://www.nanjing.gov.cn/zdgk/202512/t20251208_5708072.html>.
- UNESCO, *世界图书和版权日* (April 23):
  <https://www.unesco.org/zh/days/world-book-and-copyright>.

Categories describe the content, not statutory time off. Festival labels do not
include annual holiday schedules or historical naming/establishment periods.

## js-ephemeris-lite

The astronomical/calendar runtime is a separate dependency licensed under
MPL-2.0. Its own `LICENSE` and `THIRD_PARTY_NOTICES.md` apply to that dependency;
this package's MIT license does not relicense the ephemeris or its source data.
