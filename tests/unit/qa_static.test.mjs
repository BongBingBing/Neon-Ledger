// Runs SQA's read-only static checker (docs/QA/checks/qa-static.mjs) as part of ./tools/test.
// ERROR-level findings fail this test; WARN items are printed as diagnostics only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ROOT } from './_helpers.mjs';

const CHECKER = `${ROOT}/docs/QA/checks/qa-static.mjs`;

test('AC-UI-120 AC-CON-109 SQA static checks (qa-static.mjs) report no ERRORs', { skip: !existsSync(CHECKER) && 'checker missing' }, (t) => {
  const r = spawnSync(process.execPath, [CHECKER, '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  let findings;
  try { findings = JSON.parse(r.stdout); } catch { assert.fail(`checker output not JSON (rc=${r.status}): ${r.stdout?.slice(0, 500)} ${r.stderr?.slice(0, 500)}`); }
  const errors = findings.filter((f) => f.level === 'ERROR');
  const warns = findings.filter((f) => f.level === 'WARN');
  if (warns.length) t.diagnostic(`${warns.length} WARN findings (triage by SQA)`);
  assert.deepEqual(errors.map((e) => `${e.rule} ${e.where}: ${e.msg.slice(0, 160)}`), []);
});
