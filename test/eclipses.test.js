import test from 'node:test';
import assert from 'node:assert/strict';
import { ecFast, rsGS, rsPL, ysPL } from '../src/eclipses.js';

test('ecFast preserves Shou Xing J2000-relative conjunctions and eclipse codes', () => {
  const rows = [
    [8864, 8864.26449216153, 'T'],
    [8686, 8687.24902518585, 'A'],
    [9129, 9130.050075764828, 'N'],
    [0, 5.26065620268879, 'N'],
    [-36525, -36523.92284971631, 'N'],
    [36525, 36534.43653780644, 'N'],
  ];
  for (const [near, jdSuo, lx] of rows) {
    const result = ecFast(near);
    assert.equal(result.jd, result.jdSuo);
    assert.equal(result.jdSuo, jdSuo);
    assert.equal(result.lx, lx);
    assert.ok(result.ac === 0 || result.ac === 1);
  }
});

test('ecFast rejects non-finite dates instead of returning corrupt classifications', () => {
  assert.throws(() => ecFast(Number.NaN), /finite J2000-relative TT day/);
  assert.throws(() => ecFast(Number.POSITIVE_INFINITY), /finite J2000-relative TT day/);
});

test('ecFast refines original Shou Xing false negatives at grazing eclipse limits', () => {
  // The original ecFast reports N/ac=0 for these dates, while full rsGS
  // geometry retains a very small partial eclipse.
  const rows = [
    [-343287.6017978299, -343287.60983580875, 0.007541453060863621],
    [-178123.22420314816, -178123.2344447304, 0.0006869203095710955],
    [385970.0547769653, 385970.0646011573, 0.002411079261352296],
  ];
  for(const [near,originalMaximum,originalMagnitude] of rows){
    const fast=ecFast(near);
    assert.equal(fast.lx,'P');
    assert.equal(fast.ac,0);

    rsGS.init(near,7);
    const exact=rsGS.feature(near);
    assert.equal(exact.lx,'P');
    assert.ok(Math.abs(exact.jd-originalMaximum)*86400<8,'grazing maximum');
    assert.ok(Math.abs(exact.sf-originalMagnitude)<0.0001,'grazing magnitude');
  }
});

test('ecFast boundary refinement does not mutate the public rsGS cache', () => {
  rsGS.init(8864,7);
  const jd=rsGS.Zjd;
  const roots=rsGS.Zs.slice();
  const result=ecFast(-178123.22420314816);
  assert.equal(result.lx,'P');
  assert.equal(rsGS.Zjd,jd);
  assert.deepEqual(rsGS.Zs,roots);
});

test('ecFast marks the 1935-01-05 smallest twentieth-century partial as uncertain', () => {
  const near=-23737.277315980806;
  const fast=ecFast(near);
  assert.equal(fast.lx,'P');
  assert.equal(fast.ac,0);
  rsGS.init(near,7);
  const exact=rsGS.feature(near);
  assert.equal(exact.lx,'P');
  assert.ok(exact.sf>0 && exact.sf<0.002);
});

test('ysPL.lecMax preserves Shou Xing lunar-eclipse contacts with the current ephemeris', () => {
  const rows = [
    [8347, '全', 1.3635170051692678,
      [8346.882020565135,8346.958587361665,8347.035121160603,8346.834606341492,8347.082641313658,8346.928827723052,8346.988324945873]],
    [8701, '偏', 0.12723850274626405,
      [8701.316432765085,8701.34394608289,8701.371335906755,8701.250769710718,8701.437087446457,0,0]],
    [8849, '', 0, [0,0,0,8849.702886999936,8849.899907189545,0,0]],
    [8864, '', 0, [0,0,0,0,0,0,0]],
  ];
  for(const [near,LX,sf,contacts] of rows){
    const result=ysPL.lecMax(near);
    assert.equal(result.LX,LX);
    assert.ok(Math.abs(result.sf-sf)<0.00005);
    contacts.forEach((expected,index)=>{
      if(expected===0) assert.equal(result.lT[index],0);
      else assert.ok(Math.abs(result.lT[index]-expected)*86400<3,`${near} contact ${index}`);
    });
  }
});

