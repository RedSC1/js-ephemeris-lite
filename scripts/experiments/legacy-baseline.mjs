// Load the published baseline outside the checkout. No legacy implementation
// is retained in production or copied into the current source tree.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const directory=mkdtempSync(join(tmpdir(),'eclipse-beta5-'));
const archive=execFileSync('git',['archive','v1.0.0-beta.5','src'],{
 cwd:fileURLToPath(new URL('../..',import.meta.url)),maxBuffer:32*1024*1024,
});
execFileSync('tar',['-x','-C',directory],{input:archive});
writeFileSync(join(directory,'package.json'),'{"type":"module"}');
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}));
const legacy=await import(pathToFileURL(join(directory,'src/eclipses.js')));
const modern=await import(pathToFileURL(join(directory,'src/eclipse-search.js')));
export const {ecFast,ysPL,rsGS,rsPL}=legacy;
export const {getSolarEclipseDetails,getLunarEclipseDetails,searchSolarEclipses,searchLunarEclipses,getLocalSolarEclipse}=modern;
