// Ported from Shou Xing Tian Wen Li (寿星天文历), preserving the original public name and J2000-relative TT-day input.
// See THIRD_PARTY_NOTICES.md and THIRD_PARTY_NOTICES.zh-CN.md.

import { apparentBodyPosition } from './apparent.js';
import { lunarPhaseTimeAccurate } from './calendar-events.js';
import { AU_KM } from './ephemeris.js';
import { J2000 } from './coordinates.js';
import { rsGS, rsPL } from './solar-eclipses.js';

export { rsGS, rsPL };

const rad = 180 * 3600 / Math.PI; // arcseconds per radian
const cs_rEar = 6378.1366;
const cs_rEarA = 0.99834 * cs_rEar;
const cs_sMoon = 0.2725076 * cs_rEar * 1.0000036 * rad;
const DAY_SECOND = 1 / 86400;
const signedRad = value => {
 let result = value % (Math.PI * 2);
 if(result <= -Math.PI) result += Math.PI * 2;
 if(result > Math.PI) result -= Math.PI * 2;
 return result;
};

function refineEcFastBoundaryType(jd){
 // rsGS methods operate on `this`; an isolated receiver keeps ecFast from
 // changing the public singleton's interpolation table.
 const calculator=Object.create(rsGS);
 calculator.Zs=[];
 calculator.Zjd=Number.NaN;
 calculator.init(jd,7);
 return calculator.feature(jd).lx;
}

function lineT(G,v,u,r,n){ //寿星原名：已知位置、速度，求圆周接触时刻
 const b=G.y*v-G.x*u, A=u*u+v*v, B=u*b, C=b*b-r*r*v*v, discriminant=B*B-A*C;
 if(discriminant<0) return 0;
 let D=Math.sqrt(discriminant); if(!n) D=-D;
 return G.t+((-B+D)/A-G.x)/v;
}

function lecXY(jd,re={}){ //寿星原名：日月黄经纬差转为月食切面坐标
 if(!Number.isFinite(jd)) throw new TypeError('jd must be a finite J2000-relative TT day');
 const jdTT=J2000+jd;
 const sun=apparentBodyPosition('sun',jdTT,{solarDeflection:false});
 const moon=apparentBodyPosition('moon',jdTT,{solarDeflection:false});
 const moonDistanceKm=moon.distanceAu*AU_KM;
 const sunLongitude=sun.longitudeDeg*Math.PI/180;
 const sunLatitude=sun.latitudeDeg*Math.PI/180;
 const moonLongitude=moon.longitudeDeg*Math.PI/180;
 const moonLatitude=moon.latitudeDeg*Math.PI/180;
 re.e_mRad=cs_sMoon/moonDistanceKm;
 re.eShadow=(cs_rEarA/moonDistanceKm*rad-(959.63-8.794)/sun.distanceAu)*51/50;
 re.eShadow2=(cs_rEarA/moonDistanceKm*rad+(959.63+8.794)/sun.distanceAu)*51/50;
 re.x=signedRad(moonLongitude+Math.PI-sunLongitude)*Math.cos((moonLatitude-sunLatitude)/2);
 re.y=moonLatitude+sunLatitude;
 re.mr=re.e_mRad/rad;
 re.er=re.eShadow/rad;
 re.Er=re.eShadow2/rad;
 re.t=jd;
 return re;
}

