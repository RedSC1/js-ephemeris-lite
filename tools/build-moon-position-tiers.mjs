import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seriesPath = path.join(root, 'src/moon-series.js');
const outputPath = path.join(root, 'src/moon-prefix-counts.js');
const series = await import(`${pathToFileURL(seriesPath).href}?tiers=${Date.now()}`);
const names = ['MOON_L', 'MOON_B', 'MOON_R'];
const axes = names.map(name => series[name]);
const samples = Array.from({ length: 513 }, (_, index) => -1 + 2 * index / 512);
const tiers = Object.freeze({ fast: 0.20, mid: 0.60 });
const meanDistanceKm = 384400;

function argument(index, x) {
  const coefficients = series.MOON_ARGUMENTS[index];
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) value = value * x + coefficients[i];
  return value * x;
}

const byArgument = new Map();
for (let coordinate = 0; coordinate < axes.length; coordinate += 1) {
  axes[coordinate].forEach((rows, power) => {
    for (let index = 0; index < rows.length; index += 3) {
      const argumentIndex = rows[index + 2];
      if (!byArgument.has(argumentIndex)) byArgument.set(argumentIndex, []);
      byArgument.get(argumentIndex).push({
        coordinate, power, sine: rows[index], cosine: rows[index + 1], argumentIndex,
      });
    }
  });
}

const ranked = [...byArgument].map(([argumentIndex, terms]) => {
  let maximum = 0;
  let squareSum = 0;
  for (const x of samples) {
    const values = [0, 0, 0];
    const phase = argument(argumentIndex, x);
    for (const term of terms) {
      values[term.coordinate] += x ** term.power
        * (term.sine * Math.sin(phase) + term.cosine * Math.cos(phase));
    }
    const contribution = Math.hypot(
      values[0] * meanDistanceKm, values[1] * meanDistanceKm, values[2],
    );
    maximum = Math.max(maximum, contribution);
    squareSum += contribution * contribution;
  }
  return { argumentIndex, terms, score: maximum + Math.sqrt(squareSum / samples.length) };
}).sort((left, right) => right.score - left.score || left.argumentIndex - right.argumentIndex);
const rank = new Map(ranked.map((entry, index) => [entry.argumentIndex, index]));

function formatRows(rows) {
  const lines = [];
  for (let index = 0; index < rows.length; index += 3) {
    lines.push(`  ${rows.slice(index, index + 3).map(String).join(', ')},`);
  }
  return `[\n${lines.join('\n')}\n]`;
}

function replaceBinding(source, name, value) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  const arrayStart = source.indexOf('[', start + marker.length);
  if (start < 0 || arrayStart < 0) throw new Error(`Missing ${name}`);
  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    if (source[index] === '[') depth += 1;
    else if (source[index] === ']' && --depth === 0) {
      return source.slice(0, arrayStart) + value + source.slice(index + 1);
    }
  }
  throw new Error(`Unterminated ${name}`);
}

let source = fs.readFileSync(seriesPath, 'utf8');
const reordered = axes.map(blocks => blocks.map(rows => {
  const terms = [];
  for (let index = 0; index < rows.length; index += 3) terms.push(rows.slice(index, index + 3));
  terms.sort((left, right) => rank.get(left[2]) - rank.get(right[2]));
  return terms.flat();
}));
names.forEach((name, coordinate) => reordered[coordinate].forEach((rows, power) => {
  source = replaceBinding(source, `${name}${power}`, formatRows(rows));
}));

const output = [
  '// Per-power retained-term counts for the shared lunar argument priority.',
  '// Runtime truncation performs no ranking and keeps each argument envelope intact.',
  'export const MOON_PREFIX_COUNTS = Object.freeze([',
];
for (const blocks of reordered) {
  output.push('  Object.freeze({');
  for (const [tier, fraction] of Object.entries(tiers)) {
    const size = Math.round(ranked.length * fraction);
    const counts = blocks.map(rows => {
      let count = 0;
      while (count * 3 < rows.length && rank.get(rows[count * 3 + 2]) < size) count += 1;
      return count;
    });
    output.push(`    ${tier}: Object.freeze([${counts.join(', ')}]),`);
  }
  output.push('  }),');
}
output.push(']);', '');

fs.writeFileSync(seriesPath, source);
fs.writeFileSync(outputPath, output.join('\n'));
