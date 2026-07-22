import assert from 'node:assert/strict';
import test from 'node:test';

import { applyReplayRepair, REPLAY_REPAIRS } from './prepare-history.mjs';

test('repairs the malformed auth trigger target exactly once', () => {
  const repair = REPLAY_REPAIRS[0];
  const repaired = applyReplayRepair(`before\n${repair.before}\nafter`, repair);
  assert.equal(repaired, `before\n${repair.after}\nafter`);
});

test('repairs the malformed PL/pgSQL variable initializer', () => {
  const repair = REPLAY_REPAIRS[1];
  assert.equal(applyReplayRepair(repair.before, repair), repair.after);
});

test('rejects missing or repeated historical repair targets', () => {
  const repair = REPLAY_REPAIRS[0];
  assert.throws(() => applyReplayRepair('unrelated SQL', repair), /found 0/u);
  assert.throws(() => applyReplayRepair(`${repair.before}\n${repair.before}`, repair), /found 2/u);
});