function lecMax(jd){ //寿星原名：月食食甚与各接触时刻
 if(!Number.isFinite(jd)) throw new TypeError('jd must be a finite J2000-relative TT day');
 const phase=(Math.floor((jd-4)/29.5306)*2+1)*Math.PI;
 let t=lunarPhaseTimeAccurate(phase)-J2000;
 let G=lecXY(t,{}), g={}, u=0, v=0;
 const dt=60*DAY_SECOND;
 for(let i=0;i<3;i+=1){
  g=lecXY(t+dt,{});
  u=(g.y-G.y)/dt;
  v=(g.x-G.x)/dt;
  const correction=-(G.y*u+G.x*v)/(u*u+v*v);
  t+=correction;
  G=lecXY(t,{});
 }
 const rmin=Math.hypot(G.x,G.y);
 const lT=[0,0,0,0,0,0,0]; //食甚,初亏,复圆,半影食始,半影食终,食既,生光
 let sf=0, penumbralMagnitude=0, LX='';
 const refine=(seed,radius,end) => {
  if(!seed) return 0;
  const state=lecXY(seed,{});
  return lineT(state,v,u,radius(state),end);
 };
 if(rmin<=G.mr+G.er){
  lT[1]=t; LX='偏'; sf=(G.mr+G.er-rmin)/G.mr/2;
  lT[0]=refine(lineT(G,v,u,G.mr+G.er,0),s=>s.mr+s.er,0);
  lT[2]=refine(lineT(G,v,u,G.mr+G.er,1),s=>s.mr+s.er,1);
 }
 if(rmin<=G.mr+G.Er){
  penumbralMagnitude=(G.mr+G.Er-rmin)/G.mr/2;
  lT[3]=refine(lineT(G,v,u,G.mr+G.Er,0),s=>s.mr+s.Er,0);
  lT[4]=refine(lineT(G,v,u,G.mr+G.Er,1),s=>s.mr+s.Er,1);
 }
 if(rmin<=G.er-G.mr){
  LX='全';
  lT[5]=refine(lineT(G,v,u,G.er-G.mr,0),s=>s.er-s.mr,0);
  lT[6]=refine(lineT(G,v,u,G.er-G.mr,1),s=>s.er-s.mr,1);
 }
 return {lT,sf,LX,jd:t,penumbralMagnitude};
}

/** 寿星月食计算器命名空间；方法无共享可变状态，直接返回本次结果。 */
export const ysPL=Object.freeze({lineT,lecXY,lecMax});

