import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export function writeNativeFixture(path, fixture, binary, adapter) {
  const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
  const { rows, ...header } = fixture;
  const metadata = { ...header, reference: { binarySha256: hash(binary), adapterSha256: hash(new URL(adapter, import.meta.url)) } };
  // One record per line keeps fixture diffs reviewable without megabyte lines.
  writeFileSync(path, JSON.stringify(metadata, null, 2).slice(0, -2)
    + ',\n  "rows": [\n' + rows.map(row => '    ' + JSON.stringify(row)).join(',\n') + '\n  ]\n}\n');
}
