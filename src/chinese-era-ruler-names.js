// manakai's primary Chinese person label is not consistently the name most
// familiar in modern Chinese historiography.  For several Liao and Jin rulers
// it is a Khitan/Jurchen personal name, childhood name, or temple name.  Keep
// the upstream monarch tag ID in every generated record, but normalize the
// public label to a temple/title plus the commonly used Chinese name.
//
// Keys are manakai monarch tag IDs.  This deliberately remains a small,
// reviewed table rather than a heuristic that guesses among tag aliases.
// Main cross-checks:
// - Palace Museum, Liao annals: https://www.dpm.org.cn/ancient/nation/159624.html
// - Palace Museum, Jin annals: https://www.dpm.org.cn/ancient/nation/159658.html
// - Liao Shi 30 (Northern/Western Liao): https://zh.wikisource.org/zh-hans/辽史/卷30
// - Liao Shi 72 (Yelü Bei / Dongdan): https://zh.wikisource.org/zh-hans/辽史/卷72
export const CHINESE_ERA_RULER_NAMES = Object.freeze({
  // Other source tags whose primary label is a title or a less familiar
  // non-Han name rather than the public Chinese label used by this UI.
  1239:Object.freeze({ title:'昭宗', ruler:'朱由榔' }),
  1501:Object.freeze({ title:'世祖', ruler:'忽必烈' }),
  2630:Object.freeze({ title:'于阗王', ruler:'李圣天' }),

  // Khitan / Liao and closely related regimes.
  2307:Object.freeze({ title:'太祖', ruler:'耶律阿保机' }),
  2313:Object.freeze({ title:'太宗', ruler:'耶律德光' }),
  2314:Object.freeze({ title:'世宗', ruler:'耶律阮' }),
  2315:Object.freeze({ title:'穆宗', ruler:'耶律璟' }),
  2316:Object.freeze({ title:'景宗', ruler:'耶律贤' }),
  2317:Object.freeze({ title:'圣宗', ruler:'耶律隆绪' }),
  2320:Object.freeze({ title:'兴宗', ruler:'耶律宗真' }),
  2322:Object.freeze({ title:'道宗', ruler:'耶律洪基' }),
  2323:Object.freeze({ title:'天祚帝', ruler:'耶律延禧' }),
  2325:Object.freeze({ title:'宣宗', ruler:'耶律淳' }),
  2326:Object.freeze({ title:'德宗', ruler:'耶律大石' }),
  2339:Object.freeze({ title:'人皇王', ruler:'耶律倍' }),
  2341:Object.freeze({ title:'明王', ruler:'耶律安端' }),

  // Jin.  The source labels here are often Jurchen personal names such as
  // 合剌、迪古乃、乌禄、麻达葛、吾睹补 and 呼敦.
  2378:Object.freeze({ title:'太祖', ruler:'完颜阿骨打' }),
  2381:Object.freeze({ title:'太宗', ruler:'完颜晟' }),
  2382:Object.freeze({ title:'熙宗', ruler:'完颜亶' }),
  2383:Object.freeze({ title:'海陵王', ruler:'完颜亮' }),
  2384:Object.freeze({ title:'世宗', ruler:'完颜雍' }),
  2385:Object.freeze({ title:'章宗', ruler:'完颜璟' }),
  2387:Object.freeze({ title:'卫绍王', ruler:'完颜永济' }),
  2391:Object.freeze({ title:'宣宗', ruler:'完颜珣' }),
  2392:Object.freeze({ title:'哀宗', ruler:'完颜守绪' }),
});

// A single era name can survive a ruler succession. manakai's era object has
// one primary monarch_tag_id, so reviewed successions are split here instead
// of letting that one tag describe the whole era interval.
//
// East Dan Ganlu:
// - Liao Shi 72 records Yelü Bei's departure on Tianxian 5, month 11, Wuyin.
// - Liao Shi 5 records Yelü Anduan's investiture as Ming Wang and ruler of
//   East Dan on Tianlu 1, month 9, Dingmao.
// The interval between those attested events deliberately has no ruler label;
// it is safer than inventing one continuous personal reign.
export const CHINESE_ERA_RULER_SEGMENTS = Object.freeze({
  201:Object.freeze([
    Object.freeze({
      startJd:null,
      endJdExclusive:2061084.1666666667,
      monarchTagId:2339,
    }),
    Object.freeze({
      startJd:2061084.1666666667,
      endJdExclusive:2067253.1666666667,
      monarchTagId:null,
    }),
    Object.freeze({
      startJd:2067253.1666666667,
      endJdExclusive:null,
      monarchTagId:2341,
    }),
  ]),
});
