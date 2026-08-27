// Development-only data extraction. No Dart runtime ships in the JS package.
import 'dart:convert';
import 'package:chinese_lunar_almanac/chinese_lunar_almanac.dart';
import 'package:chinese_lunar_almanac/src/utils/fast_bitset.dart';
import 'package:chinese_lunar_almanac/src/data/god_grid_type_a.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_b.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_c.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_d.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_e.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_f.dart';
import 'package:chinese_lunar_almanac/src/data/god_rules_type_h.dart';
import 'package:chinese_lunar_almanac/src/data/yi_ji/yi_ji_data.dart';
import 'package:chinese_lunar_almanac/src/data/cnlunar_festivals.dart';
import 'package:chinese_lunar_almanac/src/calculators/peng_zu_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/tai_shen_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/god_direction_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/xiu_28_lunar_mansion_calc.dart';

dynamic encode(dynamic v) {
  if(v is FastBitSet) return v.toList();
  if(v is (FastBitSet,FastBitSet)) return [encode(v.$1),encode(v.$2)];
  if(v is Map) return v.map((k,v)=>MapEntry(k is Enum?'${k.index}':'$k',encode(v)));
  if(v is Iterable) return v.map(encode).toList();
  return v;
}
void main() {
  final data = {
    'gods': AlmanacGod.values.map((g)=>[g.name,g.label]).toList(),
    'activities': AlmanacActivity.values.map((a)=>[a.name,a.label]).toList(),
    'angelMask': AlmanacGod.angelMask,
    'sortPriority': AlmanacActivity.sortPriority,
    'activityMasks': {'civilian37':AlmanacActivity.civilian37,'imperial67':AlmanacActivity.imperial67,'tongshu60':AlmanacActivity.tongshu60,'cnlunarLegacy38':AlmanacActivity.cnlunarLegacy38},
    'aGrid':TypeAGrid.grid, 'b':TypeBGodRules.all, 'c':TypeCGodRules.all,
    'd':TypeDGodRules.singleMatch, 'diNang':TypeDGodRules.di_nang,
    'eStem':TypeEGodRules.stemMatch,'eBranch':TypeEGodRules.branchMatch,'ePillar':TypeEGodRules.pillarMatch,
    'f':TypeFGodRules.all,'bujiang':TypeHGodRules.bujiang,'yangGongJi':TypeHGodRules.yangGongJi,
    'officerGood':OfficerThings.good,'officerBad':OfficerThings.bad,
    'stemActivities':Day8CharThings.stemRules,'branchActivities':Day8CharThings.branchRules,
    'godActivities':GodActivities.table,
    'levels':ThingLevelRules.rules.map((r)=>[r.monthMask,r.realGodMask,r.virtualGodMask,r.level]).toList(),
    'pengzuStem':TianGan.values.map(PengZu.getGanTaboo).toList(),
    'pengzuBranch':DiZhi.values.map(PengZu.getZhiTaboo).toList(),
    'taishen':List.generate(60,(i)=>TaiShenCalculator.getDirection(GanZhi(TianGan.values[i%10], DiZhi.values[i%12])).toString()),
    'directions':TianGan.values.map((g)=>GodDirection.getAll(g).map((k,v)=>MapEntry(k,v.label))).toList(),
    'mansions':LunarMansion.mansions.map((m)=>{'name':m.name,'fullName':m.fullName,'direction':m.direction,'isGood':m.isGood}).toList(),
    'festivals':{
      'solar':CnlunarFestivals.legalSolarHolidays,'lunar':CnlunarFestivals.legalLunarHolidays,
      'otherSolar':CnlunarFestivals.otherSolarHolidays,'otherLunar':CnlunarFestivals.otherLunarHolidays,
      'term':CnlunarFestivals.solarTermHolidays,
      'week':CnlunarFestivals.weekBasedHolidays.map((k,v)=>MapEntry('$k',v.map((r)=>[r.$1,r.$2,r.$3]).toList())),
    },
  };
  print(jsonEncode(encode(data)));
}