export function ecFast(jd){ //快速日食搜索,jd为朔时间(J2000起算的儒略日数,不必很精确)
 if(!Number.isFinite(jd)) throw new TypeError('jd must be a finite J2000-relative TT day');
 var re=new Object();
 var t,t2,t3,t4;
 var L,mB,mR,sR, vL,vB,vR;
 var W = Math.floor((jd+8)/29.5306)*Math.PI*2; //合朔时的日月黄经差

 //合朔时间计算,2000前+-4000年误差1小时以内，+-2000年小于10分钟
 t  = ( W + 1.08472 )/7771.37714500204; //平朔时间
 re.jd = re.jdSuo = t*36525;

 t2=t*t,t3=t2*t,t4=t3*t;
 L = ( 93.2720993+483202.0175273*t-0.0034029*t2-t3/3526000+t4/863310000 )/180*Math.PI;
 re.ac=1, re.lx='N';
 if(Math.abs(Math.sin(L))>0.4) return re; //一般大于21度已不可能

 t -= ( -0.0000331*t*t + 0.10976 *Math.cos( 0.785 + 8328.6914*t) )/7771;
 t2=t*t;
 L = -1.084719 +7771.377145013*t -0.0000331*t2 +
 (22640 * Math.cos(0.785+  8328.6914*t +0.000152*t2)
  +4586 * Math.cos(0.19 +  7214.063*t  -0.000218*t2)
  +2370 * Math.cos(2.54 + 15542.754*t  -0.000070*t2)
  + 769 * Math.cos(3.1  + 16657.383*t)
  + 666 * Math.cos(1.5  +   628.302*t)
  + 412 * Math.cos(4.8  + 16866.93*t)
  + 212 * Math.cos(4.1    -1114.63*t)
  + 205 * Math.cos(0.2  +  6585.76*t)
  + 192 * Math.cos(4.9  + 23871.45*t)
  + 165 * Math.cos(2.6  + 14914.45*t)
  + 147 * Math.cos(5.5    -7700.39*t)
  + 125 * Math.cos(0.5  +  7771.38*t)
  + 109 * Math.cos(3.9  +  8956.99*t)
  +  55 * Math.cos(5.6    -1324.18*t)
  +  45 * Math.cos(0.9  + 25195.62*t)
  +  40 * Math.cos(3.8    -8538.24*t)
  +  38 * Math.cos(4.3  + 22756.82*t)
  +  36 * Math.cos(5.5  + 24986.07*t)
  -6893 * Math.cos(4.669257+628.3076*t)
  -  72 * Math.cos(4.6261 +1256.62*t)
  -  43 * Math.cos(2.67823 +628.31*t)*t
  +  21) / rad;
 t += ( W - L ) / ( 7771.38
  - 914 * Math.sin( 0.7848 + 8328.691425*t + 0.0001523*t2 )
  - 179 * Math.sin( 2.543  +15542.7543*t )
  - 160 * Math.sin( 0.1874 + 7214.0629*t ) );
 re.jd = re.jdSuo = jd = t*36525; //朔时刻

 //纬 52,15 (角秒)
 t2=t*t/10000,t3=t2*t/10000;
 mB=
  18461*Math.cos(0.0571+  8433.46616*t   -0.640*t2    -1*t3)
 + 1010*Math.cos(2.413 + 16762.1576 *t +  0.88 *t2 +  25*t3)
 + 1000*Math.cos(5.440    -104.7747 *t +  2.16 *t2 +  26*t3)
 +  624*Math.cos(0.915 +  7109.2881 *t +  0    *t2 +   7*t3)
 +  199*Math.cos(1.82  + 15647.529  *t   -2.8  *t2   -19*t3)
 +  167*Math.cos(4.84    -1219.403  *t   -1.5  *t2   -18*t3)
 +  117*Math.cos(4.17  + 23976.220  *t   -1.3  *t2 +   6*t3)
 +   62*Math.cos(4.8   + 25090.849  *t +  2    *t2 +  50*t3)
 +   33*Math.cos(3.3   + 15437.980  *t +  2    *t2 +  32*t3)
 +   32*Math.cos(1.5   +  8223.917  *t +  4    *t2 +  51*t3)
 +   30*Math.cos(1.0   +  6480.986  *t +  0    *t2 +   7*t3)
 +   16*Math.cos(2.5     -9548.095  *t   -3    *t2   -43*t3)
 +   15*Math.cos(0.2   + 32304.912  *t +  0    *t2 +  31*t3)
 +   12*Math.cos(4.0   +  7737.590  *t)
 +    9*Math.cos(1.9   + 15019.227  *t)
 +    8*Math.cos(5.4   +  8399.709  *t)
 +    8*Math.cos(4.2   + 23347.918  *t)
 +    7*Math.cos(4.9     -1847.705  *t)
 +    7*Math.cos(3.8    -16133.856  *t)
 +    7*Math.cos(2.7   + 14323.351  *t);
 mB/=rad;

 //距 106, 23 (千米)
 mR = 385001
 +20905*Math.cos(5.4971+  8328.691425*t+  1.52 *t2 +  25*t3)
 + 3699*Math.cos(4.900 +  7214.06287*t   -2.18 *t2   -19*t3)
 + 2956*Math.cos(0.972 + 15542.75429*t   -0.66 *t2 +   6*t3)
 +  570*Math.cos(1.57  + 16657.3828 *t +  3.0  *t2 +  50*t3)
 +  246*Math.cos(5.69    -1114.6286 *t   -3.7  *t2   -44*t3)
 +  205*Math.cos(1.02  + 14914.4523 *t   -1    *t2 +   6*t3)
 +  171*Math.cos(3.33  + 23871.4457 *t +  1    *t2 +  31*t3)
 +  152*Math.cos(4.94  +  6585.761  *t   -2    *t2   -19*t3)
 +  130*Math.cos(0.74    -7700.389  *t   -2    *t2   -25*t3)
 +  109*Math.cos(5.20  +  7771.377  *t)
 +  105*Math.cos(2.31  +  8956.993  *t +  1    *t2 +  25*t3)
 +   80*Math.cos(5.38    -8538.241  *t +  2.8  *t2 +  26*t3)
 +   49*Math.cos(6.24  +   628.302  *t)
 +   35*Math.cos(2.7   + 22756.817  *t   -3    *t2   -13*t3)
 +   31*Math.cos(4.1   + 16171.056  *t   -1    *t2 +   6*t3)
 +   24*Math.cos(1.7   +  7842.365  *t   -2    *t2   -19*t3)
 +   23*Math.cos(3.9   + 24986.074  *t +  5    *t2 +  75*t3)
 +   22*Math.cos(0.4   + 14428.126  *t   -4    *t2   -38*t3)
 +   17*Math.cos(2.0   +  8399.679  *t);
 mR/=6378.1366;

 t=jd/365250, t2=t*t, t3=t2*t;
 //误0.0002AU
 sR = 10001399 //日地距离
 +167070*Math.cos(3.098464 +  6283.07585*t)
 +  1396*Math.cos(3.0552   + 12566.1517 *t)
 + 10302*Math.cos(1.10749  +  6283.07585*t)*t
 +   172*Math.cos(1.064    + 12566.152  *t)*t
 +   436*Math.cos(5.785    +  6283.076  *t)*t2
 +    14*Math.cos(4.27     +  6283.08   *t)*t3;
 sR*=1.49597870691/6378.1366*10;

 //经纬速度
 t=jd/36525;
 vL = 7771 //月日黄经差速度
     -914*Math.sin(0.785 + 8328.6914*t)
     -179*Math.sin(2.543 +15542.7543*t)
     -160*Math.sin(0.187 + 7214.0629*t);
 vB =-755*Math.sin(0.057 + 8433.4662*t) //月亮黄纬速度
     - 82*Math.sin(2.413 +16762.1576*t);
 vR =-27299*Math.sin(5.497 + 8328.691425*t)
     - 4184*Math.sin(4.900 + 7214.06287*t)
     - 7204*Math.sin(0.972 +15542.75429*t);
 vL/=36525, vB/=36525, vR/=36525; //每日速度


 var gm = mR*Math.sin(mB)*vL/Math.sqrt(vB*vB+vL*vL), smR=sR-mR; //gm伽马值,smR日月距
 var mk = 0.2725076, sk = 109.1222;
 var f1 = (sk+mk)/smR, r1 = mk+f1*mR; //tanf1半影锥角, r1半影半径
 var f2 = (sk-mk)/smR, r2 = mk-f2*mR; //tanf2本影锥角, r2本影半径
 var b = 0.9972, Agm = Math.abs(gm), Ar2 = Math.abs(r2);
 var fh2 = mR-mk/f2, h = Agm<1 ? Math.sqrt(1-gm*gm) : 0; //fh2本影顶点的z坐标
 var ls1,ls2,ls3,ls4;

 if(fh2<h) re.lx = 'T';
 else      re.lx = 'A';

 ls1 = Agm-(b+r1 ); if(Math.abs(ls1)<0.016) re.ac=0; //无食分界
 ls2 = Agm-(b+Ar2); if(Math.abs(ls2)<0.016) re.ac=0; //偏食分界
 ls3 = Agm-(b    ); if(Math.abs(ls3)<0.016) re.ac=0; //无中心食分界
 ls4 = Agm-(b-Ar2); if(Math.abs(ls4)<0.016) re.ac=0; //有中心食分界(但本影未全部进入)

 if     (ls1>0) re.lx  = 'N'; //无日食
 else if(ls2>0) re.lx  = 'P'; //偏食
 else if(ls3>0) re.lx += '0'; //无中心
 else if(ls4>0) re.lx += '1'; //有中心(本影未全部进入)
 else{ //本影全进入
  if(Math.abs(fh2-h)<0.019) re.ac=0;
  if( Math.abs(fh2)<h ){
    var dr = vR*h/vL/mR;
    var H1 = mR-dr-mk/f2;  //入点影锥z坐标
    var H2 = mR+dr-mk/f2;  //出点影锥z坐标
    if(H1>0) re.lx='H3';      //环全全
    if(H2>0) re.lx='H2';      //全全环
    if(H1>0&&H2>0) re.lx='H'; //环全环
    if(Math.abs(H1)<0.019) re.ac=0;
   if(Math.abs(H2)<0.019) re.ac=0;
  }
 }
 // 短公式侧重快速判断；对其标记为 ac=0 的边界结果使用完整几何统一分类。
 if(re.ac===0) re.lx=refineEcFastBoundaryType(jd);
 return re;
}
