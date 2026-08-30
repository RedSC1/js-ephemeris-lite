// Ported from Shou Xing Tian Wen Li (寿星天文历). Public object and method
// names are intentionally preserved; astronomy inputs are supplied by this
// package's current true-of-date apparent-position pipeline.
import { apparentBodyPosition } from './apparent.js';
import { bodyRiseSetForDay } from './body-visibility.js';
import { lunarPhaseTimeAccurate } from './calendar-events.js';
import { ARCSEC_TO_RAD, J2000, iau2000bNutation, meanObliquityIau2006 } from './coordinates.js';
import { AU_KM } from './ephemeris.js';
import { calendarDateFromJulianDay, deltaTSecondsFromTt } from './time.js';

const pi2=2*Math.PI, pi_2=Math.PI/2, rad=1/ARCSEC_TO_RAD, radd=180/Math.PI;
const cs_rEar=6378.1366, cs_rEarA=0.99834*cs_rEar, cs_ba=0.99664719;
const cs_ba2=cs_ba*cs_ba, cs_AU=AU_KM, cs_k=0.2725076, cs_k2=0.2722810;
const cs_k0=109.1222, cs_sMoon=cs_k*cs_rEar*1.0000036*rad;
const cs_sMoon2=cs_k2*cs_rEar*1.0000036*rad;
const {sin,cos,tan,asin,atan,atan2,sqrt,abs,floor}=Math;

