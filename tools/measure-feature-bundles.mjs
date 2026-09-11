// Usage: node tools/measure-feature-bundles.mjs [path/to/esbuild/lib/main.js]
// esbuild is a measurement tool only; it is not a runtime dependency.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
const { build, version } = await import(process.argv[2]
  ? pathToFileURL(resolve(process.argv[2])).href : 'esbuild');
const root = fileURLToPath(new URL('../', import.meta.url));
const entries = ['src/qi-shuo.js', 'src/solar-time.js', 'src/ephemeris.js',
  'packages/bazi/dist/index.js', 'packages/ziwei/dist/index.js'];
const results = {};
for (const entry of entries) {
  const result = await build({ entryPoints: [entry], absWorkingDir: root,
    bundle: true, minify: true, platform: 'browser', format: 'esm',
    write: false, metafile: true });
  const bytes = result.outputFiles[0].contents;
  results[entry] = { bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
    inputs: Object.keys(result.metafile.inputs) };
}
console.log(JSON.stringify({ esbuild: version, results }, null, 2));