test('ysPL keeps the original contact order without mutable singleton results', () => {
  const first=ysPL.lecMax(8347);
  const second=ysPL.lecMax(8864);
  assert.equal(first.LX,'全');
  assert.equal(second.LX,'');
  assert.notStrictEqual(first.lT,second.lT);
  assert.throws(()=>ysPL.lecMax(Number.NaN),/finite J2000-relative TT day/);
});

test('rsGS.feature preserves Shou Xing global eclipse types and Bessel geometry', () => {
  const rows = [
    [8509,'H',8509.679116548547,2.1952148151681428,-0.16746957096882786,1.0131891731971316,49.36251183448112],
    [8687,'A',8687.250467137113,-1.4504535308052127,0.19838803526059978,0.9520085382973492,189.4876961487579],
    [8864,'T',8864.262840932162,-1.817674342257682,0.44130993912221583,1.0565676247670155,198.61593105833632],
    [9219,'P',9218.950421744004,-1.3468968665659702,1.066447778036892,0.9373323846839697,0],
  ];
  for(const [near,lx,jd,zxJ,zxW,sf,dw] of rows){
    rsGS.init(near,7);
    const result=rsGS.feature(near);
    assert.equal(result.lx,lx);
    assert.ok(Math.abs(result.jd-jd)*86400<1,'global maximum');
    assert.ok(Math.abs(result.zxJ-zxJ)<0.0002,'maximum longitude');
    assert.ok(Math.abs(result.zxW-zxW)<0.00005,'maximum latitude');
    assert.ok(Math.abs(result.sf-sf)<0.00005,'global magnitude');
    assert.ok(Math.abs(result.dw-dw)<0.05,'central path width');
  }
});

test('rsGS.feature preserves rare Shou Xing boundary classifications', () => {
  const rows = [
    [5231.76,'A0',5231.753152461391,0.9871759970298299],
    [-11748.26,'T0',-11748.264619791242,1.0123751107076142],
    [1245.68,'A1',1245.67318965009,0.9383851023207186],
    [1924.35,'H',1924.358912741857,1.0073701822234868],
    [5055.04,'H3',5055.033055708733,1.0158659133026107],
    [67777.4355,'T1',67777.44324504802,1.036945636079426],
    [-189581.6485,'H2',-189581.64541224632,1.0154495667444372],
  ];
  for(const [near,lx,jd,sf] of rows){
    rsGS.init(near,7);
    const result=rsGS.feature(near);
    assert.equal(result.lx,lx,`${near} type`);
    assert.ok(Math.abs(result.jd-jd)*86400<2,`${near} maximum`);
    assert.ok(Math.abs(result.sf-sf)<0.00005,`${near} magnitude`);
    assert.ok(Number.isFinite(result.zxJ) && Number.isFinite(result.zxW),`${near} location`);
  }
});

test('rsPL.secMax preserves Shou Xing local contacts at the global maximum point', () => {
  const rows = [
    [8509,'全',1.0070210322161552,[8509.613175015405,8509.679116525624,8509.745309529073,8509.6786480001,8509.679584166042]],
    [8687,'环',0.9764039856764032,[8687.177037814738,8687.250467092148,8687.323542643979,8687.248663298473,8687.252272117988]],
    [8864,'全',1.028728104084453,[8864.208071278992,8864.262840982055,8864.320084254441,8864.261267602571,8864.26441754021]],
    [9219,'偏',0.9381761152263186,[0,9218.950224451246,9218.98825012139,0,0]],
  ];
  for(const [near,LX,sf,contacts] of rows){
    rsGS.init(near,7);
    const global=rsGS.feature(near);
    const result=rsPL.secMax(near,global.zxJ,global.zxW,0);
    assert.equal(result.LX,LX);
    assert.ok(Math.abs(result.sf-sf)<0.00005,'local magnitude');
    contacts.forEach((expected,index)=>{
      if(expected===0) assert.equal(result.sT[index],0);
      else assert.ok(Math.abs(result.sT[index]-expected)*86400<1,`local contact ${index}`);
    });
    assert.notStrictEqual(result.sT,rsPL.sT);
  }
});