function rad2mrad(v){ v%=pi2; return v<0?v+pi2:v; }
function rad2rrad(v){ v%=pi2; if(v<=-Math.PI)v+=pi2; if(v>Math.PI)v-=pi2; return v; }
function llr2xyz(z){ const [J,W,R]=z,c=cos(W); return [R*c*cos(J),R*c*sin(J),R*sin(W)]; }
function xyz2llr(z){ const R=Math.hypot(...z); return [rad2mrad(atan2(z[1],z[0])),asin(z[2]/R),R]; }
function llrConv(z,E){
 const [J,W,R]=z;
 return [rad2mrad(atan2(sin(J)*cos(E)-tan(W)*sin(E),cos(J))),
  asin(cos(E)*sin(W)+sin(E)*cos(W)*sin(J)),R];
}
function CD2DP(z,L,fa,gst){
 let a=llrConv([z[0]+pi_2-gst-L,z[1],z[2]],pi_2-fa);
 a[0]=rad2mrad(-pi_2-a[0]); return a;
}
function dt_T(jd){ return deltaTSecondsFromTt(J2000+jd)/86400; }
function hcjj(t){ return meanObliquityIau2006(J2000+t*36525); }
function nutation2(t){ const n=iau2000bNutation(J2000+t*36525); return [n.dpsi,n.deps]; }
function pGST(T,dt){
 const t=(T+dt)/36525,t2=t*t,t3=t2*t,t4=t3*t;
 return pi2*(0.7790572732640+1.00273781191135448*T)
  +(0.014506+4612.15739966*t+1.39667721*t2-0.00009344*t3+0.00001882*t4)/rad;
}
function pGST2(jd){ const dt=dt_T(jd); return pGST(jd-dt,dt); }
function shiChaJ(gst,L,fa,J,W){
 const H=gst+L-J;
 return rad2mrad(atan2(sin(H),tan(fa)*cos(W)-sin(W)*cos(H)));
}
function parallax(z,H,fa,high){
 let dw=1; if(z[2]<500) dw=cs_AU; z[2]*=dw;
 const f=cs_ba,u=atan(f*tan(fa)),g=z[0]+H;
 const r0=cs_rEar*cos(u)+high*cos(fa), z0=cs_rEar*sin(u)*f+high*sin(fa);
 let s=llr2xyz(z); s[0]-=r0*cos(g); s[1]-=r0*sin(g); s[2]-=z0; s=xyz2llr(s);
 z[0]=s[0]; z[1]=s[1]; z[2]=s[2]/dw;
}
function lineEll(x1,y1,z1,x2,y2,z2,e,r){
 const dx=x2-x1,dy=y2-y1,dz=z2-z1,e2=e*e;
 const A=dx*dx+dy*dy+dz*dz/e2,B=x1*dx+y1*dy+z1*dz/e2;
 const C=x1*x1+y1*y1+z1*z1/e2-r*r,p={D:B*B-A*C}; if(p.D<0)return p;
 let D=sqrt(p.D); if(B<0)D=-D; const t=(-B+D)/A,R=Math.hypot(dx,dy,dz);
 p.x=x1+dx*t;p.y=y1+dy*t;p.z=z1+dz*t;p.R1=R*abs(t);p.R2=R*abs(t-1);return p;
}
function lineEar2(x1,y1,z1,x2,y2,z2,e,r,I){
 const P=cos(I[1]),Q=sin(I[1]);
 const p=lineEll(x1,P*y1-Q*z1,Q*y1+P*z1,x2,P*y2-Q*z2,Q*y2+P*z2,e,r);
 p.J=p.W=100;if(p.D<0)return p;
 p.J=rad2rrad(atan2(p.y,p.x)+I[0]-I[2]);
 p.W=atan(p.z/e/e/Math.hypot(p.x,p.y));return p;
}
function lineEar(P,Q,gst){
 const p=llr2xyz(P),q=llr2xyz(Q),r=lineEll(...p,...q,cs_ba,cs_rEar);
 if(r.D<0){r.J=r.W=100;return r;}
 r.W=atan(r.z/cs_ba2/Math.hypot(r.x,r.y));r.J=rad2rrad(atan2(r.y,r.x)-gst);return r;
}
function cirOvl(R,ba,R2,x0,y0){
 const re={},d=Math.hypot(x0,y0),sinB=y0/d,cosB=x0/d,ba2=ba*ba;
 let cosA=(R*R+d*d-R2*R2)/(2*d*R);if(abs(cosA)>1){re.n=0;return re;}
 let sinA=sqrt(1-cosA*cosA);
 for(let k=-1;k<2;k+=2){
  const S=cosA*sinB+sinA*cosB*k,g=R-S*S*(1/ba2-1)/2;
  cosA=(g*g+d*d-R2*R2)/(2*d*g);if(abs(cosA)>1){re.n=0;return re;}
  sinA=sqrt(1-cosA*cosA);const C=cosA*cosB-sinA*sinB*k,S2=cosA*sinB+sinA*cosB*k;
  if(k===1)re.A=[g*C,g*S2];else re.B=[g*C,g*S2];
 }
 re.n=2;return re;
}
function lineOvl(x1,y1,dx,dy,r,ba){
 const f=ba*ba,A=dx*dx+dy*dy/f,B=x1*dx+y1*dy/f,C=x1*x1+y1*y1/f-r*r,p={};
 let D=B*B-A*C;if(D<0){p.n=0;return p;}p.n=D?2:1;D=sqrt(D);
 const t1=(-B+D)/A,t2=(-B-D)/A,L=Math.hypot(dx,dy);
 p.A=[x1+dx*t1,y1+dy*t1];p.B=[x1+dx*t2,y1+dy*t2];p.R1=L*abs(t1);p.R2=L*abs(t2);return p;
}
function sunShengJ(jd,L,fa,sj){
 const dayStart=J2000+floor(jd+0.5+L/pi2)-0.5-L/pi2;
 const events=bodyRiseSetForDay('sun',dayStart,{longitudeDeg:L*radd,latitudeDeg:fa*radd},{limb:'upper'});
 const list=sj<0?events.rises:events.sets;
 if(list.length) return list[0].jdUT1-J2000;
 if(events.altitudeState==='always-above') return jd+(sj<0?-1:1);
 return jd+(sj<0?1:-1); // polar night/no visible solar limb: sunrise follows sunset
}
function rad2str2(value){ return `${(value*radd).toFixed(6)}°`; }
function jdText(jd){
 const f=calendarDateFromJulianDay(J2000+jd),pad=(value,size=2)=>String(Math.floor(value)).padStart(size,'0');
 const second=pad(Math.round(f.second));
 return `${String(f.year).padStart(4,'0')}-${pad(f.month)}-${pad(f.day)} ${pad(f.hour)}:${pad(f.minute)}:${second}`;
}
export const rsGS={
 Zs   : new Array(),  //日月赤道坐标插值表
 Zdt  : 0.04,   //插值点之间的时间间距
 Zjd  : 0,      //插值表中心时间
 dT   : 0,      //deltatT
 tanf1: 0.0046, //半影锥角
 tanf2: 0.0045, //本影锥角
 srad : 0.0046, //太阳视半径
 bba  : 1,      //贝圆极赤比
 bhc  : 0,      //黄交线与赤交线的夹角简易作图用
 dyj  : 23500,  //地月距
 
 init:function(jd,n){ //创建插值表(根数表)
  if(!Number.isFinite(jd)) throw new TypeError('jd must be a finite J2000-relative TT day');
  if(![2,3,7].includes(n)) throw new RangeError('rsGS.init root count must be 2, 3, or 7');
  const lunation=floor((jd+8)/29.5306);
  if(lunation==floor((this.Zjd+8)/29.5306) && this.Zs.length==n*9) return this;
  this.Zs.length=0;
  this.Zjd=jd=lunarPhaseTimeAccurate(lunation*pi2)-J2000;
  this.dT   = dt_T(jd); //deltat T
  const E=iau2000bNutation(J2000+jd).trueObliquity;
  var i,k,S,M,B,a=this.Zs;
  for(i=0;i<n;i++){ //插值点范围不要超过360度(约1个月)
   const sample=this.Zjd+(i-n/2+0.5)*this.Zdt,jdTT=J2000+sample;
   const sun=apparentBodyPosition('sun',jdTT,{solarDeflection:false});
   const moon=apparentBodyPosition('moon',jdTT,{solarDeflection:false});
   S=[sun.rightAscensionDeg/radd,sun.declinationDeg/radd,sun.distanceAu*cs_AU];
   M=[moon.rightAscensionDeg/radd,moon.declinationDeg/radd,moon.distanceAu*cs_AU];
   if(i && S[0]<a[0]) S[0]+=pi2;  //确保插值数据连续
   if(i && M[0]<a[3]) M[0]+=pi2;  //确保插值数据连续

   k = i*9;
   a[k+0]=S[0], a[k+1]=S[1], a[k+2]=S[2]; //存入插值表
   a[k+3]=M[0], a[k+4]=M[1], a[k+5]=M[2];


   //贝塞尔坐标的z轴坐标计算,得到a[k+6,7,8]交点赤经,贝赤交角,真恒星时
   S=llr2xyz(S), M=llr2xyz(M);
   B = xyz2llr( new Array(S[0]-M[0],S[1]-M[1],S[2]-M[2]) );
   B[0] = Math.PI/2+B[0];
   B[1] = Math.PI/2-B[1];
   if(i && B[0]<a[6]) B[0]+=pi2; //确保插值数据连续

   const ntn=iau2000bNutation(jdTT);
   a[k+6]=B[0];a[k+7]=B[1];
   a[k+8]=pGST(sample-this.dT,this.dT)+ntn.dpsi*cos(ntn.trueObliquity);
  }
  //一些辅助参数的计算
  var p=a.length-9;
  this.dyj = (a[2]+a[p+2]-a[5]-a[p+5])/2/cs_rEar; //地月平均距离
  this.tanf1 = (cs_k0+cs_k )/this.dyj; //tanf1半影锥角
  this.tanf2 = (cs_k0-cs_k2)/this.dyj; //tanf2本影锥角
  this.srad = cs_k0/((a[2]+a[p+2])/2/cs_rEar);
  this.bba = Math.sin( (a[1]+a[p+1])/2 );
  this.bba = cs_ba*(1+(1-cs_ba2)*this.bba*this.bba/2);
  this.bhc = -atan(tan(E)*sin( (a[6]+a[p+6])/2 )); //黄交线与赤交线的夹角
  return this;
 },

 chazhi:function(jd,xt){//日月坐标快速计算(贝赛尔插值法),计算第p个根数开始的m个根数
  var p=xt*3,m=3; //计算第p个根数开始的m个根数
  var i, N=this.Zs.length/9, B=this.Zs, z=new Array();
  var w = B.length/N; //每节点个数
  var t = (jd-this.Zjd)/this.Zdt+N/2-0.5; //相对于第一点的时间距离

  if(N==2) { for(i=0; i<m; i++,p++) z[i] = B[p] + (B[p+w]-B[p])*t; return z; }
  var c=Math.floor(t+0.5); if(c<=0) c=1; if(c>N-2) c=N-2; //确定c,并对超出范围的处理
  t-=c, p+=c*w; //c插值中心,t为插值因子,t再转为插值中心在数据中的位置
  for(i=0; i<m; i++,p++)
    z[i] = B[p] + ( B[p+w]-B[p-w] + (B[p+w]+B[p-w]-B[p]*2)*t ) * t/2;
  return z;
 },

 sun :function(jd){ return this.chazhi(jd,0); }, //传回值可能超过360度
 moon:function(jd){ return this.chazhi(jd,1); },
 bse :function(jd){ return this.chazhi(jd,2); },

 cd2bse:function(z,I){ //赤道转贝塞尔坐标
  var r=new Array(z[0]-I[0],z[1],z[2]);
  r = llrConv(r,-I[1]);
  return llr2xyz(r);
 },
 bse2cd:function(z,I){ //贝塞尔转赤道坐标
  var r = xyz2llr(z);
  r = llrConv(r,I[1]);
  r[0] = rad2mrad(r[0]+I[0]);
  return r;
 },
 bse2db:function(z,I,f){ //贝赛尔转地标(p点到原点连线与地球的交点,z为p点直角坐标),f=1时把地球看成椭球
  var r = xyz2llr(z);
  r = llrConv(r,I[1]);
  r[0] = rad2rrad(r[0]+I[0]-I[2]);
  if(f) r[1] = atan( tan(r[1])/cs_ba2 );
  return r;
 },
 bseXY2db:function(x,y,I,f){ //贝赛尔转地标(过p点垂直于基面的线与地球的交点,p坐标为(x,y,任意z)),f=1时把地球看成椭球
  var b=f?cs_ba:1;
  var F = lineEar2(x,y,2,  x,y,0,  b,1,I);//求中心对应的地标
  return [F.J,F.W];
 },

 bseM:function(jd){  //月亮的贝塞尔坐标
   var a=this.cd2bse(this.chazhi(jd,1),this.chazhi(jd,2));
   a[0]/=cs_rEar, a[1]/=cs_rEar, a[2]/=cs_rEar;
   return a;
 },

 //以下计算日食总体情况

 Vxy:function(x,y,s, vx,vy){ //地球上一点的速度，用贝塞尔坐标表达，s为贝赤交角
   var r = new Object();
   var h = 1-x*x-y*y;
   if(h<0) h = 0;  //越界置0，使速度场连续，置零有助于迭代时单向收敛
   else    h = sqrt(h);
   r.vx = pi2*( sin(s)*h-cos(s)*y );
   r.vy = pi2*x*cos(s);
   r.Vx = vx - r.vx;
   r.Vy = vy - r.vy;
   r.V = sqrt(r.Vx*r.Vx+r.Vy*r.Vy);
   return r;
 },
 rSM:function(mR){ //rm,rs单位千米
  var re = new Object();
  re.r1 = cs_k +this.tanf1*mR; //半影半径
  re.r2 = cs_k2-this.tanf2*mR; //本影半径
  re.ar2 = abs(re.r2);
  re.sf = cs_k2/mR/cs_k0*(this.dyj+mR); //食分
  return re;
 },
 qrd:function(jd,dx,dy, fs){ //求切入点
  var ba2 = this.bba*this.bba;
  var M = this.bseM(jd), x=M[0], y=M[1];
  var B = this.rSM(M[2]);
  var r = 0; if(fs==1) r = B.r1;
  var d = 1-(1/ba2-1)*y*y/(x*x+y*y)/2 + r;
  var t = (d*d-x*x-y*y)/(dx*x+dy*y)/2;
  x+=t*dx, y+=t*dy, jd+=t;

  var c=(1-ba2)*r*x*y/d/d/d;
  x += c*y;
  y -= c*x;
  var re=this.bse2db([x/d,y/d,0],this.bse(jd),1);
  //re[0] +=0.275/radd; //转为deltatT为66秒的历书经度
  re[2]=jd;
  return re;
 },
 feature:function(jd){//日食的基本特征
  jd = this.Zjd; //低精度的朔(误差10分钟)

  var tg=0.04, re=new Object(), ls;
  var a = this.bseM(jd-tg);
  var b = this.bseM(jd);
  var c = this.bseM(jd+tg);
  var vx = (c[0]-a[0])/tg/2;
  var vy = (c[1]-a[1])/tg/2;
  var vz = (c[2]-a[2])/tg/2;
  var ax = (c[0]+a[0]-2*b[0])/tg/tg;
  var ay = (c[1]+a[1]-2*b[1])/tg/tg;
  var v = Math.sqrt(vx*vx+vy*vy), v2=v*v;

  //影轴在贝塞尔面扫线的特征参数
  re.jdSuo = jd;    //朔
  re.dT = this.dT;  //deltat T
  re.ds = this.bhc; //黄交线与赤交线的夹角
  re.vx = vx;       //影速x
  re.vy = vy;       //影速y
  re.ax = ax;
  re.ay = ay;
  re.v  = v;
  re.k  = vy/vx;    //斜率

  var t0 = -(b[0]*vx+b[1]*vy)/v2;
  re.jd = jd+t0;  //中点时间
  re.xc = b[0]+vx*t0;  //中点坐标x
  re.yc = b[1]+vy*t0;  //中点坐标y
  re.zc = b[2]+vz*t0-1.37*t0*t0;  //中点坐标z
  re.D  = (vx*b[1]-vy*b[0])/v;
  re.d  = Math.abs(re.D);  //直线到圆心的距离
  re.I  = this.bse(re.jd); //中心点的贝塞尔z轴的赤道坐标及恒星时，(J,W,g)

  //影轴交点判断
  var F = lineEar2(re.xc,re.yc,2,  re.xc,re.yc,0,  cs_ba,1,re.I);//求中心对应的地标
  //四个关键点的影子半径计算
  var Bc,Bp,B2,B3,  dt,t2,t3,t4,t5,t6;
  Bc=Bp=B2=B3 = this.rSM(re.zc); //中点处的影子半径
  if(F.W!=100)  Bp = this.rSM(re.zc - F.R2);
  if(re.d<1){
    dt=sqrt(1-re.d*re.d)/v;  t2=t0-dt, t3=t0+dt; //中心始终参数
    B2 = this.rSM(t2*vz+b[2]-1.37*t2*t2);   //中心线始影半径
    B3 = this.rSM(t3*vz+b[2]-1.37*t3*t3);   //中心线终影半径
  }
  ls = 1;        dt=0; if(re.d<ls) dt=sqrt(ls*ls-re.d*re.d)/v; t2=t0-dt, t3=t0+dt; //偏食始终参数,t2,t3
  ls = 1+Bc.r1;  dt=0; if(re.d<ls) dt=sqrt(ls*ls-re.d*re.d)/v; t4=t0-dt, t5=t0+dt; //偏食始终参数,t4,t5
  t6 = -b[0]/vx; //视午参数l6
  if(re.d<1){
   re.gk1 = this.qrd(t2+jd,vx,vy,0); //中心始
   re.gk2 = this.qrd(t3+jd,vx,vy,0); //中心终
  }else{
   re.gk1 = [0,0,0];
   re.gk2 = [0,0,0];
  }
  re.gk3 = this.qrd(t4+jd,vx,vy,1); //偏食始
  re.gk4 = this.qrd(t5+jd,vx,vy,1); //偏食终
  re.gk5 = this.bseXY2db(t6*vx+b[0],t6*vy+b[1], this.bse(t6+jd), 1);  re.gk5[2]=t6+jd; //地方视午日食

  //日食类型、最大食地标、食分、太阳地平坐标
  if(F.W==100){ //无中心线
   //最大食地标及时分
   ls = this.bse2db([re.xc,re.yc,0],re.I, 0); re.zxJ=ls[0], re.zxW=ls[1]; //最大食地标
   re.sf = (Bc.r1-(re.d-0.9972))/(Bc.r1-Bc.r2); //0.9969是南北极区的平半径
   //类型判断
   if     (re.d>0.9972+Bc.r1)  { re.lx = 'N'; } //无食,半影没有进入
   else if(re.d>0.9972+Bc.ar2) { re.lx = 'P'; } //偏食,本影没有进入
   else                        { if(Bc.sf<1) re.lx = 'A0'; else re.lx = 'T0'; } //中心线未进入,本影部分进入(无中心，所以只是部分地入)
  }else{ //有中心线
   //最大食地标及时分
   re.zxJ=F.J, re.zxW=F.W;  //最大食地标
   re.sf = Bp.sf; //食分
   //类型判断
   if(re.d>0.9966-Bp.ar2) { if(Bp.sf<1) re.lx = 'A1'; else re.lx = 'T1'; } //中心进入,但本影没有完全进入
   else{ //本影全进入有中心日食
    if(Bp.sf>=1){
      re.lx = 'H';
      if(B2.sf>1) re.lx = 'H2'; //全环食,全始
      if(B3.sf>1) re.lx = 'H3'; //全环食,全终
      if(B2.sf>1 && B3.sf>1) re.lx='T'; //全食
    } else re.lx = 'A'; //环食
   }
  }
  re.Sdp = CD2DP(this.sun(re.jd),re.zxJ,re.zxW,re.I[2]);  //太阳在中心点的地平坐标

  //食带宽度和时延
  if(F.W!=100){
    re.dw = abs(2*Bp.r2*cs_rEar) / sin(re.Sdp[1]); //食带宽度
    ls = this.Vxy(re.xc,re.yc,re.I[1], re.vx,re.vy); //求地表影速
    re.tt = 2*abs(Bp.r2)/ls.V; //时延
  } else re.dw = re.tt =0;
  return re;
 },

 //界线图
 push:function(z,p){ p[p.length]=z[0], p[p.length]=z[1]; }, //经度改为东经为正,所以有个负号
 elmCpy:function(a,n, b,m){ //数据元素复制
   if(!b.length) return;
   if(n==-2) n=a.length;
   if(m==-2) m=b.length;
   if(n==-1) n=a.length-2;
   if(m==-1) m=b.length-2;
   a[n]=b[m], a[n+1]=b[m+1];
 },
 nanbei:function(M,vx0,vy0, h, r,I){ //vx0,vy0为影足速度(也是整个影子速度),h=1计算北界,h=-1计算南界
   var x=M[0]-vy0/vx0*r*h, y=M[1]+h*r, z, i;
   var vx,vy,v,sinA,cosA, js=0;
   for(i=0;i<3;i++){
    z = 1 - x*x - y*y;
    if(z<0) { if(js) break;  z=0;js++; } //z小于0则置0，如果两次小于0，可能不收敛造成的，故不再迭代了
    z = Math.sqrt(z);
    x -= (x-M[0])*z/M[2];
    y -= (y-M[1])*z/M[2];
    vx = vx0 - pi2*( sin(I[1])*z-cos(I[1])*y );
    vy = vy0 - pi2*  cos(I[1])*x;
    v  = Math.sqrt(vx*vx+vy*vy);
    sinA = h*vy/v, cosA = h*vx/v;
    x = M[0] - r*sinA, y = M[1] + r*cosA;
   }
   var X = M[0] - cs_k*sinA, Y = M[1] + cs_k*cosA;
   var p = lineEar2(X,Y,M[2],  x,y,0,  cs_ba,1,I);
   return [p.J, p.W, x, y];
 },

 mQie:function(M,vx0,vy0, h, r,I, A){ //vx0,vy0为影足速度(也是整个影子速度),h=1计算北界,h=-1计算南界
   var p=this.nanbei(M,vx0,vy0,h,r,I);
   if(!A.f2) A.f2=0;   A.f = p[1]==100?0:1; //记录有无解
   if(A.f2!=A.f){ //补线头线尾
     var g=lineOvl(p[2],p[3],vx0,vy0,1,this.bba), dj, F;
     if(g.n){
      if(A.f) dj=g.R2, F=g.B;
      else    dj=g.R1, F=g.A;
      F[2]=0;
      var I2 = new Array( I[0], I[1], I[2] - dj/Math.sqrt(vx0*vx0+vy0*vy0)*6.28 );  //也可以不重算计算恒星时，直接用I[2]代替，但线头不会严格落在日出日没食甚线上
      this.push( this.bse2db(F,I2,1), A);//有解补线头
     }
   }
   A.f2 = A.f; //记录上次有无解

   if(p[1]!=100) this.push(p,A);
 },
 mDian:function(M,vx0,vy0, AB, r,I, A){ //日出日没食甚
   var i, p,a=M, R,c=new Object();
   for(i=0;i<2;i++){ //迭代求交点
     c = this.Vxy(a[0],a[1],I[1], vx0,vy0);
     p = lineOvl(M[0],M[1],c.Vy,-c.Vx,1,this.bba);
     if(!p.n) break;
     if(AB) a=p.A, R=p.R1;
     else   a=p.B, R=p.R2;
   }
   if(p.n && R<=r){ //有交点
     a=this.bse2db([a[0],a[1],0], I,1); //转为地标
     this.push(a,A ); //保存第一食甚线A或B根
     return 1;
   }
   return 0;
 },
 jieX:function(jd){ //日出日没的初亏食甚复圆线，南北界线等
  var i, p, ls;
  var re=this.feature(jd);  //求特征参数

  re.p1=new Array(), re.p2=new Array(), re.p3=new Array(), re.p4=new Array();
  re.q1=new Array(), re.q2=new Array(), re.q3=new Array(), re.q4=new Array();
  re.L1=new Array(), re.L2=new Array(), re.L3=new Array(), re.L4=new Array();
  re.L5=new Array(), re.L6=new Array(); //0.5食分线
  re.L0=new Array(); //中心线

  var T = 1.7*1.7-re.d*re.d; if(T<0) T=0; T=Math.sqrt(T)/re.v+0.01;
  var t=re.jd-T, N=400, dt=2*T/N;

  var n1=0, n4=0; //n1切入时序

  //对日出日没食甚线预置一个点
  var Ua=re.q1,Ub=re.q2;
  this.push([0,0],re.q2); this.push([0,0],re.q3); this.push([0,0],re.q4);

  for(i=0;i<=N;i++,t+=dt){
   var vx = re.vx+re.ax*(t-re.jdSuo);
   var vy = re.vy+re.ay*(t-re.jdSuo);
   var M = this.bseM(t);    //此刻月亮贝塞尔坐标(其x和y正是影足)
   var B = this.rSM(M[2]);  //本半影等
   var r = B.r1;            //半影半径
   var I = this.bse(t);     //贝塞尔坐标参数

   p=cirOvl(1,this.bba, r,M[0],M[1]); //求椭圆与圆交点
   if(n1%2) {if(!p.n) n1++;} else {if(p.n) n1++;}
   if(p.n) { //有交点
    p.A[2]=p.B[2]=0;  p.A=this.bse2db(p.A,I,1);  p.B=this.bse2db(p.B,I,1); //转为地标
    if(n1==1){ this.push(p.A,re.p1); this.push(p.B,re.p2); }//保存第一亏圆界线
    if(n1==3){ this.push(p.A,re.p3); this.push(p.B,re.p4); }//保存第二亏圆界线
   }

   //日出日没食甚线
   if( !this.mDian(M,vx,vy,0,r,I, Ua) ) { if(Ua.length>0) Ua=re.q3; };
   if( !this.mDian(M,vx,vy,1,r,I, Ub) ) { if(Ub.length>2) Ub=re.q4; };
   if(t>re.jd){
     if(Ua.length==0) Ua=re.q3;
     if(Ub.length==2) Ub=re.q4;
   }

   //求中心线
   p = this.bseXY2db(M[0],M[1],I,1);
   if( p[1]!=100&&n4==0 || p[1]==100&&n4==1 ){ //从无交点跳到有交点或反之
     ls=lineOvl(M[0],M[1],vx,vy,1,this.bba);
     var dj;
     if(n4==0) dj=ls.R2,ls=ls.B; //首坐标
     else      dj=ls.R1,ls=ls.A; //末坐标
     ls[2]=0;
     var I2 = new Array( I[0], I[1], I[2] - dj/Math.sqrt(vx*vx+vy*vy)*6.28 );  //也可以不重算计算恒星时，直接用I[2]代替，但线头不会严格落在日出日没食甚线上
     this.push( this.bse2db(ls,I2,1), re.L0 );
     n4++;
   }
   if(p[1]!=100) this.push(p,re.L0); //保存中心线

   //南北界
   this.mQie(M,vx,vy, +1, r,          I, re.L1); //半影北界
   this.mQie(M,vx,vy, -1, r,          I, re.L2); //半影南界
   this.mQie(M,vx,vy, +1, B.r2,       I, re.L3); //本影北界
   this.mQie(M,vx,vy, -1, B.r2,       I, re.L4); //本影南界
   this.mQie(M,vx,vy, +1, (r+B.r2)/2, I, re.L5); //0.5半影北界
   this.mQie(M,vx,vy, -1, (r+B.r2)/2, I, re.L6); //0.5半影南界
  }


  //日出日没食甚线的线头连接
  this.elmCpy(re.q3, 0, re.q1,-1); //连接q1和a3,单边界必须
  this.elmCpy(re.q4, 0, re.q2,-1); //连接q2和a4,单边界必须

  this.elmCpy(re.q1,-2, re.L1, 0); //半影北界线西端
  this.elmCpy(re.q2,-2, re.L2, 0); //半影南界线西端
  this.elmCpy(re.q3, 0, re.L1,-1); //半影北界线东端
  this.elmCpy(re.q4, 0, re.L2,-1); //半影南界线东端

  this.elmCpy(re.q2, 0, re.q1, 0);
  this.elmCpy(re.q3,-2, re.q4,-1);

  return re;
 },
 jieX2:function (jd){ //jd力学时
  var re=new Object();
  var p1=new Array(), p2=new Array(), p3=new Array();

  if(abs(jd-this.Zjd)>0.5) return re;

  var i,s,p,x,y,X,Y;
  var S = this.sun(jd);   //此刻太阳赤道坐标
  var M = this.bseM(jd);  //此刻月亮
  var B = this.rSM(M[2]); //本半影等
  var I = this.bse(jd);   //贝塞尔坐标参数
  var Z = M[2];           //月亮的坐标的z量

  var a0=M[0]*M[0]+M[1]*M[1];
  var a1=a0-B.r2*B.r2;
  var a2=a0-B.r1*B.r1;
  var N = 200;
  for(i=0;i<N;i++){//第0和第N点是同一点，可形成一个环，但不必计算，因为第0点可能在界外而无效
    s=i/N*pi2;
    var cosS=cos(s), sinS=sin(s);
    X = M[0] + cs_k*cosS, Y = M[1] + cs_k*sinS;
    //本影
    x = M[0] + B.r2*cosS, y = M[1] + B.r2*sinS;
    p = lineEar2(X,Y,Z,  x,y,0,  cs_ba,1,I);
    if(p.W!=100) this.push( [p.J,p.W], p1 );
    else { if(sqrt(x*x+y*y)>a1) this.push( this.bse2db([x,y,0],I,1), p1 ); }
    //半影
    x = M[0] + B.r1*cosS, y = M[1] + B.r1*sinS;
    p = lineEar2(X,Y,Z,  x,y,0,  cs_ba,1,I);
    if(p.W!=100) this.push( [p.J,p.W], p2 );
    else { if(sqrt(x*x+y*y)>a2) this.push( this.bse2db([x,y,0],I,1), p2 ); }
    //晨昏圈
    p = llrConv([s,0,0],pi_2-S[1]);
    p[0] = rad2rrad( p[0]+S[0]+pi_2-I[2] );
    this.push(p, p3);
  }
  if(p1.length){p1[p1.length]=p1[0];p1[p1.length]=p1[1];}
  if(p2.length){p2[p2.length]=p2[0];p2[p2.length]=p2[1];}
  if(p3.length){p3[p3.length]=p3[0];p3[p3.length]=p3[1];}

  re.p1=p1, re.p2=p2, re.p3=p3;
  return re;
 },
 jieX3:function(jd){ //界线表
  var i,k, p, ls;
  var re=this.feature(jd);  //求特征参数

  var t = Math.floor(re.jd*1440)/1440 -3/24;
  var N=360, dt=1/1440, s='',s2;

  for(i=0;i<N;i++,t+=dt){
   var vx = re.vx+re.ax*(t-re.jdSuo);
   var vy = re.vy+re.ay*(t-re.jdSuo);
   var M = this.bseM(t);    //此刻月亮贝塞尔坐标(其x和y正是影足)
   var B = this.rSM(M[2]);  //本半影等
   var r = B.r1;            //半影半径
   var I = this.bse(t);     //贝塞尔坐标参数
   s2 = jdText(t)+' ', k=0;
   //南北界
   p = this.nanbei(M,vx,vy, +1, r,     I); if(p[1]!=100) s2+=rad2str2(p[0])+' '+rad2str2(p[1])+'|', k++; else s2+='-------------------|'; //半影北界
   p = this.nanbei(M,vx,vy, +1, B.r2,  I); if(p[1]!=100) s2+=rad2str2(p[0])+' '+rad2str2(p[1])+'|', k++; else s2+='-------------------|'; //本影北界
   p = this.bseXY2db(M[0],M[1],I,1);       if(p[1]!=100) s2+=rad2str2(p[0])+' '+rad2str2(p[1])+'|', k++; else s2+='-------------------|'; //中心线
   p = this.nanbei(M,vx,vy, -1, B.r2,  I); if(p[1]!=100) s2+=rad2str2(p[0])+' '+rad2str2(p[1])+'|', k++; else s2+='-------------------|'; //本影南界
   p = this.nanbei(M,vx,vy, -1, r,     I); if(p[1]!=100) s2+=rad2str2(p[0])+' '+rad2str2(p[1])+' ', k++; else s2+='------------------- '; //半影南界
   if(k) s+=s2+'<br>';
  }
  return '<pre>时间(力学时) 半影北界限 本影北界线 中心线 本影南界线 半影南界线，(伪本影南北界应互换)<br>'+s+'</pre>';
 }
};




