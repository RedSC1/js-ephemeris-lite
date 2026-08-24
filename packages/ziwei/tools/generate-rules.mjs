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
const placementVariants = natalStars.map((star) => ({
  starId: starIds.get(star.key),
  starKey: star.key,
  options: Object.fromEntries(placementDoc.placements
    .filter((rule) => rule.star === star.key)
    .map((rule) => [rule.option, {
      starId: starIds.get(rule.star),
      inputs: rule.inputs,
      shape: rule.shape,
      positions: rule.positions,
    }])),
}));

const brightnessVariants = stars.map((star) => ({
  starId: star.id,
  starKey: star.key,
  options: Object.fromEntries(brightnessDoc.brightness
    .filter((rule) => rule.star === star.key)
    .map((rule) => [rule.option, rule.values])),
}));
const stemKeys = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
const sihuaVariants = stemKeys.map((stem, stemIndex) => ({
  stemIndex,
  stemKey: stem,
  options: Object.fromEntries(sihuaDoc.sihua
    .filter((rule) => rule.stem === stem)
    .map((rule) => [rule.option, {
      lu: starIds.get(rule.lu),
      quan: starIds.get(rule.quan),
      ke: starIds.get(rule.ke),
      ji: starIds.get(rule.ji),
    }])),
}));
const masterVariants = Object.fromEntries(mastersDoc.masters.map((rule) => [rule.option, {
  life: rule.life.map((key) => starIds.get(key)),
  body: rule.body.map((key) => starIds.get(key)),
}]));

const banner = `// Generated from the default Ziwei TOML resources. Do not edit by hand.\n`;
const source = `${banner}
export interface GeneratedStar { readonly id: number; readonly key: string; readonly category: string; readonly natal: boolean }
export interface GeneratedPlacement { readonly starId: number; readonly inputs: readonly string[]; readonly shape: readonly number[]; readonly positions: readonly number[] }
export interface GeneratedTransformSet { readonly lu: number; readonly quan: number; readonly ke: number; readonly ji: number }
export interface GeneratedPlacementVariants { readonly starId: number; readonly starKey: string; readonly options: Readonly<Record<string, GeneratedPlacement>> }
export interface GeneratedBrightnessVariants { readonly starId: number; readonly starKey: string; readonly options: Readonly<Record<string, readonly number[]>> }
export interface GeneratedSihuaVariants { readonly stemIndex: number; readonly stemKey: string; readonly options: Readonly<Record<string, GeneratedTransformSet>> }

export const GENERATED_STARS: readonly GeneratedStar[] = Object.freeze(${JSON.stringify(stars)});
export const GENERATED_NATAL_STAR_COUNT = ${natalStars.length};
export const GENERATED_PLACEMENT_VARIANTS: readonly GeneratedPlacementVariants[] = Object.freeze(${JSON.stringify(placementVariants)} as unknown as GeneratedPlacementVariants[]);
export const GENERATED_BRIGHTNESS_VARIANTS: readonly GeneratedBrightnessVariants[] = Object.freeze(${JSON.stringify(brightnessVariants)});
export const GENERATED_SIHUA_VARIANTS: readonly GeneratedSihuaVariants[] = Object.freeze(${JSON.stringify(sihuaVariants)});
export const GENERATED_MASTER_VARIANTS: Readonly<Record<string, { readonly life: readonly number[]; readonly body: readonly number[] }>> = Object.freeze(${JSON.stringify(masterVariants)});
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source);
console.log(`generated ${placements.length} natal placements for ${stars.length} stars`);
