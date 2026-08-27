// Development-only read-only oracle. The source Dart repository is not modified.
import 'dart:convert';
import 'dart:io';
import 'package:chinese_lunar_almanac/chinese_lunar_almanac.dart';
import 'package:chinese_lunar_almanac/src/calculators/god_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/yi_ji_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/chong_sha_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/sanyuan_jiuyun_calc.dart';
import 'package:chinese_lunar_almanac/src/data/yi_ji/virtual_god_defs.dart';
import 'package:chinese_lunar_almanac/src/data/yi_ji/thing_level_calc.dart';
import 'package:chinese_lunar_almanac/src/utils/fast_bitset.dart';
import 'package:chinese_lunar_almanac/src/utils/time_utils.dart';
import 'export-huangli.dart' as exporter;

dynamic rules(Map<String,dynamic> r) {
  final int m=r['monthBranch'],d=r['dayIndex'],y=r['yearIndex'];
  final gods=r['godIds'] == null ? GodCalculator.calculateAll(
    monthIndex:m,dayGanZhiIndex:d,yearGanZhiIndex:y,lunarMonth:r['lunarMonth'],lunarDay:r['lunarDay'],
    seasonIndex:r['seasonIndex'] ?? ((m+10)%12)~/3,monthSeasonTypeIndex:r['monthSeasonTypeIndex'] ?? (m+9)%3,
    day28Star:r['mansion'],date:AstroDateTime(2026,1,1),isSiJue:r['isSiJue'] ?? false,
    isSiLi:r['isSiLi'] ?? false,isTuWangYongShi:r['isTuWangYongShi'] ?? false,
  ) : FastBitSet.fromIndices(171,List<int>.from(r['godIds']));
  final officer=(d%12-m+12)%12;
  final int virtual=r['virtualMask'] ?? computeVirtualGodBits(officerIndex:officer,monthBranch:m,
    dayBranch:d%12,dayStemBranch60:d,hasYueDe:gods.has(AlmanacGod.yue_de.index));
  final yi=YiJiCalc.calculate(monthBranch:m,dayGanZhiIndex:d,lunarMonth:r['lunarMonth'],lunarDay:r['lunarDay'],
    nextSolarTermIndex:r['nextSolarTermIndex'],dayOfficerIndex:officer,activeRealGods:gods,
    activeVirtualGodsMask:virtual,isPhaseOfMoon:r['isPhaseOfMoon'] ?? false,isYeargodDuty:r['isYeargodDuty'] ?? true);
  return [gods.toList(),yi.goodThings.toList(),yi.badThings.toList(),yi.thingLevel,
    ThingLevelCalc.calculate(monthBranch:m,activeRealGods:gods,activeVirtualGodsMask:virtual)];
}

dynamic calendar(Map<String,dynamic> r) {
  final a=r['date'] as List;
  final clock=AstroDateTime(a[0],a[1],a[2],a[3],a[4],a[5]);
  final zi=RatHourMode.values[r['zi'] ?? 0], exact=r['exact'] ?? false;
  final tp=TimePack.createBySolarTime(clockTime:clock,timezone:(r['offset'] as num)/60,
    ratHourMode:zi,useTrueSolarTime:false);
  final day=HuangliDay.from(tp,exactJieQiTime:exact);
  final board=NineStarBoard(ratHourMode:zi,exactJieQiTime:exact,
    method:r['method']=='discontinuous'?DayFlyingStarMethod.discontinuous:DayFlyingStarMethod.consecutive,
    boundary:r['boundary']=='lunar'?Boundary.lunar:Boundary.solar,
    useHistoricalSolarTerms:r['mode']=='historical');
  List<int> nums(FlyingStarBoard b)=>b.stars.map((s)=>s.number).toList();
  final meta=tp.metaTime;
  final info=getDayRange(meta,meta).first;
  return {
    if(r['includeRuleInput']==true) 'ruleInput':{
      'monthBranch':day.monthZhi.index,'dayIndex':day.ganZhi.index,
      'yearIndex':day.yearGanZhi.index,'lunarMonth':info.lunarDate.month,
      'lunarDay':info.lunarDate.day,'mansion':day.star28,
      'nextSolarTermIndex':getNextJieQi(tp.bjClt)!.index,
      'isSiJue':day.shenSha.activeRealGods.has(AlmanacGod.si_jue.index),
      'isSiLi':day.shenSha.activeRealGods.has(AlmanacGod.si_li.index),
      'isPhaseOfMoon':info.moonPhase!=null,'isYeargodDuty':true,
    },
    'lunar':[day.lunarDate.lunarYear,day.lunarDate.month,day.lunarDate.day,day.lunarDate.isLeap,day.lunarDate.monthSize],
    'ganzhi':[day.yearGanZhi.toString(),day.monthGanZhi.toString(),day.ganZhi.toString()],
    'weekday':day.weekday,'solarTerm':day.solarTerm,'moonPhases':day.moonPhase==null?[]:[day.moonPhase],
    'termJd':day.solarTermTime?.toJ2000(),'mansion':day.star28,'festivals':day.festivals,
    'godIds':day.shenSha.activeRealGods.toList(),
    'activities':[day.suitableActivities,day.tabooActivities],
    'officer':day.shenSha.jianChu.name,'dutyGod':[day.shenSha.dayTwelveGod.name,day.shenSha.dayTwelveGod.isHuangDao],
    'pengZu':day.pengZu,'taiShen':day.taiShen,'directions':day.godDirections.map((k,v)=>MapEntry(k,v.label)),
    'chongSha':[ChongSha.getChongZhi(day.ganZhi.zhi).label,ChongSha.getChongAnimal(day.ganZhi.zhi),ChongSha.getShaDirection(day.ganZhi.zhi)],
    'hours':day.dayHours.map((h)=>[h.zhiName,h.godName,h.isHuangDao]).toList(),
    'flyingYear':nums(board.getYearBoard(tp.virtualTime)),
    'flyingMonth':nums(board.getMonthBoard(tp.virtualTime)),
    'flyingDay':nums(board.getDayBoard(tp)),
    'flyingHour':nums(board.getHourBoard(tp)),
    'forward':SanYuanJiuYunCalc.getDunYinYang(tp,method:board.method,useHistoricalSolarTerms:board.useHistoricalSolarTerms,exactJieQiTime:exact),
    'cycle':day.sanYuan.label,'period':day.jiuYun.number,
  };
}

void main() {
  String? line;
  while((line=stdin.readLineSync())!=null) {
    final r=jsonDecode(line!) as Map<String,dynamic>;
    if(r['op']=='data') {exporter.main();continue;}
    final out=[];
    for(final row in r['rows']) {
      try {out.add(r['op']=='rules'?rules(row):calendar(row));}
      catch(e) {out.add({'error':e.toString()});}
    }
    print(jsonEncode(out));
  }
}
