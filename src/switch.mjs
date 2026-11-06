export function switchUrl() {
  const url = new URL(process.env.SWITCH_URL || 'http://127.0.0.1:8000');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SWITCH_URL must be the Switch bridge origin');
  }
  return url;
}

export async function request(url, key, path, body, connectionId) {
  const headers = {Authorization: 'Bearer ' + key};
  if (connectionId) headers['X-Switch-Connection-Id'] = connectionId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(new URL(path, url), {
    headers,
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
  return response.json();
}
