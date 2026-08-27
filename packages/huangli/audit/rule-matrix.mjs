// Deterministic replay of the expanded Dart oracle audit. Does not require Dart.
import { DATA } from '../src/data.js';
const base=(m,d,k=0)=>({monthBranch:m,dayIndex:d,yearIndex:(m*7+d+k)%60,lunarMonth:m+1,lunarDay:d%30+1,
  mansion:DATA.mansions[(d+m)%28].fullName,nextSolarTermIndex:(m*2+k)%24});

export function* ruleGroups() {
  yield ['month-day-year cross',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(let y=0;y<60;y++)yield {...base(m,d),yearIndex:y};
  }()];
  yield ['month-day-lunar month/day cross',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(let lm=1;lm<=12;lm++)for(let ld=1;ld<=30;ld++)yield {...base(m,d),lunarMonth:lm,lunarDay:ld};
  }()];
  yield ['month-day-mansion cross',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(const x of DATA.mansions)yield {...base(m,d),mansion:x.fullName};
  }()];
  yield ['month-day-all 32 flag combinations',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(let k=0;k<32;k++)yield {...base(m,d),isSiJue:!!(k&1),isSiLi:!!(k&2),isTuWangYongShi:!!(k&4),isPhaseOfMoon:!!(k&8),isYeargodDuty:!!(k&16)};
  }()];
  yield ['month-day-next term and phase/duty',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(let k=0;k<24;k++)for(let flags=0;flags<4;flags++)yield {...base(m,d),nextSolarTermIndex:k,isPhaseOfMoon:!!(flags&1),isYeargodDuty:!!(flags&2)};
  }()];
  yield ['explicit season and month type',function*(){
    for(let m=0;m<12;m++)for(let d=0;d<60;d++)for(let s=0;s<4;s++)for(let t=0;t<3;t++)yield {...base(m,d),seasonIndex:s,monthSeasonTypeIndex:t};
  }()];
  yield ['each god and god-pair in each month',function*(){
    for(let m=0;m<12;m++)for(let a=0;a<171;a++)for(let b=a;b<171;b++)yield {...base(m,(a+b)%60),godIds:a===b?[a]:[a,b],virtualMask:0x7fff,isPhaseOfMoon:(a+b)%2===0};
  }()];
  yield ['conflict table positive and missing-condition probes',function*(){
    for(const [,gods,virtual] of DATA.levels)for(let m=0;m<12;m++){
      const r={...base(m,m),godIds:gods,virtualMask:virtual};yield r;
      for(const id of gods)yield {...r,godIds:gods.filter(x=>x!==id)};
      for(let bit=0;bit<15;bit++)if(virtual&(1<<bit))yield {...r,virtualMask:virtual&~(1<<bit)};
    }
  }()];
  yield ['100000 seeded combined inputs',function*(){
    let seed=0x831d9ac3;
    const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
    for(let n=0;n<100000;n++)yield {
      ...base(random(12),random(60)),yearIndex:random(60),lunarMonth:random(12)+1,lunarDay:random(30)+1,
      mansion:DATA.mansions[random(28)].fullName,nextSolarTermIndex:random(24),
      isSiJue:!!random(2),isSiLi:!!random(2),isTuWangYongShi:!!random(2),
      isPhaseOfMoon:!!random(2),isYeargodDuty:!!random(2),
    };
  }()];
}
