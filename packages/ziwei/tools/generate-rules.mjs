import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseValue(source) {
  if (source.startsWith('[') || source.startsWith('"')) return JSON.parse(source);
  if (source === 'true') return true;
  if (source === 'false') return false;
  const value = Number(source);
  if (!Number.isFinite(value)) throw new Error(`unsupported TOML value: ${source}`);
  return value;
}

// The bundled Ziwei resources deliberately use a tiny TOML subset: scalar
// assignments and one-line arrays inside array-of-table sections.
function parseSimpleToml(filename) {
  const root = {};
  const tables = {};
  let current = root;
  for (const [index, original] of fs.readFileSync(filename, 'utf8').split(/\r?\n/).entries()) {
    const line = original.trim();
    if (line === '' || line.startsWith('#')) continue;
    const section = line.match(/^\[\[([A-Za-z0-9_]+)\]\]$/);
    if (section) {
      const name = section[1];
      tables[name] ??= [];
      current = {};
      tables[name].push(current);
      continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) throw new Error(`${filename}:${index + 1}: unsupported TOML syntax`);
    current[assignment[1]] = parseValue(assignment[2]);
  }
  return { ...root, ...tables };
}

function selected(rows, option = 'option1') {
  return rows.filter((row) => row.option === option);
}

const sourceDir = path.resolve(process.argv[2] ?? '');
const outputFile = path.resolve(process.argv[3] ?? '');
if (!sourceDir || !outputFile) {
  throw new Error('usage: node generate-rules.mjs SOURCE_RULE_DIR OUTPUT_FILE');
}

const starsDoc = parseSimpleToml(path.join(sourceDir, 'stars.toml'));
const placementDoc = parseSimpleToml(path.join(sourceDir, 'placement.toml'));
const brightnessDoc = parseSimpleToml(path.join(sourceDir, 'brightness.toml'));
const sihuaDoc = parseSimpleToml(path.join(sourceDir, 'sihua.toml'));
const mastersDoc = parseSimpleToml(path.join(sourceDir, 'masters.toml'));

const natalStars = starsDoc.natal_stars;
const flowStars = starsDoc.flow_stars;
const stars = [...natalStars, ...flowStars].map((star, id) => ({
  id,
  key: star.key,
  category: star.category,
  natal: id < natalStars.length,
}));
const starIds = new Map(stars.map((star) => [star.key, star.id]));
const placements = selected(placementDoc.placements)
  .filter((rule) => starIds.get(rule.star) < natalStars.length)
  .map((rule) => ({
    starId: starIds.get(rule.star),
    inputs: rule.inputs,
    shape: rule.shape,
    positions: rule.positions,
  }));
if (placements.length !== natalStars.length) {
  throw new Error(`expected ${natalStars.length} natal placements, got ${placements.length}`);
}

const brightnessByStar = Array.from({ length: stars.length }, () => Array(12).fill(-1));
for (const rule of selected(brightnessDoc.brightness)) {
  brightnessByStar[starIds.get(rule.star)] = rule.values;
}
const sihua = selected(sihuaDoc.sihua).map((rule) => ({
  lu: starIds.get(rule.lu),
  quan: starIds.get(rule.quan),
  ke: starIds.get(rule.ke),
  ji: starIds.get(rule.ji),
}));
const masters = selected(mastersDoc.masters)[0];
const masterIds = {
  life: masters.life.map((key) => starIds.get(key)),
  body: masters.body.map((key) => starIds.get(key)),
};

const banner = `// Generated from the default Ziwei TOML resources. Do not edit by hand.\n`;
const source = `${banner}
export interface GeneratedStar { readonly id: number; readonly key: string; readonly category: string; readonly natal: boolean }
export interface GeneratedPlacement { readonly starId: number; readonly inputs: readonly string[]; readonly shape: readonly number[]; readonly positions: readonly number[] }
export interface GeneratedTransformSet { readonly lu: number; readonly quan: number; readonly ke: number; readonly ji: number }

export const GENERATED_STARS: readonly GeneratedStar[] = Object.freeze(${JSON.stringify(stars)});
export const GENERATED_NATAL_STAR_COUNT = ${natalStars.length};
export const GENERATED_NATAL_PLACEMENTS: readonly GeneratedPlacement[] = Object.freeze(${JSON.stringify(placements)});
export const GENERATED_BRIGHTNESS: readonly (readonly number[])[] = Object.freeze(${JSON.stringify(brightnessByStar)});
export const GENERATED_SIHUA: readonly GeneratedTransformSet[] = Object.freeze(${JSON.stringify(sihua)});
export const GENERATED_MASTERS: Readonly<{ readonly life: readonly number[]; readonly body: readonly number[] }> = Object.freeze(${JSON.stringify(masterIds)});
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source);
console.log(`generated ${placements.length} natal placements for ${stars.length} stars`);
