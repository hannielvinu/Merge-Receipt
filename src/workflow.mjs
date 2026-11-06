import {diagnose, formatDiagnosis} from './diagnose.mjs';

const TTL = 30 * 60 * 1000;
const MAX_PENDING = 256;

export function roomWorkflow(cases, identifyCase, mention = 'merge-receipt') {
  const pending = new Map();
  const prefix = '@' + mention + ' ';

  return async function reply(payload) {
    if (payload?.addressed !== true || typeof payload.sender !== 'string'
        || typeof payload.message_id !== 'string' || typeof payload.body !== 'string') return;

    const body = payload.body.trim();
    const command = (body.toLowerCase().startsWith(prefix.toLowerCase())
      ? body.slice(prefix.length) : body).trim();
    const root = payload.thread_id || payload.message_id;
    const now = Date.now();
    for (const [key, created] of pending) {
      if (now - created >= TTL) pending.delete(key);
    }

    const decision = /^(hold|investigate)\s+(LU-\d+)$/i.exec(command);
    if (decision) {
      const caseId = decision[2].toUpperCase();
      const key = JSON.stringify([root, payload.sender, caseId]);
      if (!pending.has(key)) {
        return {root, body: 'Replay that case first. The requesting maintainer can record a decision in its thread.'};
      }
      const action = decision[1].toLowerCase() === 'hold' ? 'HOLD AND HAND OFF' : 'INVESTIGATE';
      // The reply is threaded under the maintainer's original request. That post
      // identifies the owner without interpreting display names or accepting an alias.
      return {root, body: '**' + caseId + ' · ' + action + '**\n\n'
        + 'Recorded at the requesting maintainer’s direction. Owner: the maintainer who opened this thread. '
        + 'Review the workflow trigger and keep the existing required check in place.',
      delivered: () => pending.delete(key)};
    }

    let id = /^replay\s+(LU-\d+)$/i.exec(command)?.[1]?.toUpperCase();
    let interpreted = false;
    if (!id && command.length && command.length <= 400) {
      try {
        id = await identifyCase(command, cases);
        interpreted = Boolean(id);
      } catch {
        return {root, body: 'Codex could not classify this request. Retry or use `replay LU-1640` for the deterministic replay.'};
      }
    }

    const result = diagnose(cases.find(entry => entry.id === id));
    return {
      root,
      body: formatDiagnosis(result, mention) + (interpreted ? '\n\nRequest routed by Codex. Path comparison is deterministic.' : ''),
      delivered: result.status === 'FILTERED_OUT' ? () => {
        if (pending.size >= MAX_PENDING) pending.delete(pending.keys().next().value);
        pending.set(JSON.stringify([root, payload.sender, result.caseId]), Date.now());
      } : undefined,
    };
  };
}
