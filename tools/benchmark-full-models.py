"""Frozen-model comparison; never fits coefficients or edits production code."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import time
import numpy as np
import erfa
from jplephem.spk import SPK

import argparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--vsop87', required=True, type=Path, help='CDS VI/81 directory')
parser.add_argument('--vsop2013', required=True, type=Path, help='Official solution directory with VSOP2013.f and p1..p8 data')
parser.add_argument('--top2013', required=True, type=Path, help='Directory with TOP2013LBR.dat')
parser.add_argument('--elp-module', required=True, type=Path, help='Full DE405-mode JS evaluator exporting elpmpp02(daysSinceJ2000)')
parser.add_argument('--elp82-data', required=True, type=Path, help='CDS VI/79 directory with ELP1..ELP36')
parser.add_argument('--elp82-binary', required=True, type=Path, help='Compiled benchmark-elp82-driver.f90 + official elp82b.f')
parser.add_argument('--de441', required=True, type=Path)
parser.add_argument('--out', required=True, type=Path, help='Empty output directory; caches are never reused across runs')
parser.add_argument('--samples', type=int, default=2048, help='Stratified dates per window, plus two endpoints')
args = parser.parse_args()
if args.samples < 1: parser.error('--samples must be positive')
HERE=args.out.resolve()
if HERE.exists() and any(HERE.iterdir()): parser.error('--out must be empty (prevents stale-model cache reuse)')
HERE.mkdir(parents=True,exist_ok=True)
VSOP87=args.vsop87.resolve(); V13_DATA=args.vsop2013.resolve(); TOP_DATA=args.top2013.resolve()
ELP=args.elp_module.resolve(); ELP82_DATA=args.elp82_data.resolve()
ELP82_BINARY=args.elp82_binary.resolve()

def fortran_constants(name):
    source = '\n'.join(line.split('!')[0] for line in (V13_DATA / 'VSOP2013.f').read_text().splitlines())
    section = re.search(r'data ' + name + r'/(.*?)/', source, re.S).group(1)
    section = '\n'.join(line.split('!')[0] for line in section.splitlines())
    return np.array([float(n.replace('d', 'e')) for n in re.findall(r'[+-]?\d+(?:\.\d*)?d[+-]?\d+', section)])

def read_series(body, ip):
    cache = HERE / f'{body}-full.npz'
    if cache.exists():
        return np.load(cache)['terms']
    offsets = [(6 + i*3, 3) for i in range(4)] + [(19 + i*3, 3) for i in range(5)]
    offsets += [(35 + i*4, 4) for i in range(4)] + [(52, 6)] + [(59 + i*3, 3) for i in range(3)]
    rows = []
    with (V13_DATA / f'VSOP2013p{ip}.dat').open() as stream:
        for line in stream:
            if line.startswith(' VSOP2013'):
                fields = line.split()
                variable, power = int(fields[2])-1, int(fields[3])
                continue
            ints = [int(line[start:start+width]) for start, width in offsets]
            s = float(line[68:88]) * 10**int(line[89:92])
            c = float(line[92:112]) * 10**int(line[113:116])
            # Match the official routine: replace the leading mean-motion term.
            if variable == 1 and power == 1 and int(line[:5]) == 1:
                rows.append([variable, power, MOTION[ip-1], 0., 0.])
                continue
            phase = sum(ints[j]*CI0[j] for j in range(17))
            frequency = sum(ints[j]*CI1[j] for j in range(17))
            rows.append([variable, power, np.hypot(s, c), phase-np.arctan2(s, c), frequency])
    terms = np.asarray(rows)
    np.savez_compressed(cache, terms=terms)
    return terms

def elements(terms, jd):
    out = np.zeros((len(jd), 6))
    for first in range(0, len(jd), 256):
        tau = (jd[first:first+256] - 2451545.0) / 365250
        for variable in range(6):
            for power in range(21):
                block = terms[(terms[:, 0] == variable) & (terms[:, 1] == power), 2:]
                total = np.zeros(len(tau))
                for index in range(0, len(block), 256):
                    a, b, w = block[index:index+256].T
                    total += np.sum(a[:, None] * np.cos(b[:, None]+w[:, None]*tau), axis=0)
                out[first:first+len(tau), variable] += tau**power * total
    out[:, 1] %= 2*np.pi
    return out

def elliptic_xyz(v):
    """Position part of the official ELLXYZ; vectorized, bounded Newton loop."""
    a, longitude, k, h, q, p = v.T
    z = k + 1j*h
    eccentricity = np.abs(z)
    fi, ki = np.sqrt(1-k*k-h*h), np.sqrt(1-q*q-p*p)
    u = 1/(1+fi)
    mean = longitude-np.arctan2(h, k)
    e = (longitude + (eccentricity-.125*eccentricity**3)*np.sin(mean)
         + .5*eccentricity**2*np.sin(2*mean) + .375*eccentricity**3*np.sin(3*mean))
    for _ in range(20):
        ztheta = np.exp(1j*e)
        z3 = np.conj(z)*ztheta
        delta = longitude-e+z3.imag
        rsa = 1-z3.real
        e += delta/rsa
        if np.max(np.abs(delta)) < 2e-15:
            break
    else:
        raise RuntimeError('Kepler solver did not converge')
    z1 = u*z*z3.imag
    zto = (-z+ztheta+(z1.imag-1j*z1.real))/rsa
    cw, sw = zto.real, zto.imag
    m = p*cw-q*sw
    r = a*rsa
    return np.column_stack([r*(cw-2*p*m), r*(sw+2*q*m), -2*r*ki*m])

def position(terms, jd):
    return elliptic_xyz(elements(terms, jd)) @ ROT2013.T * AU2013

CI0, CI1, MOTION = (fortran_constants(k) for k in ['ci0','ci1','freqpla'])
assert len(CI0)==len(CI1)==17 and len(MOTION)==9
eps=np.deg2rad(23+26/60+21.41136/3600); phi=np.deg2rad(-.05188/3600)
ROT2013=np.array([[np.cos(phi),-np.sin(phi)*np.cos(eps),np.sin(phi)*np.sin(eps)],[np.sin(phi),np.cos(phi)*np.cos(eps),-np.cos(phi)*np.sin(eps)],[0,np.sin(eps),np.cos(eps)]])
AU2013=149597870.691
FREQ=np.array([529.6909622785881,213.2990811942489,74.78166163181234,38.13297236217556,25.33566020437000])
LBR_FREQ=np.array([529.6909622723741,213.2990809732973,74.78166167358461,38.13297236551104])
MU=(FREQ[0]-FREQ[1])/880
TOP_HEADER=re.compile(r'PLANET\s+(\d+)\s+VARIABLE\s+(\d+)\s+T\*\*(\d+)\s+(\d+)')

def parse(path):
    blocks = {}
    with path.open() as stream:
        for line in stream:
            match = TOP_HEADER.search(line)
            assert match, repr(line)
            ip, iv, power, count = map(int, match.groups())
            rows = []
            for _ in range(count):
                term = next(stream)
                rows.append((int(term[1:9]),
                             float(term[9:31]) * 10.0**int(term[31:35]),
                             float(term[35:57]) * 10.0**int(term[57:61])))
            assert (ip, iv, power) not in blocks
            blocks[ip, iv, power] = np.array(rows).reshape(-1, 3)
    return blocks

def evaluate(blocks, kind, ip, jd):
    t = (np.asarray(jd) - 2451545.0) / 365250.0
    result = np.zeros((len(t), 6 if kind == 'TOP2013' else 3))
    longitude = {'TOP2013': 2, 'TOP2013LBR': 1}.get(kind)
    for (planet, iv, power), block in blocks.items():
        if planet != ip or not len(block):
            continue
        if iv == longitude and power == 1:
            block = block[block[:, 0] != 0]
        m, c, s = block.T
        angle = m[:, None] * MU * t[None, :]
        result[:, iv-1] += t**power * np.sum(
            c[:, None]*np.cos(angle) + s[:, None]*np.sin(angle), axis=0)
    if longitude:
        freq = FREQ if kind == 'TOP2013' else LBR_FREQ
        result[:, longitude-1] = (result[:, longitude-1] + freq[ip-5]*t) % (2*np.pi)
    return result
BODY = {'mercury':1,'venus':2,'emb':3,'mars':4,'jupiter':5,'saturn':6,'uranus':7,'neptune':8}
SEED = 2026090201
COUNT = args.samples
WINDOWS = {'1600_2200':(1600,2200),'minus1000_3000':(-1000,3000),'minus6000_10000':(-6000,10000)}
rng = np.random.default_rng(SEED)
years = {k:np.r_[lo, lo+(np.arange(COUNT)+rng.random(COUNT))*(hi-lo)/COUNT, hi] for k,(lo,hi) in WINDOWS.items()}
all_year = np.unique(np.concatenate(list(years.values())))
jd = 2451545+(all_year-2000)*365.25
indices = {k:np.searchsorted(all_year,y) for k,y in years.items()}
np.savez(HERE/'dates.npz',year=all_year,jd=jd,**indices)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def cached(name, fn):
    path=HERE/(name+'.npy')
    if path.exists(): return np.load(path)
    start=time.time();print('start',name,flush=True)
    value=fn();assert np.isfinite(value).all(), name
    np.save(path,value);print('done',name,round(time.time()-start,2),flush=True)
    return value

node = r'''
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {planetHeliocentricPosition,embPosition,moonPosition} from './src/ephemeris.js';
import {meanObliquityIau2006,vondrak2011PrecessionMatrix} from './src/coordinates.js';
const {jd,elp}=JSON.parse(fs.readFileSync(0,'utf8'));
const {elpmpp02}=await import(pathToFileURL(elp));
const eps=meanObliquityIau2006(2451545),c=Math.cos(eps),s=Math.sin(eps),p=vondrak2011PrecessionMatrix(2451545);
const mean=[[1,0,0],[0,c,s],[0,-s,c]].map(row=>[0,1,2].map(j=>row.reduce((n,v,k)=>n+v*p[k][j],0)));
const rotate=(v,scale)=>[0,1,2].map(j=>v.reduce((n,x,k)=>n+x*mean[k][j],0)*scale);
const out={};
for(const body of ['mercury','venus','emb','mars','jupiter','saturn','uranus','neptune','earth','moon']) {
 out[body]={};
 for(const a of ['fast','mid','accurate']) out[body][a]=jd.map(t=>rotate(body==='moon'?moonPosition(t,a):body==='emb'?embPosition(t,a):planetHeliocentricPosition(body,t,a),body==='moon'?1:149597870.7));
}
out.elp=jd.map(t=>elpmpp02(t-2451545));
out.runtimeToIcrf=mean;
console.log(JSON.stringify(out));
'''
runtime_file=HERE/'runtime.json'
if not runtime_file.exists():
    print('start runtime',flush=True)
    out=subprocess.check_output(['node','--input-type=module','-e',node],cwd=ROOT,input=json.dumps(dict(jd=jd.tolist(),elp=str(ELP))),text=True)
    runtime_file.write_text(out)
runtime=json.loads(runtime_file.read_text())

def segment(kernel, center, target):
    out=np.empty((len(jd),3));covered=np.zeros(len(jd),bool)
    for s in kernel.segments:
        if (s.center,s.target)!=(center,target):continue
        ix=(jd>=s.start_jd)&(jd<=s.end_jd)
        out[ix]=s.compute(jd[ix]).T;covered|=ix
    assert covered.all(),(center,target)
    return out

with SPK.open(str(args.de441)) as kernel:
    sun=segment(kernel,0,10)
    oracle={b:segment(kernel,0,i)-sun for b,i in BODY.items()}
    oracle['earth']=oracle['emb']+segment(kernel,3,399)
    oracle['moon']=segment(kernel,3,301)-segment(kernel,3,399)
np.savez(HERE/'reference.npz',**oracle)

# Official VSOP87 notice gives a dynamical-ecliptic -> FK5 rotation, NOT ICRF.
# SOFA/ERFA FK5-Hipparcos orientation completes the fixed J2000 frame tie.
VSOP87_TO_FK5 = np.array([[1.,.000000440360,-.000000190919],[-.000000479966,.917482137087,-.397776982902],[0.,.397776982902,.917482137087]])
ROT87=erfa.fk5hip()[0]@VSOP87_TO_FK5
HEADER=re.compile(r'VARIABLE\s+(\d+).*?\*T\*\*(\d+)\s+(\d+)\s+TERMS')

def full87(path):
    blocks={};key=None;expected={}
    for line in path.read_text().splitlines():
        match=HEADER.search(line)
        if match:
            iv,n,count=map(int,match.groups());key=(iv-1,n);blocks[key]=[];expected[key]=count
        elif line.strip(): blocks[key].append(list(map(float,line.split()[-3:])))
    result=np.zeros((len(jd),3))
    for (iv,n),rows in blocks.items():
        assert len(rows)==expected[iv,n]
        block=np.asarray(rows)
        for i in range(0,len(jd),128):
            t=(jd[i:i+128]-2451545)/365250
            a,b,w=block.T
            result[i:i+len(t),iv]=result[i:i+len(t),iv]+t**n*np.sum(a[:,None]*np.cos(b[:,None]+w[:,None]*t),axis=0)
    return result@ROT87.T*149597870.7

def top_full(blocks,ip):
    parts=[]
    for i in range(0,len(jd),64):
        l,b,r=evaluate(blocks,'TOP2013LBR',ip,jd[i:i+64]).T
        parts.append(np.c_[r*np.cos(b)*np.cos(l),r*np.cos(b)*np.sin(l),r*np.sin(b)])
    return np.concatenate(parts)@ROT2013.T*AU2013

models={b:{a:np.asarray(runtime[b][a]) for a in ['fast','mid','accurate']} for b in oracle}
for b,ip in BODY.items():
    code='emb' if b=='emb' else {'mercury':'mer','venus':'ven','mars':'mar','jupiter':'jup','saturn':'sat','uranus':'ura','neptune':'nep'}[b]
    models[b]['VSOP87A Full']=cached('vsop87-'+b,lambda:full87(VSOP87/('VSOP87A.'+code)))
    name='earth' if b=='emb' else b
    models[b]['VSOP2013 Full']=cached('vsop2013-'+b,lambda:position(read_series(name,ip),jd))
blocks=parse(TOP_DATA/'TOP2013LBR.dat')
for b in ['jupiter','saturn','uranus','neptune']:
    models[b]['TOP2013 Full']=cached('top2013-'+b,lambda:top_full(blocks,BODY[b]))
models['earth']['VSOP87A Full']=cached('vsop87-earth',lambda:full87(VSOP87/'VSOP87A.ear'))

def elp2000():
    text=subprocess.check_output([str(ELP82_BINARY)],cwd=ELP82_DATA,input='\n'.join(map(str,jd))+'\n',text=True)
    return np.loadtxt(text.splitlines())

models['moon']['ELP2000-82B Full native']=cached('elp2000-native',elp2000)
models['moon']['ELP-MPP02 Full native']=np.asarray(runtime['elp'])

def stats(p,ref,ix):
    err=np.linalg.norm(p[ix]-ref[ix],axis=1)
    return dict(rms_km=float(np.sqrt(np.mean(err**2))),p95_km=float(np.quantile(err,.95)),max_km=float(err.max()),worst_year=float(all_year[ix[np.argmax(err)]]))

# ELP2000-82B notice, section 8: its own dynamical-ecliptic -> FK5 matrix.
ELP82_TO_FK5=np.array([[1.,.000000437913,-.000000189859],[-.000000477299,.917482137607,-.397776981701],[0.,.397776981701,.917482137607]])
# ELP/MPP02 explanatory note, Table 7, JPL405 row (DE405-fitted constants).
eps=np.deg2rad(23+26/60+21.40960/3600);phi=np.deg2rad(-.05028/3600)
ROT_MPP=np.array([[np.cos(phi),-np.sin(phi)*np.cos(eps),np.sin(phi)*np.sin(eps)],[np.sin(phi),np.cos(phi)*np.cos(eps),-np.cos(phi)*np.sin(eps)],[0,np.sin(eps),np.cos(eps)]])
LUNAR_ROTATIONS={'ELP2000-82B Full native':erfa.fk5hip()[0]@ELP82_TO_FK5,'ELP-MPP02 Full native':ROT_MPP}
for k in ['ELP2000-82B Full native','ELP-MPP02 Full native']:
    native=models['moon'].pop(k)
    models['moon'][k.replace(' native','')]=native@LUNAR_ROTATIONS[k].T
    np.save(HERE/(k.split()[0]+'-native.npy'),native)

sources=list(ROOT.glob('src/*.js'))+[Path(__file__).resolve(),ELP,ELP.with_name('elpmpp02_data.js')]+list(VSOP87.glob('VSOP87A.*'))+list(V13_DATA.glob('VSOP2013p*.dat'))+[TOP_DATA/'TOP2013LBR.dat',ELP82_DATA/'elp82b.f']+[ELP82_DATA/f'ELP{i}' for i in range(1,37)]
report=dict(benchmark_date="2026-09-02",seed=SEED,count_per_window=COUNT+2,windows=WINDOWS,jd_sha256=hashlib.sha256(jd.tobytes()).hexdigest(),source_hashes={str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name:sha(p) for p in sources},runtime_to_icrf=runtime['runtimeToIcrf'],vsop87_to_icrf=ROT87.tolist(),lunar_rotations={k:v.tolist() for k,v in LUNAR_ROTATIONS.items()},metrics={})
for b,values in models.items():
    report['metrics'][b]={name:{w:stats(p,oracle[b],ix) for w,ix in indices.items()} for name,p in values.items()}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('REPORT READY',flush=True)
