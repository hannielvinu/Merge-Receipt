import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnose} from '../src/diagnose.mjs';
import {roomWorkflow} from '../src/workflow.mjs';

const cases = JSON.parse(readFileSync(new URL('../src/cases.json', import.meta.url)));
const [control, blocked, second] = cases;
const message = (body, overrides = {}) => ({
  addressed: true, sender: 'maintainer', message_id: 'request', body, ...overrides,
});

test('pinned public fixtures separate filtered paths from a code control', () => {
  assert.equal(diagnose(blocked).status, 'FILTERED_OUT');
  assert.equal(diagnose(blocked).files.length, 5);
  assert.equal(diagnose(second).files.length, 4);
  assert.deepEqual(diagnose(second).matches, []);
  assert.deepEqual(diagnose(control).matches, control.files);
});

test('unsupported filters or absent evidence fail closed', () => {
  assert.equal(diagnose().status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(diagnose({...blocked, base: 'main'}).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(diagnose({...blocked, patterns: ['**', '!docs/**']}).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(diagnose({...blocked, files: Array(300).fill('docs/file.md')}).status, 'INSUFFICIENT_EVIDENCE');
});

test('explicit room request and hold require the same maintainer and thread', async () => {
  const respond = roomWorkflow(cases, () => { throw new Error('unexpected model call'); });
  const first = await respond(message('@merge-receipt replay LU-1640'));
  assert.match(first.body, /0 of 5/);
  first.delivered();
  const reply = {thread_id: 'request', message_id: 'reply'};
  assert.match((await respond(message('hold LU-1640', {...reply, sender: 'other'}))).body, /Replay that case first/);
  assert.match((await respond(message('hold LU-1640', {...reply, thread_id: 'other'}))).body, /Replay that case first/);
  const accepted = await respond(message('hold LU-1640', reply));
  assert.match(accepted.body, /HOLD AND HAND OFF/);
  accepted.delivered();
  assert.match((await respond(message('hold LU-1640', reply))).body, /Replay that case first/);
});

test('natural language is routed through the provider and unrelated chat is ignored', async () => {
  const respond = roomWorkflow(cases, async body => {
    assert.equal(body, 'What happened to the first docs-only change?');
    return 'LU-1640';
  });
  assert.equal(await respond(message('hello', {addressed: false})), undefined);
  assert.match((await respond(message('What happened to the first docs-only change?'))).body, /Request routed by Codex/);
});
