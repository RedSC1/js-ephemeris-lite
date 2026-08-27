import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ruleGroups } from '../../packages/huangli/audit/rule-matrix.mjs';
import { DATA } from '../../packages/huangli/src/data.js';
const [binary] = process.argv.slice(2);
if (!binary) throw new Error('usage: node compare-huangli.mjs COMPILED_DART_ORACLE');
const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
child.on('error', error => { console.error(error); process.exitCode = 1; });
const query = async request => {
  child.stdin.write(JSON.stringify(request) + '\n');
  const line = await lines.next();
  assert.equal(line.done, false, 'Dart exited before replying');
  return JSON.parse(line.value);
};
const saved = JSON.parse(readFileSync(new URL('../../packages/huangli/audit/rules-dart-fingerprint.json', import.meta.url)));
try {
  assert.deepEqual(await query({ op: 'data' }), DATA, 'reference tables');
  const calendar = JSON.parse(readFileSync(new URL('../../packages/huangli/test/fixtures/calendar-dart.json', import.meta.url)));
  const calendarRows = calendar.samples.map(({ date: [y, m, d, zone, hour, exact] }) =>
    ({ date: [y, m, d, hour, 0, 0], offset: zone * 60, exact }));
  const days = await query({ op: 'calendar', rows: calendarRows });
  assert.equal(days.length, calendar.samples.length);
  for (const [i, day] of days.entries()) {
    const old = calendar.samples[i].result;
    const actual = [day.lunar.slice(0, 4), day.ganzhi, day.solarTerm, day.mansion, day.officer, day.dutyGod[0],
      day.activities.map(a => [...a].sort()), day.pengZu, day.taiShen, day.hours.map(h => [h[0], h[2]]), day.flyingDay];
    assert.deepEqual(actual, [old.lunar, old.ganzhi, old.term, old.mansion, old.officer, old.dutyGod,
      old.activities.map(a => [...a].sort()), old.pengzu, old.taishen, old.hours, old.dailyFlyingStars], `calendar ${i}`);
  }
  console.log(`live Dart calendar: ${days.length}`);
  for (const [name, rows] of ruleGroups()) {
    const expected = saved.groups.find(g => g.name === name), hash = createHash('sha256');
    let count = 0, batch = [];
    const flush = async () => {
      const output = await query({ op: 'rules', rows: batch });
      assert.equal(output.length, batch.length);
      for (const row of output) { assert(Array.isArray(row), JSON.stringify(row)); hash.update(JSON.stringify(row) + '\n'); }
      count += batch.length; batch = [];
    };
    for (const row of rows) { batch.push(row); if (batch.length === 2048) await flush(); }
    if (batch.length) await flush();
    assert.equal(count, expected.count, name);
    assert.equal(hash.digest('hex'), expected.dartSha256, name);
    console.log(`live Dart ${name}: ${count}`);
  }
} finally { child.stdin.end(); }
// Both implementations must match the same reference, not merely their own outputs.
await import('../../packages/huangli/audit/replay-dart-rules.mjs');
