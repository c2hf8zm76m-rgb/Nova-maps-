import { appleConfig } from '../../lib/apple.js';
import { createAppleState, allowedReturnUri } from '../../lib/security.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Method not allowed' });
  try {
    const appState = String(req.query?.state || '').trim();
    const returnUri = String(req.query?.return_uri || '').trim();
    if (!appState || !allowedReturnUri(returnUri)) return res.status(400).json({ ok: false, message: 'Invalid Audify request' });

    const { serviceId, redirectUri } = appleConfig();
    const nonce = crypto.randomUUID();
    const state = await createAppleState({ appState, returnUri, nonce });
    const url = new URL('https://appleid.apple.com/auth/authorize');
    url.searchParams.set('client_id', serviceId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code id_token');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('scope', 'name email');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return res.redirect(302, url.toString());
  } catch (error) {
    return res.status(503).json({ ok: false, message: error?.message || 'Apple auth is not configured' });
  }
}