export const rsPL={ //日食批量快速计算器
 nasa_r:0, //为1表示采用NASA的视径比
 sT:new Array(), //地方日食时间表

 secXY:function(jd,L,fa,high,re){ //日月xy坐标计算。参数：jd是力学时,站点经纬L,fa,海拔high(千米)
  //基本参数计算
  var deltat = dt_T(jd); //TD-UT
  var zd=nutation2(jd/36525);
  var gst= pGST(jd-deltat,deltat) + zd[0]*Math.cos(hcjj(jd/36525) + zd[1]); //真恒星时(不考虑非多项式部分)

  var z;
  //=======月亮========
  z=rsGS.moon(jd); re.mCJ=z[0]; re.mCW=z[1]; re.mR=z[2]; //月亮视赤经,月球赤纬
  var mShiJ = rad2rrad(gst + L - z[0]); //得到此刻月亮时角
  parallax(z, mShiJ,fa, high); re.mCJ2=z[0], re.mCW2=z[1], re.mR2=z[2]; //修正了视差的赤道坐标

  //=======太阳========
  z=rsGS.sun(jd); re.sCJ=z[0]; re.sCW=z[1]; re.sR=z[2]; //太阳视赤经,太阳赤纬
  var sShiJ = rad2rrad(gst + L - z[0]); //得到此刻太阳时角
  parallax(z,sShiJ,fa,high); re.sCJ2=z[0], re.sCW2=z[1], re.sR2=z[2]; //修正了视差的赤道坐标

  //=======视半径========
  re.mr = cs_sMoon/re.mR2/rad;
  re.sr = 959.63/re.sR2/rad*cs_AU;
  if(this.nasa_r) re.mr*=cs_sMoon2/cs_sMoon; //0.99925;
  //=======日月赤经纬差转为日面中心直角坐标(用于日食)==============
  re.x = rad2rrad(re.mCJ2-re.sCJ2) * Math.cos((re.mCW2+re.sCW2)/2);
  re.y = re.mCW2-re.sCW2;
  re.t = jd;
 },
 lineT:function(G, v,u, r, n){//已知t1时刻星体位置、速度，求x*x+y*y=r*r时,t的值
  var b=G.y*v-G.x*u, A=u*u+v*v, B=u*b, C=b*b-r*r*v*v, D=B*B-A*C;
  if(D<0) return 0;
  D=Math.sqrt(D); if(!n) D=-D;
  return G.t+((-B+D)/A-G.x)/v;
 },
 secMax:function(jd,L,fa,high){ //日食的食甚计算(jd为近朔的力学时,误差几天不要紧)
  var i;
  for(i=0;i<5;i++) this.sT[i]=0; //分别是:食甚,初亏,复圆,食既,生光
  this.LX=''; //类型
  this.sf=0;  //食分
  this.sf2=0; //食分(日出食分)
  this.sf3=0; //食分(日没食分)
  this.sflx = " "; //食分类型
  this.b1=1;  //月日半径比(食甚时刻)
  this.dur = 0; //持续时间
  this.P1 = this.V1 = 0;  //初亏方位,P北点起算,V顶点起算
  this.P2 = this.V2 = 0;  //复圆方位,P北点起算,V顶点起算
  this.sun_s = this.sun_j = 0; //日出日没

  rsGS.init(jd,7);
  jd=rsGS.Zjd; //食甚初始估值为插值表中心时刻(粗朔)

  var G=new Object(), g=new Object();
  this.secXY(jd,L,fa,high,G);
  jd -= G.x/0.2128; //与食甚的误差在20分钟以内

  var u,v,dt=60/86400,dt2,tt;
  for(i=0;i<2;i++){
   if( this.secXY(jd,L,fa,high,G)   =='err') return;
   if( this.secXY(jd+dt,L,fa,high,g)=='err') return;
   u = (g.y-G.y)/dt;
   v = (g.x-G.x)/dt;
   dt2 = -(G.y*u+G.x*v)/(u*u+v*v);
   jd += dt2; //极值时间
  }

  //求直线到太阳中心的最小值
  var maxsf = 0, maxjd = jd, rmin, ls;
  for (i = -30; i < 30; i += 6) {
   tt = jd + i / 86400;
   this.secXY(tt, L, fa, high, g);
   ls = (g.mr + g.sr - Math.sqrt(g.x * g.x + g.y * g.y)) / g.sr / 2;
   if (ls > maxsf) maxsf = ls, maxjd = tt;
  }
  jd = maxjd;
  for (i = -5; i < 5; i += 1) {
   tt = jd + i / 86400;
   this.secXY(tt, L, fa, high, g);
   ls = (g.mr + g.sr - Math.sqrt(g.x * g.x + g.y * g.y)) / g.sr / 2;
   if (ls > maxsf) maxsf = ls, maxjd = tt;
  }
  jd = maxjd;
  this.secXY(jd, L, fa, high, G);
  rmin = Math.sqrt(G.x * G.x + G.y * G.y);

  this.sun_s = sunShengJ(jd-dt_T(jd)+L/pi2,L,fa,-1) +dt_T(jd); //日出,统一用力学时
  this.sun_j = sunShengJ(jd-dt_T(jd)+L/pi2,L,fa, 1) +dt_T(jd); //日没,统一用力学时


  if(rmin<=G.mr+G.sr){ //食计算
   this.sT[1] = jd; //食甚
   this.LX='偏';
   this.sf=(G.mr+G.sr-rmin)/G.sr/2; //食分
   this.b1=G.mr/G.sr;

   this.secXY(this.sun_s,L,fa,high,g); //日出食分
   this.sf2=(g.mr+g.sr-Math.sqrt(g.x*g.x+g.y*g.y))/g.sr/2; //日出食分
   if(this.sf2<0) this.sf2=0;

   this.secXY(this.sun_j,L,fa,high,g); //日没食分
   this.sf3=(g.mr+g.sr-Math.sqrt(g.x*g.x+g.y*g.y))/g.sr/2; //日没食分
   if(this.sf3<0) this.sf3=0;

   this.sT[0] = this.lineT(G,v,u, G.mr+G.sr, 0); //初亏
   for(i=0;i<3;i++) { //初亏再算3次
    this.secXY(this.sT[0],L,fa,high,g);
    this.sT[0] = this.lineT(g,v,u, g.mr+g.sr, 0);
   }

   this.P1 = rad2mrad(atan2(g.x,g.y)); //初亏位置角
   this.V1 = rad2mrad(this.P1-shiChaJ(pGST2(this.sT[0]),L,fa,g.sCJ,g.sCW)); //这里g.sCJ与g.sCW对应的时间与sT[0]还差了一点，所以有一小点误差，不采用真恒星时也误差一点

   this.sT[2] = this.lineT(G,v,u, G.mr+G.sr, 1); //复圆
   for(i=0;i<3;i++) { //复圆再算3次
    this.secXY(this.sT[2],L,fa,high,g);
    this.sT[2] = this.lineT(g,v,u, g.mr+g.sr, 1);
   }
   this.P2 = rad2mrad(atan2(g.x,g.y));
   this.V2 = rad2mrad(this.P2-shiChaJ(pGST2(this.sT[2]),L,fa,g.sCJ,g.sCW)); //这里g.sCJ与g.sCW对应的时间与sT[2]还差了一点，所以有一小点误差，不采用真恒星时也误差一点
  }
  if(rmin<=G.mr-G.sr){ //全食计算
   this.LX='全';
   this.sT[3] = this.lineT(G,v,u, G.mr-G.sr, 0); //食既
   this.secXY(this.sT[3],L,fa,high,g);
   this.sT[3] = this.lineT(g,v,u, g.mr-g.sr, 0); //食既再算1次

   this.sT[4] = this.lineT(G,v,u, G.mr-G.sr, 1); //生光
   this.secXY(this.sT[4],L,fa,high,g);
   this.sT[4] = this.lineT(g,v,u, g.mr-g.sr, 1); //生光再算1次
   this.dur = this.sT[4]-this.sT[3];
  }
  if(rmin<=G.sr-G.mr){ //环食计算
   this.LX='环';
   this.sT[3] = this.lineT(G,v,u, G.sr-G.mr, 0); //食既
   this.secXY(this.sT[3],L,fa,high,g);
   this.sT[3] = this.lineT(g,v,u, g.sr-g.mr, 0); //食既再算1次

   this.sT[4] = this.lineT(G,v,u, G.sr-G.mr, 1); //生光
   this.secXY(this.sT[4],L,fa,high,g);
   this.sT[4] = this.lineT(g,v,u, g.sr-g.mr, 1); //生光再算1次
   this.dur = this.sT[4]-this.sT[3];
  }
  if(this.sT[1]<this.sun_s && this.sf2>0 ) this.sf=this.sf2,this.sflx="#"; //食甚在日出前，取日出食分
  if(this.sT[1]>this.sun_j && this.sf3>0 ) this.sf=this.sf3,this.sflx="*"; //食甚在日没后，取日没食分

  for(i=0;i<5;i++){
    if(this.sT[i]<this.sun_s || this.sT[i]>this.sun_j) this.sT[i]=0; //升降时间之外的日食算值无效，因为地球不是透明的
  }

  this.sun_s -= dt_T(jd);
  this.sun_j -= dt_T(jd);
  return {
   sT:[...this.sT],LX:this.LX,sf:this.sf,sf2:this.sf2,sf3:this.sf3,sflx:this.sflx,
   b1:this.b1,dur:this.dur,P1:this.P1,V1:this.V1,P2:this.P2,V2:this.V2,
   sun_s:this.sun_s,sun_j:this.sun_j
  };
 },

 //以下涉及南北界计算
 A:new Array(), B:new Array(), //本半影锥顶点坐标
 P : {S:new Array(), M:new Array(), g:0},//t1时刻的日月坐标,g为恒星时
 Q : {S:new Array(), M:new Array(), g:0},//t2时刻的日月坐标
 V : new Array(), //食界表
 Vc: '', Vb: '',  //食中心类型,本影南北距离

 zb0:function(jd){
  //基本参数计算
  var deltat = dt_T(jd); //TD-UT
  var E=hcjj(jd/36525);
  var zd=nutation2(jd/36525);

  this.P.g = pGST(jd-deltat, deltat) + zd[0]*Math.cos(E+zd[1]); //真恒星时(不考虑非多项式部分)
  this.P.S=rsGS.sun(jd);
  this.P.M=rsGS.moon(jd);

  var t2=jd+60/86400;
  this.Q.g = pGST(t2-deltat,deltat) + zd[0]*Math.cos(E+zd[1]);
  this.Q.S=rsGS.sun(t2);
  this.Q.M=rsGS.moon(t2);

  //转为直角坐标
  var z1=new Array(), z2=new Array();
  z1 = llr2xyz(this.P.S);
  z2 = llr2xyz(this.P.M);

  var k=959.63/cs_sMoon*cs_AU, F; //k为日月半径比
  //本影锥顶点坐标计算
  F = new Array(
   (z1[0]-z2[0])/(1-k)+z2[0],
   (z1[1]-z2[1])/(1-k)+z2[1],
   (z1[2]-z2[2])/(1-k)+z2[2]);
  this.A = xyz2llr(F);
  //半影锥顶点坐标计算
  F = new Array(
   (z1[0]-z2[0])/(1+k)+z2[0],
   (z1[1]-z2[1])/(1+k)+z2[1],
   (z1[2]-z2[2])/(1+k)+z2[2]);
  this.B = xyz2llr(F);
 },

 zbXY:function(p,L,fa){
  var s=new Array(p.S[0],p.S[1],p.S[2]);
  var m=new Array(p.M[0],p.M[1],p.M[2]);
  parallax(s, p.g+L-p.S[0],fa, 0); //修正了视差的赤道坐标
  parallax(m, p.g+L-p.M[0],fa, 0); //修正了视差的赤道坐标
  //=======视半径========
  p.mr = cs_sMoon/m[2]/rad;
  p.sr = 959.63/s[2]/rad*cs_AU;
  //=======日月赤经纬差转为日面中心直角坐标(用于日食)==============
  p.x = rad2rrad(m[0]-s[0]) * Math.cos((m[1]+s[1])/2);
  p.y = m[1]-s[1];
 },
 p2p:function(L,fa,re,fAB,f){ //f取+-1
  var p=this.P, q=this.Q;
  this.zbXY(this.P,L,fa);
  this.zbXY(this.Q,L,fa);

  var u=q.y-p.y, v=q.x-p.x, a=Math.sqrt(u*u+v*v),r=959.63/p.S[2]/rad*cs_AU;

  var W=p.S[1]+f*r*v/a, J=p.S[0]-f*r*u/a/Math.cos((W+p.S[1])/2), R=p.S[2];

  var A = fAB ? this.A : this.B;

  var pp = lineEar( new Array(J,W,R), A, p.g );
  re.J = pp.J;
  re.W = pp.W;
 },
 pp0:function(re){ //食中心点计算
  var p=this.P;
  var pp = lineEar( p.M, p.S, p.g );
  re.J = pp.J;
  re.W = pp.W; //无解返回值是100
  
  if(re.W==100) { re.c = ''; return; }
  re.c='全';
  this.zbXY(p,re.J,re.W);
  if(p.sr>p.mr) re.c='环';
 },
 nbj:function(jd){ //南北界计算
  rsGS.init(jd,7);
  var i, G=new Object(), V=this.V;
  for(i=0;i<10;i++) V[i]=100; this.Vc='',this.Vb=''; //返回初始化,纬度值为100表示无解,经度100也是无解,但在以下程序中经度会被转为-PI到+PI

  this.zb0(jd);
  this.pp0(G); V[0]=G.J, V[1]=G.W, this.Vc=G.c; //食中心

  G.J=G.W=0; for(i=0;i<2;i++) this.p2p(G.J,G.W,G,1, 1); V[2]=G.J, V[3]=G.W; //本影北界,环食为南界(本影区之内,变差u,v基本不变,所以计算两次足够)
  G.J=G.W=0; for(i=0;i<2;i++) this.p2p(G.J,G.W,G,1,-1); V[4]=G.J, V[5]=G.W; //本影南界,环食为北界
  G.J=G.W=0; for(i=0;i<3;i++) this.p2p(G.J,G.W,G,0,-1); V[6]=G.J, V[7]=G.W; //半影北界
  G.J=G.W=0; for(i=0;i<3;i++) this.p2p(G.J,G.W,G,0, 1); V[8]=G.J, V[9]=G.W; //半影南界

  if(V[3]!=100&&V[5]!=100){ //粗算本影南北距离
    var x=(V[2]-V[4])*Math.cos((V[3]+V[5])/2), y=V[3]-V[5];
    this.Vb = (cs_rEarA*Math.sqrt(x*x+y*y)).toFixed(0)+'千米';
  }
  return {V:[...V],Vc:this.Vc,Vb:this.Vb};
 }
};







