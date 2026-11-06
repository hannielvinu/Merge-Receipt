import {request, switchUrl} from './switch.mjs';

const key = process.env.SWITCH_REGISTRATION_KEY;
if (!key) throw new Error('Set SWITCH_REGISTRATION_KEY before registering');
const result = await request(switchUrl(), key, '/agents', {
  name: process.env.SWITCH_AGENT_NAME || 'merge-receipt',
  display_name: 'Merge Receipt',
  description: 'Codex-assisted diagnosis and maintainer decisions for missing GitHub Actions checks.',
  connector_type: 'merge-receipt',
  integration_profile: {
    connection_model: 'always_on',
    message_exchange: true,
    pre_invocation_mediation: [],
    post_invocation_mediation: [],
    event_reporting: [],
  },
});
console.log('SWITCH_AGENT_ID=' + result.id);
console.log('SWITCH_AGENT_KEY=' + result.api_key);
