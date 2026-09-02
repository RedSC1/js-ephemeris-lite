import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seriesPath = path.join(root, 'src/planet-series.js');
const outputPath = path.join(root, 'src/planet-prefix-counts.js');
const series = await import(`${pathToFileURL(seriesPath).href}?tiers=${Date.now()}`);

const BODIES = Object.freeze({
  MERCURY: 0.39,
  VENUS: 0.72,
  MARS: 1.52,
  JUPITER: 5.20,
  SATURN: 9.55,
  URANUS: 19.2,
  NEPTUNE: 30.1,
});
const TIER_FRACTIONS = Object.freeze({ fast: 0.55, mid: 0.85 });
const SAMPLES = Array.from({ length: 513 }, (_, index) => -8 + 16 * index / 512);

function rankedEnvelopes(axes, radiusAu) {
  const envelopes = [];
  for (let coordinate = 0; coordinate < axes.length; coordinate += 1) {
    const byFrequency = new Map();
    axes[coordinate].forEach((rows, power) => {
      for (let index = 0; index < rows.length; index += 3) {
        const frequency = rows[index + 2];
        if (!byFrequency.has(frequency)) byFrequency.set(frequency, []);
        byFrequency.get(frequency).push({
          power, amplitude: rows[index], phase: rows[index + 1], frequency,
        });
      }
    });
    for (const [frequency, terms] of byFrequency) {
      let maximum = 0;
      let squareSum = 0;
      for (const T of SAMPLES) {
        let value = 0;
        for (const term of terms) {
          value += T ** term.power * term.amplitude
            * Math.cos(term.phase + term.frequency * T);
        }
        // A small angular change moves the body by roughly radius * angle.
        const cartesianScale = coordinate === 2 ? 1 : radiusAu;
        const contribution = Math.abs(value) * cartesianScale;
        maximum = Math.max(maximum, contribution);
        squareSum += contribution * contribution;
      }
      envelopes.push({
        coordinate,
        frequency,
        score: maximum + Math.sqrt(squareSum / SAMPLES.length),
      });
    }
  }
  return envelopes.sort((left, right) => right.score - left.score
    || left.coordinate - right.coordinate || left.frequency - right.frequency);
}

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
  if (start < 0) throw new Error(`Missing ${name}`);
  const arrayStart = source.indexOf('[', start + marker.length);
  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    if (source[index] === '[') depth += 1;
    else if (source[index] === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(0, arrayStart) + value + source.slice(index + 1);
    }
  }
  throw new Error(`Unterminated ${name}`);
}

function frozenArray(values) {
  return `Object.freeze([${values.join(', ')}])`;
}

let source = fs.readFileSync(seriesPath, 'utf8');
const generated = [
  '// Per-power retained-term counts for direct planetary position accuracy tiers.',
  '// Coefficients are reordered offline by complete frequency envelope; no coefficients are duplicated here.',
  '',
];

for (const [body, radiusAu] of Object.entries(BODIES)) {
  const names = ['L', 'B', 'R'].map(axis => `${body}_${axis}`);
  const axes = names.map(name => series[name]);
  const ranked = rankedEnvelopes(axes, radiusAu);
  const rank = new Map(ranked.map((entry, index) => [`${entry.coordinate}:${entry.frequency}`, index]));
  const reordered = axes.map((blocks, coordinate) => blocks.map(rows => {
    const terms = [];
    for (let index = 0; index < rows.length; index += 3) terms.push(rows.slice(index, index + 3));
    terms.sort((left, right) => rank.get(`${coordinate}:${left[2]}`)
      - rank.get(`${coordinate}:${right[2]}`));
    return terms.flat();
  }));
  names.forEach((name, coordinate) => reordered[coordinate].forEach((rows, power) => {
    source = replaceBinding(source, `${name}${power}`, formatRows(rows));
  }));

  const tierSizes = Object.fromEntries(Object.entries(TIER_FRACTIONS)
    .map(([tier, fraction]) => [tier, Math.round(ranked.length * fraction)]));
  generated.push(`export const ${body}_PREFIX_COUNTS = Object.freeze([`);
  for (let coordinate = 0; coordinate < reordered.length; coordinate += 1) {
    generated.push('  Object.freeze({');
    for (const [tier, size] of Object.entries(tierSizes)) {
      const counts = reordered[coordinate].map(rows => {
        let count = 0;
        while (count * 3 < rows.length
          && rank.get(`${coordinate}:${rows[count * 3 + 2]}`) < size) count += 1;
        return count;
      });
      generated.push(`    ${tier}: ${frozenArray(counts)},`);
    }
    generated.push('  }),');
  }
  generated.push(']);', '');
}

fs.writeFileSync(seriesPath, source);
fs.writeFileSync(outputPath, `${generated.join('\n')}\n`);
