export async function hash(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ballvsball:' + s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
