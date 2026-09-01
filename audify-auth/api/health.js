export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = [
    'AUDIFY_AUTH_SECRET',
    'AUDIFY_APPLE_SERVICE_ID',
    'AUDIFY_APPLE_REDIRECT_URI',
    'AUDIFY_APPLE_TEAM_ID',
    'AUDIFY_APPLE_KEY_ID',
    'AUDIFY_APPLE_PRIVATE_KEY'
  ].every((name) => Boolean((process.env[name] || '').trim()));
  return res.status(200).json({ ok: true, service: 'audify-auth', appleConfigured: configured });
}
