import { readAppleTicket } from '../../lib/security.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });
  try {
    const ticket = String(req.body?.ticket || '').trim();
    const state = String(req.body?.state || '').trim();
    if (!ticket || !state) return res.status(400).json({ ok: false, message: 'Missing ticket or state' });
    const payload = await readAppleTicket(ticket);
    if (payload.appState !== state) return res.status(403).json({ ok: false, message: 'State mismatch' });
    return res.status(200).json({
      ok: true,
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      sub: String(payload.sub || '')
    });
  } catch (error) {
    return res.status(401).json({ ok: false, message: error?.message || 'Invalid or expired Apple ticket' });
  }
}
