import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (!version || !SEMVER.test(version)) {
  console.error('Usage: npm run release:set-version -- <semver>');
  process.exit(1);
}

const packagePaths = [
  'package.json',
  'packages/bazi/package.json',
  'packages/huangli/package.json',
  'packages/star-catalog/package.json',
  'packages/ziwei/package.json',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

for (const path of packagePaths) {
  const manifest = readJson(path);
  manifest.version = version;
  if (manifest.dependencies?.['js-ephemeris-lite']) {
    manifest.dependencies['js-ephemeris-lite'] = `^${version}`;
  }
  writeJson(path, manifest);
}

const lock = readJson('package-lock.json');
lock.version = version;
for (const key of ['', 'packages/bazi', 'packages/huangli', 'packages/star-catalog', 'packages/ziwei']) {
  const entry = lock.packages?.[key];
  if (!entry) throw new Error(`package-lock.json is missing workspace entry: ${key || '<root>'}`);
  entry.version = version;
  if (entry.dependencies?.['js-ephemeris-lite']) {
    entry.dependencies['js-ephemeris-lite'] = `^${version}`;
  }
}
writeJson('package-lock.json', lock);

console.log(`Updated ${packagePaths.length} packages and package-lock.json to ${version}.`);