test('rsPL.secMax preserves sunrise and sunset truncated eclipses', () => {
  const rows = [
    {
      near:8509,longitude:65*Math.PI/180,latitude:-70*Math.PI/180,
      sflx:'#',sf:0.10109417466538562,
      contacts:[0,0,8509.66044728895,0,0],
      sunrise:8509.654146100189,sunset:8509.982330358514,
    },
    {
      near:8509,longitude:-175*Math.PI/180,latitude:-35*Math.PI/180,
      sflx:'*',sf:0.1138755786213681,
      contacts:[8509.695124879192,0,0,0,0],
      sunrise:8509.254883526744,sunset:8509.715743753177,
    },
  ];
  for(const row of rows){
    const result=rsPL.secMax(row.near,row.longitude,row.latitude,0);
    assert.equal(result.LX,'偏');
    assert.equal(result.sflx,row.sflx);
    assert.ok(Math.abs(result.sf-row.sf)<0.001,'horizon magnitude');
    row.contacts.forEach((expected,index)=>{
      if(expected===0) assert.equal(result.sT[index],0,`horizon contact ${index}`);
      else assert.ok(Math.abs(result.sT[index]-expected)*86400<1,`horizon contact ${index}`);
    });
    assert.ok(Math.abs(result.sun_s-row.sunrise)*86400<10,'sunrise');
    assert.ok(Math.abs(result.sun_j-row.sunset)*86400<10,'sunset');
  }
});

test('rsGS and rsPL expose every original boundary method without NaN geometry', () => {
  rsGS.init(8864,7);
  const lines=rsGS.jieX(8864);
  for(const name of ['p1','p2','p3','p4','q1','q2','q3','q4','L0','L1','L2','L3','L4','L5','L6']){
    assert.equal(lines[name].length%2,0,name);
    assert.ok(lines[name].every(Number.isFinite),name);
  }
  const outlines=rsGS.jieX2(8864);
  for(const name of ['p1','p2','p3']) assert.ok(outlines[name].every(Number.isFinite),name);
  assert.match(rsGS.jieX3(8864),/^<pre>时间\(力学时\)/);
  const boundary=rsPL.nbj(8864);
  assert.equal(boundary.V.length,10);
  assert.ok(boundary.V.every(Number.isFinite));
  assert.throws(()=>rsGS.init(Number.NaN,7),/finite J2000-relative TT day/);
});

test('rsGS.init preserves the original 2/3/7 root-count parameter', () => {
  for(const [roots,length] of [[2,18],[3,27],[7,63]]){
    rsGS.init(8864,roots);
    assert.equal(rsGS.Zs.length,length);
    assert.equal(rsGS.feature(8864).lx,'T');
  }
  assert.throws(()=>rsGS.init(8864,4),/root count/);
});

test('rsGS.jieX path lines retain the original point counts and representative coordinates', () => {
  rsGS.init(8864,7);
  const lines=rsGS.jieX(8864);
  const lengths={p1:262,p2:262,p3:262,p4:262,q1:128,q2:6,q3:126,q4:4,
    L0:420,L1:208,L2:448,L3:418,L4:422,L5:346,L6:452};
  for(const [name,length] of Object.entries(lengths)) assert.equal(lines[name].length,length,name);
  const expected=[-2.7671496615745923,-0.13661587596251915,-0.34646270626982556,0.8311577441750465];
  const actual=[...lines.L0.slice(0,2),...lines.L0.slice(-2)];
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<0.00002,`L0 ${index}`));
});
