import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function required(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function privateKeyPem() {
  return required('AUDIFY_APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
}

export function appleConfig() {
  return {
    serviceId: required('AUDIFY_APPLE_SERVICE_ID'),
    redirectUri: required('AUDIFY_APPLE_REDIRECT_URI'),
    teamId: required('AUDIFY_APPLE_TEAM_ID'),
    keyId: required('AUDIFY_APPLE_KEY_ID')
  };
}

export async function createAppleClientSecret() {
  const { serviceId, teamId, keyId } = appleConfig();
  const key = await importPKCS8(privateKeyPem(), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(serviceId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

export async function exchangeAppleCode(code) {
  const { serviceId, redirectUri } = appleConfig();
  const clientSecret = await createAppleClientSecret();
  const body = new URLSearchParams({
    client_id: serviceId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });
  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.id_token) {
    throw new Error(`Apple token exchange failed (${json.error || response.status})`);
  }
  return json;
}

export async function verifyAppleIdentityToken(idToken, expectedNonce) {
  const { serviceId } = appleConfig();
  const { payload } = await jwtVerify(idToken, APPLE_KEYS, {
    issuer: APPLE_ISSUER,
    audience: serviceId
  });
  if (!payload.sub) throw new Error('Apple subject missing');
  if (!payload.email) throw new Error('Apple email missing');
  if (expectedNonce && payload.nonce !== expectedNonce) throw new Error('Apple nonce mismatch');
  return payload;
}

export function parseAppleName(rawUser) {
  if (!rawUser) return '';
  try {
    const user = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
    const first = (user?.name?.firstName || '').trim();
    const last = (user?.name?.lastName || '').trim();
    return `${first} ${last}`.trim();
  } catch {
    return '';
  }
}
