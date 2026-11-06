import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import WebSocket from 'ws';
import {identifyCase} from './codex.mjs';
import {request, switchUrl} from './switch.mjs';
import {roomWorkflow} from './workflow.mjs';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const {SWITCH_AGENT_ID: agent, SWITCH_AGENT_KEY: key, SWITCH_ROOM_ID: room} = process.env;
if (!agent || !key || !room) throw new Error('Set SWITCH_AGENT_ID, SWITCH_AGENT_KEY and SWITCH_ROOM_ID');

const url = switchUrl();
const base = '/agents/' + encodeURIComponent(agent);
const connectionId = randomUUID();
const reply = roomWorkflow(cases, identifyCase, process.env.SWITCH_AGENT_NAME);
let cursor;
let generation;
let stopping = false;
let socket;

function connect() {
  const address = new URL(base + '/connection/ws', url);
  address.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  address.searchParams.set('connection_id', connectionId);
  address.searchParams.set('rooms', room);
  address.searchParams.set('filter', 'addressed');
  if (cursor !== undefined) {
    address.searchParams.set('start_from', 'resume');
    address.searchParams.set('start_at', String(cursor));
  }
  if (generation !== undefined) address.searchParams.set('expected_generation', String(generation));

  return new Promise(resolve => {
    let ready = false;
    let queue = Promise.resolve();
    socket = new WebSocket(address, {
      headers: {Authorization: 'Bearer ' + key},
      handshakeTimeout: 10_000,
      maxPayload: 256 * 1024,
    });
    const deadline = setTimeout(() => { if (!ready) socket.terminate(); }, 15_000);
    socket.on('message', raw => {
      let frame;
      try { frame = JSON.parse(raw.toString()); } catch { return; }
      const {event, data} = frame;
      if (event === 'ping') {
        if (ready) socket.send(JSON.stringify({type: 'pong', cursor}));
        return;
      }
      if (event === 'connection_state') {
        cursor = data.cursor;
        generation = data.generation;
        ready = data.rooms?.includes(room);
        if (ready) console.log('Merge Receipt connected to Switch room ' + room);
        else {
          console.error('Switch did not grant the configured room');
          socket.close();
        }
        return;
      }
      if (event === 'refused' || event === 'evicted' || event === 'gap') {
        console.error('Switch connection ' + event + '. Reopening at the live edge. Resend unanswered requests.');
        generation = undefined;
        cursor = undefined;
        socket.close();
        return;
      }
      if (!ready || event !== 'message' || data?.room_id !== room) return;
      queue = queue.then(async () => {
        const sequence = Number(frame.id ?? data.sequence);
        if (Number.isFinite(sequence) && cursor !== undefined && sequence <= cursor) return;
        const response = await reply(data.payload);
        if (response) {
          await request(url, key, base + '/ops/post_message',
            {body: response.body, thread_id: response.root}, connectionId);
          response.delivered?.();
        }
        if (Number.isFinite(sequence)) cursor = sequence;
      }).catch(error => {
        console.error('Could not process room message:', error.message);
        socket.close();
      });
    });
    socket.on('error', error => console.error('Switch socket:', error.message));
    socket.on('close', () => {
      clearTimeout(deadline);
      queue.finally(resolve);
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    socket?.close();
  });
}
while (!stopping) {
  await connect();
  if (!stopping) await delay(2000);
}
