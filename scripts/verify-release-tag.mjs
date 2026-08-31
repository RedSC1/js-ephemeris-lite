import { readFileSync } from 'node:fs';

const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!tag?.startsWith('v')) {
  console.error('Release tag must use the form v<semver>.');
  process.exit(1);
}

const version = tag.slice(1);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
if (!SEMVER.test(version)) {
  console.error(`Invalid release tag: ${tag}`);
  process.exit(1);
}

const packagePaths = [
  'package.json',
  'packages/bazi/package.json',
  'packages/huangli/package.json',
  'packages/star-catalog/package.json',
  'packages/ziwei/package.json',
];

const packages = packagePaths.map((path) => ({
  path,
  manifest: JSON.parse(readFileSync(path, 'utf8')),
}));

for (const { path, manifest } of packages) {
  if (manifest.version !== version) {
    console.error(`${path}: version ${manifest.version} does not match tag ${tag}.`);
    process.exitCode = 1;
  }
  const coreRange = manifest.dependencies?.['js-ephemeris-lite'];
  if (coreRange && coreRange !== `^${version}`) {
    console.error(`${path}: js-ephemeris-lite dependency ${coreRange} must be ^${version}.`);
    process.exitCode = 1;
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Release tag ${tag} matches all ${packages.length} package manifests.`);
