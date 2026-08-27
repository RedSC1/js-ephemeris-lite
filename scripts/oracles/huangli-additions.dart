import 'dart:convert';
import 'dart:io';
import 'package:chinese_lunar_almanac/chinese_lunar_almanac.dart';
import 'package:chinese_lunar_almanac/src/calculators/sanyuan_jiuyun_calc.dart';
import 'package:chinese_lunar_almanac/src/calculators/twelve_gods_calc.dart';

void main() {
  final board = NineStarBoard();
  final plates = <Object>[];
  for (int period = 1; period <= 9; period++) {
    final earth = FlyingStarBoard(NineStarBoard.createNineStarBoard(period - 1, true));
    for (final m in Mountain.values) {
      plates.add([period, m.name, earth.numbers,
        board.getMountainPlate(earth, m).numbers, board.getWaterPlate(earth, m).numbers]);
    }
  }
  final dragons = <Object>[];
  for (final source in Mountain.values) {
    for (final facing in Mountain.values) {
      dragons.add([source.name, facing.name, PaiLongEngine.calculateFacingStar(source, facing)]);
    }
  }
  final hours = <Object>[];
  for (int day = 0; day < 60; day++) {
    final pillars = getDayHourGanZhi(TianGan.values[day % 10]);
    for (int branch = 0; branch < 12; branch++) {
      final h = HuangliHour(ganZhi: pillars[branch], index: branch,
        twelveGod: HourlyTwelveGods.calculate(DiZhi.values[day % 12], DiZhi.values[branch]));
      hours.add([day, branch, h.name, h.naYin, h.naYinWuXing, h.godName,
        h.isHuangDao, h.startHour, h.endHour, h.timeRange]);
    }
  }
  stdout.writeln(jsonEncode({'source': 'chinese_lunar_almanac 0.1.5 / sxwnl_spa_dart 0.18.5',
    'plates': plates, 'paiLong': dragons, 'hours': hours}));
}
