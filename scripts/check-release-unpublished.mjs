import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packagePaths = [
  'package.json',
  'packages/bazi/package.json',
  'packages/huangli/package.json',
  'packages/star-catalog/package.json',
  'packages/ziwei/package.json',
];

let foundPublishedVersion = false;
for (const path of packagePaths) {
  const { name, version } = JSON.parse(readFileSync(path, 'utf8'));
  const result = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
    encoding: 'utf8',
  });
  if (result.status === 0) {
    console.error(`${name}@${version} is already published.`);
    foundPublishedVersion = true;
  } else if (`${result.stdout}\n${result.stderr}`.includes('E404')) {
    console.log(`${name}@${version} is available.`);
  } else {
    process.stderr.write(result.stderr || result.stdout || `npm view failed for ${name}@${version}.\n`);
    process.exit(1);
  }
}

if (foundPublishedVersion) process.exit(1);
