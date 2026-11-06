import {diagnose, formatDiagnosis} from './src/diagnose.mjs';

const get = id => document.getElementById(id);
const labels = {
  'LU-1640': ['Docs-only blocker', 'First incident'],
  'LU-1642': ['Second docs blocker', 'Repeat incident'],
  'LU-1638': ['Code-change control', 'Comparison case'],
};
const sourceLabels = {pull: 'Changed files', workflow: 'Pinned workflow', policy: 'Maintainer report'};
let activeCase;
let result;
let hypothetical = false;

function renderPaths() {
  const filter = get('path-filter').value;
  const matched = new Set(result.matches);
  const rows = result.files.filter(path => filter === 'all' || matched.has(path) === (filter === 'matched'));
  get('paths').replaceChildren(...rows.map(path => {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = path;
    const status = document.createElement('span');
    status.textContent = matched.has(path) ? 'Matched' : 'Excluded';
    status.className = matched.has(path) ? 'matched' : 'excluded';
    item.append(code, status);
    return item;
  }));
  if (!rows.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = filter === 'matched' ? 'No paths matched this trigger.' : 'No paths were excluded.';
    get('paths').append(empty);
  }
}

function showResult(next, isHypothetical) {
  result = next;
  hypothetical = isHypothetical;
  const blocked = next.status === 'FILTERED_OUT';
  get('verdict').dataset.state = blocked ? 'blocked' : 'matched';
  get('case-ref').textContent = (isHypothetical ? 'WHAT-IF / ' : 'ARCHIVE / ') + next.caseId;
  get('result-tag').textContent = blocked ? 'FILTERED OUT' : 'PATH MATCHED';
  get('status').textContent = blocked ? 'Workflow filtered out' : 'Workflow eligible to trigger';
  get('result-detail').textContent = blocked
    ? 'The path filter excluded every changed file. This workflow could not report a check for this event.'
    : 'At least one path matched the trigger. Verify actual check execution separately.';
  get('metric').hidden = false;
  get('score').textContent = next.matches.length + ' / ' + next.files.length;
  get('check').textContent = next.check;
  get('base').textContent = next.base.slice(0, 12);
  get('path-filter').value = 'all';
  get('evidence').hidden = false;
  get('copy').disabled = false;
  get('copy').textContent = '▣ Copy receipt';
  get('reset').disabled = !isHypothetical;
  renderPaths();

  get('rules').replaceChildren(...next.patterns.map(pattern => {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = pattern;
    item.append(code);
    return item;
  }));
  get('sources').replaceChildren(...Object.entries(next.sources).map(([key, url]) => {
    const link = document.createElement('a');
    link.textContent = sourceLabels[key] + ' ↗';
    link.href = url;
    return link;
  }));
}

function select(entry) {
  activeCase = entry;
  for (const button of get('cases').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.caseId === entry.id));
  }
  get('input-paths').value = entry.files.join('\n');
  get('lab-error').textContent = '';
  showResult(diagnose(entry), false);
}

function showView(view) {
  for (const button of document.querySelectorAll('[data-view]')) {
    const selected = button.dataset.view === view;
    button.setAttribute('aria-pressed', String(selected));
    get('view-' + button.dataset.view).hidden = !selected;
  }
}

get('path-filter').addEventListener('change', renderPaths);
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => showView(button.dataset.view));
}
get('lab').addEventListener('submit', event => {
  event.preventDefault();
  const files = [...new Set(get('input-paths').value.split(/\r?\n/).map(path => path.trim()).filter(Boolean))];
  if (files.some(path => path.includes('\\') || path.split('/').some(part => !part || part === '..' || part === '.'))) {
    get('lab-error').textContent = 'Use repository-relative paths with forward slashes.';
    return;
  }
  const evaluated = diagnose({...activeCase, files});
  if (evaluated.status === 'INSUFFICIENT_EVIDENCE') {
    get('lab-error').textContent = 'Enter between 1 and 299 supported file paths.';
    return;
  }
  get('lab-error').textContent = '';
  showResult(evaluated, true);
});
get('reset').addEventListener('click', () => select(activeCase));
get('copy').addEventListener('click', async () => {
  const prefix = hypothetical ? 'What-if evaluation using the archived trigger\n\n' : 'Historical evidence replay\n\n';
  try {
    const diagnosis = formatDiagnosis(result);
    const receipt = hypothetical ? diagnosis.split('\n\n').slice(0, -1).join('\n\n') : diagnosis;
    await navigator.clipboard.writeText(prefix + receipt);
    get('copy').textContent = '✓ Copied';
    get('copy-status').textContent = 'Receipt copied.';
  } catch {
    get('copy').textContent = 'Copy unavailable';
    get('copy-status').textContent = 'Clipboard access unavailable.';
  }
});

try {
  const response = await fetch('./src/cases.json');
  if (!response.ok) throw new Error('Unable to load archived cases');
  const entries = await response.json();
  for (const [id, [label, note]] of Object.entries(labels)) {
    const entry = entries.find(item => item.id === id);
    if (!entry || diagnose(entry).status === 'INSUFFICIENT_EVIDENCE') continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.caseId = id;
    const meta = document.createElement('span');
    meta.className = 'case-meta';
    meta.textContent = '#' + entry.pull + ' / ' + note;
    const title = document.createElement('strong');
    title.textContent = label;
    const arrow = document.createElement('span');
    arrow.className = 'case-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(meta, title, arrow);
    button.addEventListener('click', () => select(entry));
    get('cases').append(button);
    if (!activeCase) select(entry);
    else button.setAttribute('aria-pressed', 'false');
  }
  if (!activeCase) throw new Error('No supported cases');
} catch {
  get('case-ref').textContent = 'REPLAY UNAVAILABLE';
  get('result-tag').textContent = 'UNAVAILABLE';
  get('status').textContent = 'Unable to load the archived cases';
  get('result-detail').textContent = 'Reload this page or run the replay from the repository.';
}
