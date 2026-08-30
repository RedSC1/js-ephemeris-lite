import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, '../sxwnl_spa_dart/lib/src/sxwnl/festivals.dart');
const outputPath = resolve(root, 'packages/huangli/src/festival-data.js');
const source = await readFile(sourcePath, 'utf8');

// These are source-era schedule placeholders, not recurring festivals. Annual
// Chinese holiday and make-up workday arrangements require year-specific data.
const OMITTED_SOURCE_NAMES = new Set(['国庆节假日']);

function blockAfter(marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing Dart festival block: ${marker}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('\n  };', open);
  if (open < 0 || close < 0) throw new Error(`Unterminated Dart festival block: ${marker}`);
  return source.slice(open + 1, close);
}

function parseFestival(text) {
  const match = text.match(/Festival\("([^"]+)"([\s\S]*?)\)/);
  if (!match) throw new Error(`Cannot parse festival: ${text}`);
  const [, name, options] = match;
  const value = key => options.match(new RegExp(`${key}:\\s*([A-Za-z0-9_.-]+)`))?.[1];
  return {
    name,
    source: value('source')?.split('.').at(-1),
    level: value('level')?.split('.').at(-1),
    isPublicHoliday: value('isPublicHoliday') === 'true',
    startYear: Number(value('startYear') ?? 0),
    endYear: Number(value('endYear') ?? 9999),
  };
}

function parseMap(marker) {
  const block = blockAfter(marker);
  const result = {};
  const entries = [...block.matchAll(/"(\d{4})":\s*\[([\s\S]*?)\](?=,\s*\n\s*"\d{4}"|,?\s*$)/gm)];
  for (const [, key, body] of entries) {
    result[key] = [...body.matchAll(/Festival\("[^"]+"[\s\S]*?\)/g)]
      .map(match => parseFestival(match[0]))
      .filter(item => !OMITTED_SOURCE_NAMES.has(item.name));
  }
  if (!Object.keys(result).length) throw new Error(`No entries parsed from ${marker}`);
  return result;
}

const lunar = parseMap('_lunarFtv');
const solar = parseMap('_solarFtv');
const header = `// Generated from sxwnl_spa_dart/lib/src/sxwnl/festivals.dart.\n// Run: node scripts/import-sxwnl-festivals.mjs\n// Do not edit this table by hand; display aliases and selection policy live in festivals.js.\n`;
await writeFile(outputPath, `${header}\nexport const SOLAR_FESTIVALS = ${JSON.stringify(solar, null, 2)};\n\nexport const LUNAR_FESTIVALS = ${JSON.stringify(lunar, null, 2)};\n`);
console.log(`Imported ${Object.values(solar).flat().length} solar and ${Object.values(lunar).flat().length} lunar festival entries.`);
