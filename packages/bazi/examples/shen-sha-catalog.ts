import { BaziChart, BaziShenShaCatalog, BaziShenShaModule, SHEN_SHA_TARGET } from '../src/index.js';
import { ZonedTime } from 'js-ephemeris-lite';
const chart=BaziChart.fromZonedTime(new ZonedTime({year:2000,month:1,day:1,hour:12,offsetMinutes:480}));
const base=new BaziShenShaCatalog();
const catalog=base.addModule(new BaziShenShaModule('my-school',[
 {id:'day-marker',name:'日柱示例',test:input=>input.targetKind===SHEN_SHA_TARGET.DAY},
]));
const context=catalog.createContext({disabledIds:['builtin:0']});
const withoutSchool=catalog.removeModule('my-school');
console.log(context.evaluate(chart,chart.pillars.day,SHEN_SHA_TARGET.DAY));
console.log(withoutSchool.modules); // The existing context still contains my-school.
