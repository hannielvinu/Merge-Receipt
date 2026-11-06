import {diagnose} from './src/diagnose.mjs';

const get = id => document.getElementById(id);
const labels = {
  'LU-1640': 'First blocked docs PR',
  'LU-1642': 'Second blocked docs PR',
  'LU-1638': 'Code-change control',
};

function show(entry) {
  for (const button of get('cases').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.caseId === entry.id));
  }
  const result = diagnose(entry);
  const unknown = result.status === 'INSUFFICIENT_EVIDENCE';
  get('evidence').hidden = unknown;
  get('status').dataset.status = result.status;
  get('status').textContent = unknown ? 'Insufficient evidence'
    : result.status === 'FILTERED_OUT' ? 'Workflow filtered out' : 'Path filter matched';
  get('result-detail').textContent = unknown ? 'This case is outside the supported replay.'
    : result.matches.length + ' of ' + result.files.length + ' changed paths matched. '
      + (result.status === 'FILTERED_OUT' ? 'The workflow could not report a check for this event.'
        : 'The trigger is eligible under this filter. Verify execution separately.');
  if (unknown) return;

  get('check').textContent = result.check;
  get('base').textContent = result.base.slice(0, 12);
  get('paths').replaceChildren(...result.files.map(file => {
    const item = document.createElement('li');
    const indicator = document.createElement('span');
    const matched = result.matches.includes(file);
    indicator.textContent = matched ? 'MATCHED' : 'EXCLUDED';
    indicator.className = matched ? 'matched' : 'excluded';
    const path = document.createElement('code');
    path.textContent = file;
    item.append(indicator, path);
    return item;
  }));
  get('sources').replaceChildren(...Object.entries({
    'Changed files': result.sources.pull,
    'Pinned workflow': result.sources.workflow,
    'Policy report': result.sources.policy,
  }).map(([label, url]) => {
    const link = document.createElement('a');
    link.textContent = label + ' ↗';
    link.href = url;
    return link;
  }));
}

try {
  const response = await fetch('./src/cases.json');
  if (!response.ok) throw new Error('Unable to load pinned cases');
  const cases = await response.json();
  for (const id of Object.keys(labels)) {
    const entry = cases.find(item => item.id === id);
    if (!entry) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.caseId = id;
    button.textContent = id + ' · ' + labels[id];
    button.addEventListener('click', () => show(entry));
    get('cases').append(button);
  }
  show(cases.find(entry => entry.id === 'LU-1640'));
} catch {
  get('status').textContent = 'Unable to load replay data';
  get('result-detail').textContent = 'Reload this page or run the replay from the repository.';
}
