// This evaluator intentionally implements only the positive glob subset in the pinned cases.
function patternRegex(pattern) {
  if (typeof pattern !== 'string' || !/^[a-z0-9._*/-]+$/i.test(pattern)
      || pattern.split('/').some(part => !part || part === '.' || part === '..'
        || (part.includes('**') && part !== '**'))) {
    throw new Error('Unsupported path pattern');
  }

  const segments = pattern.split('/');
  const expression = segments.map((part, i) => {
    if (part === '**') return i === segments.length - 1 ? '.*' : '(?:[^/]+/)*';
    return part.replaceAll('.', '\\.').replaceAll('*', '[^/]*')
      + (i === segments.length - 1 ? '' : '/');
  }).join('');
  return new RegExp('^' + expression + '$');
}

export function diagnose(entry) {
  const unknown = {status: 'INSUFFICIENT_EVIDENCE', caseId: entry?.id ?? 'unknown'};
  if (!entry || entry.event !== 'pull_request' || !/^[a-f0-9]{40}$/.test(entry.base)
      || !/^[\w.-]+\/[\w.-]+$/.test(entry.repo) || !Number.isInteger(entry.pull)
      || !Number.isInteger(entry.policyIssue) || !entry.check || entry.workflow !== '.github/workflows/ci.yml'
      || !Array.isArray(entry.files) || !entry.files.length || entry.files.length >= 300
      || entry.files.some(file => typeof file !== 'string' || !file || /[\r\n]/.test(file))
      || !Array.isArray(entry.patterns) || !entry.patterns.length) return unknown;

  let filters;
  try {
    filters = entry.patterns.map(patternRegex);
  } catch {
    return unknown;
  }

  const matches = entry.files.filter(file => filters.some(filter => filter.test(file)));
  const source = 'https://github.com/' + entry.repo;
  return {
    status: matches.length ? 'PATH_MATCHED' : 'FILTERED_OUT',
    caseId: entry.id,
    check: entry.check,
    base: entry.base,
    files: entry.files,
    patterns: entry.patterns,
    matches,
    sources: {
      pull: source + '/pull/' + entry.pull + '/files',
      workflow: source + '/blob/' + entry.base + '/' + entry.workflow,
      policy: source + '/issues/' + entry.policyIssue,
    },
  };
}

export function formatDiagnosis(result) {
  if (result.status === 'INSUFFICIENT_EVIDENCE') {
    return '**INSUFFICIENT_EVIDENCE** · No supported, pinned case found. Try LU-1640, LU-1642 or LU-1638.';
  }
  const summary = result.status === 'FILTERED_OUT'
    ? 'The historical path filter excluded this change. A required job in this workflow could never report for that event.'
    : 'The historical path filter allows this change. Actual check execution needs separate evidence.';
  const files = (result.matches.length ? result.matches : result.files)
    .map(file => '- `' + file.replaceAll('`', '\\`') + '`').join('\n');
  return [
    '**' + result.caseId + ' · ' + result.status + '**',
    '**' + result.matches.length + ' of ' + result.files.length + '** changed paths matched · **' + result.check + '**',
    summary,
    files,
    '[Changed files](' + result.sources.pull + ') · [Pinned workflow](' + result.sources.workflow
      + ') · [Reported required check](' + result.sources.policy + ')',
    result.status === 'FILTERED_OUT'
      ? 'To record a hold, reply with `hold ' + result.caseId + '`. Use `investigate ' + result.caseId + '` to request more evidence.'
      : 'Historical replay · this result does not grant merge approval.',
  ].join('\n\n');
}
