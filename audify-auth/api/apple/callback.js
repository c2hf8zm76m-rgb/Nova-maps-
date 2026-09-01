import { exchangeAppleCode, parseAppleName, verifyAppleIdentityToken } from '../../lib/apple.js';
import { createAppleTicket, readAppleState } from '../../lib/security.js';

function value(body, key) {
  const v = body?.[key];
  return Array.isArray(v) ? String(v[0] || '') : String(v || '');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const error = value(req.body, 'error');
    const stateToken = value(req.body, 'state');
    if (!stateToken) throw new Error('Missing Apple state');
    const state = await readAppleState(stateToken);
    const fallback = `${state.returnUri}?state=${encodeURIComponent(state.appState)}`;
    if (error) return res.redirect(302, `${fallback}&error=${encodeURIComponent(error)}`);

    const code = value(req.body, 'code');
    if (!code) throw new Error('Missing Apple authorization code');
    const tokens = await exchangeAppleCode(code);
    const profile = await verifyAppleIdentityToken(tokens.id_token, state.nonce);
    const name = parseAppleName(value(req.body, 'user'));
    const ticket = await createAppleTicket({
      email: String(profile.email || ''),
      name,
      sub: String(profile.sub || ''),
      appState: String(state.appState)
    });
    const target = `${state.returnUri}?ticket=${encodeURIComponent(ticket)}&state=${encodeURIComponent(state.appState)}`;
    return res.redirect(302, target);
  } catch (error) {
    return res.status(400).send(`Audify Apple authentication failed: ${error?.message || 'Unknown error'}`);
  }
}
