// JavaScript Yi/Ji evaluator derived from cnlunar and maintained by huangli-lite.
// Copyright (c) 2026 RedSC1; derived rules from cnlunar, Copyright (c) 2025 OPN48. MIT.
import { DATA } from './data.js';
import { BitSet } from './bitset.js';
import { G, A, OfficerThings, Day8CharThings, GodActivities, thingLevel as calculateConflictLevel } from './rule-tables.js';
export function calculateYiJi({monthBranch, dayGanZhiIndex, lunarMonth, lunarDay, nextSolarTermIndex, dayOfficerIndex, activeRealGods, activeVirtualGodsMask, isPhaseOfMoon, isYeargodDuty=true}) {
    let good = new BitSet(DATA.activities.length);
    let bad = new BitSet(DATA.activities.length);

    function extractActivities(bitset, tb) {
      tb.merge(bitset);
    }

    extractActivities(OfficerThings.good[dayOfficerIndex], good);
    extractActivities(OfficerThings.bad[dayOfficerIndex], bad);

    let stemRule = Day8CharThings.stemRules[dayGanZhiIndex % 10];
    if (stemRule != null) {
      extractActivities(stemRule[0], good);
      extractActivities(stemRule[1], bad);
    }
    let branchRule = Day8CharThings.branchRules[dayGanZhiIndex % 12];
    if (branchRule != null) {
      extractActivities(branchRule[0], good);
      extractActivities(branchRule[1], bad);
    }

    for (const godIndex of activeRealGods) {
      let rule = GodActivities.table[godIndex];
      if (rule != null) {
        extractActivities(rule[0], good);
        extractActivities(rule[1], bad);
      }
    }

    if (nextSolarTermIndex >= 4 &&
        nextSolarTermIndex <= 8 &&
        (dayOfficerIndex == 5 ||
            dayOfficerIndex == 7 ||
            dayOfficerIndex == 9)) {
      good.add(A.qu_yu);

    }

    if ((nextSolarTermIndex >= 20 || nextSolarTermIndex <= 2) &&
        (dayOfficerIndex == 5 ||
            dayOfficerIndex == 7 ||
            dayOfficerIndex == 9)) {
      good.add(A.tian_lie);

    }

    if ((nextSolarTermIndex >= 21 || nextSolarTermIndex <= 2) &&
        (dayOfficerIndex == 7)) {
      good.add(A.fa_mu);

    }

    if ([1, 6, 15, 19, 21, 23].includes(lunarDay)) {
      bad.add(A.zheng_shou_zu_jia);

    }

    if (lunarDay == 12 || lunarDay == 15) {
      bad.addAll([
        A.zheng_rong,
        A.ti_tou,
      ]);

    }

    if (lunarDay == 15 || isPhaseOfMoon) {
      bad.add(A.qiu_yi_liao_bing);

    }

    let maxLevel = calculateConflictLevel(monthBranch, activeRealGods, activeVirtualGodsMask);

    let isDe =
        activeRealGods.has(G.sui_de) ||
        activeRealGods.has(G.sui_de_he) ||
        activeRealGods.has(G.yue_de) ||
        activeRealGods.has(G.yue_de_he) ||
        activeRealGods.has(G.tian_de) ||
        activeRealGods.has(G.tian_de_he);

    let thingLevel;

    if (maxLevel == 5) {
      thingLevel = 3;
    } else if (maxLevel == 4) {
      thingLevel = isDe ? 2 : 3;
    } else if (maxLevel == 3) {
      thingLevel = isDe ? 1 : 2;
    } else if (maxLevel == 2) {
      thingLevel = isDe ? 0 : 2;
    } else if (maxLevel == 1) {
      thingLevel = isDe ? 0 : 1;
    } else if (maxLevel == 0) {
      thingLevel = 0;
    } else {

      thingLevel = 1;
    }

    let intersection = good.intersection(bad);

    if (thingLevel == 3) {
      good = BitSet.fromIndices(DATA.activities.length, [
        A.zhu_shi_bu_yi,
      ]);

      bad = BitSet.fromIndices(DATA.activities.length, [
        A.zhu_shi_bu_yi,
      ]);

    } else if (thingLevel == 2) {

      good.oppress(intersection);

    } else if (thingLevel == 1) {

      good.oppress(intersection);
      bad.oppress(intersection);

    } else if (thingLevel == 0) {

      bad.oppress(intersection);

    }

    if (thingLevel != 3) {

      if (good.includes(A.xuan_zheng_shi) &&
          good.includes(A.bu_zheng_shi)) {
        good.remove(A.bu_zheng_shi);
      }

      if (good.includes(A.ying_jian_gong_shi) &&
          good.includes(A.xiu_gong_shi)) {
        good.remove(A.xiu_gong_shi);
      }

      let isDeSheEnSixiang = false;
      let maxpowerGods = [
        G.yue_de_he,
        G.tian_de_he,
        G.tian_she,
        G.tian_yuan,
        G.yue_en,
        G.si_xiang,
        G.shi_de,
      ];
      if (isYeargodDuty) maxpowerGods.push(G.sui_de_he);

      for (const g of maxpowerGods) {
        if (activeRealGods.has(g)) {
          isDeSheEnSixiang = true;
          break;
        }
      }

      if (isDeSheEnSixiang && thingLevel != 2) {
        bad.removeAll([
          A.jin_ren_kou,
          A.an_chuang,
          A.jing_luo,
          A.yun_niang,
          A.kai_shi,
          A.li_quan_jiao_yi,
          A.na_cai,
          A.kai_cang_ku,
          A.chu_huo_cai,
        ]);

        let deGodsMask =
            BitSet.fromIndices(DATA.gods.length, [
              G.sui_de,
              G.sui_de_he,
              G.yue_de,
              G.yue_de_he,
              G.tian_de,
              G.tian_de_he,
            ]);
        if (isDe) {
          for (const dg of deGodsMask) {
            if (activeRealGods.has(dg)) {
              let t = GodActivities.table[dg];
              if (t != null) {

                bad.merge(t[1]);

              }
            }
          }
        }
      }

      let dayEarthBranch = dayGanZhiIndex % 12;
      let dayStemStr = "甲乙丙丁戊己庚辛壬癸"[dayGanZhiIndex % 10];
      if (activeRealGods.has(G.tian_gou) ||
          dayEarthBranch == 2  ) {
        bad.add(A.ji_si);

        good.removeAll([
          A.ji_si,
          A.qiu_fu,
          A.qi_si,
        ]);

      }

      if (dayEarthBranch == 3  ) {
        bad.add(A.chuan_jing);
        good.add(A.kai_qu);

      }
      if (dayStemStr == '壬') {
        bad.add(A.kai_qu);
        good.removeAll([
          A.kai_qu,
          A.chuan_jing,
        ]);

      }

      if (dayEarthBranch == 5  ) {
        bad.add(A.chu_xing);
        good.removeAll([
          A.chu_xing,
          A.chu_shi,
          A.qian_shi,
        ]);

      }

      if (dayEarthBranch == 9  ) {
        bad.add(A.yan_hui);
        good.removeAll([
          A.yan_hui,
          A.qing_ci,
          A.shang_he,
        ]);

      }

      if (dayStemStr == '丁') {
        bad.add(A.ti_tou);
        good.removeAll([
          A.ti_tou,
          A.zheng_rong,
        ]);

      }

      if (maxLevel == 0 && thingLevel == 0 && isDe) {

        for (const dg of [
          G.sui_de,
          G.sui_de_he,
          G.yue_de,
          G.yue_de_he,
          G.tian_de,
          G.tian_de_he,
        ]) {
          if (activeRealGods.has(dg)) {
            let t = GodActivities.table[dg];
            if (t != null) {
              bad.merge(t[1]);

            }
          }
        }
      }

      if (maxLevel == 1) {

        if (isDe) {
          for (const dg of [
            G.sui_de,
            G.sui_de_he,
            G.yue_de,
            G.yue_de_he,
            G.tian_de,
            G.tian_de_he,
          ]) {
            if (activeRealGods.has(dg)) {
              let t = GodActivities.table[dg];
              if (t != null) {
                bad.merge(t[1]);

              }
            }
          }
        }

        if (!bad.has(A.qi_fu)) {
          bad.remove(A.qiu_si);
        }

        if (!bad.has(A.jie_hun_yin) && !isDe) {
          bad.removeAll([
            A.guan_dai,
            A.na_cai_wen_ming,
            A.jia_qu,
            A.jin_ren_kou,
          ]);

        }

        let hasSpecialGods =
            (dayEarthBranch == 11) ||
            activeRealGods.has(G.yan_dui) ||
            activeRealGods.has(G.ba_zhuan) ||
            activeRealGods.has(G.si_ji_taboo) ||
            activeRealGods.has(G.si_qiong);

        let isSolelyBlamedOnSpecialGods = false;
        if (hasSpecialGods && bad.has(A.jia_qu)) {
          isSolelyBlamedOnSpecialGods = true;
          for (const godIndex of activeRealGods) {

            if (godIndex == G.yan_dui ||
                godIndex == G.ba_zhuan ||
                godIndex == G.si_ji_taboo ||
                godIndex == G.si_qiong) {
              continue;
            }

            let rule = GodActivities.table[godIndex];
            if (rule != null && rule[1].has(A.jia_qu)) {
              isSolelyBlamedOnSpecialGods = false;
              break;
            }
          }
        }

        if ((!bad.has(A.jia_qu) ||
                isSolelyBlamedOnSpecialGods) &&
            !isDe) {
          if (!activeRealGods.has(G.bu_jiang)) {
            bad.removeAll([
              A.guan_dai,
              A.na_cai_wen_ming,
              A.jie_hun_yin,
              A.jin_ren_kou,
              A.ban_yi,
              A.an_chuang,
            ]);

          }
        }
      }

      if (dayEarthBranch == 11  ) {
        bad.add(A.jia_qu);

      }

      if (maxLevel == 1 && !isDe) {
        if (!bad.has(A.ban_yi)) {
          bad.remove(A.an_chuang);
        }
        if (!bad.has(A.an_chuang)) {
          bad.remove(A.ban_yi);
        }

        if (!bad.has(A.jie_chu)) {
          bad.removeAll([
            A.zheng_rong,
            A.ti_tou,
            A.zheng_shou_zu_jia,
          ]);

        }

        if (!bad.has(A.xiu_zao) ||
            !bad.has(A.shu_zhu_shang_liang)) {
          bad.removeAll([
            A.xiu_gong_shi,
            A.shan_cheng_guo,
            A.zheng_shou_zu_jia,
            A.zhu_di_fang,
            A.xiu_cang_ku,
            A.gu_zhu,
            A.shan_gai,
            A.xiu_zhi_chan_shi,
            A.kai_qu_chuan_jing,
            A.kai_qu,
            A.chuan_jing,
            A.an_dui_wei,
            A.bu_yuan_sai_xue,
            A.bu_yuan,
            A.sai_xue,
            A.xiu_shi_yuan_qiang,
            A.ping_zhi_dao_tu,
            A.po_wu_huai_yuan,
          ]);

        }
      }

      if (maxLevel == 1) {
        if (!bad.has(A.kai_shi)) {
          bad.removeAll([
            A.li_quan_jiao_yi,
            A.na_cai,
            A.kai_cang_ku,
            A.chu_huo_cai,
          ]);

        }
        if (!bad.has(A.na_cai)) {
          bad.removeAll([
            A.li_quan_jiao_yi,
            A.kai_shi,
          ]);

        }
        if (!bad.has(A.li_quan_jiao_yi)) {
          bad.removeAll([
            A.na_cai,
            A.kai_shi,
            A.kai_cang_ku,
            A.chu_huo_cai,
          ]);

        }
      }

      if (maxLevel == 1) {
        if (!bad.has(A.mu_yang)) {
          bad.remove(A.na_chu);
        }
        if (!bad.has(A.na_chu)) {
          bad.remove(A.mu_yang);
        }

        if (good.has(A.an_zang)) {
          bad.remove(A.qi_cuan);
        }
        if (good.has(A.qi_cuan)) {
          bad.remove(A.an_zang);
        }

      }

      if (bad.has(A.zhao_ming_gong_qing) ||
          bad.has(A.zhao_xian)) {
        good.removeAll([
          A.shi_en,
          A.ju_zheng_zhi,
        ]);

      }

      if (bad.has(A.shi_en) ||
          bad.has(A.ju_zheng_zhi)) {
        good.removeAll([
          A.zhao_ming_gong_qing,
          A.zhao_xian,
        ]);

      }

      if (good.has(A.xuan_zheng_shi) &&
          activeRealGods.has(G.wang_wang)) {
        good.remove(A.xuan_zheng_shi);
        good.add(A.bu_zheng_shi);

      }

      if (activeRealGods.has(G.yue_yan)) {
        good.removeAll([
          A.ban_zhao,
          A.shi_en,
          A.zhao_xian,
          A.ju_zheng_zhi,
          A.xuan_zheng_shi,
        ]);
        good.add(A.bu_zheng_shi);

        bad.add(A.bu_yuan);

        if (activeRealGods.has(G.tu_fu) ||
            activeRealGods.has(G.di_nang)) {
          good.remove(A.sai_xue);

        }
      }

      if (dayOfficerIndex == 10  ) {
        good.removeAll([
          A.po_tu,
          A.an_zang,
          A.qi_cuan,
        ]);

      }

      if (activeRealGods.has(G.si_ji_taboo) ||
          activeRealGods.has(G.si_qiong)) {
        bad.add(A.an_zang);
        good.removeAll([
          A.po_tu,
          A.qi_cuan,
        ]);

      }

      if (activeRealGods.has(G.ming_fei) ||
          activeRealGods.has(G.ming_fei_dui)) {
        good.removeAll([
          A.po_tu,
          A.qi_cuan,
        ]);

      }

      let amnestyDays = [
        '空',
        '甲戌',
        '空',
        '丙申',
        '空',
        '甲子',
        '戊申',
        '庚辰',
        '辛卯',
        '甲子',
        '空',
        '甲子',
      ];
      let dStr =
          "甲乙丙丁戊己庚辛壬癸"[dayGanZhiIndex % 10] +
          "子丑寅卯辰巳午未申酉戌亥"[dayGanZhiIndex % 12];
      let lmn = lunarMonth;
      if (lmn >= 1 && lmn <= 12 && amnestyDays[lmn - 1] == dStr) {
        bad = BitSet.fromIndices(DATA.activities.length, [
          A.zhu_shi_bu_ji,
        ]);

      }

      let hasDeHe =
          activeRealGods.has(G.sui_de_he) ||
          activeRealGods.has(G.yue_de_he) ||
          activeRealGods.has(G.tian_de_he);
      let hasSheYuan =
          activeRealGods.has(G.tian_she) ||
          activeRealGods.has(G.tian_yuan);
      if (hasDeHe && hasSheYuan) {
        bad = BitSet.fromIndices(DATA.activities.length, [
          A.zhu_shi_bu_ji,
        ]);

      }
    }

    let finalOverlap = good.intersection(bad);

    if (finalOverlap.length == 1 &&
        (finalOverlap.has(A.zhu_shi_bu_yi) ||
            finalOverlap.has(A.zhu_shi_bu_ji))) {

    } else {
      good.oppress(finalOverlap);

    }

    if (bad.isEmpty) {
      bad.add(A.zhu_shi_bu_ji);
    }
    if (good.isEmpty) {
      good.add(A.zhu_shi_bu_yi);
    }

    return { goodThings: good, badThings: bad, thingLevel, maxLevel };
}
