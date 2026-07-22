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

test('adds the account assignments cleanup before the historical assertion', () => {
  const repair = REPLAY_REPAIRS[2];
  const repaired = applyReplayRepair(repair.before, repair);
  assert.match(repaired, /public\.account_assignments DROP COLUMN IF EXISTS company_id/u);
});

test('qualifies every ambiguous salary function comment with its five-argument signature', () => {
  const salaryCommentRepairs = REPLAY_REPAIRS.slice(3, 7);
  assert.equal(salaryCommentRepairs.length, 4);

  for (const repair of salaryCommentRepairs) {
    assert.equal(applyReplayRepair(repair.before, repair), repair.after);
    assert.match(repair.after, /\(UUID, TEXT, TEXT, NUMERIC, TEXT\) IS$/u);
  }
});

test('skips the unusable session-local constants block during historical replay', () => {
  const repair = REPLAY_REPAIRS[7];
  const repaired = applyReplayRepair(repair.before, repair);
  assert.match(repaired, /DO \$\$ BEGIN\n  RETURN;/u);
});

test('defers is_admin_or_hr permissions until its historical creation', () => {
  const permissionRepairs = REPLAY_REPAIRS.slice(8, 10);
  assert.equal(permissionRepairs.length, 2);

  for (const repair of permissionRepairs) {
    assert.match(applyReplayRepair(repair.before, repair), /^-- Replay repair:/u);
  }
});

test('drops get_my_role before changing its historical return type', () => {
  const repair = REPLAY_REPAIRS[10];
  const repaired = applyReplayRepair(repair.before, repair);
  assert.match(repaired, /DROP FUNCTION public\.get_my_role\(\);\nCREATE OR REPLACE/u);
});

test('rejects missing or repeated historical repair targets', () => {
  const repair = REPLAY_REPAIRS[0];
  assert.throws(() => applyReplayRepair('unrelated SQL', repair), /found 0/u);
  assert.throws(() => applyReplayRepair(`${repair.before}\n${repair.before}`, repair), /found 2/u);
});
